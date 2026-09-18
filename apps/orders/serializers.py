from __future__ import annotations

from rest_framework import serializers

from apps.catalog.models import Service
from apps.catalog.serializers import ServiceSerializer
from apps.core.exceptions import AppError
from apps.orders.models import Order, OrderMedia, OrderStatusHistory
from apps.orders.services import OrderService


class OrderMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderMedia
        fields = ("id", "kind", "file", "sort_order", "created_at")
        read_only_fields = ("id", "created_at")


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = ("id", "from_status", "to_status", "note", "created_at")


class OrderSerializer(serializers.ModelSerializer):
    service = ServiceSerializer(read_only=True)
    media = OrderMediaSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    customer_name = serializers.CharField(read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    service_id = serializers.IntegerField(source="service.id", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "service",
            "service_id",
            "service_name",
            "status",
            "progress",
            "area_size",
            "plant_category",
            "address",
            "notes",
            "phone_number",
            "customer_first_name",
            "customer_last_name",
            "customer_name",
            "customer_phone",
            "agreed_duration",
            "quoted_price",
            "currency",
            "assigned_worker_name",
            "media",
            "status_history",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_progress(self, obj: Order) -> float:
        return {
            Order.Status.NEW: 0.22,
            Order.Status.IN_REVIEW: 0.48,
            Order.Status.CONTACTED: 0.72,
            Order.Status.COMPLETED: 1.0,
            Order.Status.CANCELLED: 1.0,
        }.get(obj.status, 0.1)


class OrderCreateSerializer(serializers.Serializer):
    service_id = serializers.IntegerField()
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

    def create(self, validated_data):
        request = self.context["request"]
        try:
            service = Service.objects.get(pk=validated_data["service_id"], is_active=True)
        except Service.DoesNotExist as exc:
            raise AppError("Xizmat topilmadi.") from exc
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
        )


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True)
    assigned_worker_id = serializers.IntegerField(required=False, allow_null=True)
    quoted_price = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )
    agreed_duration = serializers.CharField(required=False, allow_blank=True)
