from __future__ import annotations

from django.contrib import admin

from apps.care.models import CareContract, CareVisit


class CareVisitInline(admin.TabularInline):
    model = CareVisit
    extra = 0
    raw_id_fields = ("planned_worker",)


@admin.register(CareContract)
class CareContractAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "status", "start_date", "end_date")
    list_filter = ("status",)
    raw_id_fields = ("customer", "order")
    filter_horizontal = ("assigned_workers",)
    inlines = [CareVisitInline]


@admin.register(CareVisit)
class CareVisitAdmin(admin.ModelAdmin):
    list_display = ("id", "contract", "visit_date", "status", "planned_worker")
    list_filter = ("status",)
    raw_id_fields = ("contract", "planned_worker")
