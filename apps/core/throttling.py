from __future__ import annotations

from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class SettingsScopedRateThrottle(SimpleRateThrottle):
    """
    Per-client limit for the view's `throttle_scope`. The rate is read from
    settings.API_THROTTLE_RATES on every request; a missing/empty rate disables it.
    """

    def __init__(self):
        # Rate is resolved per request in allow_request().
        pass

    def allow_request(self, request, view):
        self.scope = getattr(view, "throttle_scope", None)
        rate = (getattr(settings, "API_THROTTLE_RATES", None) or {}).get(self.scope)
        if not rate:
            return True
        self.rate = rate
        self.num_requests, self.duration = self.parse_rate(rate)
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}
