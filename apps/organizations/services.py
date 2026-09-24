from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone
from django.utils.text import slugify

from apps.accounts.models import User
from apps.core.exceptions import AppError
from apps.organizations.models import (
    FirmFine,
    FirmMessage,
    FirmModerationLog,
    Investor,
    Organization,
)

DEFAULT_ORG_SLUG = "default"

SPECIALTY_LABELS = dict(Organization.Specialty.choices)

MONTHLY_FEE_USD = Decimal("9")
YEARLY_FEE_USD = Decimal("90")
YEARLY_IF_MONTHLY_USD = Decimal("108")  # 12 * 9


def get_or_create_default_organization() -> Organization:
    org, _ = Organization.objects.get_or_create(
        slug=DEFAULT_ORG_SLUG,
        defaults={
            "name": getattr(settings, "DEFAULT_ORGANIZATION_NAME", "E-Makon"),
            "is_active": True,
            "status": Organization.Status.ACTIVE,
        },
    )
    return org


def resolve_organization_for_user(user: User | None) -> Organization | None:
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    if user.role == User.Role.SUPERADMIN:
        return None
    return getattr(user, "organization", None)


def organization_id_for_queryset(user: User) -> int | None:
    """
    Return organization pk to scope admin querysets.
    None means no filter (superadmin / global).
    """
    if user.role == User.Role.SUPERADMIN:
        return None
    org = getattr(user, "organization", None)
    return org.pk if org else None


def unique_slug_from_name(name: str, *, exclude_pk: int | None = None) -> str:
    base = slugify(name)[:50] or "firm"
    slug = base
    n = 1
    qs = Organization.objects.all()
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    while qs.filter(slug=slug).exists():
        n += 1
        slug = f"{base}-{n}"[:64]
    return slug


def subscription_fee_usd(plan: str, units: int) -> Decimal:
    u = max(int(units or 1), 1)
    if plan == Organization.SubscriptionPlan.MONTHLY:
        return MONTHLY_FEE_USD * u
    if plan == Organization.SubscriptionPlan.YEARLY:
        return YEARLY_FEE_USD * u
    return Decimal("0")


def subscription_yearly_if_monthly_usd(units: int) -> Decimal:
    return YEARLY_IF_MONTHLY_USD * max(int(units or 1), 1)


def suggested_commission_rate(firm: Organization) -> Decimal:
    """Volume-based suggested rate clamped to 0.1–3%."""
    completed = firm.orders.filter(status="completed").count()
    if completed >= 100:
        rate = Decimal("0.10")
    elif completed >= 50:
        rate = Decimal("0.15")
    elif completed >= 20:
        rate = Decimal("0.20")
    elif completed >= 5:
        rate = Decimal("0.25")
    else:
        rate = Decimal("0.30")
    return max(Decimal("0.10"), min(Decimal("3.00"), rate))


def firm_revenue_totals(firm: Organization) -> tuple[Decimal, Decimal]:
    completed = firm.orders.filter(status="completed", quoted_price__isnull=False)
    revenue = completed.aggregate(total=Sum("quoted_price"))["total"] or Decimal("0")
    platform = completed.aggregate(total=Sum("platform_share"))["total"]
    if platform is None:
        rate = firm.commission_rate or Decimal("0")
        platform = (revenue * rate / Decimal("100")).quantize(Decimal("0.01"))
    return revenue, platform


