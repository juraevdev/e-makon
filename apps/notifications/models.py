from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class UserNotification(TimeStampedModel):
    """In-app inbox shown in the mobile "Xabarlar" screen."""

    class Kind(models.TextChoices):
        ORDER = "order", "Buyurtma"
        CHAT = "chat", "Yozishma"
        CARE = "care", "Parvarish"
        SYSTEM = "system", "Tizim"
        OFFER = "offer", "Taklif"
        BONUS = "bonus", "Bonus"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="inbox",
    )
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.SYSTEM)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    entity_type = models.CharField(max_length=32, blank=True)
    entity_id = models.PositiveIntegerField(null=True, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "is_read", "created_at"])]


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
