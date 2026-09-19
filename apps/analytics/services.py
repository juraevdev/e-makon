from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.accounts.models import User
from apps.orders.models import Order
from apps.organizations.services import organization_id_for_queryset


class DashboardService:
    """Admin / superadmin dashboard KPI — Stitch dashboard ekraniga mos."""

    @staticmethod
    def summary(days: int = 30, user=None) -> dict:
        since = timezone.now() - timedelta(days=days)
        orders_qs = Order.objects.filter(created_at__gte=since)
        customers_qs = User.objects.filter(role=User.Role.CUSTOMER)
        active_qs = Order.objects.exclude(
            status__in=[Order.Status.COMPLETED, Order.Status.CANCELLED]
        )
        revenue_qs = Order.objects.filter(
            status=Order.Status.COMPLETED, quoted_price__isnull=False
        )
        recent_qs = Order.objects.select_related("customer", "service").order_by("-created_at")

        if user is not None:
            org_id = organization_id_for_queryset(user)
            if org_id is not None:
                orders_qs = orders_qs.filter(organization_id=org_id)
                customers_qs = customers_qs.filter(organization_id=org_id)
                active_qs = active_qs.filter(organization_id=org_id)
                revenue_qs = revenue_qs.filter(organization_id=org_id)
                recent_qs = recent_qs.filter(organization_id=org_id)

        users_total = customers_qs.count()
        active_orders = active_qs.count()
        revenue = revenue_qs.aggregate(total=Sum("quoted_price"))["total"] or Decimal("0")
        by_status = (
            orders_qs.values("status").annotate(count=Count("id")).order_by("status")
        )
        by_day = (
            orders_qs.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        recent = recent_qs[:10]
        return {
            "period_days": days,
            "total_customers": users_total,
            "active_orders": active_orders,
            "revenue_done": str(revenue),
            "orders_in_period": orders_qs.count(),
            "orders_by_status": list(by_status),
            "orders_by_day": [
                {"day": row["day"].isoformat() if row["day"] else None, "count": row["count"]}
                for row in by_day
            ],
            "recent_orders": [
                {
                    "id": o.id,
                    "service": o.service.name,
                    "customer": o.customer.full_name or o.customer.phone,
                    "status": o.status,
                    "created_at": o.created_at.isoformat(),
                }
                for o in recent
            ],
        }
