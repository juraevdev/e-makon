from __future__ import annotations

from django.db import transaction

from apps.orders.models import Order, OrderMedia, OrderStatusHistory


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
    ) -> Order:
        first_name = (customer_first_name or customer.first_name or "").strip()
        last_name = (customer_last_name or customer.last_name or "").strip()

        # Keep profile in sync when order carries name/address
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
        return order

    @staticmethod
    @transaction.atomic
    def transition(order: Order, to_status: str, *, actor=None, note: str = "") -> Order:
        if to_status not in Order.Status.values:
            raise ValueError("Noto'g'ri status")
        from_status = order.status
        if from_status == to_status:
            return order
        order.status = to_status
        order.save(update_fields=["status", "updated_at"])
        OrderStatusHistory.objects.create(
            order=order,
            from_status=from_status,
            to_status=to_status,
            changed_by=actor,
            note=note,
        )
        return order
