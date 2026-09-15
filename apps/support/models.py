from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.orders.models import Order


class SupportTicket(TimeStampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "Ochiq"
        IN_PROGRESS = "in_progress", "Jarayonda"
        RESOLVED = "resolved", "Yechilgan"
        CLOSED = "closed", "Yopilgan"

    class Priority(models.TextChoices):
        LOW = "low", "Past"
        NORMAL = "normal", "Oddiy"
        HIGH = "high", "Yuqori"

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="support_tickets",
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="support_tickets",
    )
    subject = models.CharField(max_length=255)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN, db_index=True)
    priority = models.CharField(max_length=16, choices=Priority.choices, default=Priority.NORMAL)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tickets",
        limit_choices_to={"role__in": ["admin", "superadmin", "worker"]},
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Ticket #{self.pk}: {self.subject}"


class SupportMessage(TimeStampedModel):
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="support_messages",
    )
    body = models.TextField()
    is_internal = models.BooleanField(
        default=False,
        help_text="Ichki eslatma — mijozga ko'rinmaydi",
    )

    class Meta:
        ordering = ["created_at"]
