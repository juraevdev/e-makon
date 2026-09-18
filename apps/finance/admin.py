from django.contrib import admin

from apps.finance.models import LedgerEntry, OrderEscrow


@admin.register(OrderEscrow)
class OrderEscrowAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "status",
        "amount",
        "platform_fee",
        "firm_payout",
        "paid_at",
        "released_at",
    )
    list_filter = ("status",)
    raw_id_fields = ("order", "last_action_by")


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "entry_type", "amount", "debit_account", "credit_account", "firm", "order", "created_at")
    list_filter = ("entry_type",)
    raw_id_fields = ("order", "firm", "user", "escrow", "created_by")
