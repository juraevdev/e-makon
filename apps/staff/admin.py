from __future__ import annotations

from django.contrib import admin

from apps.staff.models import AdminProfile, EmployeeProfile


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "specialty", "rating", "is_active")
    list_filter = ("specialty", "is_active")
    search_fields = ("user__full_name", "user__phone")
    raw_id_fields = ("user",)


@admin.register(AdminProfile)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "is_active", "can_manage_staff", "can_view_analytics")
    list_filter = ("is_active",)
    raw_id_fields = ("user",)
