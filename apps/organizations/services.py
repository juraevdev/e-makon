from __future__ import annotations

from django.conf import settings

from apps.accounts.models import User
from apps.organizations.models import Organization

DEFAULT_ORG_SLUG = "default"


def get_or_create_default_organization() -> Organization:
    org, _ = Organization.objects.get_or_create(
        slug=DEFAULT_ORG_SLUG,
        defaults={
            "name": getattr(settings, "DEFAULT_ORGANIZATION_NAME", "E-Makon"),
            "is_active": True,
        },
    )
    return org


def resolve_organization_for_user(user: User | None) -> Organization | None:
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    if user.role == User.Role.SUPERADMIN:
        return None
    return getattr(user, "organization", None)


def organization_id_for_queryset(user: User) -> int | None:
    """
    Return organization pk to scope admin querysets.
    None means no filter (superadmin / global).
    """
    if user.role == User.Role.SUPERADMIN:
        return None
    org = getattr(user, "organization", None)
    return org.pk if org else None
