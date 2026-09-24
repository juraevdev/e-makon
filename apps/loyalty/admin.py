from django.contrib import admin

from apps.loyalty.models import LoyaltyReward, LoyaltySettings, PointTransaction


@admin.register(LoyaltySettings)
class LoyaltySettingsAdmin(admin.ModelAdmin):
    list_display = ("uzs_per_point", "min_redeem_points", "expire_months")


@admin.register(LoyaltyReward)
class LoyaltyRewardAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "points_cost", "is_active", "sort_order")
    list_editable = ("is_active", "sort_order")
    search_fields = ("name",)


@admin.register(PointTransaction)
class PointTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "kind", "points", "order", "created_at")
    list_filter = ("kind",)
    search_fields = ("user__phone", "note")
    raw_id_fields = ("user", "order")
