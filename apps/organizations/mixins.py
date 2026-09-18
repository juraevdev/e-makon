from __future__ import annotations

from apps.accounts.models import User
from apps.organizations.services import organization_id_for_queryset


class OrganizationQuerysetMixin:
    """
    Scope ModelViewSet querysets to the admin's organization.
    Superadmin sees all rows. Admin without organization sees none.
    """

    organization_field = "organization_id"

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if getattr(user, "role", None) == User.Role.SUPERADMIN:
            return qs
        org_id = organization_id_for_queryset(user)
        if org_id is None:
            return qs.none()
        return qs.filter(**{self.organization_field: org_id})
