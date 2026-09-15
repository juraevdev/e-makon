from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import OTPChallenge, User
from apps.core.exceptions import OTPError
from apps.core.phone import normalize_phone


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _generate_code(length: int | None = None) -> str:
    length = length or settings.OTP_CODE_LENGTH
    # Cryptographically stronger than random.randint for OTP
    upper = 10**length
    return str(secrets.randbelow(upper)).zfill(length)


class OTPService:
    """Phone OTP lifecycle — SMS provider hook can replace `_dispatch_sms`."""

    @staticmethod
    def _dispatch_sms(phone: str, code: str) -> None:
        # TODO: integrate Eskiz / Playmobile / Twilio
        # For now we only log in debug mode via returned code.
        return None

    @classmethod
    @transaction.atomic
    def request_code(
        cls,
        phone: str,
        purpose: str = OTPChallenge.Purpose.LOGIN,
    ) -> dict:
        phone = normalize_phone(phone)
        if not phone:
            raise OTPError("Telefon raqam noto'g'ri.")

        # Invalidate previous unused challenges
        OTPChallenge.objects.filter(
            phone=phone,
            purpose=purpose,
            is_used=False,
        ).update(is_used=True)

        code = _generate_code()
        challenge = OTPChallenge.objects.create(
            phone=phone,
            code_hash=_hash_code(code),
            purpose=purpose,
            expires_at=timezone.now()
            + timedelta(seconds=settings.OTP_CODE_TTL_SECONDS),
        )
        cls._dispatch_sms(phone, code)

        payload = {
            "phone": phone,
            "expires_in": settings.OTP_CODE_TTL_SECONDS,
            "challenge_id": challenge.pk,
        }
        if settings.OTP_DEBUG_RETURN_CODE:
            payload["debug_code"] = code
        return payload

    @classmethod
    @transaction.atomic
    def verify_and_issue_tokens(
        cls,
        phone: str,
        code: str,
        purpose: str = OTPChallenge.Purpose.LOGIN,
        full_name: str = "",
        first_name: str = "",
        last_name: str = "",
    ) -> dict:
        phone = normalize_phone(phone)
        challenge = (
            OTPChallenge.objects.filter(
                phone=phone,
                purpose=purpose,
                is_used=False,
            )
            .order_by("-created_at")
            .first()
        )
        if challenge is None:
            raise OTPError("OTP topilmadi. Qayta so'rang.")
        if challenge.is_expired:
            challenge.is_used = True
            challenge.save(update_fields=["is_used", "updated_at"])
            raise OTPError("OTP muddati tugagan.")

        if challenge.attempts >= settings.OTP_MAX_ATTEMPTS:
            challenge.is_used = True
            challenge.save(update_fields=["is_used", "updated_at"])
            raise OTPError("Urinishlar soni tugadi.")

        challenge.attempts += 1
        if challenge.code_hash != _hash_code(code.strip()):
            challenge.save(update_fields=["attempts", "updated_at"])
            raise OTPError("OTP noto'g'ri.")

        challenge.is_used = True
        challenge.save(update_fields=["is_used", "attempts", "updated_at"])

        if not first_name and not last_name and full_name:
            chunks = full_name.strip().split(None, 1)
            first_name = chunks[0] if chunks else ""
            last_name = chunks[1] if len(chunks) > 1 else ""

        user, created = User.objects.get_or_create(
            phone=phone,
            defaults={
                "role": User.Role.CUSTOMER,
                "first_name": first_name or "",
                "last_name": last_name or "",
                "full_name": full_name or f"{first_name} {last_name}".strip(),
            },
        )
        updates: list[str] = []
        if first_name and not user.first_name:
            user.first_name = first_name
            updates.append("first_name")
        if last_name and not user.last_name:
            user.last_name = last_name
            updates.append("last_name")
        if (full_name or first_name or last_name) and not user.full_name:
            user.full_name = full_name or f"{first_name} {last_name}".strip()
            updates.append("full_name")
        if updates:
            user.save()

        if not user.is_active:
            raise OTPError("Hisob faol emas.")

        refresh = RefreshToken.for_user(user)
        return {
            "user": user,
            "created": created,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
