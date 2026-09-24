from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.care.models import CareContract
from apps.care.serializers import CareContractSerializer
from apps.core.permissions import IsAdmin, IsCustomer
from apps.organizations.mixins import OrganizationQuerysetMixin
from apps.organizations.permissions import RequiresAdminCapability


class CustomerCareContractViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CareContractSerializer
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return (
            CareContract.objects.filter(customer=self.request.user)
            .select_related("customer", "order", "order__service")
            .prefetch_related("visits")
        )


class AdminCareContractViewSet(OrganizationQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = CareContract.objects.select_related(
        "customer", "order", "order__service"
    ).prefetch_related("visits")
    serializer_class = CareContractSerializer
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_manage_orders"
    filterset_fields = ("status",)
