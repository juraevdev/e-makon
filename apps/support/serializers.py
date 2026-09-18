from __future__ import annotations

from rest_framework import serializers

from apps.support.models import SupportMessage, SupportTicket


class SupportMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.full_name", read_only=True)

    class Meta:
        model = SupportMessage
        fields = ("id", "sender", "sender_name", "body", "is_internal", "created_at")
        read_only_fields = ("id", "sender", "sender_name", "created_at")


class SupportTicketSerializer(serializers.ModelSerializer):
    messages = SupportMessageSerializer(many=True, read_only=True)
    customer_id = serializers.IntegerField(source="customer.id", read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True, allow_null=True)

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
            "assigned_to_name",
            "messages",
            "created_at",
            "updated_at",
        )

    def get_customer_name(self, obj: SupportTicket) -> str:
        return obj.customer.display_name or obj.customer.phone


class SupportTicketCreateSerializer(serializers.ModelSerializer):
    body = serializers.CharField(write_only=True)

    class Meta:
        model = SupportTicket
        fields = ("subject", "order", "priority", "body")

    def create(self, validated_data):
        body = validated_data.pop("body")
        user = self.context["request"].user
        ticket = SupportTicket.objects.create(customer=user, **validated_data)
        SupportMessage.objects.create(ticket=ticket, sender=user, body=body)
        return ticket
