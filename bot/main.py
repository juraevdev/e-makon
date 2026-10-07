from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.enums import ParseMode
from aiogram.fsm.storage.base import BaseStorage
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.fsm.storage.redis import RedisStorage
from aiogram.types import BotCommand
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web
from redis.asyncio import Redis

from bot.api.client import EMakonAPIClient
from bot.config import get_settings
from bot.handlers.customer import router as customer_router
from bot.middleware.rate_limit import RateLimiter
from bot.middleware.telegram_errors import TelegramNetworkGuardMiddleware
from bot.notifications.worker import NotificationWorker
from bot.runtime import get_notify_worker, get_services, set_notify_worker, set_services
from bot.services.domain import (
    AuthService,
    CatalogService,
    OrderFlowService,
    ProfileService,
    SupportService,
)
from bot.storage.sessions import SessionStore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("bot")


async def probe_redis(redis_url: str) -> Redis | None:
    client = Redis.from_url(
        redis_url,
        decode_responses=True,
        socket_connect_timeout=0.4,
        socket_timeout=1.0,
    )
    try:
        await client.ping()
        logger.info("redis_connected url=%s", redis_url)
        return client
    except Exception as exc:  # noqa: BLE001
        await client.aclose()
        logger.warning("redis_unavailable: %s", exc)
        return None


async def on_startup(bot: Bot) -> None:
    settings = get_settings()
    commands = [BotCommand(command="start", description="Boshlash / kirish")]
    if settings.run_mode == "webhook" and settings.webhook_url:
        await asyncio.gather(
            bot.set_my_commands(commands),
            bot.set_webhook(
                url=settings.webhook_url.rstrip("/") + settings.webhook_path,
                secret_token=settings.webhook_secret or None,
                drop_pending_updates=True,
            ),
        )
        logger.info("bot_commands_set webhook_set")
    else:
        await asyncio.gather(
            bot.set_my_commands(commands),
            bot.delete_webhook(drop_pending_updates=True),
        )
        logger.info("bot_commands_set polling_mode")


async def on_shutdown(bot: Bot) -> None:
    services = get_services()
    api: EMakonAPIClient = services["api"]
    worker = get_notify_worker()
    if worker:
        worker.stop()
    await api.aclose()
    redis = services.get("redis")
    if redis is not None:
        await redis.aclose()


def build_bot() -> Bot:
    settings = get_settings()
    session_kwargs: dict = {"timeout": settings.telegram_timeout}
    if settings.telegram_proxy:
        session_kwargs["proxy"] = settings.telegram_proxy
        logger.info("telegram_proxy_enabled")
    session = AiohttpSession(**session_kwargs)
    return Bot(
        token=settings.bot_token,
        session=session,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


def build_dispatcher(storage: BaseStorage) -> Dispatcher:
    dp = Dispatcher(storage=storage)
    dp.update.middleware(TelegramNetworkGuardMiddleware())
    dp.include_router(customer_router)
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)
    return dp


def wire_services(redis: Redis | None) -> None:
    api = EMakonAPIClient()
    sessions = SessionStore()
    set_services(
        {
            "api": api,
            "sessions": sessions,
            "auth": AuthService(api, sessions),
            "catalog": CatalogService(api),
            "orders": OrderFlowService(api, sessions),
            "support": SupportService(api, sessions),
            "profile": ProfileService(api, sessions),
            "limiter": RateLimiter(redis),
            "redis": redis,
        }
    )


async def _prepare() -> tuple[Bot, Dispatcher, Redis | None, SettingsBundle]:
    settings = get_settings()
    if not settings.bot_token:
        raise SystemExit("BOT_TOKEN is required")

    redis: Redis | None = None
    if settings.use_redis:
        redis = await probe_redis(settings.redis_url)
    elif settings.allow_memory_fsm:
        logger.info("redis_skipped (BOT_USE_REDIS=false, MemoryStorage)")
    else:
        redis = await probe_redis(settings.redis_url)

    if redis is None:
        if not settings.allow_memory_fsm:
            raise SystemExit(
                "Redis is required (localhost:6379 refused). "
                "Start Redis, or set BOT_ALLOW_MEMORY_FSM=true for local MemoryStorage."
            )
        logger.warning(
            "Using MemoryStorage fallback — FSM resets on restart; "
            "Telegram notifications from API will not work until Redis is up."
        )
        storage: BaseStorage = MemoryStorage()
    else:
        storage = RedisStorage(redis=redis)

    bot = build_bot()
    wire_services(redis)
    dp = build_dispatcher(storage)
    return bot, dp, redis, SettingsBundle(settings=settings)


class SettingsBundle:
    def __init__(self, settings) -> None:
        self.settings = settings


async def run_polling() -> None:
    bot, dp, redis, bundle = await _prepare()
    settings = bundle.settings
    worker_task = None
    if redis is not None:
        worker = NotificationWorker(bot, redis, settings.notification_queue_key)
        set_notify_worker(worker)
        worker_task = asyncio.create_task(worker.run())
    else:
        logger.warning("notification_worker_skipped (no Redis)")

    try:
        await dp.start_polling(bot)
    finally:
        worker = get_notify_worker()
        if worker:
            worker.stop()
        if worker_task:
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass


async def run_webhook() -> None:
    import os

    # Redis/HTTP clients are bound to the loop they were created on, so everything
    # (setup, aiohttp server, worker) has to live inside this single asyncio.run() loop.
    bot, dp, redis, bundle = await _prepare()
    settings = bundle.settings
    if not settings.webhook_url:
        raise SystemExit("WEBHOOK_URL is required when BOT_RUN_MODE=webhook")

    app = web.Application()
    SimpleRequestHandler(
        dispatcher=dp,
        bot=bot,
        secret_token=settings.webhook_secret or None,
    ).register(app, path=settings.webhook_path)
    setup_application(app, dp, bot=bot)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(
        runner,
        host=os.getenv("BOT_HOST", "0.0.0.0"),
        port=int(os.getenv("BOT_PORT", "8081")),
    )
    await site.start()
    logger.info("webhook_server_started path=%s", settings.webhook_path)

    worker_task = None
    if redis is not None:
        worker = NotificationWorker(bot, redis, settings.notification_queue_key)
        set_notify_worker(worker)
        worker_task = asyncio.create_task(worker.run())
    else:
        logger.warning("notification_worker_skipped (no Redis)")

    try:
        await asyncio.Event().wait()
    finally:
        worker = get_notify_worker()
        if worker:
            worker.stop()
        if worker_task:
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass
        await runner.cleanup()


def main() -> None:
    settings = get_settings()
    if settings.run_mode == "webhook":
        asyncio.run(run_webhook())
    else:
        asyncio.run(run_polling())


if __name__ == "__main__":
    main()
