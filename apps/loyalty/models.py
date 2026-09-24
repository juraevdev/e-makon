from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class LoyaltySettings(TimeStampedModel):
    """Singleton sozlamalar (pk=1)."""

    uzs_per_point = models.PositiveIntegerField(default=10000)
    min_redeem_points = models.PositiveIntegerField(default=50)
    expire_months = models.PositiveIntegerField(default=12)

    class Meta:
        verbose_name = "Sodiqlik sozlamalari"
        verbose_name_plural = "Sodiqlik sozlamalari"

    def __str__(self) -> str:
        return "Loyalty settings"

    @classmethod
    def load(cls) -> "LoyaltySettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)


class LoyaltyReward(TimeStampedModel):
    name = models.CharField(max_length=255)
    icon = models.CharField(max_length=64, blank=True, default="redeem")
    points_cost = models.PositiveIntegerField(default=100)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "Mukofot"
        verbose_name_plural = "Mukofotlar"

    def __str__(self) -> str:
        return self.name


class PointTransaction(TimeStampedModel):
    class Kind(models.TextChoices):
        EARN = "earn", "Hisobga olindi"
        REDEEM = "redeem", "Almashtirildi"
        EXPIRE = "expire", "Muddati o'tdi"
        ADJUST = "adjust", "Tuzatish"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="point_transactions",
    )
    kind = models.CharField(max_length=16, choices=Kind.choices)
    points = models.IntegerField()
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="point_transactions",
    )
    note = models.CharField(max_length=512, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Ball tranzaksiyasi"
        verbose_name_plural = "Ball tranzaksiyalari"

    def __str__(self) -> str:
        return f"{self.kind} {self.points} → user={self.user_id}"
