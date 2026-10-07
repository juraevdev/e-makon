from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.core.exceptions import AppError, ConflictError
from apps.orders import schedule
from apps.orders.models import Order, OrderIdempotency, OrderItem, OrderMedia, OrderStatusHistory


# Canonical lifecycle (enforced for admin transitions).
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    Order.Status.NEW: {Order.Status.IN_REVIEW, Order.Status.CANCELLED},
    Order.Status.IN_REVIEW: {Order.Status.CONTACTED, Order.Status.CANCELLED},
    Order.Status.CONTACTED: {
        Order.Status.COMPLETED,
        Order.Status.CANCELLED,
        Order.Status.IN_REVIEW,
    },
    Order.Status.COMPLETED: set(),
    Order.Status.CANCELLED: set(),
}

STAGE_SEQUENCE: list[str] = [
    Order.WorkStage.ACCEPTED,
    Order.WorkStage.ON_THE_WAY,
    Order.WorkStage.ARRIVED,
    Order.WorkStage.WORKING,
    Order.WorkStage.FINISHED,
]

STAGE_STATUS: dict[str, str] = {
    Order.WorkStage.ACCEPTED: Order.Status.IN_REVIEW,
    Order.WorkStage.ON_THE_WAY: Order.Status.CONTACTED,
    Order.WorkStage.ARRIVED: Order.Status.CONTACTED,
    Order.WorkStage.WORKING: Order.Status.CONTACTED,
    Order.WorkStage.FINISHED: Order.Status.COMPLETED,
}

CUSTOMER_CANCELLABLE_STAGES: set[str] = {"", Order.WorkStage.ACCEPTED}

STATUS_PATH: list[str] = [
    Order.Status.NEW,
    Order.Status.IN_REVIEW,
    Order.Status.CONTACTED,
    Order.Status.COMPLETED,
]


def stage_message(order: Order) -> tuple[str, str]:
    label = Order.WorkStage(order.work_stage).label if order.work_stage else ""
    title = f"Buyurtma #{order.pk}: {label}"
    parts: list[str] = []
    if order.work_stage == Order.WorkStage.ACCEPTED:
        parts.append(f"{order.organization.name if order.organization_id else 'Firma'} buyurtmangizni qabul qildi.")
    elif order.work_stage == Order.WorkStage.ON_THE_WAY:
        parts.append("Ishchi guruh sizning manzilingizga yo'lga chiqdi.")
    elif order.work_stage == Order.WorkStage.ARRIVED:
        parts.append("Ishchi guruh manzilga yetib keldi.")
    elif order.work_stage == Order.WorkStage.WORKING:
        parts.append("Ishlar boshlandi.")
    elif order.work_stage == Order.WorkStage.FINISHED:
        parts.append(
            "Ishlar yakunlandi. Tizim ma'muriyati tasdiqlagach to'lov firmaga o'tkaziladi."
        )
    if order.work_stage in {Order.WorkStage.ACCEPTED, Order.WorkStage.ON_THE_WAY}:
        if order.distance_km is not None:
            parts.append(f"Masofa: {order.distance_km.normalize():f} km.")
        if order.eta_minutes:
            parts.append(f"Taxminan {order.eta_minutes} daqiqada yetib boradi.")
    if order.assigned_worker_name:
        parts.append(f"Mas'ul: {order.assigned_worker_name}.")
    return title, " ".join(parts)


