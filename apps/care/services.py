from __future__ import annotations

import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.care.models import CareContract, CareContractEvent, CareVisit
from apps.core.exceptions import AppError

MAX_VISITS = 500

FIRM_EDITABLE = {
    CareContract.Status.DRAFT,
    CareContract.Status.PENDING,
    CareContract.Status.REJECTED,
}


def visit_dates(contract: CareContract) -> list[date]:
    start, end = contract.start_date, contract.end_date
    if end < start:
        return []
    weekdays = sorted({int(d) for d in contract.preferred_weekdays or [] if 0 <= int(d) <= 6})
    if not weekdays:
        weekdays = [start.weekday()]
    out: list[date] = []
    if contract.frequency == CareContract.Frequency.MONTHLY:
        year, month, day = start.year, start.month, start.day
        while len(out) < MAX_VISITS:
            last = calendar.monthrange(year, month)[1]
            current = date(year, month, min(day, last))
            if current > end:
                break
            if current >= start:
                out.append(current)
            month += 1
            if month > 12:
                month, year = 1, year + 1
        return out
    step_weeks = 2 if contract.frequency == CareContract.Frequency.BIWEEKLY else 1
    week_start = start - timedelta(days=start.weekday())
    while week_start <= end and len(out) < MAX_VISITS:
        for wd in weekdays:
            current = week_start + timedelta(days=wd)
            if start <= current <= end:
                out.append(current)
        week_start += timedelta(weeks=step_weeks)
    return out[:MAX_VISITS]


def log(contract: CareContract, action: str, actor=None, note: str = "") -> CareContractEvent:
    return CareContractEvent.objects.create(contract=contract, actor=actor, action=action, note=note)


