from __future__ import annotations

from rest_framework import serializers

from apps.catalog.models import Service
from apps.catalog.serializers import ServiceSerializer
from apps.core.exceptions import AppError
from apps.orders.models import (
    LedgerEntry,
    Order,
    OrderEscrow,
    OrderMedia,
    OrderPayment,
    OrderStatusHistory,
)
from apps.orders.payments import PaymentService, estimate_order_amount, payment_options
from apps.orders.services import OrderService


class OrderMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderMedia
        fields = ("id", "kind", "file", "sort_order", "created_at")
        read_only_fields = ("id", "created_at")


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    stage_label = serializers.SerializerMethodField()
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderStatusHistory
        fields = (
            "id",
            "from_status",
            "to_status",
            "stage",
            "stage_label",
            "note",
            "changed_by_name",
            "created_at",
        )

    def get_stage_label(self, obj: OrderStatusHistory) -> str:
        if obj.stage in Order.WorkStage.values:
            return Order.WorkStage(obj.stage).label
        return ""

    def get_changed_by_name(self, obj: OrderStatusHistory) -> str:
        if not obj.changed_by_id:
            return ""
        return obj.changed_by.display_name or obj.changed_by.phone


class OrderEscrowSerializer(serializers.ModelSerializer):
    order_id = serializers.IntegerField(source="order.id", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = OrderEscrow
        fields = (
            "id",
            "order_id",
            "status",
            "status_label",
            "amount",
            "currency",
            "commission_rate",
            "platform_fee",
            "firm_payout",
            "paid_at",
            "released_at",
            "refunded_at",
            "disputed_at",
            "note",
            "dispute_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class OrderPaymentSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    provider_label = serializers.CharField(source="get_provider_display", read_only=True)

    class Meta:
        model = OrderPayment
        fields = (
            "id",
            "provider",
            "provider_label",
            "status",
            "status_label",
            "amount",
            "currency",
            "checkout_url",
            "submitted_at",
            "resolved_at",
            "note",
            "created_at",
        )
        read_only_fields = fields


class LedgerEntrySerializer(serializers.ModelSerializer):
    entry_type_label = serializers.CharField(source="get_entry_type_display", read_only=True)
    debit_label = serializers.SerializerMethodField()
    credit_label = serializers.SerializerMethodField()

    class Meta:
        model = LedgerEntry
        fields = (
            "id",
            "entry_type",
            "entry_type_label",
            "amount",
            "currency",
            "debit_account",
            "debit_label",
            "credit_account",
            "credit_label",
            "order",
            "firm",
            "user",
            "escrow",
            "note",
            "meta",
            "created_at",
        )
        read_only_fields = fields

    def get_debit_label(self, obj: LedgerEntry) -> str:
        from apps.orders.finance import ACCOUNT_LABELS

        return ACCOUNT_LABELS.get(obj.debit_account, obj.debit_account)

    def get_credit_label(self, obj: LedgerEntry) -> str:
        from apps.orders.finance import ACCOUNT_LABELS

        return ACCOUNT_LABELS.get(obj.credit_account, obj.credit_account)


class OrderSerializer(serializers.ModelSerializer):
    service = ServiceSerializer(read_only=True)
    media = OrderMediaSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    escrow = OrderEscrowSerializer(read_only=True)
    customer_name = serializers.CharField(read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    customer_id = serializers.IntegerField(source="customer.id", read_only=True)
    service_id = serializers.IntegerField(source="service.id", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    service_icon = serializers.CharField(source="service.icon", read_only=True)
    assigned_worker_id = serializers.IntegerField(read_only=True, allow_null=True)
    firm_id = serializers.IntegerField(source="organization_id", read_only=True, allow_null=True)
    firm_name = serializers.SerializerMethodField()
    partner_name = serializers.SerializerMethodField()
    work_stage_label = serializers.SerializerMethodField()
    distance_km = serializers.FloatField(read_only=True, allow_null=True)
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()
    partner_lat = serializers.SerializerMethodField()
    partner_lng = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    amount = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    payment = serializers.SerializerMethodField()
    payment_options = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "service",
            "service_id",
            "service_name",
            "service_icon",
            "status",
            "progress",
            "area_size",
            "plant_category",
            "address",
            "notes",
            "phone_number",
            "customer_id",
            "customer_first_name",
            "customer_last_name",
            "customer_name",
            "customer_phone",
            "agreed_duration",
            "quoted_price",
            "currency",
            "assigned_worker_id",
            "assigned_worker_name",
            "firm_id",
            "firm_name",
            "partner_name",
            "work_stage",
            "work_stage_label",
            "work_stage_at",
            "distance_km",
            "eta_minutes",
            "eta_at",
            "scheduled_date",
            "time_slot",
            "lat",
            "lng",
            "partner_lat",
            "partner_lng",
            "platform_share",
            "commission_rate_applied",
            "escrow",
            "amount",
            "payment_status",
            "payment",
            "payment_options",
            "location_lat",
            "location_lng",
            "media",
            "status_history",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_firm_name(self, obj: Order) -> str:
        return obj.organization.name if obj.organization_id else ""

    def get_partner_name(self, obj: Order) -> str:
        return self.get_firm_name(obj)

    def get_work_stage_label(self, obj: Order) -> str:
        if obj.work_stage in Order.WorkStage.values:
            return Order.WorkStage(obj.work_stage).label
        return ""

    @staticmethod
    def _f(value) -> float | None:
        return float(value) if value is not None else None

    def get_lat(self, obj: Order) -> float | None:
        return self._f(obj.location_lat)

    def get_lng(self, obj: Order) -> float | None:
        return self._f(obj.location_lng)

    def get_partner_lat(self, obj: Order) -> float | None:
        return self._f(obj.organization.location_lat) if obj.organization_id else None

    def get_partner_lng(self, obj: Order) -> float | None:
        return self._f(obj.organization.location_lng) if obj.organization_id else None

    def get_amount(self, obj: Order) -> int:
        return int(obj.quoted_price or 0)

    def get_payment_status(self, obj: Order) -> str:
        return PaymentService.status(obj)

    def get_payment_options(self, obj: Order) -> dict:
        return payment_options()

    def get_payment(self, obj: Order) -> dict | None:
        payment = PaymentService.latest(obj)
        return OrderPaymentSerializer(payment).data if payment else None

    def get_progress(self, obj: Order) -> float:
        from apps.orders.services import STAGE_SEQUENCE

        if obj.status == Order.Status.CANCELLED:
            return 1.0
        if obj.work_stage in STAGE_SEQUENCE:
            return round(0.3 + 0.7 * (STAGE_SEQUENCE.index(obj.work_stage) + 1) / 5, 2)
        return {
            Order.Status.NEW: 0.22,
            Order.Status.IN_REVIEW: 0.48,
            Order.Status.CONTACTED: 0.72,
            Order.Status.COMPLETED: 1.0,
            Order.Status.CANCELLED: 1.0,
        }.get(obj.status, 0.1)


class OrderCreateSerializer(serializers.Serializer):
    service_id = serializers.IntegerField()
    service_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )
    phone_number = serializers.CharField(max_length=32, required=False, allow_blank=True)
    area_size = serializers.CharField(max_length=255, required=False, allow_blank=True)
    address = serializers.CharField(max_length=512, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    plant_category = serializers.CharField(max_length=255, required=False, allow_blank=True)
    customer_first_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    customer_last_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    media = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        allow_empty=True,
    )
    firm_id = serializers.IntegerField(required=False, allow_null=True)
    scheduled_date = serializers.DateField(
        required=False, allow_null=True, input_formats=["%Y-%m-%d", "iso-8601"]
    )
    time_slot = serializers.CharField(max_length=64, required=False, allow_blank=True)
    lat = serializers.DecimalField(max_digits=10, decimal_places=7, required=False, allow_null=True)
    lng = serializers.DecimalField(max_digits=10, decimal_places=7, required=False, allow_null=True)

    def to_internal_value(self, data):
        raw = data.get("scheduled_date") if hasattr(data, "get") else None
        if isinstance(raw, str) and "T" in raw:
            data = data.copy() if hasattr(data, "copy") else dict(data)
            data["scheduled_date"] = raw.split("T", 1)[0]
        for key in ("lat", "lng"):
            value = data.get(key) if hasattr(data, "get") else None
            if isinstance(value, float):
                data = data.copy() if hasattr(data, "copy") else dict(data)
                data[key] = round(value, 7)
        return super().to_internal_value(data)

    @staticmethod
    def _resolve_for_firm(service: Service, firm_id: int | None) -> Service:
        """Katalog turini tanlangan firmaning tasdiqlangan taklifiga almashtiradi."""
        if not firm_id or service.organization_id == firm_id:
            return service
        root = service.base_service or service
        if root.organization_id == firm_id:
            return root
        offer = (
            Service.objects.filter(
                base_service=root,
                organization_id=firm_id,
                is_active=True,
                moderation_status=Service.Moderation.APPROVED,
            )
            .order_by("id")
            .first()
        )
        if offer is None:
            raise AppError(f"Tanlangan firma \"{root.name}\" xizmatini ko'rsatmaydi.")
        return offer

    def create(self, validated_data):
        request = self.context["request"]
        published = Service.objects.filter(
            is_active=True, moderation_status=Service.Moderation.APPROVED
        )
        try:
            service = published.get(pk=validated_data["service_id"])
        except Service.DoesNotExist as exc:
            raise AppError("Xizmat topilmadi.") from exc
        firm_id = validated_data.get("firm_id")
        service = self._resolve_for_firm(service, firm_id)
        extra_ids = [
            i for i in validated_data.get("service_ids") or [] if i != validated_data["service_id"]
        ]
        extras = []
        for extra in published.filter(pk__in=extra_ids):
            try:
                resolved = self._resolve_for_firm(extra, firm_id or service.organization_id)
            except AppError:
                continue
            if resolved.pk != service.pk:
                extras.append(resolved)
        priced_services = [service, *extras]
        first_name = (
            validated_data.get("customer_first_name")
            or validated_data.get("first_name")
            or ""
        )
        last_name = (
            validated_data.get("customer_last_name")
            or validated_data.get("last_name")
            or ""
        )
        return OrderService.create_order(
            customer=request.user,
            service=service,
            phone_number=validated_data.get("phone_number") or "",
            area_size=validated_data.get("area_size") or "",
            address=validated_data.get("address") or "",
            notes=validated_data.get("notes") or "",
            plant_category=validated_data.get("plant_category") or "",
            customer_first_name=first_name,
            customer_last_name=last_name,
            media_files=validated_data.get("media") or [],
            idempotency_key=self.context.get("idempotency_key"),
            quoted_price=estimate_order_amount(
                priced_services, validated_data.get("area_size") or ""
            ),
            scheduled_date=validated_data.get("scheduled_date"),
            time_slot=validated_data.get("time_slot") or "",
            location_lat=validated_data.get("lat"),
            location_lng=validated_data.get("lng"),
        )


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True)
    assigned_worker_id = serializers.IntegerField(required=False, allow_null=True)
    quoted_price = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )
    agreed_duration = serializers.CharField(required=False, allow_blank=True)


class OrderStageSerializer(serializers.Serializer):
    stage = serializers.ChoiceField(choices=Order.WorkStage.choices)
    distance_km = serializers.DecimalField(
        max_digits=7, decimal_places=2, required=False, allow_null=True, min_value=0
    )
    eta_minutes = serializers.IntegerField(
        required=False, allow_null=True, min_value=0, max_value=60 * 24 * 7
    )
    assigned_worker_id = serializers.IntegerField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)
