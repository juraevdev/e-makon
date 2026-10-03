from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.organizations.models import (
    FirmFine,
    FirmMessage,
    FirmModerationLog,
    FirmReview,
    Investor,
    Organization,
)
from apps.organizations.services import (
    SPECIALTY_LABELS,
    firm_revenue_totals,
    subscription_fee_usd,
    subscription_yearly_if_monthly_usd,
    suggested_commission_rate,
    unique_slug_from_name,
)


class FirmReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
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
        read_only_fields = fields

    def get_customer_name(self, obj: FirmReview) -> str:
        return obj.customer.display_name if obj.customer_id else ""


class PublicFirmReviewSerializer(serializers.ModelSerializer):
    """Ilovada ko'rinadigan sharh: mijoz telefoni oshkor qilinmaydi."""

    firm_id = serializers.IntegerField(read_only=True)
    author = serializers.SerializerMethodField()
    mine = serializers.SerializerMethodField()

    class Meta:
        model = FirmReview
        fields = ("id", "firm_id", "order", "author", "score", "comment", "mine", "created_at")
        read_only_fields = fields

    def get_author(self, obj: FirmReview) -> str:
        name = obj.customer.display_name if obj.customer_id else ""
        return name or "Mijoz"

    def get_mine(self, obj: FirmReview) -> bool:
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.customer_id == request.user.pk)


class FirmReviewCreateSerializer(serializers.Serializer):
    score = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    order = serializers.IntegerField(required=False, allow_null=True)


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
        read_only_fields = fields

    def get_sender_name(self, obj: FirmMessage) -> str:
        if obj.sender_id:
            return obj.sender.display_name or obj.sender.phone
        return ""


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
        read_only_fields = fields


class FirmModerationLogSerializer(serializers.ModelSerializer):
    action_label = serializers.SerializerMethodField()
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

    def get_action_label(self, obj: FirmModerationLog) -> str:
        labels = {
            "set_trial": "Sinov muddati",
            "apply_suggested_rate": "Tavsiya stavka",
            "adjust_debt": "Qarz tuzatish",
            "block": "Bloklash",
            "unblock": "Blokdan chiqarish",
            "end_agreement": "Kelishuv tugashi",
            "send_message": "Xabar",
            "add_fine": "Jarima",
            "ban_sales": "Sotuv taqiqi",
            "lift_sales_ban": "Sotuv taqiqi olib tashlandi",
        }
        return labels.get(obj.action, obj.action)

    def get_created_by_name(self, obj: FirmModerationLog) -> str:
        if obj.created_by_id:
            return obj.created_by.display_name or obj.created_by.phone
        return ""


class PartnerFirmSerializer(serializers.ModelSerializer):
    specialty_label = serializers.SerializerMethodField()
    suggested_rate = serializers.SerializerMethodField()
    is_sales_banned = serializers.SerializerMethodField()
    subscription_fee_usd = serializers.SerializerMethodField()
    subscription_yearly_if_monthly_usd = serializers.SerializerMethodField()
    revenue = serializers.SerializerMethodField()
    platform_share = serializers.SerializerMethodField()
    orders_count = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Organization
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
            "work_hours",
            "website",
            "telegram_channel",
            "telegram_group",
            "instagram",
            "youtube",
            "facebook",
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
            "specialty_label",
            "suggested_rate",
            "is_sales_banned",
            "subscription_fee_usd",
            "subscription_yearly_if_monthly_usd",
            "warnings_count",
            "unpaid_fines",
            "ended_at",
            "owner",
            "is_active",
            "orders_count",
            "revenue",
            "platform_share",
            "created_at",
            "updated_at",
        )

    def get_specialty_label(self, obj: Organization) -> str:
        return SPECIALTY_LABELS.get(obj.specialty, obj.specialty)

    def get_suggested_rate(self, obj: Organization) -> str:
        return str(suggested_commission_rate(obj))

    def get_is_sales_banned(self, obj: Organization) -> bool:
        return obj.is_sales_banned

    def get_subscription_fee_usd(self, obj: Organization) -> str:
        return str(subscription_fee_usd(obj.subscription_plan, obj.subscription_units))

    def get_subscription_yearly_if_monthly_usd(self, obj: Organization) -> str:
        return str(subscription_yearly_if_monthly_usd(obj.subscription_units))

    def get_revenue(self, obj: Organization) -> str:
        cached = getattr(obj, "_revenue_cache", None)
        if cached is not None:
            return str(cached)
        revenue, _ = firm_revenue_totals(obj)
        return str(revenue)

    def get_platform_share(self, obj: Organization) -> str:
        cached = getattr(obj, "_platform_share_cache", None)
        if cached is not None:
            return str(cached)
        _, platform = firm_revenue_totals(obj)
        return str(platform)

    def get_orders_count(self, obj: Organization) -> int:
        if hasattr(obj, "orders_count_anno"):
            return int(obj.orders_count_anno)
        return obj.orders.count()

    def get_is_active(self, obj: Organization) -> bool:
        return obj.status == Organization.Status.ACTIVE

    def validate_commission_rate(self, value: Decimal) -> Decimal:
        if value < Decimal("0.1") or value > Decimal("3"):
            raise serializers.ValidationError("Kampaniya ulushi 0.1%–3% oralig'ida.")
        return value

    def create(self, validated_data):
        name = validated_data.get("name") or "firm"
        validated_data["slug"] = unique_slug_from_name(name)
        return super().create(validated_data)


