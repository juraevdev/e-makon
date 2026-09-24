from __future__ import annotations

from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.analytics.services import DashboardService
from apps.core.permissions import IsAdmin
from apps.core.responses import success_response
from apps.orders.models import Order
from apps.organizations.models import Organization
from apps.organizations.permissions import RequiresAdminCapability
from apps.organizations.services import organization_id_for_queryset
from apps.staff.models import EmployeeProfile


class DashboardView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_view_analytics"

    def get(self, request):
        period = request.query_params.get("period") or "month"
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        days_raw = request.query_params.get("days")
        days = int(days_raw) if days_raw else None
        if days is not None:
            days = max(1, min(days, 365))
        return success_response(
            DashboardService.summary(
                days=days,
                user=request.user,
                period=period,
                date_from=date_from,
                date_to=date_to,
            )
        )


class ReportsBundleView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_view_analytics"

    def get(self, request):
        period = request.query_params.get("period") or "month"
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        days_raw = request.query_params.get("days")
        days = int(days_raw) if days_raw else None
        summary = DashboardService.summary(
            days=days,
            user=request.user,
            period=period,
            date_from=date_from,
            date_to=date_to,
        )
        title = f"E-Makon hisobot — {summary['date_from']} — {summary['date_to']}"
        return success_response(
            {
                "generated_at": timezone.now().isoformat(),
                "title": title,
                "summary": summary,
            }
        )


class MapPayloadView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_view_analytics"

    def get(self, request):
        org_id = organization_id_for_queryset(request.user)

        firms_qs = Organization.objects.exclude(
            location_lat__isnull=True, location_lng__isnull=True
        )
        workers_qs = EmployeeProfile.objects.select_related("user").filter(is_active=True)
        orders_qs = Order.objects.exclude(
            status__in=[Order.Status.COMPLETED, Order.Status.CANCELLED]
        ).select_related("service", "customer", "organization", "assigned_worker")

        if org_id is not None:
            firms_qs = firms_qs.filter(pk=org_id)
            workers_qs = workers_qs.filter(organization_id=org_id)
            orders_qs = orders_qs.filter(organization_id=org_id)

        firms = [
            {
                "id": f.id,
                "name": f.name,
                "phone": f.phone,
                "specialty": f.specialty,
                "rating": str(f.rating),
                "status": f.status,
                "is_active": f.status == Organization.Status.ACTIVE,
                "lat": float(f.location_lat) if f.location_lat is not None else None,
                "lng": float(f.location_lng) if f.location_lng is not None else None,
                "address": f.address,
            }
            for f in firms_qs[:200]
        ]

        workers = []
        for w in workers_qs[:200]:
            u = w.user
            workers.append(
                {
                    "id": w.id,
                    "user_id": u.id,
                    "name": u.display_name or u.phone,
                    "phone": u.phone,
                    "specialty": w.specialty,
                    "rating": str(w.rating),
                    "is_active": w.is_active and u.is_active,
                    "lat": float(u.location_lat) if u.location_lat is not None else None,
                    "lng": float(u.location_lng) if u.location_lng is not None else None,
                    "address": u.formatted_address or u.home_address,
                }
            )

        orders = []
        for o in orders_qs[:200]:
            lat = float(o.location_lat) if o.location_lat is not None else None
            lng = float(o.location_lng) if o.location_lng is not None else None
            if lat is None and o.customer_id and o.customer.location_lat is not None:
                lat = float(o.customer.location_lat)
                lng = float(o.customer.location_lng) if o.customer.location_lng is not None else None
            orders.append(
                {
                    "id": o.id,
                    "status": o.status,
                    "service": o.service.name if o.service_id else "",
                    "customer": o.customer_name,
                    "firm": o.organization.name if o.organization_id else "",
                    "address": o.address,
                    "lat": lat,
                    "lng": lng,
                    "assigned_worker": o.assigned_worker_name
                    or (o.assigned_worker.display_name if o.assigned_worker_id else ""),
                }
            )

        workers_active = sum(1 for w in workers if w["is_active"] and w["lat"] is not None)
        orders_active = len(orders)

        return success_response(
            {
                "firms": firms,
                "workers": workers,
                "orders": orders,
                "workers_active": workers_active,
                "orders_active": orders_active,
            }
        )
