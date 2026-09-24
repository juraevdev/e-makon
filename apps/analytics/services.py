from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from apps.accounts.models import User
from apps.catalog.models import Service
from apps.orders.models import Order
from apps.organizations.models import Investor, Organization
from apps.organizations.services import (
    organization_id_for_queryset,
    suggested_commission_rate,
)


PERIOD_DAYS = {
    "day": 1,
    "week": 7,
    "month": 30,
    "season": 90,
    "year": 365,
}


def _parse_bound(value: str | None, *, end: bool = False):
    if not value:
        return None
    dt = parse_datetime(value)
    if dt is not None:
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt
    d = parse_date(value)
    if d is None:
        return None
    if end:
        return timezone.make_aware(
            datetime.combine(d, datetime.max.time().replace(microsecond=0)),
            timezone.get_current_timezone(),
        )
    return timezone.make_aware(
        datetime.combine(d, datetime.min.time()),
        timezone.get_current_timezone(),
    )


def _resolve_period(
    *,
    period: str = "month",
    date_from: str | None = None,
    date_to: str | None = None,
    days: int | None = None,
) -> tuple[str, datetime, datetime, int]:
    now = timezone.now()
    period = (period or "month").lower()

    if period == "custom" or date_from or date_to:
        start = _parse_bound(date_from) or (now - timedelta(days=30))
        end = _parse_bound(date_to, end=True) or now
        if end < start:
            start, end = end, start
        span = max(1, (end.date() - start.date()).days + 1)
        return "custom", start, end, span

    if days is not None:
        days = max(1, min(int(days), 365))
        start = now - timedelta(days=days)
        return period if period in PERIOD_DAYS else "custom", start, now, days

    days = PERIOD_DAYS.get(period, 30)
    start = now - timedelta(days=days)
    return period if period in PERIOD_DAYS else "month", start, now, days


