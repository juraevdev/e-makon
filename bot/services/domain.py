from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from bot.api.client import APIError, EMakonAPIClient
from bot.intake.config import get_intake_fields
from bot.storage.sessions import BotSession, SessionStore

logger = logging.getLogger(__name__)

_PHONE_RE = re.compile(r"[^\d+]")


def normalize_phone(value: str) -> str:
    raw = (value or "").strip()
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("998") and len(digits) == 12:
        return f"+{digits}"
    if len(digits) == 9:
        return f"+998{digits}"
    if raw.startswith("+") and digits:
        return f"+{digits}"
    if digits:
        return f"+{digits}"
    return raw


class AuthService:
    def __init__(self, api: EMakonAPIClient, sessions: SessionStore) -> None:
        self.api = api
        self.sessions = sessions

    def get_session(self, telegram_id: int) -> BotSession | None:
        try:
            return self.sessions.get(telegram_id)
        except ValueError:
            self.sessions.delete(telegram_id)
            return None

    async def request_otp(self, phone: str) -> dict:
        data = await self.api.otp_request(normalize_phone(phone))
        # Dev: API may return debug_code when SMS is not configured
        debug = data.get("debug_code") if isinstance(data, dict) else None
        if debug:
            logger.warning(
                "========== OTP (BOT LOG) ==========\n"
                "Telefon: %s\n"
                "Kod:     %s\n"
                "===================================",
                phone,
                debug,
            )
        return data

    async def verify_and_link(
        self,
        *,
        phone: str,
        code: str,
        telegram_id: int,
        telegram_username: str = "",
        full_name: str = "",
    ) -> BotSession:
        data = await self.api.otp_verify(normalize_phone(phone), code, full_name=full_name)
        access = data["access"]
        refresh = data["refresh"]
        user = data["user"]
        try:
            await self.api.telegram_link(
                access_token=access,
                telegram_id=telegram_id,
                telegram_username=telegram_username,
            )
        except APIError as exc:
            if exc.status_code == 403:
                raise APIError(
                    "Telegram bog'lash rad etildi. EMAKON_BOT_SERVICE_KEY API va botda bir xil ekanini tekshiring.",
                    status_code=403,
                    code="telegram_link_forbidden",
                ) from exc
            raise
        self.sessions.save(
            telegram_id=telegram_id,
            user_id=user["id"],
            refresh_token=refresh,
            access_token=access,
            phone=user.get("phone") or normalize_phone(phone),
        )
        session = self.sessions.get(telegram_id)
        assert session is not None
        return session

    async def with_access(self, session: BotSession):
        async def on_refreshed(new_access: str) -> None:
            self.sessions.update_access(session.telegram_id, new_access)
            session.access_token = new_access

        return session.access_token, session.refresh_token, on_refreshed


class CatalogService:
    def __init__(self, api: EMakonAPIClient) -> None:
        self.api = api
        self._list_cache: list[dict] | None = None
        self._list_cache_at: float = 0.0
        self._detail_cache: dict[str, tuple[float, dict]] = {}

    async def list_services(self) -> list[dict]:
        import time

        now = time.monotonic()
        if self._list_cache is not None and (now - self._list_cache_at) < 60:
            return self._list_cache
        items = await self.api.list_services()
        self._list_cache = items
        self._list_cache_at = now
        return items

    async def get_service(self, slug: str) -> dict:
        import time

        now = time.monotonic()
        cached = self._detail_cache.get(slug)
        if cached and (now - cached[0]) < 60:
            return cached[1]
        data = await self.api.get_service(slug)
        self._detail_cache[slug] = (now, data)
        return data


