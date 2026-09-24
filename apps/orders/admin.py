from __future__ import annotations

from django.contrib import admin

from apps.orders.models import (
    LedgerEntry,
    Order,
    OrderEscrow,
    OrderIdempotency,
    OrderMedia,
    OrderStatusHistory,
)


class OrderMediaInline(admin.TabularInline):
    model = OrderMedia
    extra = 0


class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    readonly_fields = ("from_status", "to_status", "changed_by", "note", "created_at")


class OrderEscrowInline(admin.StackedInline):
    model = OrderEscrow
    extra = 0
    readonly_fields = ("paid_at", "released_at", "refunded_at", "disputed_at")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "service", "status", "phone_number", "created_at")
    list_filter = ("status", "service")
    search_fields = ("customer__phone", "customer__full_name", "phone_number", "address")
    inlines = [OrderMediaInline, OrderStatusHistoryInline, OrderEscrowInline]
    raw_id_fields = ("customer", "assigned_worker", "service", "organization")


@admin.register(OrderIdempotency)
class OrderIdempotencyAdmin(admin.ModelAdmin):
    list_display = ("key", "customer", "order", "created_at")
    search_fields = ("key", "customer__phone")
    raw_id_fields = ("customer", "order")


@admin.register(OrderEscrow)
class OrderEscrowAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "status", "amount", "platform_fee", "firm_payout", "created_at")
    list_filter = ("status",)
    raw_id_fields = ("order",)


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "entry_type",
        "amount",
        "currency",
        "debit_account",
        "credit_account",
        "order",
        "firm",
        "created_at",
    )
    list_filter = ("entry_type",)
    raw_id_fields = ("order", "firm", "user", "escrow")
