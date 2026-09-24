from __future__ import annotations

from rest_framework import serializers

from apps.loyalty.models import LoyaltyReward, LoyaltySettings, PointTransaction


class LoyaltySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltySettings
        fields = ("uzs_per_point", "min_redeem_points", "expire_months")


class LoyaltyRewardSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyReward
        fields = (
            "id",
            "name",
            "icon",
            "points_cost",
            "is_active",
            "sort_order",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class PointTransactionSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_phone = serializers.CharField(source="user.phone", read_only=True)
    order_id = serializers.IntegerField(source="order_id", read_only=True, allow_null=True)

    class Meta:
        model = PointTransaction
        fields = (
            "id",
            "user",
            "user_name",
            "user_phone",
            "kind",
            "points",
            "order",
            "order_id",
            "note",
            "created_at",
        )
        read_only_fields = fields

    def get_user_name(self, obj: PointTransaction) -> str:
        return obj.user.display_name if obj.user_id else ""