class OrderFlowService:
    def __init__(self, api: EMakonAPIClient, sessions: SessionStore) -> None:
        self.api = api
        self.sessions = sessions
        self.auth = AuthService(api, sessions)

    def intake_for(self, slug: str):
        return get_intake_fields(slug)

    async def submit(
        self,
        *,
        session: BotSession,
        service_id: int,
        fields: dict[str, Any],
        media: list[tuple[str, bytes, str]],
        idempotency_key: str | None = None,
    ) -> dict:
        access, refresh, on_refreshed = await self.auth.with_access(session)
        key = idempotency_key or str(uuid.uuid4())
        return await self.api.create_order(
            access_token=access,
            fields={
                "service_id": service_id,
                "phone_number": fields.get("phone_number") or session.phone,
                "area_size": fields.get("area_size") or "",
                "address": fields.get("address") or "",
                "notes": fields.get("notes") or "",
                "plant_category": fields.get("plant_category") or "",
            },
            media_files=media,
            idempotency_key=key,
            refresh_token=refresh,
            on_refreshed=on_refreshed,
        )

    async def list_orders(self, session: BotSession) -> list[dict]:
        access, refresh, on_refreshed = await self.auth.with_access(session)
        return await self.api.list_orders(
            access, refresh_token=refresh, on_refreshed=on_refreshed
        )

    async def get_order(self, session: BotSession, order_id: int) -> dict:
        access, refresh, on_refreshed = await self.auth.with_access(session)
        return await self.api.get_order(
            access, order_id, refresh_token=refresh, on_refreshed=on_refreshed
        )

    async def cancel(self, session: BotSession, order_id: int) -> dict:
        access, refresh, on_refreshed = await self.auth.with_access(session)
        return await self.api.cancel_order(
            access, order_id, refresh_token=refresh, on_refreshed=on_refreshed
        )


class SupportService:
    def __init__(self, api: EMakonAPIClient, sessions: SessionStore) -> None:
        self.api = api
        self.auth = AuthService(api, sessions)

    async def list_tickets(self, session: BotSession) -> list[dict]:
        access, refresh, on_refreshed = await self.auth.with_access(session)
        return await self.api.list_support(
            access, refresh_token=refresh, on_refreshed=on_refreshed
        )

    async def get_ticket(self, session: BotSession, ticket_id: int) -> dict:
        access, refresh, on_refreshed = await self.auth.with_access(session)
        ticket = await self.api.get_support(
            access, ticket_id, refresh_token=refresh, on_refreshed=on_refreshed
        )
        # Defense in depth: never render internal messages if leaked.
        messages = ticket.get("messages") or []
        ticket["messages"] = [
            m for m in messages if not m.get("is_internal")
        ]
        return ticket

    async def create(self, session: BotSession, subject: str, body: str) -> dict:
        access, refresh, on_refreshed = await self.auth.with_access(session)
        return await self.api.create_support(
            access, subject, body, refresh_token=refresh, on_refreshed=on_refreshed
        )

    async def reply(self, session: BotSession, ticket_id: int, body: str) -> dict:
        access, refresh, on_refreshed = await self.auth.with_access(session)
        return await self.api.reply_support(
            access, ticket_id, body, refresh_token=refresh, on_refreshed=on_refreshed
        )


class ProfileService:
    def __init__(self, api: EMakonAPIClient, sessions: SessionStore) -> None:
        self.api = api
        self.auth = AuthService(api, sessions)

    async def get(self, session: BotSession) -> dict:
        access, refresh, on_refreshed = await self.auth.with_access(session)
        return await self.api.me(access, refresh_token=refresh, on_refreshed=on_refreshed)

    async def update_address(
        self,
        session: BotSession,
        *,
        home_address: str = "",
        location_lat=None,
        location_lng=None,
    ) -> dict:
        access, refresh, on_refreshed = await self.auth.with_access(session)
        payload: dict[str, Any] = {}
        if home_address:
            payload["home_address"] = home_address
        if location_lat is not None:
            payload["location_lat"] = str(location_lat)
        if location_lng is not None:
            payload["location_lng"] = str(location_lng)
        return await self.api.patch_me(
            access, payload, refresh_token=refresh, on_refreshed=on_refreshed
        )
