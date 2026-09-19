from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import User
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
            "organization_id",
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
            "telegram_id",
            "telegram_username",
            "date_joined",
        )
        read_only_fields = fields


# Telegram identity is only writable via trusted bot link — never via profile PATCH.
_TELEGRAM_WRITE_BLOCKED = frozenset({"telegram_id", "telegram_username"})


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

    def to_internal_value(self, data):
        # Silently ignore spoof attempts; do not allow telegram_* writes.
        if hasattr(data, "keys"):
            mutable = dict(data)
            for key in _TELEGRAM_WRITE_BLOCKED:
                mutable.pop(key, None)
            data = mutable
        return super().to_internal_value(data)

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
        for key in _TELEGRAM_WRITE_BLOCKED:
            validated_data.pop(key, None)

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


class TelegramLinkSerializer(serializers.Serializer):
    telegram_id = serializers.IntegerField(min_value=1)
    telegram_username = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )


class TelegramUnlinkSerializer(serializers.Serializer):
    """Empty body — unlinks the authenticated user's telegram identity."""

    pass

