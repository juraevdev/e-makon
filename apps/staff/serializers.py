from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer
from apps.orders.models import Order
from apps.staff.commission import (
    COMMISSION_MAX,
    COMMISSION_MIN,
    calc_platform_share,
    subscription_fee_usd,
    suggest_commission_rate,
)
from apps.staff.models import (
    AdminProfile,
    EmployeeProfile,
    FirmFine,
    FirmMessage,
    FirmModerationLog,
    FirmReview,
    Investor,
    PartnerFirm,
)


class EmployeeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    phone = serializers.CharField(write_only=True, required=False)
    full_name = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    firm_name = serializers.CharField(source="firm.name", read_only=True, allow_null=True)

    class Meta:
        model = EmployeeProfile
        fields = (
            "id",
            "user",
            "firm",
            "firm_name",
            "specialty",
            "rating",
            "is_active",
            "notes",
            "phone",
            "full_name",
            "password",
            "created_at",
        )
        read_only_fields = ("id", "user", "firm_name", "created_at")

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
            first_name=(full_name.split(None, 1)[0] if full_name else ""),
            last_name=(
                full_name.split(None, 1)[1]
                if full_name and len(full_name.split(None, 1)) > 1
                else ""
            ),
            role=User.Role.WORKER,
            is_staff=False,
        )
        return EmployeeProfile.objects.create(user=user, **validated_data)


class FirmReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.display_name", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)

    class Meta:
        model = FirmReview
        fields = (
            "id",
            "firm",
            "order",
            "customer",
            "customer_name",
            "customer_phone",
            "score",
            "comment",
            "created_at",
        )
        read_only_fields = ("id", "customer", "created_at")


class FirmMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = FirmMessage
        fields = (
            "id",
            "firm",
            "sender",
            "sender_name",
            "kind",
            "subject",
            "body",
            "is_read",
            "created_at",
        )
        read_only_fields = ("id", "sender", "created_at")

    def get_sender_name(self, obj: FirmMessage) -> str:
        if not obj.sender_id:
            return ""
        return obj.sender.display_name or obj.sender.phone


class FirmFineSerializer(serializers.ModelSerializer):
    class Meta:
        model = FirmFine
        fields = (
            "id",
            "firm",
            "amount",
            "currency",
            "reason",
            "created_by",
            "is_paid",
            "paid_at",
            "created_at",
        )
        read_only_fields = ("id", "created_by", "paid_at", "created_at")


class FirmModerationLogSerializer(serializers.ModelSerializer):
    action_label = serializers.CharField(source="get_action_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = FirmModerationLog
        fields = (
            "id",
            "firm",
            "action",
            "action_label",
            "note",
            "meta",
            "created_by",
            "created_by_name",
            "created_at",
        )
        read_only_fields = fields

    def get_created_by_name(self, obj: FirmModerationLog) -> str:
        if not obj.created_by_id:
            return ""
        return obj.created_by.display_name or obj.created_by.phone


class PartnerFirmSerializer(serializers.ModelSerializer):
    orders_count = serializers.IntegerField(read_only=True, required=False)
    revenue = serializers.SerializerMethodField()
    platform_share = serializers.SerializerMethodField()
    suggested_rate = serializers.SerializerMethodField()
    specialty_label = serializers.SerializerMethodField()
    subscription_fee_usd = serializers.SerializerMethodField()
    subscription_yearly_if_monthly_usd = serializers.SerializerMethodField()
    unpaid_fines = serializers.SerializerMethodField()
    is_sales_banned = serializers.SerializerMethodField()

    class Meta:
        model = PartnerFirm
        fields = (
            "id",
            "name",
            "legal_name",
            "phone",
            "email",
            "address",
            "region",
            "district",
            "specialty",
            "specialty_label",
            "description",
            "rating",
            "ratings_count",
            "commission_rate",
            "suggested_rate",
            "subscription_plan",
            "subscription_units",
            "subscription_fee_usd",
            "subscription_yearly_if_monthly_usd",
            "debt_amount",
            "debt_currency",
            "warnings_count",
            "sales_banned_until",
            "is_sales_banned",
            "unpaid_fines",
            "status",
            "exit_reason",
            "ended_at",
            "trial_ends_at",
            "location_lat",
            "location_lng",
            "owner",
            "is_active",
            "orders_count",
            "revenue",
            "platform_share",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "orders_count",
            "revenue",
            "platform_share",
            "suggested_rate",
            "specialty_label",
            "rating",
            "ratings_count",
            "warnings_count",
            "subscription_fee_usd",
            "subscription_yearly_if_monthly_usd",
            "unpaid_fines",
            "is_sales_banned",
        )

    def get_specialty_label(self, obj: PartnerFirm) -> str:
        return obj.get_specialty_display()

    def _revenue(self, obj: PartnerFirm) -> Decimal:
        if hasattr(obj, "revenue_sum") and obj.revenue_sum is not None:
            return Decimal(str(obj.revenue_sum))
        total = (
            Order.objects.filter(
                firm=obj, status=Order.Status.COMPLETED, quoted_price__isnull=False
            ).aggregate(total=Sum("quoted_price"))["total"]
            or Decimal("0")
        )
        return Decimal(str(total))

    def get_revenue(self, obj: PartnerFirm) -> str:
        return str(self._revenue(obj))

    def get_platform_share(self, obj: PartnerFirm) -> str:
        rev = self._revenue(obj)
        rate = obj.commission_rate or suggest_commission_rate(rev)
        return str(calc_platform_share(rev, rate))

    def get_suggested_rate(self, obj: PartnerFirm) -> str:
        return str(suggest_commission_rate(self._revenue(obj)))

    def get_subscription_fee_usd(self, obj: PartnerFirm) -> str:
        return str(subscription_fee_usd(obj.subscription_plan, obj.subscription_units))

    def get_subscription_yearly_if_monthly_usd(self, obj: PartnerFirm) -> str:
        units = max(int(obj.subscription_units or 1), 1)
        return str(Decimal(units) * Decimal("108"))

    def get_unpaid_fines(self, obj: PartnerFirm) -> str:
        total = (
            obj.fines.filter(is_paid=False).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        return str(total)

    def get_is_sales_banned(self, obj: PartnerFirm) -> bool:
        return obj.is_sales_banned

    def validate_commission_rate(self, value):
        rate = Decimal(str(value))
        if rate < COMMISSION_MIN or rate > COMMISSION_MAX:
            raise serializers.ValidationError(
                f"Ulush {COMMISSION_MIN}% dan {COMMISSION_MAX}% gacha bo'lishi kerak."
            )
        return rate

    def validate_subscription_units(self, value):
        if value is not None and int(value) < 1:
            raise serializers.ValidationError("Kamida 1 o'rin kerak.")
        return value


class InvestorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Investor
        fields = (
            "id",
            "full_name",
            "company_name",
            "phone",
            "email",
            "address",
            "investment_amount",
            "currency",
            "share_percent",
            "status",
            "notes",
            "exit_reason",
            "ended_at",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


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


def log_moderation(
    firm: PartnerFirm,
    action: str,
    *,
    user=None,
    note: str = "",
    meta: dict | None = None,
) -> FirmModerationLog:
    return FirmModerationLog.objects.create(
        firm=firm,
        action=action,
        note=note,
        meta=meta or {},
        created_by=user,
    )
