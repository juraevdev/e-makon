from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Always prefer project .env over stale shell env (e.g. leftover test keys).
_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / ".env", override=True)


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    bot_token: str
    api_base_url: str
    bot_service_key: str
    redis_url: str
    bot_secret_key: str
    bot_database_path: str
    webhook_url: str
    webhook_secret: str
    webhook_path: str
    run_mode: str  # polling | webhook
    notification_queue_key: str
    http_timeout: float
    # Local-only: if Redis is down, use MemoryStorage (FSM lost on restart; no TG notify).
    allow_memory_fsm: bool
    # If False (default with memory FSM), skip Redis connect entirely for faster local start.
    use_redis: bool
    # Optional proxy for Telegram API (socks5://... or http://...) — useful in UZ networks.
    telegram_proxy: str
    telegram_timeout: float


@lru_cache
def get_settings() -> Settings:
    allow_memory = _env_bool("BOT_ALLOW_MEMORY_FSM", default=True)
    # Prefer skipping Redis locally unless explicitly enabled.
    use_redis = _env_bool("BOT_USE_REDIS", default=False)
    return Settings(
        bot_token=os.getenv("BOT_TOKEN", ""),
        api_base_url=os.getenv("EMAKON_API_BASE_URL", "http://127.0.0.1:8000/api/v1").rstrip("/"),
        bot_service_key=os.getenv("EMAKON_BOT_SERVICE_KEY", ""),
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        bot_secret_key=os.getenv("BOT_SECRET_KEY", os.getenv("BOT_ENCRYPTION_KEY", "dev-only-change-me")),
        bot_database_path=os.getenv("BOT_DATABASE_PATH", os.path.join("bot_data", "sessions.sqlite3")),
        webhook_url=os.getenv("WEBHOOK_URL", ""),
        webhook_secret=os.getenv("WEBHOOK_SECRET", ""),
        webhook_path=os.getenv("WEBHOOK_PATH", "/telegram/webhook"),
        run_mode=os.getenv("BOT_RUN_MODE", "polling"),
        notification_queue_key=os.getenv("NOTIFICATION_QUEUE_KEY", "emakon:notifications"),
        http_timeout=float(os.getenv("BOT_HTTP_TIMEOUT", "10")),
        allow_memory_fsm=allow_memory,
        use_redis=use_redis,
        telegram_proxy=(os.getenv("TELEGRAM_PROXY") or os.getenv("HTTPS_PROXY") or "").strip(),
        telegram_timeout=float(os.getenv("TELEGRAM_TIMEOUT", "25")),
    )
