from __future__ import annotations

import asyncio
import json
import logging

from aiogram import Bot
from aiogram.exceptions import TelegramForbiddenError, TelegramBadRequest
from redis.asyncio import Redis

from bot.formatters import messages as msg
from bot.keyboards import common as kb

logger = logging.getLogger(__name__)


class NotificationWorker:
    def __init__(self, bot: Bot, redis: Redis, queue_key: str) -> None:
        self.bot = bot
        self.redis = redis
        self.queue_key = queue_key
        self._stop = asyncio.Event()

    def stop(self) -> None:
        self._stop.set()

    async def run(self) -> None:
        logger.info("notification_worker_started queue=%s", self.queue_key)
        while not self._stop.is_set():
            try:
                item = await self.redis.blpop(self.queue_key, timeout=5)
            except Exception as exc:  # noqa: BLE001
                logger.warning("notification_redis_unavailable: %s (retry in 5s)", exc)
                await asyncio.sleep(5)
                continue
            if not item:
                continue
            _, raw = item
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("notification_bad_json")
                continue
            await self._handle(event)

    async def _handle(self, event: dict) -> None:
        event_id = event.get("event_id")
        sent_key = f"emakon:notify:sent:{event_id}"
        try:
            if not await self.redis.set(sent_key, "1", nx=True, ex=7 * 24 * 3600):
                logger.info("notification_already_sent event_id=%s", event_id)
                return
        except Exception:  # noqa: BLE001
            logger.exception("notification_dedupe_failed")

        telegram_id = event.get("telegram_id")
        if not telegram_id:
            return

        event_type = event.get("event_type")
        payload = event.get("payload") or {}
        text, markup = self._format(event_type, payload)
        if not text:
            return

        try:
            await self.bot.send_message(
                chat_id=int(telegram_id),
                text=text,
                reply_markup=markup,
            )
        except TelegramForbiddenError:
            logger.warning("telegram_blocked user=%s", telegram_id)
            # permanent skip — leave sent_key so we don't retry forever
        except TelegramBadRequest:
            logger.warning("telegram_bad_request user=%s", telegram_id)
        except Exception:  # noqa: BLE001
            logger.exception("telegram_send_failed")
            try:
                await self.redis.delete(sent_key)
                await self.redis.rpush(self.queue_key, json.dumps(event, ensure_ascii=False))
            except Exception:  # noqa: BLE001
                logger.exception("notification_requeue_failed")
            await asyncio.sleep(1)

    def _format(self, event_type: str | None, payload: dict):
        if event_type == "order.created":
            return msg.notify_order_created(payload), kb.view_order_keyboard(
                int(payload.get("order_id") or 0)
            )
        if event_type == "order.status_changed":
            return msg.notify_status_changed(payload), kb.view_order_keyboard(
                int(payload.get("order_id") or 0)
            )
        if event_type == "order.cancelled":
            return msg.notify_cancelled(payload), kb.view_order_keyboard(
                int(payload.get("order_id") or 0)
            )
        if event_type == "support.reply":
            return msg.notify_support_reply(payload), kb.view_support_keyboard(
                int(payload.get("ticket_id") or 0)
            )
        return None, None
