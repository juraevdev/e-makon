from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.analytics.services import DashboardService
from apps.core.permissions import IsAdmin
from apps.core.responses import success_response


class DashboardView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        days = int(request.query_params.get("days") or 30)
        days = max(1, min(days, 365))
        return success_response(DashboardService.summary(days=days))
