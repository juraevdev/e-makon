from __future__ import annotations

from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.core.permissions import IsSuperAdmin
from apps.core.responses import success_response
from apps.loyalty.models import LoyaltyReward, LoyaltySettings, PointTransaction
from apps.loyalty.serializers import (
    LoyaltyRewardSerializer,
    LoyaltySettingsSerializer,
    PointTransactionSerializer,
)


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


class PointTransactionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = PointTransaction.objects.select_related("user", "order").all()
    serializer_class = PointTransactionSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filterset_fields = ("kind", "user")
    search_fields = ("user__phone", "user__full_name", "note")
