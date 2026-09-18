from __future__ import annotations

from rest_framework import serializers

from apps.finance.models import LedgerEntry, OrderEscrow


class OrderEscrowSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    order_id = serializers.IntegerField(source="order.id", read_only=True)

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


class LedgerEntrySerializer(serializers.ModelSerializer):
    entry_type_label = serializers.CharField(source="get_entry_type_display", read_only=True)
    debit_label = serializers.CharField(source="get_debit_account_display", read_only=True)
    credit_label = serializers.CharField(source="get_credit_account_display", read_only=True)

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