class DashboardService:
    """Admin / superadmin dashboard KPI — panel DashboardData shape."""

    @staticmethod
    def summary(
        days: int | None = None,
        user=None,
        *,
        period: str = "month",
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict:
        period_key, start, end, period_days = _resolve_period(
            period=period,
            date_from=date_from,
            date_to=date_to,
            days=days,
        )

        orders_qs = Order.objects.filter(created_at__gte=start, created_at__lte=end)
        all_orders = Order.objects.all()
        customers_qs = User.objects.filter(role=User.Role.CUSTOMER)
        active_qs = Order.objects.exclude(
            status__in=[Order.Status.COMPLETED, Order.Status.CANCELLED]
        )
        revenue_all_qs = Order.objects.filter(
            status=Order.Status.COMPLETED, quoted_price__isnull=False
        )
        revenue_period_qs = revenue_all_qs.filter(created_at__gte=start, created_at__lte=end)
        firms_qs = Organization.objects.all()
        investors_qs = Investor.objects.all()
        services_qs = Service.objects.all()
        recent_qs = Order.objects.select_related(
            "customer", "service", "organization"
        ).order_by("-created_at")

        org_id = None
        if user is not None:
            org_id = organization_id_for_queryset(user)
            if org_id is not None:
                orders_qs = orders_qs.filter(organization_id=org_id)
                all_orders = all_orders.filter(organization_id=org_id)
                customers_qs = customers_qs.filter(organization_id=org_id)
                active_qs = active_qs.filter(organization_id=org_id)
                revenue_all_qs = revenue_all_qs.filter(organization_id=org_id)
                revenue_period_qs = revenue_period_qs.filter(organization_id=org_id)
                firms_qs = firms_qs.filter(pk=org_id)
                services_qs = services_qs.filter(organization_id=org_id)
                recent_qs = recent_qs.filter(organization_id=org_id)

        # Previous period for change %
        prev_start = start - (end - start)
        prev_orders = Order.objects.filter(created_at__gte=prev_start, created_at__lt=start)
        if org_id is not None:
            prev_orders = prev_orders.filter(organization_id=org_id)
        prev_count = prev_orders.count()
        curr_count = orders_qs.count()
        if prev_count:
            orders_change_pct = round(((curr_count - prev_count) / prev_count) * 100, 1)
        else:
            orders_change_pct = None

        revenue_done = revenue_all_qs.aggregate(total=Sum("quoted_price"))["total"] or Decimal("0")
        revenue_period = (
            revenue_period_qs.aggregate(total=Sum("quoted_price"))["total"] or Decimal("0")
        )
        platform_share_total = (
            revenue_period_qs.aggregate(total=Sum("platform_share"))["total"]
        )
        if platform_share_total is None:
            platform_share_total = Decimal("0")
            for o in revenue_period_qs.select_related("organization"):
                if o.platform_share is not None:
                    platform_share_total += o.platform_share
                elif o.organization_id and o.quoted_price:
                    rate = o.commission_rate_applied or o.organization.commission_rate
                    platform_share_total += (
                        Decimal(o.quoted_price) * Decimal(rate) / Decimal("100")
                    ).quantize(Decimal("0.01"))

        completed_orders = revenue_period_qs.count()
        avg_check = (
            (revenue_period / completed_orders).quantize(Decimal("0.01"))
            if completed_orders
            else Decimal("0")
        )

        today = timezone.localdate()
        today_orders = all_orders.filter(created_at__date=today).count()

        by_status = list(
            orders_qs.values("status").annotate(count=Count("id")).order_by("status")
        )
        by_day_rows = (
            orders_qs.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"), revenue=Sum("quoted_price"))
            .order_by("day")
        )
        orders_series = [
            {
                "day": row["day"].isoformat() if row["day"] else None,
                "label": row["day"].isoformat() if row["day"] else "",
                "count": row["count"],
                "revenue": str(row["revenue"] or 0),
            }
            for row in by_day_rows
        ]
        orders_by_day = [
            {
                "day": s["day"],
                "label": s["label"],
                "count": s["count"],
                "revenue": s["revenue"],
            }
            for s in orders_series
        ]

        # Service usage
        service_stats = (
            orders_qs.values(
                "service_id",
                "service__name",
                "service__icon",
                "service__cover_image",
                "service__category",
            )
            .annotate(orders=Count("id"), revenue=Sum("quoted_price"))
            .order_by("-orders")
        )
        service_usage = []
        for row in service_stats:
            firm_rows = (
                orders_qs.filter(service_id=row["service_id"], organization__isnull=False)
                .values("organization_id", "organization__name")
                .annotate(orders=Count("id"))
                .order_by("-orders")[:5]
            )
            service_usage.append(
                {
                    "id": row["service_id"],
                    "name": row["service__name"] or "",
                    "icon": row["service__icon"] or "eco",
                    "image": str(row["service__cover_image"] or ""),
                    "category": row["service__category"] or "",
                    "orders": row["orders"],
                    "revenue": str(row["revenue"] or 0),
                    "firms": [
                        {
                            "id": f["organization_id"],
                            "name": f["organization__name"] or "",
                            "orders": f["orders"],
                        }
                        for f in firm_rows
                    ],
                }
            )
        top_services = service_usage[:5]
        least_services = list(reversed(service_usage[-5:])) if service_usage else []

        firm_revenues = []
        for firm in firms_qs.order_by("name")[:50]:
            firm_orders = orders_qs.filter(organization=firm)
            rev = firm_orders.filter(
                status=Order.Status.COMPLETED, quoted_price__isnull=False
            ).aggregate(total=Sum("quoted_price"))["total"] or Decimal("0")
            share = firm_orders.filter(
                status=Order.Status.COMPLETED
            ).aggregate(total=Sum("platform_share"))["total"]
            if share is None:
                share = (
                    rev * Decimal(firm.commission_rate) / Decimal("100")
                ).quantize(Decimal("0.01"))
            firm_revenues.append(
                {
                    "id": firm.id,
                    "name": firm.name,
                    "status": firm.status,
                    "orders": firm_orders.count(),
                    "revenue": str(rev),
                    "commission_rate": str(firm.commission_rate),
                    "suggested_rate": str(suggested_commission_rate(firm)),
                    "platform_share": str(share),
                }
            )

        recent_orders = [
            {
                "id": o.id,
                "service": o.service.name if o.service_id else "",
                "service_icon": o.service.icon if o.service_id else "",
                "customer": o.customer_name or (o.customer.full_name if o.customer_id else ""),
                "customer_phone": o.customer.phone if o.customer_id else o.phone_number,
                "firm_id": o.organization_id,
                "firm": o.organization.name if o.organization_id else "",
                "status": o.status,
                "quoted_price": str(o.quoted_price) if o.quoted_price is not None else None,
                "platform_share": str(o.platform_share) if o.platform_share is not None else None,
                "created_at": o.created_at.isoformat(),
            }
            for o in recent_qs[:10]
        ]

        new_firms = [
            {
                "id": f.id,
                "name": f.name,
                "phone": f.phone,
                "region": f.region,
                "specialty": f.specialty,
                "status": f.status,
                "commission_rate": str(f.commission_rate),
                "address": f.address,
                "created_at": f.created_at.isoformat(),
            }
            for f in firms_qs.filter(created_at__gte=start, created_at__lte=end).order_by(
                "-created_at"
            )[:10]
        ]
        ended_firms = [
            {
                "id": f.id,
                "name": f.name,
                "phone": f.phone,
                "status": f.status,
                "exit_reason": f.exit_reason,
                "ended_at": f.ended_at.isoformat() if f.ended_at else None,
                "created_at": f.created_at.isoformat(),
            }
            for f in firms_qs.filter(status=Organization.Status.ENDED).order_by("-ended_at")[:10]
        ]
        recent_investors = [
            {
                "id": i.id,
                "full_name": i.full_name,
                "company_name": i.company_name,
                "phone": i.phone,
                "investment_amount": str(i.investment_amount),
                "share_percent": str(i.share_percent),
                "status": i.status,
                "created_at": i.created_at.isoformat(),
            }
            for i in investors_qs.order_by("-created_at")[:10]
        ]

        active_customers = customers_qs.filter(
            orders__created_at__gte=start, orders__created_at__lte=end
        ).distinct().count()

        return {
            "period": period_key,
            "period_days": period_days,
            "date_from": start.date().isoformat(),
            "date_to": end.date().isoformat(),
            "total_customers": customers_qs.count(),
            "active_customers": active_customers,
            "firms_total": firms_qs.count(),
            "firms_active": firms_qs.filter(status=Organization.Status.ACTIVE).count(),
            "firms_ended": firms_qs.filter(status=Organization.Status.ENDED).count(),
            "investors_total": investors_qs.count(),
            "investors_active": investors_qs.filter(status=Investor.Status.ACTIVE).count(),
            "active_orders": active_qs.count(),
            "today_orders": today_orders,
            "revenue_done": str(revenue_done),
            "revenue_period": str(revenue_period),
            "platform_share_total": str(platform_share_total),
            "avg_check": str(avg_check),
            "orders_in_period": curr_count,
            "orders_change_pct": orders_change_pct,
            "completed_orders": completed_orders,
            "orders_by_status": by_status,
            "orders_series": orders_series,
            "orders_by_day": orders_by_day,
            "top_services": top_services,
            "least_services": least_services,
            "firm_revenues": firm_revenues,
            "recent_orders": recent_orders,
            "new_firms": new_firms,
            "ended_firms": ended_firms,
            "recent_investors": recent_investors,
            "catalog_size": services_qs.count(),
            "catalog_active": services_qs.filter(is_active=True).count(),
        }
