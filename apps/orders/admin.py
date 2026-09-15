from __future__ import annotations

from django.contrib import admin

from apps.orders.models import Order, OrderMedia, OrderStatusHistory


class OrderMediaInline(admin.TabularInline):
    model = OrderMedia
    extra = 0


class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    readonly_fields = ("from_status", "to_status", "changed_by", "note", "created_at")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "service", "status", "phone_number", "created_at")
    list_filter = ("status", "service")
    search_fields = ("customer__phone", "customer__full_name", "phone_number", "address")
    inlines = [OrderMediaInline, OrderStatusHistoryInline]
    raw_id_fields = ("customer", "assigned_worker", "service")
