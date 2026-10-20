from __future__ import annotations

import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.care.models import CareContract, CareVisit
from apps.loyalty.services import LoyaltyService
from apps.notifications.services import notify_user
from apps.organizations.models import FirmMessage, Organization
from apps.organizations.services import FirmService

logger = logging.getLogger(__name__)


def expire_loyalty_points() -> dict:
    result = LoyaltyService.expire_stale_points()
    logger.info("loyalty_expire users=%s points=%s", result["users"], result["points"])
    return result


@transaction.atomic
def expire_firm_trials() -> dict:
    """Sinov muddati tugagan firmalarni to'xtatadi."""
    now = timezone.now()
    qs = (
        Organization.objects.select_for_update()
        .filter(trial_ends_at__isnull=False, trial_ends_at__lte=now)
        .exclude(status__in=[Organization.Status.ENDED, Organization.Status.SUSPENDED])
    )
    count = 0
    for firm in qs:
        firm.status = Organization.Status.SUSPENDED
        firm.save(update_fields=["status", "updated_at"])
        FirmService.log(
            firm,
            "trial_expired",
            note="Sinov muddati tugadi — avtomatik to'xtatildi",
            meta={"trial_ends_at": firm.trial_ends_at.isoformat() if firm.trial_ends_at else ""},
        )
        FirmMessage.objects.create(
            firm=firm,
            kind=FirmMessage.Kind.WARNING,
            subject="Sinov muddati tugadi",
            body=(
                "Sinov muddatingiz tugadi. Obunani faollashtirish uchun "
                "E-Makon ma'muriyatiga murojaat qiling."
            ),
        )
        count += 1
    logger.info("trial_expire firms=%s", count)
    return {"firms": count}


def remind_care_visits(*, days_ahead: int = 1) -> dict:
    """Ertangi (yoki N kun keyingi) rejalashtirilgan tashriflar uchun eslatma."""
    target = timezone.localdate() + timedelta(days=days_ahead)
    visits = (
        CareVisit.objects.filter(
            visit_date=target,
            status=CareVisit.Status.SCHEDULED,
            contract__status=CareContract.Status.ACTIVE,
        )
        .select_related("contract", "contract__customer", "planned_worker")
    )
    customers = 0
    workers = 0
    for visit in visits:
        contract = visit.contract
        title = f"Parvarish eslatmasi — {visit.visit_date:%d.%m.%Y}"
        body = contract.title or contract.address or "Rejalashtirilgan tashrif"
        if contract.customer_id:
            notify_user(
                contract.customer,
                kind="care",
                title=title,
                body=body,
                entity_type="care_contract",
                entity_id=contract.pk,
            )
            customers += 1
        if visit.planned_worker_id:
            notify_user(
                visit.planned_worker,
                kind="care",
                title=title,
                body=f"{body} · {contract.client_name or contract.phone_number}",
                entity_type="care_visit",
                entity_id=visit.pk,
            )
            workers += 1
        if visit.status == CareVisit.Status.SCHEDULED:
            visit.status = CareVisit.Status.REMINDED
            visit.save(update_fields=["status", "updated_at"])
    logger.info("care_remind day=%s customers=%s workers=%s", target, customers, workers)
    return {"date": target.isoformat(), "customers": customers, "workers": workers}


def run_all() -> dict:
    return {
        "loyalty": expire_loyalty_points(),
        "trials": expire_firm_trials(),
        "care_reminders": remind_care_visits(days_ahead=1),
    }
