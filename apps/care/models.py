from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.orders.models import Order


class CareContract(TimeStampedModel):
    """1 yillik kafolatli parvarish — mygarden `CareContract`."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Faol"
        COMPLETED = "completed", "Tugagan"
        CANCELLED = "cancelled", "Bekor"

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="care_contracts",
    )
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="care_contract",
    )
    preferred_weekdays = models.JSONField(default=list, blank=True)
    area_size = models.CharField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
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
