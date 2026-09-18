from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel


class OrderEscrow(TimeStampedModel):
    """
    Buyurtma to'lovi — foydalanuvchi E-Makonga to'laydi, pul escrowda saqlanadi.
    Firma ishni yakunlagach platforma ulushini ushlab, qolganini firmaga yuboradi.
    Firmaning ishsiz pul talabi / tovlamachilikda — userga qaytariladi.
    """

    class Status(models.TextChoices):
        AWAITING_PAYMENT = "awaiting_payment", "To'lov kutilmoqda"
        HELD = "held", "E-Makonda ushlab turilgan"
        RELEASED = "released", "Firmaga o'tkazilgan"
        REFUNDED = "refunded", "Userga qaytarilgan"
        DISPUTED = "disputed", "Nizoli"
        FROZEN = "frozen", "Muzlatilgan"

    order = models.OneToOneField(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="escrow",
    )
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.AWAITING_PAYMENT,
        db_index=True,
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=8, default="UZS")
    commission_rate = models.DecimalField(max_digits=3, decimal_places=1, default=Decimal("0.3"))
    platform_fee = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    firm_payout = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    paid_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    disputed_at = models.DateTimeField(null=True, blank=True)

    note = models.TextField(blank=True)
    dispute_reason = models.TextField(blank=True)
    last_action_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="escrow_actions",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Escrow"
        verbose_name_plural = "Escrowlar"

    def __str__(self) -> str:
        return f"Escrow #{self.order_id} {self.status} {self.amount}"

    def recalc_split(self) -> None:
        from apps.staff.commission import calc_platform_share

        self.platform_fee = calc_platform_share(self.amount, self.commission_rate)
        self.firm_payout = (Decimal(str(self.amount)) - Decimal(str(self.platform_fee))).quantize(
            Decimal("0.01")
        )


class LedgerEntry(TimeStampedModel):
    """Avtomatik hisob-kitob yozuvi — barcha pul harakatlari shu yerda."""

    class EntryType(models.TextChoices):
        ESCROW_IN = "escrow_in", "User → E-Makon (escrow)"
        ESCROW_RELEASE = "escrow_release", "E-Makon → Firma"
        ESCROW_REFUND = "escrow_refund", "E-Makon → User (qaytarish)"
        COMMISSION = "commission", "Platforma ulushi"
        FINE = "fine", "Jarima"
        RATE_HIKE = "rate_hike", "Foiz oshirildi"
        SUBSCRIPTION = "subscription", "Obuna"
        DEBT_ADJUST = "debt_adjust", "Qarz tuzatish"
        PUNISH_FIRM = "punish_firm", "Firma jazolandi"
        PUNISH_USER = "punish_user", "User jazolandi"
        DISPUTE = "dispute", "Nizo"
        ADJUSTMENT = "adjustment", "Tuzatish"

    class Account(models.TextChoices):
        USER = "user", "Foydalanuvchi"
        PLATFORM_ESCROW = "platform_escrow", "E-Makon escrow"
        PLATFORM_REVENUE = "platform_revenue", "E-Makon daromad"
        FIRM_PAYABLE = "firm_payable", "Firmaga to'lov"
        FIRM_DEBT = "firm_debt", "Firma qarzi"

    entry_type = models.CharField(max_length=24, choices=EntryType.choices, db_index=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=8, default="UZS")
    debit_account = models.CharField(max_length=32, choices=Account.choices)
    credit_account = models.CharField(max_length=32, choices=Account.choices)

    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    firm = models.ForeignKey(
        "staff.PartnerFirm",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    escrow = models.ForeignKey(
        OrderEscrow,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_created",
    )
    note = models.TextField(blank=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["entry_type", "created_at"]),
            models.Index(fields=["firm", "created_at"]),
        ]
        verbose_name = "Hisob yozuvi"
        verbose_name_plural = "Hisob yozuvlari"

    def __str__(self) -> str:
        return f"{self.entry_type} {self.amount} ({self.debit_account}→{self.credit_account})"
