# E-Makon / My Garden

Monorepo: mobile/superadmin **REST API** + Telegram **bot** (My Garden).

Domain is shared conceptually (`Service`, `Order` statuses, `Worker`, care contracts).
API and bot are **separate Django projects** (own `manage.py`, settings, DB) until an
explicit shared-DB sync is wired.

## Layout

```
e-makon/
  config/ + apps/             REST API (DRF, JWT, OTP)
  mobile/                     Flutter mijoz ilovasi (Stitch UI)
  mygarden/                   Telegram bot
```

### API architecture (`apps/`)

```
config/                 Django project (settings split: local / production)
apps/
  core/                 TimeStampedModel, pagination, permissions, errors
  accounts/             Custom User (phone), OTP, JWT, admin password login
  catalog/              Services (Stitch home grid)
  orders/               Orders, media, status machine
  staff/                Employees + admin profiles
  care/                 Yearly-care contracts and visits
  support/              Tickets + messages
  analytics/            Superadmin dashboard KPIs
```

Layering: **View → Serializer → Service → Model**. Business rules live in `services.py`, not in views.

Roles: `customer` | `worker` | `admin` | `superadmin`

## Setup

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

## Customer API (`/api/v1/`)

| Method | Path | Auth |
|---|---|---|
| POST | `/auth/otp/request/` | public |
| POST | `/auth/otp/verify/` | public |
| GET/PATCH | `/auth/me/` | JWT — profil (ism, manzil, geo, telefonlar) |
| GET | `/services/` | public — category, duration, gallery, features |
| GET | `/services/{slug}/` | public |
| GET/POST | `/orders/` | customer — `first_name`/`last_name` ham qabul qilinadi |
| POST | `/orders/{id}/cancel/` | customer |
| GET | `/care-contracts/` | customer |
| GET/POST | `/support/` | customer |

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

## Superadmin API (`/api/v1/admin/`)

| Method | Path |
|---|---|
| POST | `/auth/admin/login/` `{ phone, password }` |
| GET | `/admin/dashboard/?days=30` |
| GET | `/admin/map/` |
| CRUD | `/admin/services/` `/admin/orders/` `/admin/employees/` `/admin/admins/` `/admin/customers/` `/admin/support/` `/admin/banners/` |
| GET/PATCH | `/admin/loyalty/settings/` |
| CRUD | `/admin/loyalty-rewards/` |
| GET | `/admin/loyalty-transactions/` |

Order status (same as mobile): `new` → `in_review` → `contacted` → `completed` | `cancelled`

Order status (same as mobile): `new` → `in_review` → `contacted` → `completed` | `cancelled`

```json
POST /api/v1/admin/orders/{id}/transition/
{ "status": "contacted", "assigned_worker_id": 3, "quoted_price": 1500000 }
```

## Telegram bot (`mygarden/`)

Copied **without** secrets or local runtime junk (no `.env`, `.venv`, `db.sqlite3`, `__pycache__`).

```powershell
cd mygarden
copy .env.example .env   # fill BOT_TOKEN, Postgres, Redis, ...
.\run.ps1                # or: .\run.ps1 bot
```

Details: [mygarden/README.md](mygarden/README.md), [mygarden/DEPLOY.md](mygarden/DEPLOY.md).

API models keep optional Telegram bridge fields (`telegram_id`, `telegram_file_id`, `external_bot_order_id`) for a future shared DB / sync worker.

Production API DB: set `USE_SQLITE=False` and Postgres env vars (same pattern as the bot).
