from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import AppError
from apps.orders.models import LedgerEntry, Order, OrderEscrow
from apps.organizations.services import FirmService


ACCOUNT_LABELS = {
    "customer_cash": "Mijoz naqd/karta",
    "platform_escrow": "E-Makon escrow",
    "platform_revenue": "E-Makon daromad",
    "firm_payable": "Firmaga to'lov",
    "firm_debt": "Firma qarzi",
    "refund_payable": "Qaytarish majburiyati",
}


def _rate_for_order(order: Order) -> Decimal:
    if order.commission_rate_applied is not None:
        return Decimal(order.commission_rate_applied)
    firm = order.organization
    if firm is not None and firm.commission_rate is not None:
        return Decimal(firm.commission_rate)
    return Decimal("0.30")


def _split(amount: Decimal, rate: Decimal) -> tuple[Decimal, Decimal]:
    fee = (amount * rate / Decimal("100")).quantize(Decimal("0.01"))
    payout = (amount - fee).quantize(Decimal("0.01"))
    return fee, payout


def _ledger(
    *,
    entry_type: str,
    amount: Decimal,
    currency: str,
    debit: str,
    credit: str,
    order: Order | None = None,
    firm=None,
    user=None,
    escrow: OrderEscrow | None = None,
    note: str = "",
    meta: dict | None = None,
) -> LedgerEntry:
    return LedgerEntry.objects.create(
        entry_type=entry_type,
        amount=amount,
        currency=currency,
        debit_account=debit,
        credit_account=credit,
        order=order,
        firm=firm,
        user=user,
        escrow=escrow,
        note=note or "",
        meta=meta or {},
    )


