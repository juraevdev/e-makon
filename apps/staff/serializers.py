from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer
from apps.staff.models import AdminProfile, EmployeeProfile


class EmployeeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    phone = serializers.CharField(write_only=True, required=False)
    full_name = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = EmployeeProfile
        fields = (
            "id",
            "user",
            "specialty",
            "rating",
            "is_active",
            "notes",
            "phone",
            "full_name",
            "password",
            "created_at",
        )
        read_only_fields = ("id", "user", "created_at")

    def create(self, validated_data):
        phone = validated_data.pop("phone", None)
        if not phone:
            raise serializers.ValidationError({"phone": "Telefon raqam majburiy."})
        full_name = validated_data.pop("full_name", "")
        password = validated_data.pop("password", "") or None
        user = User.objects.create_user(
            phone=phone,
            password=password,
            full_name=full_name,
            role=User.Role.WORKER,
            is_staff=False,
        )
        return EmployeeProfile.objects.create(user=user, **validated_data)


class AdminUserSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    phone = serializers.CharField(write_only=True, required=False)
    full_name = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = AdminProfile
        fields = (
            "id",
            "user",
            "title",
            "can_manage_staff",
            "can_manage_orders",
            "can_view_analytics",
            "is_active",
            "phone",
            "full_name",
            "password",
            "created_at",
        )
        read_only_fields = ("id", "user", "created_at")

    def create(self, validated_data):
        phone = validated_data.pop("phone", None)
        password = validated_data.pop("password", None)
        if not phone:
            raise serializers.ValidationError({"phone": "Telefon raqam majburiy."})
        if not password:
            raise serializers.ValidationError({"password": "Parol majburiy."})
        full_name = validated_data.pop("full_name", "")
        user = User.objects.create_user(
            phone=phone,
            password=password,
            full_name=full_name,
            role=User.Role.ADMIN,
            is_staff=True,
        )
        return AdminProfile.objects.create(user=user, **validated_data)
