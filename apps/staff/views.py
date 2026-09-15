from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.core.permissions import IsAdmin, IsSuperAdmin
from apps.staff.models import AdminProfile, EmployeeProfile
from apps.staff.serializers import AdminUserSerializer, EmployeeSerializer


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = EmployeeProfile.objects.select_related("user").all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    search_fields = ("user__full_name", "user__phone")
    filterset_fields = ("specialty", "is_active")


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = AdminProfile.objects.select_related("user").all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    search_fields = ("user__full_name", "user__phone")
    filterset_fields = ("is_active",)