class FinanceService:
    @staticmethod
    @transaction.atomic
    def ensure(order: Order, *, note: str = "", actor=None) -> OrderEscrow:
        if order.quoted_price is None:
            raise AppError("Buyurtmada narx (quoted_price) yo'q.")
        amount = Decimal(order.quoted_price)
        rate = _rate_for_order(order)
        fee, payout = _split(amount, rate)

        escrow, created = OrderEscrow.objects.get_or_create(
            order=order,
            defaults={
                "status": OrderEscrow.Status.AWAITING_PAYMENT,
                "amount": amount,
                "currency": order.currency or "UZS",
                "commission_rate": rate,
                "platform_fee": fee,
                "firm_payout": payout,
                "note": note or "",
            },
        )
        if not created:
            escrow.amount = amount
            escrow.currency = order.currency or escrow.currency
            escrow.commission_rate = rate
            escrow.platform_fee = fee
            escrow.firm_payout = payout
            if note:
                escrow.note = note
            escrow.save()

        order.commission_rate_applied = rate
        order.platform_share = fee
        order.save(update_fields=["commission_rate_applied", "platform_share", "updated_at"])
        return escrow

    @staticmethod
    @transaction.atomic
    def mark_paid(order: Order, *, note: str = "", actor=None) -> OrderEscrow:
        escrow = FinanceService.ensure(order, note=note, actor=actor)
        if escrow.status not in {
            OrderEscrow.Status.AWAITING_PAYMENT,
            OrderEscrow.Status.DISPUTED,
            OrderEscrow.Status.FROZEN,
        }:
            if escrow.status == OrderEscrow.Status.HELD:
                return escrow
            raise AppError(f"Escrow holati to'lov uchun yaroqsiz: {escrow.status}")

        escrow.status = OrderEscrow.Status.HELD
        escrow.paid_at = timezone.now()
        if note:
            escrow.note = note
        escrow.save()

        _ledger(
            entry_type=LedgerEntry.EntryType.ESCROW_HOLD,
            amount=escrow.amount,
            currency=escrow.currency,
            debit="customer_cash",
            credit="platform_escrow",
            order=order,
            firm=order.organization,
            user=order.customer,
            escrow=escrow,
            note=note or "Mijoz to'lovi escrowga",
        )
        return escrow

    @staticmethod
    @transaction.atomic
    def release(order: Order, *, note: str = "", actor=None) -> OrderEscrow:
        try:
            escrow = order.escrow
        except OrderEscrow.DoesNotExist as exc:
            raise AppError("Escrow ochilmagan.") from exc
        if escrow.status != OrderEscrow.Status.HELD:
            raise AppError("Faqat ushlab turilgan escrowni chiqarish mumkin.")

        escrow.status = OrderEscrow.Status.RELEASED
        escrow.released_at = timezone.now()
        if note:
            escrow.note = note
        escrow.save()

        _ledger(
            entry_type=LedgerEntry.EntryType.PLATFORM_FEE,
            amount=escrow.platform_fee,
            currency=escrow.currency,
            debit="platform_escrow",
            credit="platform_revenue",
            order=order,
            firm=order.organization,
            escrow=escrow,
            note="Platforma ulushi",
        )
        _ledger(
            entry_type=LedgerEntry.EntryType.ESCROW_RELEASE,
            amount=escrow.firm_payout,
            currency=escrow.currency,
            debit="platform_escrow",
            credit="firm_payable",
            order=order,
            firm=order.organization,
            escrow=escrow,
            note=note or "Firmaga o'tkazish",
        )
        return escrow

    @staticmethod
    @transaction.atomic
    def refund(
        order: Order,
        *,
        note: str = "",
        punish_firm: bool = False,
        actor=None,
    ) -> OrderEscrow:
        try:
            escrow = order.escrow
        except OrderEscrow.DoesNotExist as exc:
            raise AppError("Escrow ochilmagan.") from exc
        if escrow.status not in {
            OrderEscrow.Status.HELD,
            OrderEscrow.Status.DISPUTED,
            OrderEscrow.Status.FROZEN,
            OrderEscrow.Status.AWAITING_PAYMENT,
        }:
            raise AppError("Bu escrowni qaytarib bo'lmaydi.")

        was_held = escrow.status == OrderEscrow.Status.HELD
        escrow.status = OrderEscrow.Status.REFUNDED
        escrow.refunded_at = timezone.now()
        if note:
            escrow.note = note
        escrow.save()

        if was_held:
            _ledger(
                entry_type=LedgerEntry.EntryType.REFUND,
                amount=escrow.amount,
                currency=escrow.currency,
                debit="platform_escrow",
                credit="refund_payable",
                order=order,
                firm=order.organization,
                user=order.customer,
                escrow=escrow,
                note=note or "Mijozga qaytarish",
            )

        if punish_firm and order.organization_id:
            FirmService.add_fine(
                order.organization,
                Decimal("100000"),
                reason=note or "Refund bilan firma jazo",
                actor=actor,
            )
        return escrow

    @staticmethod
    @transaction.atomic
    def dispute(order: Order, *, note: str = "", actor=None) -> OrderEscrow:
        try:
            escrow = order.escrow
        except OrderEscrow.DoesNotExist:
            escrow = FinanceService.ensure(order, note=note, actor=actor)

        escrow.status = OrderEscrow.Status.DISPUTED
        escrow.disputed_at = timezone.now()
        escrow.dispute_reason = note or escrow.dispute_reason
        if note:
            escrow.note = note
        escrow.save()
        return escrow

    @staticmethod
    @transaction.atomic
    def punish_firm(
        order: Order,
        *,
        note: str = "",
        refund: bool = False,
        fine_amount: Decimal | int | str = 100000,
        sales_ban_days: int = 0,
        actor=None,
    ) -> OrderEscrow:
        firm = order.organization
        if firm is None:
            raise AppError("Buyurtmaga firma biriktirilmagan.")

        try:
            escrow = order.escrow
        except OrderEscrow.DoesNotExist:
            escrow = FinanceService.ensure(order, note=note, actor=actor)

        if refund and escrow.status in {
            OrderEscrow.Status.HELD,
            OrderEscrow.Status.DISPUTED,
            OrderEscrow.Status.FROZEN,
        }:
            FinanceService.refund(order, note=note, punish_firm=False, actor=actor)
            escrow.refresh_from_db()

        amount = Decimal(str(fine_amount or 0))
        if amount > 0:
            FirmService.add_fine(firm, amount, reason=note or "Firma jazo", actor=actor)
            _ledger(
                entry_type=LedgerEntry.EntryType.FINE,
                amount=amount,
                currency=order.currency or "UZS",
                debit="firm_debt",
                credit="platform_revenue",
                order=order,
                firm=firm,
                escrow=escrow,
                note=note or "Firma jarimasi",
            )

        days = int(sales_ban_days or 0)
        if days > 0:
            FirmService.ban_sales(firm, days, reason=note or "", actor=actor)

        return escrow

    @staticmethod
    @transaction.atomic
    def punish_user(
        order: Order,
        *,
        note: str = "",
        block: bool = False,
        release_to_firm: bool = False,
        actor=None,
    ) -> OrderEscrow:
        customer = order.customer
        try:
            escrow = order.escrow
        except OrderEscrow.DoesNotExist:
            escrow = FinanceService.ensure(order, note=note, actor=actor)

        if release_to_firm and escrow.status == OrderEscrow.Status.HELD:
            FinanceService.release(order, note=note or "User jazo — firmaga", actor=actor)
            escrow.refresh_from_db()

        if block:
            customer.is_active = False
            customer.save(update_fields=["is_active"])

        # Soft loyalty penalty when points exist
        points = getattr(customer, "loyalty_points", 0) or 0
        if points > 0:
            deduct = min(points, 50)
            customer.loyalty_points = points - deduct
            customer.save(update_fields=["loyalty_points"])
            try:
                from apps.loyalty.models import PointTransaction

                PointTransaction.objects.create(
                    user=customer,
                    kind=PointTransaction.Kind.ADJUST,
                    points=-deduct,
                    order=order,
                    note=note or "User jazo — ball kamaytirildi",
                )
            except Exception:  # noqa: BLE001
                pass

        _ledger(
            entry_type=LedgerEntry.EntryType.PUNISHMENT,
            amount=Decimal("0"),
            currency=order.currency or "UZS",
            debit="customer_cash",
            credit="platform_revenue",
            order=order,
            firm=order.organization,
            user=customer,
            escrow=escrow,
            note=note or "User jazo",
            meta={"block": block, "release_to_firm": release_to_firm},
        )
        return escrow