class FirmService:
    @staticmethod
    def log(firm: Organization, action: str, *, actor=None, note: str = "", meta: dict | None = None):
        return FirmModerationLog.objects.create(
            firm=firm,
            action=action,
            note=note or "",
            meta=meta or {},
            created_by=actor,
        )

    @staticmethod
    def set_trial(firm: Organization, days: int, *, actor=None) -> Organization:
        days = max(0, int(days))
        if days <= 0:
            firm.trial_ends_at = None
        else:
            firm.trial_ends_at = timezone.now() + timedelta(days=days)
            if firm.status == Organization.Status.ACTIVE:
                firm.status = Organization.Status.PENDING
        firm.save()
        FirmService.log(firm, "set_trial", actor=actor, note=f"{days} kun", meta={"days": days})
        return firm

    @staticmethod
    def apply_suggested_rate(firm: Organization, *, actor=None) -> Organization:
        rate = suggested_commission_rate(firm)
        firm.commission_rate = rate
        firm.save(update_fields=["commission_rate", "updated_at"])
        FirmService.log(firm, "apply_suggested_rate", actor=actor, meta={"rate": str(rate)})
        return firm

    @staticmethod
    def adjust_debt(firm: Organization, amount: Decimal, *, actor=None) -> Organization:
        firm.debt_amount = (firm.debt_amount or Decimal("0")) + Decimal(amount)
        firm.save(update_fields=["debt_amount", "updated_at"])
        FirmService.log(
            firm,
            "adjust_debt",
            actor=actor,
            meta={"amount": str(amount), "debt": str(firm.debt_amount)},
        )
        return firm

    @staticmethod
    def block(firm: Organization, reason: str = "", *, actor=None) -> Organization:
        firm.status = Organization.Status.SUSPENDED
        firm.exit_reason = reason or firm.exit_reason
        firm.save()
        FirmService.log(firm, "block", actor=actor, note=reason)
        return firm

    @staticmethod
    def unblock(firm: Organization, *, actor=None) -> Organization:
        firm.status = Organization.Status.ACTIVE
        firm.save()
        FirmService.log(firm, "unblock", actor=actor)
        return firm

    @staticmethod
    def end_agreement(firm: Organization, exit_reason: str = "", *, actor=None) -> Organization:
        firm.status = Organization.Status.ENDED
        firm.exit_reason = exit_reason or firm.exit_reason
        firm.ended_at = timezone.now()
        firm.save()
        FirmService.log(firm, "end_agreement", actor=actor, note=exit_reason)
        return firm

    @staticmethod
    def send_message(
        firm: Organization,
        *,
        kind: str,
        subject: str,
        body: str,
        actor=None,
    ) -> FirmMessage:
        if kind not in FirmMessage.Kind.values:
            raise AppError("Noto'g'ri xabar turi.")
        msg = FirmMessage.objects.create(
            firm=firm,
            sender=actor,
            kind=kind,
            subject=subject or "",
            body=body or "",
        )
        if kind == FirmMessage.Kind.WARNING:
            firm.warnings_count = (firm.warnings_count or 0) + 1
            firm.save(update_fields=["warnings_count", "updated_at"])
        FirmService.log(firm, "send_message", actor=actor, note=subject, meta={"kind": kind})
        return msg

    @staticmethod
    def add_fine(firm: Organization, amount: Decimal, reason: str = "", *, actor=None) -> FirmFine:
        fine = FirmFine.objects.create(
            firm=firm,
            amount=amount,
            reason=reason or "",
            created_by=actor,
        )
        firm.unpaid_fines = (firm.unpaid_fines or Decimal("0")) + Decimal(amount)
        firm.debt_amount = (firm.debt_amount or Decimal("0")) + Decimal(amount)
        firm.save(update_fields=["unpaid_fines", "debt_amount", "updated_at"])
        FirmService.log(
            firm,
            "add_fine",
            actor=actor,
            note=reason,
            meta={"amount": str(amount)},
        )
        return fine

    @staticmethod
    def ban_sales(firm: Organization, days: int, reason: str = "", *, actor=None) -> Organization:
        days = max(1, int(days))
        firm.sales_banned_until = timezone.now() + timedelta(days=days)
        firm.save(update_fields=["sales_banned_until", "updated_at"])
        FirmService.log(
            firm,
            "ban_sales",
            actor=actor,
            note=reason,
            meta={"days": days},
        )
        return firm

    @staticmethod
    def lift_sales_ban(firm: Organization, *, actor=None) -> Organization:
        firm.sales_banned_until = None
        firm.save(update_fields=["sales_banned_until", "updated_at"])
        FirmService.log(firm, "lift_sales_ban", actor=actor)
        return firm


class InvestorService:
    @staticmethod
    def end_agreement(investor: Investor, exit_reason: str = "") -> Investor:
        investor.status = Investor.Status.ENDED
        investor.exit_reason = exit_reason or investor.exit_reason
        investor.ended_at = timezone.now()
        investor.is_active = False
        investor.save()
        return investor
