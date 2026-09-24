from __future__ import annotations

from rest_framework import serializers

from apps.care.models import CareContract, CareVisit


class CareVisitSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareVisit
        fields = (
            "id",
            "visit_date",
            "status",
            "assigned_worker_name",
            "report_notes",
            "created_at",
        )


class CareContractSerializer(serializers.ModelSerializer):
    visits = CareVisitSerializer(many=True, read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    service_name = serializers.SerializerMethodField()

    class Meta:
        model = CareContract
        fields = (
            "id",
            "order",
            "status",
            "preferred_weekdays",
            "area_size",
            "start_date",
            "end_date",
            "customer_name",
            "customer_phone",
            "service_name",
            "visits",
            "created_at",
        )
        read_only_fields = fields

    def get_customer_name(self, obj: CareContract) -> str:
        if obj.customer_id:
            return obj.customer.display_name or obj.customer.phone
        return ""

    def get_customer_phone(self, obj: CareContract) -> str:
        if obj.phone_number:
            return obj.phone_number
        return obj.customer.phone if obj.customer_id else ""

    def get_service_name(self, obj: CareContract) -> str:
        if obj.order_id and obj.order.service_id:
            return obj.order.service.name
        return ""
