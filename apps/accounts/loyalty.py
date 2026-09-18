from __future__ import annotations

from decimal import Decimal

from apps.accounts.models import LoyaltySettings, PointTransaction, User


def award_points_for_order(order, *, actor=None) -> PointTransaction | None:
    """Bajarilgan buyurtma uchun ball hisoblash (1 ball = N so'm)."""
    price = order.quoted_price
    if price is None or price <= 0:
        return None
    if PointTransaction.objects.filter(order=order, kind=PointTransaction.Kind.EARN).exists():
        return None

    settings = LoyaltySettings.get()
    per = Decimal(settings.uzs_per_point or 1)
    points = int(Decimal(price) // per)
    if points <= 0:
        return None

    customer = order.customer
    customer.loyalty_points = (customer.loyalty_points or 0) + points
    customer.save(update_fields=["loyalty_points"])
    return PointTransaction.objects.create(
        user=customer,
        kind=PointTransaction.Kind.EARN,
        points=points,
        order=order,
        note=f"Buyurtma #{order.pk} bajarildi",
    )


def apply_adjustment(user: User, points: int, *, note: str = "") -> PointTransaction:
    user.loyalty_points = max(0, (user.loyalty_points or 0) + points)
    user.save(update_fields=["loyalty_points"])
    kind = PointTransaction.Kind.ADJUST
    if points > 0:
        kind = PointTransaction.Kind.EARN
    elif points < 0:
        kind = PointTransaction.Kind.REDEEM
    return PointTransaction.objects.create(
        user=user,
        kind=kind,
        points=points,
        note=note,
    )
