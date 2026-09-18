from __future__ import annotations

from django.contrib import admin

from apps.catalog.models import Banner, Service


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("emoji", "name", "slug", "sort_order", "is_active", "price_from")
    list_editable = ("sort_order", "is_active")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "placement", "sort_order")
    list_filter = ("status", "placement")
    search_fields = ("title",)