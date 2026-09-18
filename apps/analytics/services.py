from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.accounts.models import User
from apps.catalog.models import Service
from apps.orders.models import Order
from apps.staff.commission import calc_platform_share, suggest_commission_rate
from apps.staff.models import Investor, PartnerFirm


def _parse_period(
    *,
    period: str = "month",
    days: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> tuple[datetime, datetime, str]:
    now = timezone.now()
    end = now
    start: datetime

    if date_from or date_to:
        d_from = parse_date(date_from) if date_from else None
        d_to = parse_date(date_to) if date_to else None
        if d_from:
            start = timezone.make_aware(datetime.combine(d_from, datetime.min.time()))
        else:
            start = now - timedelta(days=30)
        if d_to:
            end = timezone.make_aware(datetime.combine(d_to, datetime.max.time().replace(microsecond=0)))
        period_key = "custom"
        return start, end, period_key

    period = (period or "month").lower()
    if days:
        start = now - timedelta(days=max(1, min(int(days), 3650)))
        return start, end, "custom"

    mapping = {
        "day": 1,
        "daily": 1,
        "week": 7,
        "weekly": 7,
        "month": 30,
        "monthly": 30,
        "season": 90,
        "seasonal": 90,
        "quarter": 90,
        "year": 365,
        "yearly": 365,
    }
    span = mapping.get(period, 30)
    start = now - timedelta(days=span)
    return start, end, period if period in mapping else "month"


class DashboardService:
    """Superadmin dashboard — firma, investor, xizmat foydalanishi va aylanma."""

    @staticmethod
    def summary(
        *,
        period: str = "month",
        days: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict:
        now = timezone.now()
        since, until, period_key = _parse_period(
            period=period, days=days, date_from=date_from, date_to=date_to
        )
        span_days = max(1, (until - since).days or 1)
        prev_since = since - timedelta(days=span_days)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        firms_qs = PartnerFirm.objects.all()
        investors_qs = Investor.objects.all()
        customers = User.objects.filter(role=User.Role.CUSTOMER)

        orders_qs = Order.objects.filter(created_at__gte=since, created_at__lte=until)
        prev_orders = Order.objects.filter(created_at__gte=prev_since, created_at__lt=since)
        completed_all = Order.objects.filter(
            status=Order.Status.COMPLETED, quoted_price__isnull=False
        )
        completed_period = completed_all.filter(created_at__gte=since, created_at__lte=until)

        revenue = completed_all.aggregate(total=Sum("quoted_price"))["total"] or Decimal("0")
        revenue_period = (
            completed_period.aggregate(total=Sum("quoted_price"))["total"] or Decimal("0")
        )
        platform_share_total = (
            completed_all.aggregate(total=Sum("platform_share"))["total"] or Decimal("0")
        )
        if not platform_share_total:
            # Fallback estimate from firm rates
            platform_share_total = Decimal("0")
            for row in (
                Order.objects.filter(status=Order.Status.COMPLETED, quoted_price__isnull=False)
                .values("firm_id", "firm__commission_rate")
                .annotate(rev=Sum("quoted_price"))
            ):
                rate = row["firm__commission_rate"] or suggest_commission_rate(row["rev"])
                platform_share_total += calc_platform_share(row["rev"], rate)

        active_orders = Order.objects.exclude(
            status__in=[Order.Status.COMPLETED, Order.Status.CANCELLED]
        ).count()

        # Chart bucket
        if period_key in {"year", "yearly"}:
            trunc = TruncMonth
            label_fmt = "%Y-%m"
        elif period_key in {"season", "seasonal", "quarter"}:
            trunc = TruncWeek
            label_fmt = "%Y-%m-%d"
        elif period_key in {"week", "weekly"}:
            trunc = TruncDate
            label_fmt = "%Y-%m-%d"
        elif period_key in {"day", "daily"}:
            trunc = TruncDate
            label_fmt = "%Y-%m-%d"
        else:
            trunc = TruncDate if span_days <= 62 else TruncWeek
            label_fmt = "%Y-%m-%d"

        series = [
            {
                "day": row["bucket"].date().isoformat()
                if hasattr(row["bucket"], "date")
                else (row["bucket"].isoformat() if row["bucket"] else None),
                "label": row["bucket"].strftime(label_fmt) if row["bucket"] else "",
                "count": row["count"],
                "revenue": str(row["revenue"] or 0),
            }
            for row in orders_qs.annotate(bucket=trunc("created_at"))
            .values("bucket")
            .annotate(count=Count("id"), revenue=Sum("quoted_price"))
            .order_by("bucket")
        ]

        # Top / least used services in period (by order count, not revenue)
        service_stats = list(
            orders_qs.values(
                "service_id",
                "service__name",
                "service__icon",
                "service__hero_image_url",
                "service__category",
            )
            .annotate(orders=Count("id"), revenue=Sum("quoted_price"))
            .order_by("-orders")
        )
        # All active catalog services with 0 usage should appear in least
        used_ids = {row["service_id"] for row in service_stats}
        for svc in Service.objects.filter(is_active=True).exclude(id__in=used_ids):
            service_stats.append(
                {
                    "service_id": svc.id,
                    "service__name": svc.name,
                    "service__icon": svc.icon,
                    "service__hero_image_url": svc.hero_image_url,
                    "service__category": svc.category,
                    "orders": 0,
                    "revenue": 0,
                }
            )

        def enrich_service(row):
            firms = list(
                Order.objects.filter(
                    service_id=row["service_id"],
                    created_at__gte=since,
                    created_at__lte=until,
                    firm__isnull=False,
                )
                .values("firm_id", "firm__name")
                .annotate(orders=Count("id"))
                .order_by("-orders")[:5]
            )
            return {
                "id": row["service_id"],
                "name": row["service__name"],
                "icon": row["service__icon"] or "eco",
                "image": row["service__hero_image_url"] or "",
                "category": row["service__category"] or "",
                "orders": row["orders"],
                "revenue": str(row["revenue"] or 0),
                "firms": [
                    {"id": f["firm_id"], "name": f["firm__name"], "orders": f["orders"]}
                    for f in firms
                ],
            }

        sorted_by_usage = sorted(service_stats, key=lambda r: r["orders"], reverse=True)
        top_services = [enrich_service(r) for r in sorted_by_usage[:4]]
        least_services = [enrich_service(r) for r in sorted(service_stats, key=lambda r: r["orders"])[:4]]

        # Firm revenue table
        firm_rows = []
        for firm in firms_qs.annotate(
            orders_count=Count("orders"),
            revenue_sum=Sum(
                "orders__quoted_price",
                filter=Q(orders__status=Order.Status.COMPLETED),
            ),
        ).order_by("-revenue_sum")[:12]:
            rev = firm.revenue_sum or Decimal("0")
            rate = firm.commission_rate or suggest_commission_rate(rev)
            firm_rows.append(
                {
                    "id": firm.id,
                    "name": firm.name,
                    "status": firm.status,
                    "orders": firm.orders_count,
                    "revenue": str(rev),
                    "commission_rate": str(rate),
                    "suggested_rate": str(suggest_commission_rate(rev)),
                    "platform_share": str(calc_platform_share(rev, rate)),
                }
            )

        recent = (
            Order.objects.select_related("customer", "service", "firm", "assigned_worker")
            .order_by("-created_at")[:4]
        )
        new_firms = firms_qs.exclude(status=PartnerFirm.Status.ENDED).order_by("-created_at")[:5]
        ended_firms = firms_qs.filter(status=PartnerFirm.Status.ENDED).order_by("-ended_at")[:5]
        new_investors = investors_qs.filter(status=Investor.Status.ACTIVE).order_by("-created_at")[
            :5
        ]

        prev_count = prev_orders.count()
        period_count = orders_qs.count()
        orders_change = (
            round(100 * (period_count - prev_count) / prev_count, 1) if prev_count else None
        )

        by_status = list(
            orders_qs.values("status").annotate(count=Count("id")).order_by("status")
        )

        return {
            "period": period_key,
            "period_days": span_days,
            "date_from": since.date().isoformat(),
            "date_to": until.date().isoformat(),
            "total_customers": customers.count(),
            "active_customers": customers.filter(is_active=True).count(),
            "firms_total": firms_qs.count(),
            "firms_active": firms_qs.filter(
                status=PartnerFirm.Status.ACTIVE, is_active=True
            ).count(),
            "firms_ended": firms_qs.filter(status=PartnerFirm.Status.ENDED).count(),
            "investors_total": investors_qs.count(),
            "investors_active": investors_qs.filter(
                status=Investor.Status.ACTIVE, is_active=True
            ).count(),
            "active_orders": active_orders,
            "today_orders": Order.objects.filter(created_at__gte=today_start).count(),
            "revenue_done": str(revenue),
            "revenue_period": str(revenue_period),
            "platform_share_total": str(platform_share_total),
            "avg_check": str(
                (revenue / completed_all.count()).quantize(Decimal("1"))
                if completed_all.count()
                else "0"
            ),
            "orders_in_period": period_count,
            "orders_change_pct": orders_change,
            "completed_orders": completed_all.count(),
            "orders_by_status": by_status,
            "orders_series": series,
            "orders_by_day": series,  # backward compatible
            "top_services": top_services,
            "least_services": least_services,
            "firm_revenues": firm_rows,
            "recent_orders": [
                {
                    "id": o.id,
                    "service": o.service.name,
                    "service_icon": o.service.icon,
                    "customer": o.customer_name or o.customer.phone,
                    "customer_phone": o.phone_number or o.customer.phone,
                    "firm_id": o.firm_id,
                    "firm": o.firm_name or (o.firm.name if o.firm_id else "Tayinlanmagan"),
                    "status": o.status,
                    "quoted_price": str(o.quoted_price) if o.quoted_price is not None else None,
                    "platform_share": str(o.platform_share) if o.platform_share is not None else None,
                    "created_at": o.created_at.isoformat(),
                }
                for o in recent
            ],
            "new_firms": [
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
                for f in new_firms
            ],
            "ended_firms": [
                {
                    "id": f.id,
                    "name": f.name,
                    "phone": f.phone,
                    "status": f.status,
                    "exit_reason": f.exit_reason,
                    "ended_at": f.ended_at.isoformat() if f.ended_at else None,
                    "created_at": f.created_at.isoformat(),
                }
                for f in ended_firms
            ],
            "recent_investors": [
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
                for i in new_investors
            ],
            "catalog_size": Service.objects.count(),
            "catalog_active": Service.objects.filter(is_active=True).count(),
        }

    @staticmethod
    def report_bundle(
        *,
        period: str = "month",
        days: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict:
        """Yagona aylanma hisobot — PDF uchun to'liq paket."""
        summary = DashboardService.summary(
            period=period, days=days, date_from=date_from, date_to=date_to
        )
        return {
            "generated_at": timezone.now().isoformat(),
            "title": "E-MAKON aylanma hisobot",
            "summary": summary,
        }

    @staticmethod
    def map_payload() -> dict:
        firms = []
        for f in PartnerFirm.objects.all():
            firms.append(
                {
                    "id": f.id,
                    "name": f.name,
                    "phone": f.phone,
                    "specialty": f.specialty,
                    "rating": str(f.rating),
                    "status": f.status,
                    "is_active": f.is_active,
                    "lat": float(f.location_lat) if f.location_lat is not None else None,
                    "lng": float(f.location_lng) if f.location_lng is not None else None,
                    "address": f.address,
                }
            )
        orders = []
        active = Order.objects.exclude(
            status__in=[Order.Status.COMPLETED, Order.Status.CANCELLED]
        ).select_related("customer", "service", "firm")
        for o in active:
            lat = o.customer.location_lat
            lng = o.customer.location_lng
            orders.append(
                {
                    "id": o.id,
                    "status": o.status,
                    "service": o.service.name,
                    "customer": o.customer_name or o.customer.phone,
                    "firm": o.firm_name or (o.firm.name if o.firm_id else ""),
                    "address": o.address or o.customer.formatted_address,
                    "lat": float(lat) if lat is not None else None,
                    "lng": float(lng) if lng is not None else None,
                    "assigned_worker": o.assigned_worker_name,
                }
            )
        return {
            "firms": firms,
            "workers": firms,  # backward compatible alias for map UI
            "orders": orders,
            "workers_active": sum(1 for f in firms if f["is_active"] and f["status"] == "active"),
            "orders_active": len(orders),
        }
