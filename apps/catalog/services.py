from __future__ import annotations

import re

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.catalog.models import Service
from apps.core.exceptions import AppError
from apps.organizations.services import DEFAULT_ORG_SLUG, get_or_create_default_organization

_APOSTROPHES = re.compile(r"[`'‘’ʻʼ´]")
_SPACES = re.compile(r"\s+")


def normalize_name(name: str) -> str:
    text = _APOSTROPHES.sub("", (name or "").lower())
    return _SPACES.sub(" ", text).strip()


def platform_owned_q() -> Q:
    return Q(organization__isnull=True) | Q(organization__slug=DEFAULT_ORG_SLUG)


def catalog_types():
    """Ilovadagi katalog turlari: firma taklifi emas, platformaga tegishli asosiy xizmatlar."""
    return Service.objects.filter(platform_owned_q(), base_service__isnull=True)


def is_catalog_type(service: Service) -> bool:
    if service.base_service_id:
        return False
    return service.organization_id is None or service.organization.slug == DEFAULT_ORG_SLUG


def is_type_proposal(service: Service) -> bool:
    return not service.base_service_id and not is_catalog_type(service)


def find_catalog_type(name: str, *, exclude_pk: int | None = None) -> Service | None:
    key = normalize_name(name)
    if not key:
        return None
    qs = catalog_types()
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    for candidate in qs.only("id", "name", "organization_id"):
        if normalize_name(candidate.name) == key:
            return candidate
    return None


def _unique_type_slug(base: str) -> str:
    base = (base or "xizmat")[:56]
    slug = base
    n = 2
    while catalog_types().filter(slug=slug).exists():
        slug = f"{base}-{n}"
        n += 1
    return slug


@transaction.atomic
def attach_to_catalog_type(service: Service, *, base: Service | None, actor) -> Service:
    """Firmaning yangi tur taklifini katalog turiga aylantiradi (yoki mavjud turga qo'shadi).

    Natijada katalogda bitta tur qoladi, firma xizmati esa uning ichidagi taklifga aylanadi.
    """
    if not is_type_proposal(service):
        return service
    if base is None:
        base = find_catalog_type(service.name)
    if base is not None:
        if not is_catalog_type(base):
            raise AppError("Faqat katalog turini tanlash mumkin.")
        if (
            Service.objects.filter(organization_id=service.organization_id, base_service=base)
            .exclude(pk=service.pk)
            .exists()
        ):
            raise AppError(f"Bu firmada \"{base.name}\" turidagi xizmat allaqachon bor.")
    else:
        slug_root = service.slug.rsplit("-", 1)[0] if "-" in service.slug else service.slug
        base = Service.objects.create(
            organization=get_or_create_default_organization(),
            name=service.name,
            slug=_unique_type_slug(slug_root),
            emoji=service.emoji,
            icon=service.icon,
            category=service.category,
            short_description=service.short_description,
            description=service.description,
            long_description=service.long_description,
            cover_image=service.cover_image.name if service.cover_image else None,
            hero_image_url=service.hero_image_url,
            gallery_images=service.gallery_images,
            duration=service.duration,
            features=service.features,
            price_label="Firmalar narxi",
            sort_order=(catalog_types().order_by("-sort_order").values_list("sort_order", flat=True).first() or 0) + 1,
            moderation_status=Service.Moderation.APPROVED,
            moderated_at=timezone.now(),
            moderated_by=actor,
        )
    service.base_service = base
    service.save(update_fields=["base_service", "updated_at"])
    return base
