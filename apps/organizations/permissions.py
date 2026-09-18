from __future__ import annotations

from rest_framework.permissions import BasePermission

from apps.accounts.models import User


class RequiresAdminCapability(BasePermission):
    """
    Superadmin: always allowed.
    Admin: requires active AdminProfile and the named capability flag.
    Set `required_capability` on the view (e.g. 'can_manage_orders').
    """

    message = "Bu amal uchun admin huquqi yetarli emas."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == User.Role.SUPERADMIN:
            return True
        if user.role != User.Role.ADMIN:
            return False

        capability = getattr(view, "required_capability", None)
        if not capability:
            return True

        profile = getattr(user, "admin_profile", None)
        if profile is None or not profile.is_active:
            return False
        return bool(getattr(profile, capability, False))
