from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.exceptions import TelegramNetworkError, TelegramRetryAfter
from aiogram.types import TelegramObject

logger = logging.getLogger(__name__)


class TelegramNetworkGuardMiddleware(BaseMiddleware):
    """Catch Telegram API network failures so one bad send does not look like a bot crash."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        try:
            return await handler(event, data)
        except TelegramRetryAfter as exc:
            logger.warning("telegram_retry_after seconds=%s", exc.retry_after)
            return None
        except TelegramNetworkError as exc:
            logger.error(
                "telegram_network_error: %s — VPN/proxy kerak bo'lishi mumkin "
                "(TELEGRAM_PROXY=.env). api.telegram.org ga ulanishni tekshiring.",
                exc,
            )
            return None
