from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer
from apps.organizations.models import Organization
from apps.organizations.services import get_or_create_default_organization
from apps.staff.models import AdminProfile, EmployeeProfile


class EmployeeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    phone = serializers.CharField(write_only=True, required=False)
    full_name = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    employment_status_label = serializers.CharField(
        source="get_employment_status_display", read_only=True
    )
    specialty_label = serializers.CharField(source="get_specialty_display", read_only=True)
    active_orders = serializers.SerializerMethodField()
    completed_orders = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeProfile
        fields = (
            "id",
            "user",
            "specialty",
            "specialty_label",
            "rating",
            "is_active",
            "employment_status",
            "employment_status_label",
            "position",
            "hired_at",
            "dismissed_at",
            "dismissal_reason",
            "birth_date",
            "address",
            "emergency_phone",
            "skills",
            "notes",
            "active_orders",
            "completed_orders",
            "phone",
            "full_name",
            "password",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "user",
            "is_active",
            "employment_status",
            "dismissed_at",
            "dismissal_reason",
            "created_at",
            "updated_at",
        )

    def get_active_orders(self, obj: EmployeeProfile) -> int:
        return int(getattr(obj, "active_orders_anno", 0) or 0)

    def get_completed_orders(self, obj: EmployeeProfile) -> int:
        return int(getattr(obj, "completed_orders_anno", 0) or 0)

    def validate_skills(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Ko'nikmalar ro'yxat bo'lishi kerak.")
        return [str(v).strip()[:60] for v in value if str(v).strip()][:20]

    def create(self, validated_data):
        phone = validated_data.pop("phone", None)
        if not phone:
            raise serializers.ValidationError({"phone": "Telefon raqam majburiy."})
        full_name = validated_data.pop("full_name", "")
        password = validated_data.pop("password", "") or None
        org = self.context.get("organization") or get_or_create_default_organization()
        user = User.objects.create_user(
            phone=phone,
            password=password,
            full_name=full_name,
            role=User.Role.WORKER,
            is_staff=False,
            organization=org,
        )
        validated_data.setdefault("hired_at", timezone.localdate())
        return EmployeeProfile.objects.create(user=user, organization=org, **validated_data)

    def update(self, instance, validated_data):
        phone = validated_data.pop("phone", None)
        full_name = validated_data.pop("full_name", None)
        password = validated_data.pop("password", None)
        user = instance.user
        user_changed = False
        if phone and phone != user.phone:
            user.phone = phone
            user_changed = True
        if full_name is not None:
            user.full_name = full_name
            chunks = full_name.strip().split(None, 1)
            user.first_name = chunks[0] if chunks else ""
            user.last_name = chunks[1] if len(chunks) > 1 else ""
            user_changed = True
        if password:
            user.set_password(password)
            user_changed = True
        if user_changed:
            user.save()
        return super().update(instance, validated_data)


class AdminUserSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    phone = serializers.CharField(write_only=True, required=False)
    full_name = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)
    organization_id = serializers.PrimaryKeyRelatedField(
        source="organization",
        queryset=Organization.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = AdminProfile
        fields = (
            "id",
            "user",
            "organization_id",
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
        org = validated_data.pop("organization", None) or self.context.get(
            "default_organization"
        ) or get_or_create_default_organization()
        user = User.objects.create_user(
            phone=phone,
            password=password,
            full_name=full_name,
            role=User.Role.ADMIN,
            is_staff=True,
            organization=org,
        )
        return AdminProfile.objects.create(user=user, organization=org, **validated_data)

    def update(self, instance, validated_data):
        phone = validated_data.pop("phone", None)
        full_name = validated_data.pop("full_name", None)
        password = validated_data.pop("password", None)
        user = instance.user
        user_changed = False
        if phone and phone != user.phone:
            user.phone = phone
            user_changed = True
        if full_name is not None:
            user.full_name = full_name
            chunks = full_name.strip().split(None, 1)
            user.first_name = chunks[0] if chunks else ""
            user.last_name = chunks[1] if len(chunks) > 1 else ""
            user_changed = True
        if password:
            user.set_password(password)
            user_changed = True
        if user_changed:
            user.save()
        return super().update(instance, validated_data)
