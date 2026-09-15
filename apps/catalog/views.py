from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.catalog.models import Service
from apps.catalog.serializers import ServiceSerializer
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
