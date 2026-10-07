from __future__ import annotations

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import (
    AdminLoginView,
    LogoutView,
    MeView,
    OTPRequestView,
    OTPVerifyView,
    TelegramLinkView,
    TelegramUnlinkView,
)
from apps.core.throttling import SettingsScopedRateThrottle


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_classes = [SettingsScopedRateThrottle]
    throttle_scope = "token"


urlpatterns = [
    path("otp/request/", OTPRequestView.as_view(), name="otp-request"),
    path("otp/verify/", OTPVerifyView.as_view(), name="otp-verify"),
    path("admin/login/", AdminLoginView.as_view(), name="admin-login"),
    path("token/refresh/", ThrottledTokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("telegram/link/", TelegramLinkView.as_view(), name="telegram-link"),
    path("telegram/unlink/", TelegramUnlinkView.as_view(), name="telegram-unlink"),
]
