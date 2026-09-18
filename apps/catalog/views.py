from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.catalog.models import Banner, Service
from apps.catalog.serializers import BannerSerializer, ServiceSerializer
from apps.core.permissions import IsAdmin


class ServiceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Service.objects.filter(is_active=True)
    serializer_class = ServiceSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"
    search_fields = ("name", "description")
    ordering_fields = ("sort_order", "name")


class AdminServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    lookup_field = "slug"
    search_fields = ("name", "slug")
    filterset_fields = ("is_active",)


class PublicBannerViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BannerSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Banner.objects.filter(status=Banner.Status.ACTIVE)


class AdminBannerViewSet(viewsets.ModelViewSet):
    queryset = Banner.objects.select_related("link_service").all()
    serializer_class = BannerSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ("status", "placement")
    search_fields = ("title", "description")
