from __future__ import annotations

from django.db import models

from apps.core.models import TimeStampedModel


class Organization(TimeStampedModel):
    """
    Tenant / partner company on the E-Makon platform.

    Superadmins are platform-scoped (User.organization=NULL).
    Admins, workers, and customers belong to exactly one organization
    once assigned (default org used for existing/single-tenant deploys).
    """

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=64, unique=True)
    is_active = models.BooleanField(default=True, db_index=True)
    phone = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=512, blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "Tashkilot"
        verbose_name_plural = "Tashkilotlar"

    def __str__(self) -> str:
        return self.name
