from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel


class Organization(TimeStampedModel):
    """
    Tenant / partner firm on the E-Makon platform.

    Superadmins are platform-scoped (User.organization=NULL).
    Admins, workers, and customers belong to exactly one organization
    once assigned (default org used for existing/single-tenant deploys).
    """

    class Specialty(models.TextChoices):
        GENERAL = "general", "Umumiy"
        LANDSCAPE = "landscape", "Landshaft"
        GARDEN_CARE = "garden_care", "Bog' parvarishi"
        ORNAMENTAL = "ornamental", "Manzarali o'simliklar"
        IRRIGATION = "irrigation", "Sug'orish"
        PEST_CONTROL = "pest_control", "Dorilash"

    class SubscriptionPlan(models.TextChoices):
        NONE = "none", "Yo'q"
        MONTHLY = "monthly", "Oylik"
        YEARLY = "yearly", "Yillik"

    class Status(models.TextChoices):
        ACTIVE = "active", "Faol"
        PENDING = "pending", "Kutilmoqda"
        SUSPENDED = "suspended", "Bloklangan"
        ENDED = "ended", "Tugagan"

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=64, unique=True)
    is_active = models.BooleanField(default=True, db_index=True)
    phone = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=512, blank=True)

    legal_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    region = models.CharField(max_length=120, blank=True)
    district = models.CharField(max_length=120, blank=True)
    specialty = models.CharField(
        max_length=32,
        choices=Specialty.choices,
        default=Specialty.GENERAL,
    )
    description = models.TextField(blank=True)

    rating = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0"))
    ratings_count = models.PositiveIntegerField(default=0)

    commission_rate = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal("0.30"),
        validators=[MinValueValidator(Decimal("0.1")), MaxValueValidator(Decimal("3"))],
        help_text="Platforma ulushi foizda (0.1–3)",
    )

    subscription_plan = models.CharField(
        max_length=16,
        choices=SubscriptionPlan.choices,
        default=SubscriptionPlan.NONE,
    )
    subscription_units = models.PositiveIntegerField(default=1)

    debt_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    debt_currency = models.CharField(max_length=8, default="UZS")

    warnings_count = models.PositiveIntegerField(default=0)
    sales_banned_until = models.DateTimeField(null=True, blank=True)
    unpaid_fines = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    exit_reason = models.TextField(blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)

    location_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    location_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_organizations",
    )

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "Tashkilot"
        verbose_name_plural = "Tashkilotlar"

    def __str__(self) -> str:
        return self.name

    def sync_is_active_from_status(self) -> None:
        self.is_active = self.status == self.Status.ACTIVE

    def save(self, *args, **kwargs):
        self.sync_is_active_from_status()
        super().save(*args, **kwargs)

    @property
    def is_sales_banned(self) -> bool:
        until = self.sales_banned_until
        return bool(until and until > timezone.now())


class FirmReview(TimeStampedModel):
    firm = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="reviews")
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="firm_reviews",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="firm_reviews",
    )
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Firma sharhi"
        verbose_name_plural = "Firma sharhlari"


class FirmMessage(TimeStampedModel):
    class Kind(models.TextChoices):
        MESSAGE = "message", "Xabar"
        WARNING = "warning", "Ogohlantirish"
        REPORT = "report", "Hisobot"

    firm = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="firm_messages_sent",
    )
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.MESSAGE)
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField()
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Firma xabari"
        verbose_name_plural = "Firma xabarlari"


class FirmFine(TimeStampedModel):
    firm = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="fines")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=8, default="UZS")
    reason = models.CharField(max_length=512, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="firm_fines_created",
    )
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Firma jarimasi"
        verbose_name_plural = "Firma jarimalari"


class FirmModerationLog(TimeStampedModel):
    firm = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="moderation_logs")
    action = models.CharField(max_length=64)
    note = models.TextField(blank=True)
    meta = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="firm_moderation_logs",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Firma moderatsiya logi"
        verbose_name_plural = "Firma moderatsiya loglari"


class Investor(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Faol"
        PENDING = "pending", "Kutilmoqda"
        ENDED = "ended", "Tugagan"

    full_name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=512, blank=True)
    investment_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=8, default="UZS")
    share_percent = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    notes = models.TextField(blank=True)
    exit_reason = models.TextField(blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Investor"
        verbose_name_plural = "Investorlar"

    def __str__(self) -> str:
        return self.full_name or self.company_name or f"Investor #{self.pk}"

    def save(self, *args, **kwargs):
        self.is_active = self.status == self.Status.ACTIVE
        super().save(*args, **kwargs)
