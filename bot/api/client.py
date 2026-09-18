from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx

from bot.config import get_settings

logger = logging.getLogger(__name__)


class APIError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str = "error",
        errors: Any = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.errors = errors


class EMakonAPIClient:
    """Async HTTP client for E-Makon DRF API. No Django ORM."""

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.api_base_url
        self.bot_service_key = settings.bot_service_key
        self.timeout = settings.http_timeout
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers={"User-Agent": "e-makon-telegram-bot/1.0"},
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    def _headers(
        self,
        *,
        access_token: str | None = None,
        idempotency_key: str | None = None,
        bot_auth: bool = False,
        correlation_id: str | None = None,
    ) -> dict[str, str]:
        headers: dict[str, str] = {
            "X-Correlation-ID": correlation_id or str(uuid.uuid4()),
        }
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        if bot_auth and self.bot_service_key:
            headers["X-Bot-Service-Key"] = self.bot_service_key
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        return headers

    def _parse_error(self, response: httpx.Response) -> APIError:
        message = "Xatolik yuz berdi."
        code = "error"
        errors = None
        try:
            data = response.json()
            message = str(data.get("message") or data.get("detail") or message)
            code = str(data.get("code") or code)
            errors = data.get("errors")
        except Exception:  # noqa: BLE001
            message = response.text[:200] or message
        return APIError(message, status_code=response.status_code, code=code, errors=errors)

    async def request(
        self,
        method: str,
        path: str,
        *,
        access_token: str | None = None,
        json: dict | None = None,
        data: dict | None = None,
        files: list | None = None,
        idempotency_key: str | None = None,
        bot_auth: bool = False,
        correlation_id: str | None = None,
        refresh_token: str | None = None,
        on_refreshed=None,
    ) -> Any:
        headers = self._headers(
            access_token=access_token,
            idempotency_key=idempotency_key,
            bot_auth=bot_auth,
            correlation_id=correlation_id,
        )
        try:
            response = await self._client.request(
                method, path, headers=headers, json=json, data=data, files=files
            )
        except httpx.RequestError as exc:
            logger.error("api_unreachable path=%s err=%s", path, exc)
            raise APIError(
                "Xizmat vaqtincha ishlamayapti. API server ishlayotganini tekshiring.",
                status_code=503,
                code="api_unreachable",
            ) from exc

        if response.status_code == 401 and refresh_token and on_refreshed:
            try:
                new_access = await self.refresh(refresh_token)
            except httpx.RequestError as exc:
                raise APIError(
                    "Xizmat vaqtincha ishlamayapti. API server ishlayotganini tekshiring.",
                    status_code=503,
                    code="api_unreachable",
                ) from exc
            if on_refreshed:
                await on_refreshed(new_access)
            headers = self._headers(
                access_token=new_access,
                idempotency_key=idempotency_key,
                bot_auth=bot_auth,
                correlation_id=correlation_id,
            )
            try:
                response = await self._client.request(
                    method, path, headers=headers, json=json, data=data, files=files
                )
            except httpx.RequestError as exc:
                raise APIError(
                    "Xizmat vaqtincha ishlamayapti. API server ishlayotganini tekshiring.",
                    status_code=503,
                    code="api_unreachable",
                ) from exc

        if response.status_code >= 400:
            logger.warning(
                "api_error status=%s path=%s correlation=%s",
                response.status_code,
                path,
                headers.get("X-Correlation-ID"),
            )
            raise self._parse_error(response)

        if response.status_code == 204 or not response.content:
            return None
        payload = response.json()
        if isinstance(payload, dict) and "data" in payload and "success" in payload:
            return payload["data"]
        return payload

    async def otp_request(self, phone: str) -> dict:
        return await self.request("POST", "/auth/otp/request/", json={"phone": phone})

    async def otp_verify(self, phone: str, code: str, full_name: str = "") -> dict:
        body: dict[str, str] = {"phone": phone, "code": code}
        if full_name:
            body["full_name"] = full_name
        return await self.request("POST", "/auth/otp/verify/", json=body)

    async def refresh(self, refresh_token: str) -> str:
        data = await self.request(
            "POST", "/auth/token/refresh/", json={"refresh": refresh_token}
        )
        return data["access"]

    async def telegram_link(
        self, *, access_token: str, telegram_id: int, telegram_username: str = ""
    ) -> dict:
        return await self.request(
            "POST",
            "/auth/telegram/link/",
            access_token=access_token,
            bot_auth=True,
            json={
                "telegram_id": telegram_id,
                "telegram_username": telegram_username or "",
            },
        )

    async def me(self, access_token: str, **kwargs) -> dict:
        return await self.request("GET", "/auth/me/", access_token=access_token, **kwargs)

    async def patch_me(self, access_token: str, payload: dict, **kwargs) -> dict:
        return await self.request(
            "PATCH", "/auth/me/", access_token=access_token, json=payload, **kwargs
        )

    async def list_services(self, **kwargs) -> list:
        data = await self.request("GET", "/services/", **kwargs)
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data if isinstance(data, list) else []

    async def get_service(self, slug: str, **kwargs) -> dict:
        return await self.request("GET", f"/services/{slug}/", **kwargs)

    async def create_order(
        self,
        *,
        access_token: str,
        fields: dict,
        media_files: list[tuple[str, bytes, str]] | None,
        idempotency_key: str,
        **kwargs,
    ) -> dict:
        files = []
        data = {k: str(v) for k, v in fields.items() if v is not None and v != ""}
        for idx, (filename, content, content_type) in enumerate(media_files or []):
            files.append(("media", (filename, content, content_type)))
        return await self.request(
            "POST",
            "/orders/",
            access_token=access_token,
            data=data,
            files=files or None,
            idempotency_key=idempotency_key,
            **kwargs,
        )

    async def list_orders(self, access_token: str, **kwargs) -> list:
        data = await self.request("GET", "/orders/", access_token=access_token, **kwargs)
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data if isinstance(data, list) else []

    async def get_order(self, access_token: str, order_id: int, **kwargs) -> dict:
        return await self.request(
            "GET", f"/orders/{order_id}/", access_token=access_token, **kwargs
        )

    async def cancel_order(self, access_token: str, order_id: int, **kwargs) -> dict:
        return await self.request(
            "POST", f"/orders/{order_id}/cancel/", access_token=access_token, **kwargs
        )

    async def list_support(self, access_token: str, **kwargs) -> list:
        data = await self.request("GET", "/support/", access_token=access_token, **kwargs)
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data if isinstance(data, list) else []

    async def get_support(self, access_token: str, ticket_id: int, **kwargs) -> dict:
        return await self.request(
            "GET", f"/support/{ticket_id}/", access_token=access_token, **kwargs
        )

    async def create_support(
        self, access_token: str, subject: str, body: str, order_id: int | None = None, **kwargs
    ) -> dict:
        payload: dict[str, Any] = {"subject": subject, "body": body}
        if order_id:
            payload["order"] = order_id
        return await self.request(
            "POST", "/support/", access_token=access_token, json=payload, **kwargs
        )

    async def reply_support(
        self, access_token: str, ticket_id: int, body: str, **kwargs
    ) -> dict:
        return await self.request(
            "POST",
            f"/support/{ticket_id}/reply/",
            access_token=access_token,
            json={"body": body},
            **kwargs,
        )
