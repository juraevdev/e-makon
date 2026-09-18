from __future__ import annotations

from django.contrib import admin

from apps.staff.models import (
    AdminProfile,
    EmployeeProfile,
    FirmFine,
    FirmMessage,
    FirmModerationLog,
    FirmReview,
    Investor,
    PartnerFirm,
)


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "firm", "specialty", "rating", "is_active")
    list_filter = ("specialty", "is_active")
    search_fields = ("user__full_name", "user__phone", "firm__name")
    raw_id_fields = ("user", "firm")


@admin.register(AdminProfile)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "is_active", "can_manage_staff", "can_view_analytics")
    list_filter = ("is_active",)
    raw_id_fields = ("user",)


@admin.register(PartnerFirm)
class PartnerFirmAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "phone",
        "region",
        "specialty",
        "rating",
        "commission_rate",
        "subscription_plan",
        "debt_amount",
        "status",
        "is_active",
    )
    list_filter = ("status", "specialty", "subscription_plan", "is_active")
    search_fields = ("name", "legal_name", "phone", "region")


@admin.register(FirmReview)
class FirmReviewAdmin(admin.ModelAdmin):
    list_display = ("firm", "customer", "score", "order", "created_at")
    list_filter = ("score",)
    raw_id_fields = ("firm", "customer", "order")


@admin.register(FirmMessage)
class FirmMessageAdmin(admin.ModelAdmin):
    list_display = ("firm", "kind", "subject", "sender", "created_at")
    list_filter = ("kind",)
    raw_id_fields = ("firm", "sender")


@admin.register(FirmFine)
class FirmFineAdmin(admin.ModelAdmin):
    list_display = ("firm", "amount", "currency", "is_paid", "created_at")
    list_filter = ("is_paid", "currency")
    raw_id_fields = ("firm", "created_by")


@admin.register(FirmModerationLog)
class FirmModerationLogAdmin(admin.ModelAdmin):
    list_display = ("firm", "action", "created_by", "created_at")
    list_filter = ("action",)
    raw_id_fields = ("firm", "created_by")


@admin.register(Investor)
class InvestorAdmin(admin.ModelAdmin):
    list_display = ("full_name", "company_name", "phone", "investment_amount", "share_percent", "status")
    list_filter = ("status", "is_active")
    search_fields = ("full_name", "company_name", "phone")
