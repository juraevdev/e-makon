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
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="support_tickets",
        null=True,
        blank=True,
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


class ChatRoom(TimeStampedModel):
    """Har bir mijoz va firma uchun alohida suhbat xonasi."""

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="chat_rooms",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_rooms",
    )
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_message_preview = models.CharField(max_length=255, blank=True)
    customer_unread = models.PositiveIntegerField(default=0)
    firm_unread = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-last_message_at", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "customer"], name="uniq_chat_room_firm_customer"
            )
        ]

    def __str__(self) -> str:
        return f"Chat #{self.pk} firm={self.organization_id} customer={self.customer_id}"


class ChatMessage(TimeStampedModel):
    class SenderRole(models.TextChoices):
        CUSTOMER = "customer", "Mijoz"
        FIRM = "firm", "Firma"
        PLATFORM = "platform", "E-Makon"

    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="chat_messages",
    )
    sender_role = models.CharField(max_length=16, choices=SenderRole.choices)
    body = models.TextField()
    order = models.ForeignKey(
        Order,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_messages",
    )

    class Meta:
        ordering = ["created_at", "id"]


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
