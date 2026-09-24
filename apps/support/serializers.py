from __future__ import annotations

from rest_framework import serializers

from apps.support.models import SupportMessage, SupportTicket


class SupportMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.full_name", read_only=True)

    class Meta:
        model = SupportMessage
        fields = ("id", "sender", "sender_name", "body", "is_internal", "created_at")
        read_only_fields = ("id", "sender", "sender_name", "created_at")


class CustomerSupportMessageSerializer(serializers.ModelSerializer):
    """Customer-facing messages — never expose is_internal or internal bodies."""

    sender_name = serializers.CharField(source="sender.full_name", read_only=True)

    class Meta:
        model = SupportMessage
        fields = ("id", "sender", "sender_name", "body", "created_at")
        read_only_fields = fields


class SupportTicketSerializer(serializers.ModelSerializer):
    messages = SupportMessageSerializer(many=True, read_only=True)
    customer_id = serializers.IntegerField(source="customer.id", read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = (
            "id",
            "subject",
            "status",
            "priority",
            "order",
            "customer_id",
            "customer_name",
            "customer_phone",
            "assigned_to",
            "assigned_to_name",
            "messages",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "customer_id",
            "customer_name",
            "customer_phone",
            "assigned_to",
            "assigned_to_name",
            "messages",
            "created_at",
            "updated_at",
        )

    def get_customer_name(self, obj: SupportTicket) -> str:
        return obj.customer.display_name if obj.customer_id else ""

    def get_assigned_to_name(self, obj: SupportTicket) -> str:
        if obj.assigned_to_id:
            return obj.assigned_to.display_name or obj.assigned_to.phone
        return ""


class CustomerSupportTicketSerializer(serializers.ModelSerializer):
    messages = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = (
            "id",
            "subject",
            "status",
            "priority",
            "order",
            "assigned_to",
            "messages",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_messages(self, obj: SupportTicket):
        public = [m for m in obj.messages.all() if not m.is_internal]
        return CustomerSupportMessageSerializer(public, many=True).data


class SupportTicketCreateSerializer(serializers.ModelSerializer):
    body = serializers.CharField(write_only=True)

    class Meta:
        model = SupportTicket
        fields = ("subject", "order", "priority", "body")

    def create(self, validated_data):
        body = validated_data.pop("body")
        user = self.context["request"].user
        ticket = SupportTicket.objects.create(
            customer=user,
            organization=getattr(user, "organization", None),
            **validated_data,
        )
        SupportMessage.objects.create(ticket=ticket, sender=user, body=body)
        return ticket
