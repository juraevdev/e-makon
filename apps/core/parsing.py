from __future__ import annotations

from decimal import Decimal, InvalidOperation

from apps.core.exceptions import AppError


def parse_int(
    value,
    *,
    field: str = "qiymat",
    default: int | None = None,
    minimum: int | None = None,
    maximum: int | None = None,
    required: bool = False,
) -> int | None:
    """Parse request ints safely — never raise ValueError to the client as 500."""
    if value is None or value == "":
        if required:
            raise AppError(f"{field} majburiy.")
        return default
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise AppError(f"{field} butun son bo'lishi kerak.") from exc
    if minimum is not None and number < minimum:
        raise AppError(f"{field} kamida {minimum} bo'lishi kerak.")
    if maximum is not None and number > maximum:
        raise AppError(f"{field} ko'pi bilan {maximum} bo'lishi kerak.")
    return number


def parse_decimal(
    value,
    *,
    field: str = "summa",
    default: Decimal | None = None,
    required: bool = False,
) -> Decimal | None:
    if value is None or value == "":
        if required:
            raise AppError(f"{field} majburiy.")
        return default
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise AppError(f"{field} noto'g'ri.") from exc
