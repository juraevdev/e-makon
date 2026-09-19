from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.core.permissions import IsAdmin, IsSuperAdmin
from apps.organizations.mixins import OrganizationQuerysetMixin
from apps.organizations.permissions import RequiresAdminCapability
from apps.organizations.services import get_or_create_default_organization, resolve_organization_for_user
from apps.staff.models import AdminProfile, EmployeeProfile
from apps.staff.serializers import AdminUserSerializer, EmployeeSerializer


class EmployeeViewSet(OrganizationQuerysetMixin, viewsets.ModelViewSet):
    queryset = EmployeeProfile.objects.select_related("user").all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_manage_staff"
    search_fields = ("user__full_name", "user__phone")
    filterset_fields = ("specialty", "is_active")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["organization"] = resolve_organization_for_user(self.request.user)
        return ctx


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = AdminProfile.objects.select_related("user", "organization").all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    search_fields = ("user__full_name", "user__phone")
    filterset_fields = ("is_active",)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["default_organization"] = get_or_create_default_organization()
        return ctx
