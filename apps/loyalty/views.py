from __future__ import annotations

from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.core.permissions import IsCustomer, IsSuperAdmin
from apps.core.responses import success_response
from apps.loyalty.models import LoyaltyReward, LoyaltySettings, PointTransaction
from apps.loyalty.serializers import (
    CustomerPointTransactionSerializer,
    LoyaltyRewardSerializer,
    LoyaltySettingsSerializer,
    PointTransactionSerializer,
)
from apps.loyalty.services import LoyaltyService


class LoyaltySettingsView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        settings_obj = LoyaltySettings.load()
        return success_response(LoyaltySettingsSerializer(settings_obj).data)

    def patch(self, request):
        settings_obj = LoyaltySettings.load()
        serializer = LoyaltySettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(serializer.data)


class LoyaltyRewardViewSet(viewsets.ModelViewSet):
    queryset = LoyaltyReward.objects.all()
    serializer_class = LoyaltyRewardSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filterset_fields = ("is_active",)
    search_fields = ("name",)


class CustomerLoyaltyViewSet(viewsets.GenericViewSet):
    """Mijoz balansi, faol mukofotlar, ball tarixi va almashtirish."""

    serializer_class = PointTransactionSerializer
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return PointTransaction.objects.filter(user=self.request.user).select_related("order")

    def list(self, request):
        settings_obj = LoyaltySettings.load()
        rewards = LoyaltyReward.objects.filter(is_active=True)
        request.user.refresh_from_db(fields=["loyalty_points"])
        return success_response(
            {
                "balance": request.user.loyalty_points,
                "uzs_per_point": settings_obj.uzs_per_point,
                "min_redeem_points": settings_obj.min_redeem_points,
                "rewards": LoyaltyRewardSerializer(rewards, many=True).data,
            }
        )

    @action(detail=False, methods=["get"])
    def transactions(self, request):
        page = self.paginate_queryset(self.get_queryset())
        data = CustomerPointTransactionSerializer(page, many=True).data
        return self.get_paginated_response(data)

    @action(detail=False, methods=["post"])
    def redeem(self, request):
        tx = LoyaltyService.redeem(request.user, request.data.get("reward_id"))
        request.user.refresh_from_db(fields=["loyalty_points"])
        return success_response(
            {
                "balance": request.user.loyalty_points,
                "transaction": CustomerPointTransactionSerializer(tx).data,
            },
            message="Mukofot olindi",
        )


class PointTransactionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = PointTransaction.objects.select_related("user", "order").all()
    serializer_class = PointTransactionSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filterset_fields = ("kind", "user")
    search_fields = ("user__phone", "user__full_name", "note")
