from __future__ import annotations

import re


_PHONE_RE = re.compile(r"[^\d+]")


def normalize_phone(value: str) -> str:
    """Normalize Uzbek / international phone numbers to +998XXXXXXXXX when possible."""
    raw = (value or "").strip()
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("998") and len(digits) == 12:
        return f"+{digits}"
    if len(digits) == 9:
        return f"+998{digits}"
    if raw.startswith("+") and digits:
        return f"+{digits}"
    if digits:
        return f"+{digits}"
    return raw
