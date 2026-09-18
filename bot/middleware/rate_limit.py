from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class RateLimiter:
    """Redis-backed rate limit; if redis is None, always allow (local fallback)."""

    def __init__(self, redis: Any = None) -> None:
        self.redis = redis

    async def allow(self, key: str, *, limit: int, window_sec: int) -> bool:
        if self.redis is None:
            return True
        full = f"emakon:bot:rl:{key}"
        try:
            count = await self.redis.incr(full)
            if count == 1:
                await self.redis.expire(full, window_sec)
            return count <= limit
        except Exception:  # noqa: BLE001
            logger.warning("rate_limit_redis_error key=%s", key)
            return True
