from __future__ import annotations

from django.db import models

from apps.core.models import TimeStampedModel


class NotificationDelivery(TimeStampedModel):
    """Minimal delivery log for dedupe / ops (optional consumer writes)."""

    event_id = models.CharField(max_length=128, unique=True, db_index=True)
    event_type = models.CharField(max_length=64)
    user_id = models.PositiveIntegerField()
    telegram_id = models.BigIntegerField(null=True, blank=True)
    entity_type = models.CharField(max_length=32, blank=True)
    entity_id = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        default="queued",
        help_text="queued|sent|failed|skipped",
    )
    detail = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]
