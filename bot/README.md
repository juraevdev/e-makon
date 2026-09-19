# E-Makon Telegram Bot

Independent **customer** Telegram client for the E-Makon platform.

This is **not** MyGarden. It does not import MyGarden, share its database, or use its models.

## Architecture

```
Telegram → aiogram 3 Bot → HTTP → E-Makon DRF API → PostgreSQL
                ↓
              Redis (FSM + notification queue + rate limits)
                ↓
         Bot SQLite (encrypted refresh tokens only)
```

Backend is the source of truth. The bot never uses Django ORM or the E-Makon database.

## Requirements

- Python 3.11+
- Running E-Makon API (`python manage.py runserver`)
- Redis
- `EMAKON_BOT_SERVICE_KEY` matching API settings
- `BOT_TOKEN` from @BotFather

## Setup

```powershell
# from repo root
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

copy .env.example .env
# fill BOT_TOKEN, EMAKON_BOT_SERVICE_KEY, BOT_SECRET_KEY

# API
python manage.py migrate
python manage.py seed_catalog
python manage.py runserver

# Bot (other terminal)
python -m bot.main
```

## Environment

| Variable | Purpose |
|----------|---------|
| `BOT_TOKEN` | Telegram bot token |
| `EMAKON_API_BASE_URL` | e.g. `http://127.0.0.1:8000/api/v1` |
| `EMAKON_BOT_SERVICE_KEY` | Shared secret for `/auth/telegram/link/` |
| `REDIS_URL` | FSM + notifications |
| `BOT_SECRET_KEY` | Encrypts refresh tokens in bot DB |
| `BOT_DATABASE_PATH` | Local SQLite session file |
| `BOT_RUN_MODE` | `polling` (dev) or `webhook` (prod) |
| `WEBHOOK_URL` / `WEBHOOK_SECRET` | Production webhook |

## Modes

- **Polling:** `BOT_RUN_MODE=polling` then `python -m bot.main`
- **Webhook:** `BOT_RUN_MODE=webhook`, set `WEBHOOK_URL`, run bot (aiohttp on `BOT_PORT`)

Notification worker runs inside the bot process and consumes Redis list `NOTIFICATION_QUEUE_KEY`.

## Tests

```powershell
# Backend
python manage.py test apps.accounts.tests_telegram_security apps.orders.tests_idempotency

# Bot unit
python -m pytest bot/tests -q
```

## Security

- Never commit real `BOT_TOKEN` / service keys
- Customers cannot set `telegram_id` via `/auth/me/`
- Telegram link requires JWT + `X-Bot-Service-Key`
- Internal support messages are filtered by the API (bot also strips `is_internal` defensively)
