"""Firma bandligi: soatlik vaqt oraliqlari va ularning bo'sh/band holati.

Bir vaqtda firma nechta buyurtmani bajara oladi — faol xodimlari soni (kamida 1).
Oraliqqa to'g'ri keladigan faol buyurtmalar shu songa yetsa, oraliq band (qizil).
"""

from __future__ import annotations

from datetime import date, datetime, time

from django.utils import timezone

from apps.core.exceptions import AppError
from apps.orders.models import Order

WORK_START_HOUR = 8
WORK_END_HOUR = 20
SLOT_MINUTES = 60
DEFAULT_DURATION_MINUTES = 60
MAX_DURATION_MINUTES = 12 * 60

ACTIVE_STATUSES = (Order.Status.NEW, Order.Status.IN_REVIEW, Order.Status.CONTACTED)


def _minutes(value: time) -> int:
    return value.hour * 60 + value.minute


def _hhmm(total_minutes: int) -> str:
    total_minutes = max(0, min(total_minutes, 24 * 60))
    return f"{total_minutes // 60:02d}:{total_minutes % 60:02d}"


def format_slot(start: time, duration_minutes: int) -> str:
    begin = _minutes(start)
    return f"{_hhmm(begin)} – {_hhmm(begin + duration_minutes)}"


def parse_time(raw) -> time | None:
    """'09:00', '9:30', '09:00 – 10:00' → time. Noto'g'ri bo'lsa None."""
    if raw is None:
        return None
    if isinstance(raw, time):
        return raw
    text = str(raw).strip()
    if not text:
        return None
    head = text.replace("–", "-").split("-", 1)[0].strip()
    parts = head.split(":")
    if len(parts) < 2:
        return None
    try:
        hour, minute = int(parts[0]), int(parts[1][:2])
    except ValueError:
        return None
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return time(hour, minute)


def parse_day(raw) -> date:
    """`?date=YYYY-MM-DD`; bo'sh bo'lsa bugun."""
    if not raw:
        return _now_local().date()
    try:
        return date.fromisoformat(str(raw)[:10])
    except ValueError:
        raise AppError("Sana formati: YYYY-MM-DD.") from None


def firm_capacity(organization_id: int | None) -> int:
    if not organization_id:
        return 1
    from apps.staff.models import EmployeeProfile

    count = EmployeeProfile.objects.filter(
        organization_id=organization_id,
        is_active=True,
        employment_status=EmployeeProfile.EmploymentStatus.ACTIVE,
    ).count()
    return max(1, count)


def _day_orders(organization_id: int, day: date, exclude_order_id: int | None = None):
    qs = Order.objects.filter(
        organization_id=organization_id,
        scheduled_date=day,
        scheduled_start__isnull=False,
        status__in=ACTIVE_STATUSES,
    ).select_related("service", "customer")
    if exclude_order_id:
        qs = qs.exclude(pk=exclude_order_id)
    return list(qs)


def _overlaps(order: Order, slot_start: int, slot_end: int) -> bool:
    begin = _minutes(order.scheduled_start)
    end = begin + (order.duration_minutes or DEFAULT_DURATION_MINUTES)
    return begin < slot_end and slot_start < end


def _now_local() -> datetime:
    return timezone.localtime(timezone.now())


def day_availability(
    organization_id: int,
    day: date,
    *,
    include_orders: bool = False,
) -> dict:
    capacity = firm_capacity(organization_id)
    orders = _day_orders(organization_id, day)
    now = _now_local()
    slots = []
    for start in range(WORK_START_HOUR * 60, WORK_END_HOUR * 60, SLOT_MINUTES):
        end = start + SLOT_MINUTES
        inside = [o for o in orders if _overlaps(o, start, end)]
        past = day < now.date() or (day == now.date() and start <= now.hour * 60 + now.minute)
        busy = len(inside) >= capacity
        slot = {
            "start": _hhmm(start),
            "end": _hhmm(end),
            "label": f"{_hhmm(start)} – {_hhmm(end)}",
            "busy_count": len(inside),
            "capacity": capacity,
            "available": not busy and not past,
            "status": "past" if past else ("busy" if busy else "free"),
        }
        if include_orders:
            slot["orders"] = [
                {
                    "id": o.pk,
                    "customer_name": o.customer_name,
                    "service_name": o.service.name if o.service_id else "",
                    "assigned_worker_name": o.assigned_worker_name,
                    "time_slot": format_slot(o.scheduled_start, o.duration_minutes),
                    "status": o.status,
                }
                for o in inside
            ]
        slots.append(slot)
    return {
        "date": day.isoformat(),
        "capacity": capacity,
        "work_start": _hhmm(WORK_START_HOUR * 60),
        "work_end": _hhmm(WORK_END_HOUR * 60),
        "slot_minutes": SLOT_MINUTES,
        "slots": slots,
    }


def ensure_slot_available(
    organization_id: int | None,
    day: date | None,
    start: time | None,
    duration_minutes: int,
    *,
    exclude_order_id: int | None = None,
) -> None:
    """Mijoz tanlagan vaqt firma ish vaqtida va bo'sh ekanini tekshiradi."""
    if not organization_id or day is None or start is None:
        return
    begin = _minutes(start)
    if begin < WORK_START_HOUR * 60 or begin >= WORK_END_HOUR * 60:
        raise AppError(
            f"Ish vaqti {_hhmm(WORK_START_HOUR * 60)} – {_hhmm(WORK_END_HOUR * 60)}. Boshqa vaqt tanlang.",
            code="slot_outside_hours",
        )
    now = _now_local()
    if day < now.date() or (day == now.date() and begin <= now.hour * 60 + now.minute):
        raise AppError("O'tib ketgan vaqtni tanlab bo'lmaydi.", code="slot_in_past")

    capacity = firm_capacity(organization_id)
    orders = _day_orders(organization_id, day, exclude_order_id=exclude_order_id)
    end = begin + duration_minutes
    slot_start = begin - (begin % SLOT_MINUTES)
    while slot_start < end:
        slot_end = slot_start + SLOT_MINUTES
        if sum(1 for o in orders if _overlaps(o, slot_start, slot_end)) >= capacity:
            raise AppError(
                f"{_hhmm(slot_start)} – {_hhmm(slot_end)} vaqtida firma band. Boshqa vaqt tanlang.",
                code="slot_busy",
            )
        slot_start = slot_end


def end_time(start: time, duration_minutes: int) -> str:
    return _hhmm(_minutes(start) + duration_minutes)


def clamp_duration(value) -> int:
    try:
        minutes = int(value)
    except (TypeError, ValueError):
        return DEFAULT_DURATION_MINUTES
    return max(30, min(minutes, MAX_DURATION_MINUTES))
