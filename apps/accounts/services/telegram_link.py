from __future__ import annotations

from django.db import transaction

from apps.accounts.models import User
from apps.core.exceptions import AppError, ConflictError, ForbiddenError


class TelegramLinkService:
    @staticmethod
    @transaction.atomic
    def link(*, user: User, telegram_id: int, telegram_username: str = "") -> User:
        if not user.is_active:
            raise ForbiddenError("Hisob faol emas.")
        if user.role != User.Role.CUSTOMER:
            raise ForbiddenError("Faqat mijoz akkaunti bog'lanishi mumkin.")

        existing = (
            User.objects.select_for_update()
            .filter(telegram_id=telegram_id)
            .first()
        )
        if existing is not None and existing.pk != user.pk:
            raise ConflictError("Bu Telegram akkaunt boshqa foydalanuvchiga bog'langan.")

        locked = User.objects.select_for_update().get(pk=user.pk)
        if not locked.is_active:
            raise ForbiddenError("Hisob faol emas.")

        locked.telegram_id = telegram_id
        if telegram_username is not None:
            locked.telegram_username = (telegram_username or "").lstrip("@")[:255]
        locked.save(update_fields=["telegram_id", "telegram_username"])
        return locked

    @staticmethod
    @transaction.atomic
    def unlink(*, user: User) -> User:
        if not user.is_active:
            raise ForbiddenError("Hisob faol emas.")
        locked = User.objects.select_for_update().get(pk=user.pk)
        if locked.telegram_id is None:
            raise AppError("Telegram akkaunt bog'lanmagan.")
        locked.telegram_id = None
        locked.telegram_username = ""
        locked.save(update_fields=["telegram_id", "telegram_username"])
        return locked
