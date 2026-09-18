from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.analytics.services import DashboardService
from apps.core.permissions import IsAdmin
from apps.core.responses import success_response


def _period_kwargs(request) -> dict:
    days_raw = request.query_params.get("days")
    days = int(days_raw) if days_raw not in (None, "") else None
    return {
        "period": request.query_params.get("period") or "month",
        "days": days,
        "date_from": request.query_params.get("date_from") or None,
        "date_to": request.query_params.get("date_to") or None,
    }


class DashboardView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        return success_response(DashboardService.summary(**_period_kwargs(request)))


class ReportBundleView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        return success_response(DashboardService.report_bundle(**_period_kwargs(request)))


class MapView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        return success_response(DashboardService.map_payload())
