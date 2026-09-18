from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.catalog.models import Service
from apps.core.models import TimeStampedModel


class Order(TimeStampedModel):
    """Buyurtma — mobile `OrderStatus` bilan mos."""

    class Status(models.TextChoices):
        NEW = "new", "Yangi"
        IN_REVIEW = "in_review", "Kelishilmoqda"
        CONTACTED = "contacted", "Bog'lanildi"
        COMPLETED = "completed", "Bajarildi"
        CANCELLED = "cancelled", "Bekor qilindi"

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="orders",
        limit_choices_to={"role": "customer"},
    )
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.NEW,
        db_index=True,
    )
    area_size = models.CharField(max_length=255, blank=True)
    plant_category = models.CharField(max_length=255, blank=True)
    address = models.CharField(max_length=512, blank=True)
    notes = models.TextField(blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    customer_first_name = models.CharField(max_length=120, blank=True)
    customer_last_name = models.CharField(max_length=120, blank=True)
    agreed_duration = models.CharField(max_length=255, blank=True)
    quoted_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, default="UZS")

    assigned_worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_orders",
        limit_choices_to={"role": "worker"},
    )
    assigned_worker_name = models.CharField(max_length=255, blank=True)
    firm = models.ForeignKey(
        "staff.PartnerFirm",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    firm_name = models.CharField(max_length=255, blank=True)
    # Buyurtma bajarilganda kampaniya ulushi (quoted_price * firm.commission_rate / 100)
    platform_share = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    commission_rate_applied = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )

    # Telegram bridge fields (optional sync with mygarden bot)
    telegram_group_message_id = models.BigIntegerField(null=True, blank=True)
    external_bot_order_id = models.PositiveIntegerField(null=True, blank=True, unique=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["customer", "status"]),
        ]
        verbose_name = "Buyurtma"
        verbose_name_plural = "Buyurtmalar"

    def __str__(self) -> str:
        return f"Order #{self.pk} — {self.service}"

    @property
    def customer_name(self) -> str:
        parts = [self.customer_first_name.strip(), self.customer_last_name.strip()]
        joined = " ".join(p for p in parts if p)
        if joined:
            return joined
        return self.customer.display_name if self.customer_id else ""


class OrderMedia(TimeStampedModel):
    class Kind(models.TextChoices):
        PHOTO = "photo", "Photo"
        VIDEO = "video", "Video"

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="media")
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.PHOTO)
    file = models.FileField(upload_to="orders/%Y/%m/")
    telegram_file_id = models.CharField(max_length=255, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class OrderStatusHistory(TimeStampedModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="status_history")
    from_status = models.CharField(max_length=16, blank=True)
    to_status = models.CharField(max_length=16)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_status_changes",
    )
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]
