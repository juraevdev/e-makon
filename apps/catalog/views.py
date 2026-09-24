from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.catalog.models import Banner, Service
from apps.catalog.serializers import BannerSerializer, ServiceSerializer
from apps.core.permissions import IsAdmin
from apps.organizations.mixins import OrganizationQuerysetMixin
from apps.organizations.permissions import RequiresAdminCapability
from apps.organizations.services import get_or_create_default_organization, resolve_organization_for_user


class ServiceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Service.objects.filter(is_active=True)
    serializer_class = ServiceSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"
    search_fields = ("name", "description")
    ordering_fields = ("sort_order", "name")


class AdminServiceViewSet(OrganizationQuerysetMixin, viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_manage_orders"
    lookup_field = "slug"
    search_fields = ("name", "slug")
    filterset_fields = ("is_active",)

    def perform_create(self, serializer):
        org = resolve_organization_for_user(self.request.user)
        if org is None:
            org = get_or_create_default_organization()
        serializer.save(organization=org)


class AdminBannerViewSet(viewsets.ModelViewSet):
    queryset = Banner.objects.select_related("link_service").all()
    serializer_class = BannerSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    search_fields = ("title", "description")
    filterset_fields = ("status", "placement")
    ordering_fields = ("sort_order", "created_at")
