from __future__ import annotations

from django.contrib import admin

from apps.support.models import SupportMessage, SupportTicket


class SupportMessageInline(admin.TabularInline):
    model = SupportMessage
    extra = 0
    raw_id_fields = ("sender",)


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("id", "subject", "customer", "status", "priority", "assigned_to", "created_at")
    list_filter = ("status", "priority")
    search_fields = ("subject", "customer__phone", "customer__full_name")
    raw_id_fields = ("customer", "order", "assigned_to")
    inlines = [SupportMessageInline]
