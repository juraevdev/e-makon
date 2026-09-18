from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import AppError
from apps.finance.models import LedgerEntry, OrderEscrow
from apps.orders.models import Order
from apps.staff.commission import calc_platform_share, suggest_commission_rate
from apps.staff.models import FirmModerationLog, PartnerFirm
from apps.staff.serializers import log_moderation


def _dec(value) -> Decimal:
    return Decimal(str(value or 0))


def post_ledger(
    *,
    entry_type: str,
    amount,
    debit: str,
    credit: str,
    order=None,
    firm=None,
    user=None,
    escrow=None,
    created_by=None,
    note: str = "",
    meta: dict | None = None,
    currency: str = "UZS",
) -> LedgerEntry:
    return LedgerEntry.objects.create(
        entry_type=entry_type,
        amount=_dec(amount),
        currency=currency,
        debit_account=debit,
        credit_account=credit,
        order=order,
        firm=firm,
        user=user,
        escrow=escrow,
        created_by=created_by,
        note=note,
        meta=meta or {},
    )


class EscrowService:
    """Escrow hayoti: to'lov → ushlash → firmaga / userga."""

    @staticmethod
    def _rate_for_order(order: Order) -> Decimal:
        if order.firm_id and order.firm is not None:
            return _dec(order.firm.commission_rate or suggest_commission_rate(order.quoted_price))
        return suggest_commission_rate(order.quoted_price)

    @staticmethod
    @transaction.atomic
    def ensure_escrow(order: Order, *, actor=None) -> OrderEscrow:
        if order.quoted_price is None or _dec(order.quoted_price) <= 0:
            raise AppError("Avval kelishilgan narx (quoted_price) belgilang.")
        escrow = getattr(order, "escrow", None)
        if escrow is not None:
            return escrow
        rate = EscrowService._rate_for_order(order)
        fee = calc_platform_share(order.quoted_price, rate)
        payout = _dec(order.quoted_price) - fee
        return OrderEscrow.objects.create(
            order=order,
            status=OrderEscrow.Status.AWAITING_PAYMENT,
            amount=_dec(order.quoted_price),
            currency=order.currency or "UZS",
            commission_rate=rate,
            platform_fee=fee,
            firm_payout=payout,
            last_action_by=actor,
            note="Escrow ochildi — user E-Makonga to'lashi kutilmoqda",
        )

    @staticmethod
    @transaction.atomic
    def mark_user_paid(order: Order, *, actor=None, note: str = "") -> OrderEscrow:
        """Foydalanuvchi pulni E-Makonga tashladi — escrow HELD."""
        escrow = EscrowService.ensure_escrow(order, actor=actor)
        if escrow.status not in {
            OrderEscrow.Status.AWAITING_PAYMENT,
            OrderEscrow.Status.DISPUTED,
        }:
            raise AppError(f"To'lov qabul qilib bo'lmaydi (holat: {escrow.status}).")
        # Sync amount if price changed before pay
        if order.quoted_price is not None:
            escrow.amount = _dec(order.quoted_price)
            escrow.commission_rate = EscrowService._rate_for_order(order)
            escrow.recalc_split()
        escrow.status = OrderEscrow.Status.HELD
        escrow.paid_at = timezone.now()
        escrow.last_action_by = actor
        if note:
            escrow.note = note
        escrow.save()
        post_ledger(
            entry_type=LedgerEntry.EntryType.ESCROW_IN,
            amount=escrow.amount,
            debit=LedgerEntry.Account.USER,
            credit=LedgerEntry.Account.PLATFORM_ESCROW,
            order=order,
            firm=order.firm,
            user=order.customer,
            escrow=escrow,
            created_by=actor,
            note=note or "User E-Makonga to'ladi — pul escrowda",
            currency=escrow.currency,
        )
        return escrow

    @staticmethod
    @transaction.atomic
    def release_to_firm(order: Order, *, actor=None, note: str = "") -> OrderEscrow:
        """Ish bajarilgan — firmaga to'lov (platforma ulushi ushlab qolinadi)."""
        escrow = getattr(order, "escrow", None)
        if escrow is None:
            raise AppError("Escrow yo'q. Avval user to'lovi kerak.")
        if escrow.status != OrderEscrow.Status.HELD:
            raise AppError(f"Firmaga o'tkazib bo'lmaydi (holat: {escrow.status}).")
        if order.status != Order.Status.COMPLETED:
            raise AppError("Firma ishni yakunlamagan — pul berilmaydi.")
        if not order.firm_id:
            raise AppError("Buyurtmaga firma biriktirilmagan.")

        # Re-apply current firm rate at release (rate hike reflected)
        escrow.commission_rate = EscrowService._rate_for_order(order)
        escrow.recalc_split()
        escrow.status = OrderEscrow.Status.RELEASED
        escrow.released_at = timezone.now()
        escrow.last_action_by = actor
        if note:
            escrow.note = note
        escrow.save()

        order.commission_rate_applied = escrow.commission_rate
        order.platform_share = escrow.platform_fee
        order.save(update_fields=["commission_rate_applied", "platform_share", "updated_at"])

        post_ledger(
            entry_type=LedgerEntry.EntryType.ESCROW_RELEASE,
            amount=escrow.firm_payout,
            debit=LedgerEntry.Account.PLATFORM_ESCROW,
            credit=LedgerEntry.Account.FIRM_PAYABLE,
            order=order,
            firm=order.firm,
            user=order.customer,
            escrow=escrow,
            created_by=actor,
            note=note or "Ish yakunlandi — firmaga to'lov",
            currency=escrow.currency,
            meta={"firm_payout": str(escrow.firm_payout)},
        )
        post_ledger(
            entry_type=LedgerEntry.EntryType.COMMISSION,
            amount=escrow.platform_fee,
            debit=LedgerEntry.Account.PLATFORM_ESCROW,
            credit=LedgerEntry.Account.PLATFORM_REVENUE,
            order=order,
            firm=order.firm,
            user=order.customer,
            escrow=escrow,
            created_by=actor,
            note=f"Kampaniya ulushi {escrow.commission_rate}%",
            currency=escrow.currency,
            meta={"rate": str(escrow.commission_rate)},
        )
        return escrow

    @staticmethod
    @transaction.atomic
    def refund_to_user(order: Order, *, actor=None, note: str = "", punish_firm: bool = False) -> OrderEscrow:
        """
        Firma ish qilmay pul olmoqchi / tovlamachilik / bekor —
        pul userga qaytariladi, firmaga berilmaydi.
        """
        escrow = getattr(order, "escrow", None)
        if escrow is None:
            raise AppError("Escrow yo'q.")
        if escrow.status not in {
            OrderEscrow.Status.HELD,
            OrderEscrow.Status.DISPUTED,
            OrderEscrow.Status.FROZEN,
        }:
            raise AppError(f"Qaytarib bo'lmaydi (holat: {escrow.status}).")

        escrow.status = OrderEscrow.Status.REFUNDED
        escrow.refunded_at = timezone.now()
        escrow.last_action_by = actor
        escrow.note = note or escrow.note
        escrow.save()

        post_ledger(
            entry_type=LedgerEntry.EntryType.ESCROW_REFUND,
            amount=escrow.amount,
            debit=LedgerEntry.Account.PLATFORM_ESCROW,
            credit=LedgerEntry.Account.USER,
            order=order,
            firm=order.firm,
            user=order.customer,
            escrow=escrow,
            created_by=actor,
            note=note or "Pul userga qaytarildi — firmaga berilmadi",
            currency=escrow.currency,
        )

        if punish_firm and order.firm_id:
            EscrowService.punish_firm(
                order.firm,
                actor=actor,
                reason=note or "Ish qilinmasdan pul talab qilindi / nizoli holat",
                order=order,
                fine_amount=None,
            )
        return escrow

    @staticmethod
    @transaction.atomic
    def open_dispute(order: Order, *, actor=None, reason: str = "") -> OrderEscrow:
        escrow = getattr(order, "escrow", None)
        if escrow is None:
            raise AppError("Escrow yo'q.")
        if escrow.status != OrderEscrow.Status.HELD:
            raise AppError("Faqat ushlab turilgan to'lovni nizolash mumkin.")
        escrow.status = OrderEscrow.Status.DISPUTED
        escrow.disputed_at = timezone.now()
        escrow.dispute_reason = reason
        escrow.last_action_by = actor
        escrow.save()
        post_ledger(
            entry_type=LedgerEntry.EntryType.DISPUTE,
            amount=escrow.amount,
            debit=LedgerEntry.Account.PLATFORM_ESCROW,
            credit=LedgerEntry.Account.PLATFORM_ESCROW,
            order=order,
            firm=order.firm,
            user=order.customer,
            escrow=escrow,
            created_by=actor,
            note=reason or "Nizo ochildi",
            currency=escrow.currency,
        )
        return escrow

    @staticmethod
    @transaction.atomic
    def on_order_completed(order: Order, *, actor=None) -> OrderEscrow | None:
        """
        Buyurtma COMPLETED bo'lganda:
        - agar escrow HELD bo'lsa → avtomatik firmaga release
        - agar to'lov yo'q bo'lsa → hech narsa (admin keyin mark_paid + release)
        """
        escrow = getattr(order, "escrow", None)
        if escrow is None:
            return None
        if escrow.status == OrderEscrow.Status.HELD:
            return EscrowService.release_to_firm(
                order,
                actor=actor,
                note="Avtomatik: ish yakunlandi, pul firmaga o'tkazildi",
            )
        return escrow

    @staticmethod
    @transaction.atomic
    def on_order_cancelled(order: Order, *, actor=None) -> OrderEscrow | None:
        escrow = getattr(order, "escrow", None)
        if escrow is None:
            return None
        if escrow.status in {OrderEscrow.Status.HELD, OrderEscrow.Status.DISPUTED, OrderEscrow.Status.FROZEN}:
            return EscrowService.refund_to_user(
                order,
                actor=actor,
                note="Buyurtma bekor — pul userga qaytarildi",
            )
        return escrow

    @staticmethod
    @transaction.atomic
    def record_rate_hike(
        firm: PartnerFirm,
        *,
        old_rate,
        new_rate,
        actor=None,
        note: str = "",
    ) -> LedgerEntry:
        entry = post_ledger(
            entry_type=LedgerEntry.EntryType.RATE_HIKE,
            amount=0,
            debit=LedgerEntry.Account.PLATFORM_REVENUE,
            credit=LedgerEntry.Account.PLATFORM_REVENUE,
            firm=firm,
            created_by=actor,
            note=note or f"Foiz {old_rate}% → {new_rate}%",
            meta={"from": str(old_rate), "to": str(new_rate)},
        )
        return entry

    @staticmethod
    @transaction.atomic
    def record_fine(firm: PartnerFirm, *, amount, reason: str, actor=None, fine_id=None) -> LedgerEntry:
        amt = _dec(amount)
        return post_ledger(
            entry_type=LedgerEntry.EntryType.FINE,
            amount=amt,
            debit=LedgerEntry.Account.FIRM_DEBT,
            credit=LedgerEntry.Account.PLATFORM_REVENUE,
            firm=firm,
            created_by=actor,
            note=reason,
            meta={"fine_id": fine_id},
        )

    @staticmethod
    @transaction.atomic
    def punish_firm(
        firm: PartnerFirm,
        *,
        actor=None,
        reason: str = "",
        order: Order | None = None,
        fine_amount=None,
        sales_ban_days: int = 0,
    ) -> dict:
        firm.warnings_count = (firm.warnings_count or 0) + 1
        updates = ["warnings_count", "updated_at"]
        if fine_amount is not None and _dec(fine_amount) > 0:
            firm.debt_amount = _dec(firm.debt_amount) + _dec(fine_amount)
            updates.append("debt_amount")
        if sales_ban_days and sales_ban_days > 0:
            firm.sales_banned_until = timezone.now() + timezone.timedelta(days=int(sales_ban_days))
            updates.append("sales_banned_until")
        firm.save(update_fields=updates)

        log_moderation(
            firm,
            FirmModerationLog.Action.WARNING,
            user=actor,
            note=reason or "Firma jazolandi",
            meta={"order_id": order.id if order else None, "fine": str(fine_amount or 0)},
        )
        post_ledger(
            entry_type=LedgerEntry.EntryType.PUNISH_FIRM,
            amount=_dec(fine_amount or 0),
            debit=LedgerEntry.Account.FIRM_DEBT,
            credit=LedgerEntry.Account.PLATFORM_REVENUE,
            firm=firm,
            order=order,
            user=order.customer if order else None,
            created_by=actor,
            note=reason or "Firma jazolandi",
            meta={"sales_ban_days": sales_ban_days},
        )
        return {"firm_id": firm.id, "warnings": firm.warnings_count}

    @staticmethod
    @transaction.atomic
    def punish_user(
        user,
        *,
        actor=None,
        reason: str = "",
        order: Order | None = None,
        block: bool = False,
    ) -> dict:
        if block:
            user.is_active = False
            user.save(update_fields=["is_active"])
        post_ledger(
            entry_type=LedgerEntry.EntryType.PUNISH_USER,
            amount=0,
            debit=LedgerEntry.Account.USER,
            credit=LedgerEntry.Account.USER,
            user=user,
            order=order,
            firm=order.firm if order else None,
            created_by=actor,
            note=reason or "Foydalanuvchi jazolandi",
            meta={"blocked": block},
        )
        return {"user_id": user.id, "blocked": block}
