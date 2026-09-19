from __future__ import annotations

from django.db import IntegrityError, transaction

from apps.core.exceptions import AppError, ConflictError
from apps.orders.models import Order, OrderIdempotency, OrderMedia, OrderStatusHistory


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
        if profile_updates:
            customer.save()

        order = Order.objects.create(
            customer=customer,
            organization=(
                getattr(customer, "organization", None)
                or getattr(service, "organization", None)
            ),
            service=service,
            phone_number=phone_number or customer.phone,
            area_size=area_size,
            address=address or customer.formatted_address,
            notes=notes,
            plant_category=plant_category,
            customer_first_name=first_name,
            customer_last_name=last_name,
            status=Order.Status.NEW,
        )
        OrderStatusHistory.objects.create(
            order=order,
            from_status="",
            to_status=Order.Status.NEW,
            changed_by=customer,
            note="Buyurtma yaratildi",
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
        return order, True

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
    def transition(order: Order, to_status: str, *, actor=None, note: str = "") -> Order:
        if to_status not in Order.Status.values:
            raise ValueError("Noto'g'ri status")
        from_status = order.status
        if from_status == to_status:
            return order

        OrderService.assert_transition_allowed(from_status, to_status)

        order.status = to_status
        order.save(update_fields=["status", "updated_at"])
        history = OrderStatusHistory.objects.create(
            order=order,
            from_status=from_status,
            to_status=to_status,
            changed_by=actor,
            note=note,
        )

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
        return order
