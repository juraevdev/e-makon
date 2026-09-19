from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from django.conf import settings

from apps.notifications.models import NotificationDelivery

logger = logging.getLogger(__name__)


def _redis_client():
    try:
        import redis
    except ImportError:
        return None
    url = getattr(settings, "REDIS_URL", None)
    if not url:
        return None
    try:
        return redis.Redis.from_url(url, decode_responses=True)
    except Exception:  # noqa: BLE001
        logger.exception("redis_connect_failed")
        return None


class NotificationService:
    """Enqueue Telegram notification jobs onto a Redis list (no Celery)."""

    @staticmethod
    def _queue_key() -> str:
        return getattr(settings, "NOTIFICATION_QUEUE_KEY", "emakon:notifications")

    @classmethod
    def _record_delivery(
        cls,
        *,
        event_id: str,
        event_type: str,
        user_id: int,
        telegram_id: int | None,
        entity_type: str,
        entity_id: int,
        status: str,
        detail: str = "",
    ) -> None:
        NotificationDelivery.objects.update_or_create(
            event_id=event_id,
            defaults={
                "event_type": event_type,
                "user_id": user_id,
                "telegram_id": telegram_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "status": status,
                "detail": (detail or "")[:255],
            },
        )

    @classmethod
    def enqueue(
        cls,
        *,
        event_type: str,
        user_id: int,
        telegram_id: int | None,
        entity_type: str,
        entity_id: int,
        payload: dict | None = None,
        delivery_key: str | None = None,
    ) -> bool:
        event_id = delivery_key or str(uuid.uuid4())

        if not telegram_id:
            logger.info(
                "notification_skip_no_telegram event=%s user_id=%s",
                event_type,
                user_id,
            )
            cls._record_delivery(
                event_id=event_id,
                event_type=event_type,
                user_id=user_id,
                telegram_id=None,
                entity_type=entity_type,
                entity_id=entity_id,
                status="skipped",
                detail="no_telegram_id",
            )
            return False

        body = {
            "event_id": event_id,
            "event_type": event_type,
            "user_id": user_id,
            "telegram_id": telegram_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload or {},
        }

        client = _redis_client()
        if client is None:
            logger.warning("notification_enqueue_skipped_no_redis event=%s", event_type)
            cls._record_delivery(
                event_id=event_id,
                event_type=event_type,
                user_id=user_id,
                telegram_id=telegram_id,
                entity_type=entity_type,
                entity_id=entity_id,
                status="skipped",
                detail="no_redis",
            )
            return False

        dedupe_key = f"emakon:notify:dedupe:{event_id}"
        try:
            # SET NX EX — skip if already enqueued/delivered recently (7 days)
            if not client.set(dedupe_key, "1", nx=True, ex=7 * 24 * 3600):
                logger.info("notification_deduped event_id=%s", event_id)
                cls._record_delivery(
                    event_id=event_id,
                    event_type=event_type,
                    user_id=user_id,
                    telegram_id=telegram_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    status="skipped",
                    detail="deduped",
                )
                return False
            client.rpush(cls._queue_key(), json.dumps(body, ensure_ascii=False))
            cls._record_delivery(
                event_id=event_id,
                event_type=event_type,
                user_id=user_id,
                telegram_id=telegram_id,
                entity_type=entity_type,
                entity_id=entity_id,
                status="queued",
            )
            return True
        except Exception as exc:  # noqa: BLE001
            logger.exception("notification_enqueue_failed event=%s", event_type)
            cls._record_delivery(
                event_id=event_id,
                event_type=event_type,
                user_id=user_id,
                telegram_id=telegram_id,
                entity_type=entity_type,
                entity_id=entity_id,
                status="failed",
                detail=str(exc),
            )
            return False

    @classmethod
    def enqueue_order_event(
        cls,
        *,
        event_type: str,
        order,
        extra: dict | None = None,
        delivery_key: str | None = None,
    ) -> bool:
        customer = order.customer
        payload = {
            "order_id": order.pk,
            "service_name": getattr(order.service, "name", ""),
            "status": order.status,
            **(extra or {}),
        }
        key = delivery_key or f"{event_type}:order:{order.pk}:{order.status}"
        return cls.enqueue(
            event_type=event_type,
            user_id=customer.pk,
            telegram_id=customer.telegram_id,
            entity_type="order",
            entity_id=order.pk,
            payload=payload,
            delivery_key=key,
        )

    @classmethod
    def enqueue_support_reply(cls, *, ticket, message) -> bool:
        if message.is_internal:
            return False
        customer = ticket.customer
        return cls.enqueue(
            event_type="support.reply",
            user_id=customer.pk,
            telegram_id=customer.telegram_id,
            entity_type="support_ticket",
            entity_id=ticket.pk,
            payload={
                "ticket_id": ticket.pk,
                "subject": ticket.subject,
                "message_id": message.pk,
            },
            delivery_key=f"support.reply:msg:{message.pk}",
        )
