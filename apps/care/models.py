from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.orders.models import Order


class CareContract(TimeStampedModel):
    """Uzoq muddatli parvarish shartnomasi: uy xo'jaligi yoki tashkilot bilan, E-Makon vositachiligida."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Qoralama"
        PENDING = "pending", "Tizim tasdig'ida"
        ACTIVE = "active", "Faol"
        PAUSED = "paused", "To'xtatilgan"
        COMPLETED = "completed", "Tugagan"
        CANCELLED = "cancelled", "Bekor"
        REJECTED = "rejected", "Rad etilgan"

    class ClientType(models.TextChoices):
        HOUSEHOLD = "household", "Uy xo'jaligi"
        ORGANIZATION = "organization", "Tashkilot / markaz"

    class Frequency(models.TextChoices):
        WEEKLY = "weekly", "Haftalik"
        BIWEEKLY = "biweekly", "2 haftada bir"
        MONTHLY = "monthly", "Oylik"

    class PaymentTerms(models.TextChoices):
        MONTHLY = "monthly", "Har oy"
        QUARTERLY = "quarterly", "Har chorak"
        UPFRONT = "upfront", "Oldindan to'liq"

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="care_contracts",
        null=True,
        blank=True,
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="care_contracts",
        null=True,
        blank=True,
    )
    order = models.OneToOneField(
        Order,
        on_delete=models.SET_NULL,
        related_name="care_contract",
        null=True,
        blank=True,
    )
    service = models.ForeignKey(
        "catalog.Service",
        on_delete=models.SET_NULL,
        related_name="care_contracts",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255, blank=True)
    client_type = models.CharField(
        max_length=16, choices=ClientType.choices, default=ClientType.HOUSEHOLD
    )
    client_name = models.CharField(max_length=255, blank=True)
    contact_person = models.CharField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=512, blank=True)
    location_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    location_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    area_size = models.CharField(max_length=255, blank=True)

    frequency = models.CharField(max_length=16, choices=Frequency.choices, default=Frequency.WEEKLY)
    preferred_weekdays = models.JSONField(default=list, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    price_per_visit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="UZS")
    payment_terms = models.CharField(
        max_length=16, choices=PaymentTerms.choices, default=PaymentTerms.MONTHLY
    )
    terms = models.TextField(blank=True)

    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True
    )
    platform_note = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="care_contracts_approved",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="care_contracts_created",
        null=True,
        blank=True,
    )
    assigned_workers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="care_contracts_assigned",
        blank=True,
        limit_choices_to={"role": "worker"},
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"CareContract #{self.pk}"


class CareVisit(TimeStampedModel):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Rejalashtirilgan"
        REMINDED = "reminded", "Eslatma yuborildi"
        APPROVED = "approved", "Tasdiqlangan"
        POSTPONED = "postponed", "Kechiktirilgan"
        DONE = "done", "Bajarildi"
        NOT_DONE = "not_done", "Bajarilmadi"
        REJECTED = "rejected", "Rad etilgan"
        AWAITING_REPORT = "awaiting_report", "Hisobot kutilmoqda"

    contract = models.ForeignKey(CareContract, on_delete=models.CASCADE, related_name="visits")
    visit_date = models.DateField(db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    planned_worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planned_care_visits",
        limit_choices_to={"role": "worker"},
    )
    assigned_worker_name = models.CharField(max_length=255, blank=True)
    report_notes = models.TextField(blank=True)
    report_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["visit_date", "id"]
        indexes = [
            models.Index(fields=["visit_date", "status"]),
        ]

    def __str__(self) -> str:
        return f"CareVisit #{self.pk} on {self.visit_date}"


class CareContractEvent(TimeStampedModel):
    """Firma va tizim ma'muriyati o'rtasidagi shartnoma bo'yicha yozishma/harakatlar tarixi."""

    contract = models.ForeignKey(CareContract, on_delete=models.CASCADE, related_name="events")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="care_contract_events",
    )
    action = models.CharField(max_length=32)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at", "id"]
