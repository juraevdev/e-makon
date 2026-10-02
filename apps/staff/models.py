from __future__ import annotations

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
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="employees",
        null=True,
        blank=True,
    )
    specialty = models.CharField(
        max_length=32,
        choices=Specialty.choices,
        default=Specialty.GENERAL,
    )
    class EmploymentStatus(models.TextChoices):
        ACTIVE = "active", "Ishda"
        ON_LEAVE = "on_leave", "Ta'tilda"
        DISMISSED = "dismissed", "Ishdan bo'shagan"

    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    employment_status = models.CharField(
        max_length=16,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.ACTIVE,
        db_index=True,
    )
    position = models.CharField(max_length=120, blank=True)
    hired_at = models.DateField(null=True, blank=True)
    dismissed_at = models.DateField(null=True, blank=True)
    dismissal_reason = models.TextField(blank=True)
    birth_date = models.DateField(null=True, blank=True)
    address = models.CharField(max_length=512, blank=True)
    emergency_phone = models.CharField(max_length=32, blank=True)
    skills = models.JSONField(default=list, blank=True)

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
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="admins",
        null=True,
        blank=True,
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
