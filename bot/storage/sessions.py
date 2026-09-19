from __future__ import annotations

import base64
import hashlib
import os
import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from bot.config import get_settings


def _fernet(secret: str) -> Fernet:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


@dataclass
class BotSession:
    telegram_id: int
    user_id: int
    refresh_token: str
    access_token: str = ""
    phone: str = ""
    updated_at: str = ""


class SessionStore:
    """SQLite-backed encrypted session store (bot-local, not E-Makon DB)."""

    def __init__(self, path: str | None = None, secret: str | None = None) -> None:
        settings = get_settings()
        self.path = path or settings.bot_database_path
        self._fernet = _fernet(secret or settings.bot_secret_key)
        self._lock = threading.Lock()
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    telegram_id INTEGER PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    refresh_enc TEXT NOT NULL,
                    access_enc TEXT NOT NULL DEFAULT '',
                    phone TEXT NOT NULL DEFAULT '',
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _enc(self, value: str) -> str:
        return self._fernet.encrypt(value.encode("utf-8")).decode("utf-8")

    def _dec(self, value: str) -> str:
        try:
            return self._fernet.decrypt(value.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            raise ValueError("session_decrypt_failed") from exc

    def save(
        self,
        *,
        telegram_id: int,
        user_id: int,
        refresh_token: str,
        access_token: str = "",
        phone: str = "",
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO sessions (telegram_id, user_id, refresh_enc, access_enc, phone, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(telegram_id) DO UPDATE SET
                    user_id=excluded.user_id,
                    refresh_enc=excluded.refresh_enc,
                    access_enc=excluded.access_enc,
                    phone=excluded.phone,
                    updated_at=excluded.updated_at
                """,
                (
                    telegram_id,
                    user_id,
                    self._enc(refresh_token),
                    self._enc(access_token or ""),
                    phone,
                    now,
                ),
            )
            conn.commit()

    def get(self, telegram_id: int) -> BotSession | None:
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM sessions WHERE telegram_id = ?", (telegram_id,)
            ).fetchone()
        if not row:
            return None
        return BotSession(
            telegram_id=row["telegram_id"],
            user_id=row["user_id"],
            refresh_token=self._dec(row["refresh_enc"]),
            access_token=self._dec(row["access_enc"]) if row["access_enc"] else "",
            phone=row["phone"] or "",
            updated_at=row["updated_at"],
        )

    def update_access(self, telegram_id: int, access_token: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as conn:
            conn.execute(
                "UPDATE sessions SET access_enc = ?, updated_at = ? WHERE telegram_id = ?",
                (self._enc(access_token), now, telegram_id),
            )
            conn.commit()

    def delete(self, telegram_id: int) -> None:
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM sessions WHERE telegram_id = ?", (telegram_id,))
            conn.commit()
