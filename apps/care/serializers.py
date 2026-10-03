from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import User
from apps.care.models import CareContract, CareContractEvent, CareVisit
from apps.care.services import visit_dates
from apps.core.phone import normalize_phone


class CareVisitSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CareVisit
        fields = (
            "id",
            "visit_date",
            "status",
            "status_label",
            "planned_worker",
            "assigned_worker_name",
            "report_notes",
            "report_sent_at",
            "created_at",
        )
        read_only_fields = fields


class CareContractEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_role = serializers.SerializerMethodField()

    class Meta:
        model = CareContractEvent
        fields = ("id", "action", "note", "actor_name", "actor_role", "created_at")
        read_only_fields = fields

    def get_actor_name(self, obj: CareContractEvent) -> str:
        if not obj.actor_id:
            return "Tizim"
        return obj.actor.display_name or obj.actor.phone

    def get_actor_role(self, obj: CareContractEvent) -> str:
        return obj.actor.role if obj.actor_id else ""


class CareContractSerializer(serializers.ModelSerializer):
    visits = CareVisitSerializer(many=True, read_only=True)
    events = CareContractEventSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    client_type_label = serializers.CharField(source="get_client_type_display", read_only=True)
    frequency_label = serializers.CharField(source="get_frequency_display", read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    service_name = serializers.SerializerMethodField()
    firm_name = serializers.CharField(source="organization.name", read_only=True, default="")
    planned_visits = serializers.SerializerMethodField()
    visits_done = serializers.SerializerMethodField()
    assigned_worker_ids = serializers.PrimaryKeyRelatedField(
        source="assigned_workers",
        queryset=User.objects.filter(role=User.Role.WORKER),
        many=True,
        required=False,
    )
    customer_phone_input = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = CareContract
        fields = (
            "id",
            "order",
            "service",
            "service_name",
            "firm_name",
            "title",
            "client_type",
            "client_type_label",
            "client_name",
            "contact_person",
            "phone_number",
            "address",
            "location_lat",
            "location_lng",
            "area_size",
            "frequency",
            "frequency_label",
            "preferred_weekdays",
            "start_date",
            "end_date",
            "price_per_visit",
            "total_amount",
            "currency",
            "payment_terms",
            "terms",
            "status",
            "status_label",
            "platform_note",
            "rejection_reason",
            "approved_at",
            "customer",
            "customer_name",
            "customer_phone",
            "customer_phone_input",
            "assigned_worker_ids",
            "planned_visits",
            "visits_done",
            "visits",
            "events",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "order",
            "customer",
            "status",
            "platform_note",
            "rejection_reason",
            "approved_at",
            "created_at",
            "updated_at",
        )

    def get_customer_name(self, obj: CareContract) -> str:
        if obj.client_name:
            return obj.client_name
        if obj.customer_id:
            return obj.customer.display_name or obj.customer.phone
        return ""

    def get_customer_phone(self, obj: CareContract) -> str:
        if obj.phone_number:
            return obj.phone_number
        return obj.customer.phone if obj.customer_id else ""

    def get_service_name(self, obj: CareContract) -> str:
        if obj.service_id:
            return obj.service.name
        if obj.order_id and obj.order.service_id:
            return obj.order.service.name
        return ""

    def get_planned_visits(self, obj: CareContract) -> int:
        return len(obj.visits.all()) or len(visit_dates(obj))

    def get_visits_done(self, obj: CareContract) -> int:
        return sum(1 for v in obj.visits.all() if v.status == CareVisit.Status.DONE)

    def validate_preferred_weekdays(self, value):
        try:
            days = sorted({int(v) for v in value or []})
        except (TypeError, ValueError):
            raise serializers.ValidationError("Hafta kunlari 0–6 oralig'ida.") from None
        if any(d < 0 or d > 6 for d in days):
            raise serializers.ValidationError("Hafta kunlari 0–6 oralig'ida.")
        return days

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end <= start:
            raise serializers.ValidationError({"end_date": "Tugash sanasi boshlanishdan keyin bo'lsin."})
        if start and end and (end - start).days > 1830:
            raise serializers.ValidationError({"end_date": "Shartnoma muddati 5 yildan oshmasin."})
        org = self.context.get("organization")
        workers = attrs.get("assigned_workers")
        if org is not None and workers:
            if any(w.organization_id != org.pk for w in workers):
                raise serializers.ValidationError({"assigned_worker_ids": "Xodim topilmadi."})
        client_name = attrs.get("client_name", getattr(self.instance, "client_name", ""))
        phone_input = attrs.get("customer_phone_input")
        if not client_name and not phone_input and not getattr(self.instance, "customer_id", None):
            raise serializers.ValidationError({"client_name": "Mijoz yoki tashkilot nomini kiriting."})
        return attrs

    def _link_customer(self, validated_data):
        raw = validated_data.pop("customer_phone_input", None)
        if not raw:
            return
        phone = normalize_phone(raw)
        customer = User.objects.filter(phone=phone, role=User.Role.CUSTOMER).first()
        if customer is not None:
            validated_data["customer"] = customer
            validated_data.setdefault("phone_number", phone)

    def create(self, validated_data):
        self._link_customer(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._link_customer(validated_data)
        return super().update(instance, validated_data)