SOCIAL_FIELDS = (
    "website",
    "telegram_channel",
    "telegram_group",
    "instagram",
    "youtube",
    "facebook",
)


def social_url(field: str, value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    if raw.startswith(("http://", "https://")):
        return raw
    handle = raw.lstrip("@")
    if field in {"telegram_channel", "telegram_group"}:
        return f"https://t.me/{handle}"
    if field == "instagram":
        return f"https://instagram.com/{handle}"
    if field == "youtube":
        return f"https://youtube.com/@{handle}"
    if field == "facebook":
        return f"https://facebook.com/{handle}"
    return f"https://{raw}"


class FirmSelfSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = (
            "phone",
            "email",
            "address",
            "region",
            "district",
            "description",
            "location_lat",
            "location_lng",
            "work_hours",
            *SOCIAL_FIELDS,
        )

    def validate(self, attrs):
        for field in SOCIAL_FIELDS:
            if field in attrs and field != "website":
                attrs[field] = (attrs[field] or "").strip()
        return attrs


class PublicFirmSerializer(serializers.ModelSerializer):
    """Mobil ilovadagi `PartnerModel` bilan mos ochiq firma kartasi."""

    tagline = serializers.SerializerMethodField()
    activity = serializers.SerializerMethodField()
    emoji = serializers.SerializerMethodField()
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    telegram = serializers.SerializerMethodField()
    socials = serializers.SerializerMethodField()
    services_count = serializers.SerializerMethodField()
    offer = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = (
            "id",
            "name",
            "tagline",
            "activity",
            "emoji",
            "description",
            "address",
            "region",
            "district",
            "lat",
            "lng",
            "rating",
            "ratings_count",
            "phone",
            "work_hours",
            "website",
            "instagram",
            "telegram",
            "telegram_channel",
            "telegram_group",
            "youtube",
            "facebook",
            "socials",
            "services_count",
            "offer",
        )
        read_only_fields = fields

    def get_tagline(self, obj: Organization) -> str:
        return SPECIALTY_LABELS.get(obj.specialty, obj.specialty)

    def get_activity(self, obj: Organization) -> str:
        return " · ".join(p for p in (self.get_tagline(obj), obj.region) if p)

    def get_emoji(self, obj: Organization) -> str:
        return {
            "landscape": "🏡",
            "garden_care": "🌳",
            "ornamental": "🌸",
            "irrigation": "💧",
            "pest_control": "🧪",
        }.get(obj.specialty, "🌿")

    def get_lat(self, obj: Organization) -> float | None:
        return float(obj.location_lat) if obj.location_lat is not None else None

    def get_lng(self, obj: Organization) -> float | None:
        return float(obj.location_lng) if obj.location_lng is not None else None

    def get_rating(self, obj: Organization) -> float:
        return float(obj.rating or 0)

    def get_telegram(self, obj: Organization) -> str:
        return social_url("telegram_channel", obj.telegram_channel or obj.telegram_group)

    def get_socials(self, obj: Organization) -> list[dict]:
        labels = {
            "telegram_channel": "Telegram kanal",
            "telegram_group": "Telegram guruh",
            "instagram": "Instagram",
            "youtube": "YouTube",
            "facebook": "Facebook",
            "website": "Veb-sayt",
        }
        out = []
        for field, label in labels.items():
            url = social_url(field, getattr(obj, field, ""))
            if url:
                out.append({"kind": field, "label": label, "url": url})
        return out

    def get_services_count(self, obj: Organization) -> int:
        return int(getattr(obj, "services_count_anno", 0) or 0)

    def get_offer(self, obj: Organization) -> dict | None:
        offers = self.context.get("offers_by_firm") or {}
        offer = offers.get(obj.pk)
        if offer is None:
            return None
        return {
            "service_id": offer.pk,
            "name": offer.name,
            "price": int(offer.price_from or offer.price_to or 0),
            "duration": offer.duration,
        }


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
        read_only_fields = ("id", "ended_at", "is_active", "created_at", "updated_at")
