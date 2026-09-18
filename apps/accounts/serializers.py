from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import LoyaltyReward, LoyaltySettings, PointTransaction, User
from apps.core.phone import normalize_phone


class UserSerializer(serializers.ModelSerializer):
    formatted_address = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "phone",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "role",
            "avatar",
            "birth_date",
            "home_address",
            "country",
            "region",
            "district",
            "street",
            "formatted_address",
            "location_lat",
            "location_lng",
            "additional_phones",
            "telegram_username",
            "loyalty_points",
            "is_active",
            "date_joined",
        )
        read_only_fields = fields


class AdminCustomerSerializer(UserSerializer):
    phone = serializers.CharField()
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    full_name = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    orders_count = serializers.IntegerField(read_only=True)
    last_order_at = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ("orders_count", "last_order_at")
        read_only_fields = (
            "id",
            "role",
            "avatar",
            "loyalty_points",
            "formatted_address",
            "telegram_username",
            "date_joined",
            "orders_count",
            "last_order_at",
        )

    def validate_phone(self, value: str) -> str:
        return normalize_phone(value)

    def create(self, validated_data):
        phone = validated_data.pop("phone")
        validated_data.pop("role", None)
        return User.objects.create_user(
            phone=phone,
            role=User.Role.CUSTOMER,
            **validated_data,
        )


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "first_name",
            "last_name",
            "full_name",
            "email",
            "avatar",
            "birth_date",
            "home_address",
            "country",
            "region",
            "district",
            "street",
            "location_lat",
            "location_lng",
            "additional_phones",
        )

    def validate_additional_phones(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Qo'shimcha telefonlar ro'yxat bo'lishi kerak.")
        cleaned = []
        for item in value:
            phone = normalize_phone(str(item))
            if phone:
                cleaned.append(phone)
        return cleaned

    def update(self, instance, validated_data):
        full_name = validated_data.get("full_name")
        first_name = validated_data.get("first_name")
        last_name = validated_data.get("last_name")

        if full_name and first_name is None and last_name is None:
            chunks = full_name.strip().split(None, 1)
            validated_data["first_name"] = chunks[0] if chunks else ""
            validated_data["last_name"] = chunks[1] if len(chunks) > 1 else ""

        return super().update(instance, validated_data)


class OTPRequestSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    purpose = serializers.ChoiceField(
        choices=["login", "register", "verify_phone"],
        default="login",
        required=False,
    )

    def validate_phone(self, value: str) -> str:
        phone = normalize_phone(value)
        if len(phone) < 10:
            raise serializers.ValidationError("Telefon raqam noto'g'ri.")
        return phone


class OTPVerifySerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    code = serializers.CharField(max_length=8)
    purpose = serializers.ChoiceField(
        choices=["login", "register", "verify_phone"],
        default="login",
        required=False,
    )
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate_phone(self, value: str) -> str:
        return normalize_phone(value)


class AdminPasswordLoginSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    password = serializers.CharField(write_only=True)

    def validate_phone(self, value: str) -> str:
        return normalize_phone(value)


class LoyaltySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltySettings
        fields = ("uzs_per_point", "min_redeem_points", "expire_months")


class LoyaltyRewardSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyReward
        fields = ("id", "name", "icon", "points_cost", "is_active", "sort_order", "created_at")
        read_only_fields = ("id", "created_at")


class PointTransactionSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_phone = serializers.CharField(source="user.phone", read_only=True)
    order_id = serializers.IntegerField(source="order.id", read_only=True)

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
        return obj.user.display_name or obj.user.phone
