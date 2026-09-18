from __future__ import annotations

from django.db import models

from apps.core.models import TimeStampedModel


class Service(TimeStampedModel):
    """Xizmat katalogi — mobile `GardenService` / Stitch home grid bilan mos."""

    class Icon(models.TextChoices):
        CALL = "call", "call"
        ARCHITECTURE = "architecture", "architecture"
        ECO = "eco", "eco"
        CONTENT_CUT = "content_cut", "content_cut"
        PARK = "park", "park"
        SCIENCE = "science", "science"
        DATABASE = "database", "database"
        GRAIN = "grain", "grain"
        VERIFIED = "verified_user", "verified_user"
        WATER = "water_drop", "water_drop"
        FOREST = "forest", "forest"
        PHONE = "phone_in_talk", "phone_in_talk"

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=64, unique=True)
    emoji = models.CharField(max_length=8, blank=True)
    icon = models.CharField(max_length=32, blank=True, help_text="Material icon name")
    category = models.CharField(max_length=64, blank=True)
    short_description = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    long_description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="services/", blank=True, null=True)
    hero_image_url = models.URLField(max_length=512, blank=True)
    gallery_images = models.JSONField(default=list, blank=True)
    price_label = models.CharField(max_length=120, blank=True, default="Kelishilgan narxda")
    duration = models.CharField(max_length=120, blank=True, default="O'rtacha vaqt: 1.5 - 2 soat")
    features = models.JSONField(
        default=list,
        blank=True,
        help_text='[{"icon": "verified_outlined", "label": "Kafolat"}, ...]',
    )
    sort_order = models.PositiveIntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True)
    # Pricing hint for UI (actual quote may be after consultation)
    price_from = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, default="UZS")

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "Xizmat"
        verbose_name_plural = "Xizmatlar"

    def __str__(self) -> str:
        return f"{self.emoji} {self.name}".strip()

    @property
    def detail_description(self) -> str:
        return self.long_description or self.description


class Banner(TimeStampedModel):
    """Mobil bosh sahifa / promo bannerlari."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Qoralama"
        SCHEDULED = "scheduled", "Rejalashtirilgan"
        ACTIVE = "active", "Faol"
        ARCHIVED = "archived", "Arxiv"

    class Placement(models.TextChoices):
        HOME = "home", "Bosh sahifa"
        PROMO = "promo", "Promo"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    image_url = models.URLField(max_length=512, blank=True)
    image = models.ImageField(upload_to="banners/", blank=True, null=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    placement = models.CharField(max_length=16, choices=Placement.choices, default=Placement.HOME)
    link_service = models.ForeignKey(
        Service,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="banners",
    )
    sort_order = models.PositiveIntegerField(default=0)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["sort_order", "-id"]
        verbose_name = "Banner"
        verbose_name_plural = "Bannerlar"

    def __str__(self) -> str:
        return self.title

    @property
    def image_src(self) -> str:
        if self.image:
            return self.image.url
        return self.image_url
