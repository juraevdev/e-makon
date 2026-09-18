from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class EmployeeProfile(TimeStampedModel):
    """Xodim profili — mygarden bot `Worker` modeliga mos."""

    class Specialty(models.TextChoices):
        GENERAL = "general", "Umumiy"
        LANDSCAPE = "landscape", "Landshaft"
        GARDEN_CARE = "garden_care", "Bog' parvarishi"
        ORNAMENTAL = "ornamental", "Manzarali o'simliklar"
        IRRIGATION = "irrigation", "Sug'orish"
        PEST_CONTROL = "pest_control", "Dorilash"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="employee_profile",
    )
    firm = models.ForeignKey(
        "staff.PartnerFirm",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employees",
    )
    specialty = models.CharField(
        max_length=32,
        choices=Specialty.choices,
        default=Specialty.GENERAL,
    )
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["user__full_name", "id"]
        verbose_name = "Xodim"
        verbose_name_plural = "Xodimlar"

    def __str__(self) -> str:
        return self.user.full_name or self.user.phone


class AdminProfile(TimeStampedModel):
    """Admin panel foydalanuvchisi (superadmin boshqaruvi)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="admin_profile",
    )
    title = models.CharField(max_length=128, blank=True, default="Admin")
    can_manage_staff = models.BooleanField(default=True)
    can_manage_orders = models.BooleanField(default=True)
    can_view_analytics = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Admin"
        verbose_name_plural = "Adminlar"

    def __str__(self) -> str:
        return self.user.full_name or self.user.phone


class PartnerFirm(TimeStampedModel):
    """Xizmat ko'rsatuvchi firma — buyurtmalar shu firmaga biriktiriladi."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Faol"
        PENDING = "pending", "Kutilmoqda"
        SUSPENDED = "suspended", "To'xtatilgan"
        ENDED = "ended", "Kelishuv tugagan"

    name = models.CharField(max_length=255)
    legal_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=512, blank=True)
    region = models.CharField(max_length=120, blank=True)
    district = models.CharField(max_length=120, blank=True)
    specialty = models.CharField(
        max_length=32,
        choices=EmployeeProfile.Specialty.choices,
        default=EmployeeProfile.Specialty.GENERAL,
    )
    description = models.TextField(blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    ratings_count = models.PositiveIntegerField(default=0)
    # Kampaniya ulushi: firma aylanmasining 0.1% … 3%
    commission_rate = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        default=0.3,
        help_text="Foiz (0.1 — 3.0). Ogohlantirishlardan keyin oshirilishi mumkin.",
    )

    class SubscriptionPlan(models.TextChoices):
        NONE = "none", "Obuna yo'q"
        MONTHLY = "monthly", "Oylik ($9 / o'rin)"
        YEARLY = "yearly", "Yillik ($90 / o'rin)"

    subscription_plan = models.CharField(
        max_length=16,
        choices=SubscriptionPlan.choices,
        default=SubscriptionPlan.NONE,
    )
    subscription_units = models.PositiveIntegerField(
        default=1,
        help_text="Obuna o'rinlari soni. Oylik $9, yillik $90 (12×$9=$108).",
    )
    # Kampaniyaga qarzdorlik (to'lanmagan ulush + jarima + obuna)
    debt_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    debt_currency = models.CharField(max_length=8, default="UZS")
    warnings_count = models.PositiveIntegerField(default=0)
    sales_banned_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Shu sanagacha yangi buyurtma qabul qilish taqiqlanadi.",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    exit_reason = models.CharField(max_length=512, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    trial_ends_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Sinov muddati tugash sanasi. Bo'sh bo'lsa doimiy hamkorlik.",
    )
    location_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    location_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_firms",
        limit_choices_to={"role": "worker"},
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "Firma"
        verbose_name_plural = "Firmalar"

    def __str__(self) -> str:
        return self.name

    @property
    def is_sales_banned(self) -> bool:
        if not self.sales_banned_until:
            return False
        from django.utils import timezone

        return timezone.now() < self.sales_banned_until

    def subscription_fee_usd(self) -> Decimal:
        from apps.staff.commission import subscription_fee_usd as fee_fn

        return fee_fn(self.subscription_plan, self.subscription_units)

    def recalculate_rating(self) -> None:
        from django.db.models import Avg, Count

        agg = self.reviews.aggregate(avg=Avg("score"), cnt=Count("id"))
        self.rating = Decimal(str(agg["avg"] or 0)).quantize(Decimal("0.01"))
        self.ratings_count = int(agg["cnt"] or 0)
        self.save(update_fields=["rating", "ratings_count", "updated_at"])


class FirmReview(TimeStampedModel):
    """Mijoz firma xizmatini baholaydi — reyting shu asosida shakllanadi."""

    firm = models.ForeignKey(PartnerFirm, on_delete=models.CASCADE, related_name="reviews")
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
        limit_choices_to={"role": "customer"},
    )
    score = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["firm", "customer", "order"],
                name="uniq_firm_customer_order_review",
            )
        ]

    def __str__(self) -> str:
        return f"{self.firm_id} ★{self.score}"


class FirmMessage(TimeStampedModel):
    """Superadmin ↔ firma xabarlari / ogohlantirishlar."""

    class Kind(models.TextChoices):
        MESSAGE = "message", "Xabar"
        WARNING = "warning", "Ogohlantirish"
        REPORT = "report", "Hisobot"

    firm = models.ForeignKey(PartnerFirm, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="firm_messages_sent",
    )
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.MESSAGE)
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField()
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.kind}: {self.firm_id}"


class FirmFine(TimeStampedModel):
    """Firma jarimasi — kampaniya qarzi sifatida hisoblanadi."""

    firm = models.ForeignKey(PartnerFirm, on_delete=models.CASCADE, related_name="fines")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=8, default="UZS")
    reason = models.CharField(max_length=512)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="firm_fines_created",
    )
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Fine {self.amount} → {self.firm_id}"


class FirmModerationLog(TimeStampedModel):
    """Blok, savdo taqiqi, jarima, ogohlantirish tarixi."""

    class Action(models.TextChoices):
        WARNING = "warning", "Ogohlantirish"
        FINE = "fine", "Jarima"
        SALES_BAN = "sales_ban", "Savdo taqiqi"
        SALES_UNBAN = "sales_unban", "Savdo ochildi"
        BLOCK = "block", "Blok"
        UNBLOCK = "unblock", "Blokdan chiqarish"
        RATE_HIKE = "rate_hike", "Foiz oshirildi"
        MESSAGE = "message", "Xabar"

    firm = models.ForeignKey(PartnerFirm, on_delete=models.CASCADE, related_name="moderation_logs")
    action = models.CharField(max_length=16, choices=Action.choices)
    note = models.TextField(blank=True)
    meta = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="firm_moderation_actions",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.action} #{self.firm_id}"


class Investor(TimeStampedModel):
    """Investor hamkor — platformaga kapital/ulush kiritadigan tomon."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Faol"
        PENDING = "pending", "Kutilmoqda"
        ENDED = "ended", "Tugatilgan"

    full_name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=512, blank=True)
    investment_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="UZS")
    share_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    notes = models.TextField(blank=True)
    exit_reason = models.CharField(max_length=512, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Investor"
        verbose_name_plural = "Investorlar"

    def __str__(self) -> str:
        return self.full_name or self.company_name
