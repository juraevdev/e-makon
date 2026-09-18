from __future__ import annotations

from decimal import Decimal

# Obuna: 1 o'rin oylik $9, yillik $90 (12×$9 = $108 → yillikda tejaladi)
SUBSCRIPTION_MONTHLY_USD = Decimal("9")
SUBSCRIPTION_YEARLY_USD = Decimal("90")
SUBSCRIPTION_YEARLY_IF_MONTHLY_USD = Decimal("108")

COMMISSION_MIN = Decimal("0.1")
COMMISSION_MAX = Decimal("3.0")


def suggest_commission_rate(revenue: Decimal | int | float | None) -> Decimal:
    """Firma aylanmasiga qarab kampaniya ulushi (0.1% … 3.0%)."""
    amount = Decimal(str(revenue or 0))
    if amount >= Decimal("500000000"):
        return Decimal("3.0")
    if amount >= Decimal("200000000"):
        return Decimal("2.0")
    if amount >= Decimal("100000000"):
        return Decimal("1.5")
    if amount >= Decimal("50000000"):
        return Decimal("1.0")
    if amount >= Decimal("10000000"):
        return Decimal("0.5")
    if amount >= Decimal("5000000"):
        return Decimal("0.3")
    return Decimal("0.1")


def calc_platform_share(
    price: Decimal | int | float | None, rate: Decimal | int | float | None
) -> Decimal:
    if price is None:
        return Decimal("0")
    p = Decimal(str(price))
    r = Decimal(str(rate or 0))
    return (p * r / Decimal("100")).quantize(Decimal("0.01"))


def subscription_fee_usd(plan: str, units: int = 1) -> Decimal:
    n = max(int(units or 1), 1)
    if plan == "monthly":
        return Decimal(n) * SUBSCRIPTION_MONTHLY_USD
    if plan == "yearly":
        return Decimal(n) * SUBSCRIPTION_YEARLY_USD
    return Decimal("0")