class OrderService:
    @staticmethod
    @transaction.atomic
    def create_order(
        *,
        customer,
        service,
        phone_number: str = "",
        area_size: str = "",
        address: str = "",
        notes: str = "",
        plant_category: str = "",
        customer_first_name: str = "",
        customer_last_name: str = "",
        media_files: list | None = None,
        idempotency_key: str | None = None,
        quoted_price=None,
        scheduled_date=None,
        time_slot: str = "",
        scheduled_start=None,
        duration_minutes: int | None = None,
        location_lat=None,
        location_lng=None,
        items: list[tuple] | None = None,
    ) -> tuple[Order, bool]:
        """
        Create an order. Returns (order, created).
        If idempotency_key matches an existing record for this customer, returns that order.
        """
        if idempotency_key:
            existing = (
                OrderIdempotency.objects.select_related(
                    "order",
                    "order__service",
                    "order__customer",
                )
                .filter(customer=customer, key=idempotency_key)
                .first()
            )
            if existing:
                return existing.order, False

        firm = getattr(service, "organization", None)
        if firm is not None and (not firm.is_active or firm.is_sales_banned):
            raise AppError(
                "Bu xizmat ko'rsatuvchi hozircha buyurtma qabul qilmaydi.",
                code="firm_unavailable",
            )

        first_name = (customer_first_name or customer.first_name or "").strip()
        last_name = (customer_last_name or customer.last_name or "").strip()

        profile_updates: list[str] = []
        if first_name and not customer.first_name:
            customer.first_name = first_name
            profile_updates.append("first_name")
        if last_name and not customer.last_name:
            customer.last_name = last_name
            profile_updates.append("last_name")
        if address and not customer.home_address and not customer.formatted_address:
            customer.home_address = address
            profile_updates.append("home_address")
        organization = getattr(service, "organization", None) or getattr(
            customer, "organization", None
        )
        start = schedule.parse_time(scheduled_start) or schedule.parse_time(time_slot)
        duration = schedule.clamp_duration(duration_minutes or schedule.DEFAULT_DURATION_MINUTES)
        if start is not None and scheduled_date is not None and organization is not None:
            from apps.organizations.models import Organization

            # Bir vaqtda ikki mijoz oxirgi bo'sh joyni band qilmasligi uchun.
            Organization.objects.select_for_update().filter(pk=organization.pk).first()
            schedule.ensure_slot_available(organization.pk, scheduled_date, start, duration)
            time_slot = schedule.format_slot(start, duration)

        if profile_updates:
            customer.save()

        order = Order.objects.create(
            customer=customer,
            organization=organization,
            service=service,
            phone_number=phone_number or customer.phone,
            area_size=area_size,
            address=address or customer.formatted_address,
            notes=notes,
            plant_category=plant_category,
            customer_first_name=first_name,
            customer_last_name=last_name,
            quoted_price=quoted_price,
            scheduled_date=scheduled_date,
            time_slot=time_slot,
            scheduled_start=start,
            duration_minutes=duration,
            location_lat=location_lat,
            location_lng=location_lng,
            status=Order.Status.NEW,
        )
        OrderStatusHistory.objects.create(
            order=order,
            from_status="",
            to_status=Order.Status.NEW,
            changed_by=customer,
            note="Buyurtma yaratildi",
        )
        OrderItem.objects.bulk_create(
            [
                OrderItem(order=order, service=item_service, amount=amount, sort_order=index)
                for index, (item_service, amount) in enumerate(items or [(service, quoted_price)])
            ]
        )
        for index, uploaded in enumerate(media_files or []):
            kind = (
                OrderMedia.Kind.VIDEO
                if getattr(uploaded, "content_type", "").startswith("video")
                else OrderMedia.Kind.PHOTO
            )
            OrderMedia.objects.create(order=order, file=uploaded, kind=kind, sort_order=index)

        if idempotency_key:
            try:
                with transaction.atomic():
                    OrderIdempotency.objects.create(
                        key=idempotency_key,
                        customer=customer,
                        order=order,
                    )
            except IntegrityError:
                # Concurrent create with same key — return the winner.
                existing = (
                    OrderIdempotency.objects.select_related("order")
                    .filter(customer=customer, key=idempotency_key)
                    .first()
                )
                if existing:
                    return existing.order, False
                raise ConflictError("Idempotency conflict.") from None

        from apps.notifications.services import NotificationService

        NotificationService.enqueue_order_event(
            event_type="order.created",
            order=order,
            extra={"from_status": "", "to_status": Order.Status.NEW},
        )
        if order.organization_id:
            from apps.organizations.models import FirmMessage

            FirmMessage.objects.create(
                firm_id=order.organization_id,
                kind=FirmMessage.Kind.MESSAGE,
                subject=f"Yangi buyurtma #{order.pk}",
                body=f"{service.name} · {order.address or 'manzil ko‘rsatilmagan'}.",
            )
        return order, True

    @staticmethod
    def customer_can_cancel(order: Order) -> bool:
        """Mijoz ishchi guruh yo'lga chiqquncha bekor qila oladi; keyin firma yoki platforma orqali."""
        if order.status not in {Order.Status.NEW, Order.Status.IN_REVIEW}:
            return False
        return order.work_stage in CUSTOMER_CANCELLABLE_STAGES

    @staticmethod
    def assert_transition_allowed(from_status: str, to_status: str) -> None:
        if to_status not in Order.Status.values:
            raise ValueError("Noto'g'ri status")
        if from_status == to_status:
            return
        allowed = ALLOWED_TRANSITIONS.get(from_status, set())
        if to_status not in allowed:
            raise AppError(
                f"Status o'tishi ruxsat etilmagan: {from_status} → {to_status}",
                code="order_invalid_state",
            )

    @staticmethod
    @transaction.atomic
    def transition(
        order: Order, to_status: str, *, actor=None, note: str = "", silent: bool = False
    ) -> Order:
        if to_status not in Order.Status.values:
            raise ValueError("Noto'g'ri status")
        from_status = order.status
        if from_status == to_status:
            return order

        OrderService.assert_transition_allowed(from_status, to_status)

        from apps.orders.finance import FinanceService
        from apps.orders.models import OrderEscrow
        from apps.orders.payments import PaymentService

        if (
            from_status == Order.Status.NEW
            and to_status != Order.Status.CANCELLED
            and PaymentService.requires_payment(order)
            and not PaymentService.is_paid(order)
        ):
            raise AppError(
                "To'lov tasdiqlanmaguncha buyurtmani ishga olib bo'lmaydi.",
                code="order_payment_required",
            )

        order.status = to_status
        update_fields = ["status", "updated_at"]
        if to_status == Order.Status.IN_REVIEW and not order.work_stage:
            order.work_stage = Order.WorkStage.ACCEPTED
            order.work_stage_at = timezone.now()
            update_fields += ["work_stage", "work_stage_at"]
        elif to_status == Order.Status.COMPLETED and order.work_stage != Order.WorkStage.FINISHED:
            order.work_stage = Order.WorkStage.FINISHED
            order.work_stage_at = timezone.now()
            update_fields += ["work_stage", "work_stage_at"]
        order.save(update_fields=update_fields)
        history = OrderStatusHistory.objects.create(
            order=order,
            from_status=from_status,
            to_status=to_status,
            stage=order.work_stage,
            changed_by=actor,
            note=note,
        )

        escrow = PaymentService.escrow_of(order)
        if escrow is not None and escrow.status == OrderEscrow.Status.HELD:
            # A firm marking its own order completed must not pay itself out;
            # the platform (superadmin) confirms the release separately.
            firm_actor = getattr(actor, "role", None) not in {None, User.Role.SUPERADMIN}
            if to_status == Order.Status.COMPLETED and not firm_actor:
                FinanceService.release(
                    order, note="Ish yakunlandi — pul firmaga o'tkazildi", actor=actor
                )
            elif to_status == Order.Status.CANCELLED:
                FinanceService.refund(
                    order, note="Buyurtma bekor qilindi — pul mijozga qaytariladi", actor=actor
                )

        if to_status == Order.Status.COMPLETED:
            from apps.loyalty.services import LoyaltyService

            LoyaltyService.award_for_order(order)

        from apps.notifications.services import NotificationService

        event_type = (
            "order.cancelled"
            if to_status == Order.Status.CANCELLED
            else "order.status_changed"
        )
        NotificationService.enqueue_order_event(
            event_type=event_type,
            order=order,
            extra={
                "from_status": from_status,
                "to_status": to_status,
                "history_id": history.pk,
            },
            delivery_key=f"order:{order.pk}:hist:{history.pk}",
        )
        if not silent and actor is not None and actor.pk != order.customer_id:
            from apps.notifications.services import notify_user

            notify_user(
                order.customer,
                kind="order",
                title=f"Buyurtma #{order.pk}: {Order.Status(to_status).label}",
                body=note or f"{order.service.name} buyurtmangiz holati yangilandi.",
                entity_type="order",
                entity_id=order.pk,
            )
        return order

    @staticmethod
    @transaction.atomic
    def set_stage(
        order: Order,
        stage: str,
        *,
        actor=None,
        distance_km=None,
        eta_minutes: int | None = None,
        note: str = "",
    ) -> Order:
        """Firma ishchi guruhi bosqichini belgilaydi; status kerak bo'lsa birga suriladi."""
        if stage not in STAGE_SEQUENCE:
            raise AppError("Noto'g'ri ish bosqichi.", code="order_invalid_stage")
        if order.status in {Order.Status.CANCELLED, Order.Status.COMPLETED}:
            raise AppError("Yopilgan buyurtma bosqichini o'zgartirib bo'lmaydi.", code="order_closed")
        previous_stage = order.work_stage
        current = STAGE_SEQUENCE.index(previous_stage) if previous_stage else -1
        target = STAGE_SEQUENCE.index(stage)
        if target < current:
            raise AppError("Bosqichni orqaga qaytarib bo'lmaydi.", code="order_stage_backwards")

        target_status = STAGE_STATUS[stage]
        path_from = STATUS_PATH.index(order.status)
        path_to = STATUS_PATH.index(target_status)
        for next_status in STATUS_PATH[path_from + 1 : path_to + 1]:
            OrderService.transition(order, next_status, actor=actor, note=note, silent=True)

        now = timezone.now()
        if distance_km is not None:
            order.distance_km = Decimal(str(distance_km))
        if eta_minutes is not None:
            order.eta_minutes = int(eta_minutes)
            order.eta_at = now + timedelta(minutes=int(eta_minutes))
        changed = previous_stage != stage
        order.work_stage = stage
        if changed:
            order.work_stage_at = now
        order.save(
            update_fields=[
                "work_stage",
                "work_stage_at",
                "distance_km",
                "eta_minutes",
                "eta_at",
                "updated_at",
            ]
        )
        if changed or distance_km is not None or eta_minutes is not None:
            OrderStatusHistory.objects.create(
                order=order,
                from_status=order.status,
                to_status=order.status,
                stage=stage,
                changed_by=actor,
                note=note or Order.WorkStage(stage).label,
            )
            from apps.notifications.services import notify_user

            title, body = stage_message(order)
            notify_user(
                order.customer,
                kind="order",
                title=title,
                body=(f"{body} {note}".strip() if note else body),
                entity_type="order",
                entity_id=order.pk,
            )
        return order

    @staticmethod
    @transaction.atomic
    def reschedule(
        order: Order,
        *,
        actor=None,
        scheduled_date=None,
        scheduled_start=None,
        duration_minutes: int | None = None,
        extend_minutes: int | None = None,
        note: str = "",
    ) -> Order:
        """Firma vaqtni ko'chiradi yoki ish cho'zilganda davomiylikni uzaytiradi."""
        if order.status in {Order.Status.CANCELLED, Order.Status.COMPLETED}:
            raise AppError("Yopilgan buyurtma vaqtini o'zgartirib bo'lmaydi.", code="order_closed")

        day = scheduled_date or order.scheduled_date
        start = schedule.parse_time(scheduled_start) or order.scheduled_start
        if day is None or start is None:
            raise AppError("Buyurtma sanasi va boshlanish vaqtini kiriting.", code="schedule_required")
        duration = order.duration_minutes or schedule.DEFAULT_DURATION_MINUTES
        if duration_minutes:
            duration = schedule.clamp_duration(duration_minutes)
        if extend_minutes:
            duration = schedule.clamp_duration(duration + int(extend_minutes))

        moved = day != order.scheduled_date or start != order.scheduled_start
        if moved and order.organization_id:
            from apps.organizations.models import Organization

            Organization.objects.select_for_update().filter(pk=order.organization_id).first()
            schedule.ensure_slot_available(
                order.organization_id, day, start, duration, exclude_order_id=order.pk
            )
        # Faqat uzaytirish bloklanmaydi: ish allaqachon ketmoqda, keyingi oraliqlar band bo'lib ko'rinadi.

        before = order.time_slot
        order.scheduled_date = day
        order.scheduled_start = start
        order.duration_minutes = duration
        order.time_slot = schedule.format_slot(start, duration)
        order.save(
            update_fields=[
                "scheduled_date",
                "scheduled_start",
                "duration_minutes",
                "time_slot",
                "updated_at",
            ]
        )
        if before != order.time_slot or moved:
            text = f"Vaqt: {day.strftime('%d.%m.%Y')} {order.time_slot}"
            OrderStatusHistory.objects.create(
                order=order,
                from_status=order.status,
                to_status=order.status,
                changed_by=actor,
                note=f"{text}. {note}".strip() if note else text,
            )
            from apps.notifications.services import notify_user

            notify_user(
                order.customer,
                kind="order",
                title=f"Buyurtma #{order.pk}: vaqt yangilandi",
                body=f"{text}." + (f" {note}" if note else ""),
                entity_type="order",
                entity_id=order.pk,
            )
        return order
