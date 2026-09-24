from django.contrib import admin

from apps.organizations.models import (
    FirmFine,
    FirmMessage,
    FirmModerationLog,
    FirmReview,
    Investor,
    Organization,
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "slug",
        "status",
        "specialty",
        "commission_rate",
        "phone",
        "is_active",
        "created_at",
    )
    list_filter = ("status", "specialty", "subscription_plan", "is_active")
    search_fields = ("name", "legal_name", "slug", "phone", "email")
    prepopulated_fields = {"slug": ("name",)}
    raw_id_fields = ("owner",)


@admin.register(FirmReview)
class FirmReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "firm", "customer", "score", "created_at")
    raw_id_fields = ("firm", "order", "customer")


@admin.register(FirmMessage)
class FirmMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "firm", "kind", "subject", "is_read", "created_at")
    list_filter = ("kind", "is_read")
    raw_id_fields = ("firm", "sender")


@admin.register(FirmFine)
class FirmFineAdmin(admin.ModelAdmin):
    list_display = ("id", "firm", "amount", "is_paid", "created_at")
    list_filter = ("is_paid",)
    raw_id_fields = ("firm", "created_by")


@admin.register(FirmModerationLog)
class FirmModerationLogAdmin(admin.ModelAdmin):
    list_display = ("id", "firm", "action", "created_by", "created_at")
    list_filter = ("action",)
    raw_id_fields = ("firm", "created_by")


@admin.register(Investor)
class InvestorAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "full_name",
        "company_name",
        "phone",
        "investment_amount",
        "share_percent",
        "status",
        "is_active",
    )
    list_filter = ("status", "is_active")
    search_fields = ("full_name", "company_name", "phone", "email")
