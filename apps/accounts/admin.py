from __future__ import annotations

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from apps.accounts.models import LoyaltyReward, LoyaltySettings, OTPChallenge, PointTransaction, User


class UserCreationFormPhone(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("phone",)


class UserChangeFormPhone(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    form = UserChangeFormPhone
    add_form = UserCreationFormPhone
    ordering = ("-date_joined",)
    list_display = (
        "phone",
        "first_name",
        "last_name",
        "full_name",
        "role",
        "loyalty_points",
        "is_active",
        "is_staff",
        "date_joined",
    )
    list_filter = ("role", "is_active", "is_staff")
    search_fields = (
        "phone",
        "first_name",
        "last_name",
        "full_name",
        "email",
        "telegram_username",
    )
    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        (
            "Profil",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "full_name",
                    "birth_date",
                    "email",
                    "avatar",
                    "role",
                )
            },
        ),
        (
            "Manzil",
            {
                "fields": (
                    "home_address",
                    "country",
                    "region",
                    "district",
                    "street",
                    "location_lat",
                    "location_lng",
                    "additional_phones",
                )
            },
        ),
        ("Telegram", {"fields": ("telegram_id", "telegram_username")}),
        (
            "Huquqlar",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Sanalar", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("phone", "password1", "password2", "role", "is_staff", "is_superuser"),
            },
        ),
    )
    filter_horizontal = ("groups", "user_permissions")


@admin.register(OTPChallenge)
class OTPChallengeAdmin(admin.ModelAdmin):
    list_display = ("phone", "purpose", "attempts", "is_used", "expires_at", "created_at")
    list_filter = ("purpose", "is_used")
    search_fields = ("phone",)
    readonly_fields = ("code_hash",)


@admin.register(LoyaltySettings)
class LoyaltySettingsAdmin(admin.ModelAdmin):
    list_display = ("uzs_per_point", "min_redeem_points", "expire_months")


@admin.register(LoyaltyReward)
class LoyaltyRewardAdmin(admin.ModelAdmin):
    list_display = ("name", "points_cost", "is_active", "sort_order")
    list_editable = ("is_active", "sort_order")


@admin.register(PointTransaction)
class PointTransactionAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "points", "order", "created_at")
    list_filter = ("kind",)
    search_fields = ("user__phone", "user__full_name", "note")
