from __future__ import annotations

import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission


class IsBotService(BasePermission):
    """Require X-Bot-Service-Key matching EMAKON_BOT_SERVICE_KEY."""

    message = "Bot service credential invalid."

    def has_permission(self, request, view) -> bool:
        expected = (getattr(settings, "EMAKON_BOT_SERVICE_KEY", "") or "").strip()
        if not expected:
            return False
        provided = (
            request.headers.get("X-Bot-Service-Key")
            or request.META.get("HTTP_X_BOT_SERVICE_KEY")
            or ""
        ).strip()
        if not provided:
            return False
        return hmac.compare_digest(provided, expected)
