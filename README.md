# E-Makon

Monorepo: **REST API** (source of truth) + Telegram **bot** (HTTP client) + mobile / admin clients.

The bot does **not** own business data — it calls this API with JWT + `X-Bot-Service-Key`.

## Layout

```
e-makon/
  config/ + apps/             REST API (DRF, JWT, OTP)
  bot/                        Telegram bot (HTTP adapter, Redis notifications)
  mobile/                     Flutter mijoz ilovasi
  superadmin_panel/           Admin panel (Next.js)
```

### API architecture (`apps/`)

```
config/                 Django project (settings split: local / production)
apps/
  core/                 TimeStampedModel, pagination, permissions, errors
  accounts/             Custom User (phone), OTP, JWT, admin password login
  organizations/        Multi-tenant Organization (tenant scope)
  catalog/              Services
  orders/               Orders, media, status machine
  staff/                Employees + AdminProfile capabilities
  care/                 Yearly-care contracts and visits
  support/              Tickets + messages
  analytics/            Admin dashboard KPIs (org-scoped)
  notifications/        Redis enqueue + NotificationDelivery log
```

Layering: **View → Serializer → Service → Model**. Business rules live in `services.py`, not in views.

Roles: `customer` | `worker` | `admin` | `superadmin`

Tenancy: non-superadmin users and domain rows belong to an `Organization`. Superadmin is platform-scoped (`organization=NULL`). Admins see only their org via queryset scoping + `AdminProfile` capability flags.

## Setup

Quick start (Windows):

```powershell
.\run.ps1 -Setup          # venv + pip + .env + migrate + seed
.\run.ps1                 # API (fon) + Telegram bot (shu terminal)
.\run.ps1 -ApiOnly        # faqat API
.\run.ps1 -Redis          # Redis (Docker) + API + bot
```

Manual:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py seed_catalog
python manage.py createsuperuser   # phone + password (role=superadmin)
python manage.py runserver
```

- API docs: http://127.0.0.1:8000/api/docs/
- Django admin: http://127.0.0.1:8000/django-admin/
- Health: http://127.0.0.1:8000/health/

Dev OTP: `OTP_DEBUG_RETURN_CODE=True` returns `debug_code` in the request-OTP response (no SMS yet).

OTP is **customer-only** (rate-limited). Admin/worker accounts must use password login.

## Customer API (`/api/v1/`)

| Method | Path | Auth |
|---|---|---|
| POST | `/auth/otp/request/` | public |
| POST | `/auth/otp/verify/` | public |
| POST | `/auth/telegram/link/` | JWT customer + `X-Bot-Service-Key` |
| POST | `/auth/telegram/unlink/` | JWT customer + `X-Bot-Service-Key` |
| GET/PATCH | `/auth/me/` | JWT — profil (telegram_id yozib bo‘lmaydi) |
| GET | `/services/` | public — category, duration, gallery, features |
| GET | `/services/{slug}/` | public |
| GET/POST | `/orders/` | customer — `Idempotency-Key` qo‘llab-quvvatlanadi |
| POST | `/orders/{id}/cancel/` | customer |
| GET | `/care-contracts/` | customer |
| GET/POST | `/support/` | customer (ichki xabarlar yashiriladi) |

## Telegram Bot

See [`bot/README.md`](bot/README.md). Run separately:

```powershell
python -m bot.main
```

Requires Redis, `BOT_TOKEN`, and matching `EMAKON_BOT_SERVICE_KEY`.

OTP example:

```json
POST /api/v1/auth/otp/request/
{ "phone": "901234567" }

POST /api/v1/auth/otp/verify/
{ "phone": "901234567", "code": "123456", "full_name": "Aziz" }
```

Create order (multipart): `service_id`, optional `area_size`, `address`, `notes`,
`phone_number`, `first_name` / `last_name` (yoki `customer_first_name` /
`customer_last_name`), `media`.

Profile PATCH: `first_name`, `last_name`, `birth_date`, `home_address`, `country`,
`region`, `district`, `street`, `location_lat`, `location_lng`, `additional_phones`,
`avatar`, `email`.

## Superadmin / Admin API (`/api/v1/admin/`)

| Method | Path |
|---|---|
| POST | `/auth/admin/login/` `{ phone, password }` |
| GET | `/admin/dashboard/?days=30` |
| CRUD | `/admin/services/` `/admin/orders/` `/admin/employees/` `/admin/admins/` `/admin/support/` |

Admin endpoints require role `admin`/`superadmin`. Org admins need an active `AdminProfile` with the relevant capability (`can_manage_orders`, `can_manage_staff`, `can_view_analytics`). Lists are scoped to the admin's organization; superadmin sees all.

Order status (same as mobile): `new` → `in_review` → `contacted` → `completed` | `cancelled`

```json
POST /api/v1/admin/orders/{id}/transition/
{ "status": "contacted", "assigned_worker_id": 3, "quoted_price": 1500000 }
```
