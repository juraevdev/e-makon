from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.care.models import CareContract
from apps.care.serializers import CareContractSerializer
from apps.core.permissions import IsAdmin, IsCustomer


class CustomerCareContractViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CareContractSerializer
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return CareContract.objects.filter(customer=self.request.user).prefetch_related("visits")


class AdminCareContractViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CareContract.objects.select_related("customer", "order").prefetch_related("visits")
    serializer_class = CareContractSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ("status",)
