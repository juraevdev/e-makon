from __future__ import annotations

from typing import Any

# Aiogram 3 Bot does not support item assignment — keep process-local runtime here.
_services: dict[str, Any] = {}
_notify_worker: Any = None


def set_services(services: dict[str, Any]) -> None:
    global _services
    _services = services


def get_services() -> dict[str, Any]:
    if not _services:
        raise RuntimeError("Bot services are not initialized")
    return _services


def set_notify_worker(worker: Any) -> None:
    global _notify_worker
    _notify_worker = worker


def get_notify_worker() -> Any:
    return _notify_worker