class CareContractService:
    @staticmethod
    def recalc_total(contract: CareContract) -> None:
        if contract.price_per_visit and not contract.total_amount:
            contract.total_amount = Decimal(contract.price_per_visit) * len(visit_dates(contract))

    @staticmethod
    @transaction.atomic
    def generate_visits(contract: CareContract) -> int:
        today = timezone.localdate()
        contract.visits.filter(
            status=CareVisit.Status.SCHEDULED, visit_date__gte=today
        ).delete()
        existing = set(contract.visits.values_list("visit_date", flat=True))
        worker = contract.assigned_workers.first()
        created = [
            CareVisit(
                contract=contract,
                visit_date=d,
                planned_worker=worker,
                assigned_worker_name=(worker.full_name if worker else ""),
            )
            for d in visit_dates(contract)
            if d >= today and d not in existing
        ]
        CareVisit.objects.bulk_create(created)
        return len(created)

    @staticmethod
    def _require(contract: CareContract, allowed: set[str], message: str) -> None:
        if contract.status not in allowed:
            raise AppError(message, code="care_invalid_state")

    @classmethod
    @transaction.atomic
    def submit(cls, contract: CareContract, actor, note: str = "") -> CareContract:
        cls._require(
            contract,
            {CareContract.Status.DRAFT, CareContract.Status.REJECTED},
            "Faqat qoralama yoki rad etilgan shartnomani yuborish mumkin.",
        )
        contract.status = CareContract.Status.PENDING
        contract.rejection_reason = ""
        contract.save(update_fields=["status", "rejection_reason", "updated_at"])
        log(contract, "submit", actor, note or "Tizim ma'muriyati tasdig'iga yuborildi")
        return contract

    @classmethod
    @transaction.atomic
    def approve(cls, contract: CareContract, actor, note: str = "") -> CareContract:
        cls._require(
            contract, {CareContract.Status.PENDING}, "Faqat tasdiq kutayotgan shartnoma tasdiqlanadi."
        )
        contract.status = CareContract.Status.ACTIVE
        contract.approved_at = timezone.now()
        contract.approved_by = actor
        if note:
            contract.platform_note = note
        cls.recalc_total(contract)
        contract.save()
        count = cls.generate_visits(contract)
        log(contract, "approve", actor, note or f"Tasdiqlandi, {count} ta tashrif rejalashtirildi")
        cls._notify(contract, approved=True, note=note)
        return contract

    @classmethod
    @transaction.atomic
    def reject(cls, contract: CareContract, actor, reason: str) -> CareContract:
        cls._require(
            contract, {CareContract.Status.PENDING}, "Faqat tasdiq kutayotgan shartnoma rad etiladi."
        )
        if not reason:
            raise AppError("Rad etish sababini yozing.")
        contract.status = CareContract.Status.REJECTED
        contract.rejection_reason = reason
        contract.save(update_fields=["status", "rejection_reason", "updated_at"])
        log(contract, "reject", actor, reason)
        cls._notify(contract, approved=False, note=reason)
        return contract

    @classmethod
    @transaction.atomic
    def pause(cls, contract: CareContract, actor, note: str = "") -> CareContract:
        cls._require(contract, {CareContract.Status.ACTIVE}, "Faqat faol shartnomani to'xtatish mumkin.")
        contract.status = CareContract.Status.PAUSED
        contract.save(update_fields=["status", "updated_at"])
        contract.visits.filter(
            status=CareVisit.Status.SCHEDULED, visit_date__gte=timezone.localdate()
        ).update(status=CareVisit.Status.POSTPONED)
        log(contract, "pause", actor, note)
        return contract

    @classmethod
    @transaction.atomic
    def resume(cls, contract: CareContract, actor, note: str = "") -> CareContract:
        cls._require(contract, {CareContract.Status.PAUSED}, "Faqat to'xtatilgan shartnoma davom ettiriladi.")
        contract.status = CareContract.Status.ACTIVE
        contract.save(update_fields=["status", "updated_at"])
        contract.visits.filter(
            status=CareVisit.Status.POSTPONED, visit_date__gte=timezone.localdate()
        ).update(status=CareVisit.Status.SCHEDULED)
        log(contract, "resume", actor, note)
        return contract

    @classmethod
    @transaction.atomic
    def complete(cls, contract: CareContract, actor, note: str = "") -> CareContract:
        cls._require(
            contract,
            {CareContract.Status.ACTIVE, CareContract.Status.PAUSED},
            "Faqat faol shartnomani yakunlash mumkin.",
        )
        contract.status = CareContract.Status.COMPLETED
        contract.save(update_fields=["status", "updated_at"])
        log(contract, "complete", actor, note)
        return contract

    @classmethod
    @transaction.atomic
    def cancel(cls, contract: CareContract, actor, reason: str) -> CareContract:
        if contract.status in {CareContract.Status.COMPLETED, CareContract.Status.CANCELLED}:
            raise AppError("Shartnoma allaqachon yopilgan.", code="care_invalid_state")
        if not reason:
            raise AppError("Bekor qilish sababini yozing.")
        contract.status = CareContract.Status.CANCELLED
        contract.save(update_fields=["status", "updated_at"])
        contract.visits.filter(
            status__in=[CareVisit.Status.SCHEDULED, CareVisit.Status.POSTPONED],
            visit_date__gte=timezone.localdate(),
        ).delete()
        log(contract, "cancel", actor, reason)
        return contract

    @staticmethod
    def _notify(contract: CareContract, *, approved: bool, note: str) -> None:
        from apps.notifications.services import notify_user
        from apps.organizations.models import FirmMessage

        label = contract.title or contract.client_name or f"#{contract.pk}"
        if contract.organization_id:
            FirmMessage.objects.create(
                firm_id=contract.organization_id,
                kind=FirmMessage.Kind.MESSAGE if approved else FirmMessage.Kind.WARNING,
                subject=(
                    f"Parvarish shartnomasi tasdiqlandi: {label}"
                    if approved
                    else f"Parvarish shartnomasi rad etildi: {label}"
                ),
                body=note or ("Shartnoma faollashtirildi." if approved else ""),
            )
        if approved and contract.customer_id:
            notify_user(
                contract.customer,
                kind="care",
                title=f"Parvarish shartnomasi faollashdi: {label}",
                body=f"{contract.start_date:%d.%m.%Y} – {contract.end_date:%d.%m.%Y}. "
                "E-Makon kafolati ostida.",
                entity_type="care_contract",
                entity_id=contract.pk,
            )
