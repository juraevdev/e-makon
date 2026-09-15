from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.accounts.models import User
from apps.orders.models import Order


class DashboardService:
    """Superadmin dashboard KPI — Stitch dashboard ekraniga mos."""

    @staticmethod
    def summary(days: int = 30) -> dict:
        since = timezone.now() - timedelta(days=days)
        orders_qs = Order.objects.filter(created_at__gte=since)
        users_total = User.objects.filter(role=User.Role.CUSTOMER).count()
        active_orders = Order.objects.exclude(
            status__in=[Order.Status.COMPLETED, Order.Status.CANCELLED]
        ).count()
        revenue = (
            Order.objects.filter(
                status=Order.Status.COMPLETED, quoted_price__isnull=False
            ).aggregate(total=Sum("quoted_price"))["total"]
            or Decimal("0")
        )
        by_status = (
            orders_qs.values("status").annotate(count=Count("id")).order_by("status")
        )
        by_day = (
            orders_qs.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        recent = (
            Order.objects.select_related("customer", "service")
            .order_by("-created_at")[:10]
        )
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
