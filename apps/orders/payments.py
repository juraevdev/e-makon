from __future__ import annotations

import base64
import math
import re
from decimal import Decimal
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import AppError
from apps.orders.finance import FinanceService
from apps.orders.models import Order, OrderEscrow, OrderPayment


_AREA_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*([a-zA-Z'ʻ‘`²]*)")
_AREA_UNITS_M2 = {
    "sotix": 100.0,
    "sotih": 100.0,
    "sotik": 100.0,
    "sotiq": 100.0,
    "sot": 100.0,
    "ga": 10000.0,
    "gektar": 10000.0,
    "ha": 10000.0,
}


def _parse_area(raw: str) -> float:
    """Kvadrat metr: "250", "250 m2", "2 sotix", "0,5 ga" kabi yozuvlarni tushunadi."""
    match = _AREA_RE.search(str(raw or "").strip().lower())
    if not match:
        return 0.0
    value = float(match.group(1).replace(",", "."))
    unit = match.group(2).strip("'ʻ‘`")
    return value * _AREA_UNITS_M2.get(unit, 1.0)


def estimate_for_service(service, area_m2: float) -> int:
    """Mobil `PriceCalculator.estimateForService` bilan bir xil formula."""
    price_min = int(service.price_from or 0)
    price_max = int(service.price_to or 0)
    if price_min <= 0 and price_max <= 0:
        return 0
    if area_m2 <= 0:
        return price_min
    blocks = min(max(math.ceil(area_m2 / 10), 1), 500)
    raw_step = (price_max - price_min) / 40 if price_max > price_min else price_min * 0.04
    per_block = min(max(math.floor(raw_step + 0.5), 5000), 500000)
    total = price_min + (blocks - 1) * per_block
    if price_max > 0:
        return min(max(total, price_min), price_max)
    return total


def estimate_items(services, area_size: str) -> list[tuple[object, Decimal | None]]:
    area = _parse_area(area_size)
    items = []
    for service in services:
        amount = estimate_for_service(service, area)
        items.append((service, Decimal(amount) if amount > 0 else None))
    return items


def _payme_url(order: Order, amount: Decimal) -> str:
    merchant_id = settings.PAYME_MERCHANT_ID
    if not merchant_id:
        return ""
    tiyin = int(amount * 100)
    parts = [f"m={merchant_id}", f"ac.{settings.PAYME_ACCOUNT_FIELD}={order.pk}", f"a={tiyin}"]
    if settings.PAYMENT_RETURN_URL:
        parts.append(f"c={settings.PAYMENT_RETURN_URL}")
    encoded = base64.b64encode(";".join(parts).encode()).decode()
    return f"{settings.PAYME_CHECKOUT_URL.rstrip('/')}/{encoded}"


def _click_url(order: Order, amount: Decimal) -> str:
    if not (settings.CLICK_SERVICE_ID and settings.CLICK_MERCHANT_ID):
        return ""
    params = {
        "service_id": settings.CLICK_SERVICE_ID,
        "merchant_id": settings.CLICK_MERCHANT_ID,
        "amount": f"{amount:.2f}",
        "transaction_param": str(order.pk),
    }
    if settings.PAYMENT_RETURN_URL:
        params["return_url"] = settings.PAYMENT_RETURN_URL
    return f"{settings.CLICK_CHECKOUT_URL}?{urlencode(params)}"


def provider_ready(provider: str) -> bool:
    if provider == OrderPayment.Provider.PAYME:
        return bool(settings.PAYME_MERCHANT_ID)
    if provider == OrderPayment.Provider.CLICK:
        return bool(settings.CLICK_SERVICE_ID and settings.CLICK_MERCHANT_ID)
    return False


def payment_options() -> dict:
    return {
        "click": provider_ready(OrderPayment.Provider.CLICK),
        "payme": provider_ready(OrderPayment.Provider.PAYME),
        "test": bool(settings.PAYMENTS_TEST_MODE),
    }


def checkout_url(order: Order, provider: str, amount: Decimal) -> str:
    if provider == OrderPayment.Provider.PAYME:
        return _payme_url(order, amount)
    if provider == OrderPayment.Provider.CLICK:
        return _click_url(order, amount)
    return ""


class PaymentService:
    PAID_ESCROW = {OrderEscrow.Status.HELD, OrderEscrow.Status.RELEASED}

    @staticmethod
    def requires_payment(order: Order) -> bool:
        return order.quoted_price is not None and Decimal(order.quoted_price) > 0

    @staticmethod
    def escrow_of(order: Order) -> OrderEscrow | None:
        try:
            return order.escrow
        except OrderEscrow.DoesNotExist:
            return None

    @staticmethod
    def is_paid(order: Order) -> bool:
        escrow = PaymentService.escrow_of(order)
        return escrow is not None and escrow.status in PaymentService.PAID_ESCROW

    @staticmethod
    def latest(order: Order, *, use_prefetched: bool = False) -> OrderPayment | None:
        cached = getattr(order, "_prefetched_objects_cache", {}).get("payments")
        if use_prefetched and cached is not None:
            return max(cached, key=lambda p: (p.created_at, p.id), default=None)
        return order.payments.order_by("-created_at", "-id").first()

    @staticmethod
    def status(order: Order, *, use_prefetched: bool = False) -> str:
        """not_required | unpaid | checking | rejected | paid | released | refunded"""
        if not PaymentService.requires_payment(order):
            return "not_required"
        escrow = PaymentService.escrow_of(order)
        if escrow is not None:
            if escrow.status == OrderEscrow.Status.HELD:
                return "paid"
            if escrow.status == OrderEscrow.Status.RELEASED:
                return "released"
            if escrow.status == OrderEscrow.Status.REFUNDED:
                return "refunded"
        payment = PaymentService.latest(order, use_prefetched=use_prefetched)
        if payment is not None:
            if payment.status == OrderPayment.Status.SUBMITTED:
                return "checking"
            if payment.status == OrderPayment.Status.REJECTED:
                return "rejected"
        return "unpaid"

    @staticmethod
    @transaction.atomic
    def pay_test(order: Order, *, actor=None) -> OrderEscrow:
        """Click/Payme ulanmagan davrda: to'lov darhol tasdiqlanadi, buyurtma firmaga tushadi."""
        if not settings.PAYMENTS_TEST_MODE:
            raise AppError("Sinov to'lovi o'chirilgan. Click yoki Payme orqali to'lang.")
        PaymentService.start(order, OrderPayment.Provider.TEST)
        escrow = PaymentService.confirm(
            order,
            note="Sinov to'lovi — Click/Payme vaqtincha ulanmagan",
            actor=actor,
        )
        if order.organization_id:
            from apps.organizations.models import FirmMessage

            FirmMessage.objects.create(
                firm_id=order.organization_id,
                kind=FirmMessage.Kind.MESSAGE,
                subject=f"Yangi to'langan buyurtma #{order.pk}",
                body=(
                    f"{order.service.name} · {order.address or 'manzil ko‘rsatilmagan'}. "
                    "To'lov (sinov rejimi) tizim hisobida — buyurtmani qabul qiling."
                ),
            )
        return escrow

    @staticmethod
    @transaction.atomic
    def start(order: Order, provider: str) -> OrderPayment:
        if provider not in OrderPayment.Provider.values:
            raise AppError("Noma'lum to'lov usuli.")
        if provider == OrderPayment.Provider.TEST and not settings.PAYMENTS_TEST_MODE:
            raise AppError("Sinov to'lovi o'chirilgan.")
        if order.status in {Order.Status.CANCELLED, Order.Status.COMPLETED}:
            raise AppError("Bu buyurtma uchun to'lov qilib bo'lmaydi.")
        if not PaymentService.requires_payment(order):
            raise AppError("Bu buyurtma uchun to'lov talab qilinmaydi.")
        if PaymentService.is_paid(order):
            raise AppError("Buyurtma allaqachon to'langan.")

        escrow = FinanceService.ensure(order, note="To'lov boshlandi")
        if escrow.status == OrderEscrow.Status.REFUNDED:
            raise AppError("Bu buyurtma bo'yicha pul qaytarilgan.")

        amount = Decimal(order.quoted_price)
        payment = PaymentService.latest(order)
        if (
            payment is not None
            and payment.status == OrderPayment.Status.PENDING
            and payment.provider == provider
            and payment.amount == amount
        ):
            return payment

        return OrderPayment.objects.create(
            order=order,
            provider=provider,
            amount=amount,
            currency=order.currency or "UZS",
            checkout_url=checkout_url(order, provider, amount),
        )

    @staticmethod
    @transaction.atomic
    def submit(order: Order) -> OrderPayment:
        payment = PaymentService.latest(order)
        if payment is None:
            raise AppError("Avval to'lov usulini tanlang.")
        if payment.status == OrderPayment.Status.SUBMITTED:
            return payment
        if payment.status != OrderPayment.Status.PENDING:
            raise AppError("Yangi to'lovni boshlang.")
        payment.status = OrderPayment.Status.SUBMITTED
        payment.submitted_at = timezone.now()
        payment.save(update_fields=["status", "submitted_at", "updated_at"])
        return payment

    @staticmethod
    @transaction.atomic
    def confirm(order: Order, *, note: str = "", actor=None) -> OrderEscrow:
        escrow = FinanceService.mark_paid(order, note=note, actor=actor)
        payment = PaymentService.latest(order)
        if payment is not None and payment.status in {
            OrderPayment.Status.PENDING,
            OrderPayment.Status.SUBMITTED,
        }:
            payment.status = OrderPayment.Status.CONFIRMED
            payment.resolved_at = timezone.now()
            payment.resolved_by = actor
            if note:
                payment.note = note
            payment.save()
        return escrow

    @staticmethod
    @transaction.atomic
    def reject(order: Order, *, note: str = "", actor=None) -> OrderPayment:
        payment = PaymentService.latest(order)
        if payment is None or payment.status not in {
            OrderPayment.Status.PENDING,
            OrderPayment.Status.SUBMITTED,
        }:
            raise AppError("Tekshiriladigan to'lov yo'q.")
        payment.status = OrderPayment.Status.REJECTED
        payment.resolved_at = timezone.now()
        payment.resolved_by = actor
        payment.note = note or "To'lov hisobga tushmadi"
        payment.save()
        return payment
