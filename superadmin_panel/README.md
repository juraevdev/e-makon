# E-MAKON SuperAdmin Panel

Next.js (App Router) + Tailwind v4. Mobil ilova bilan **bir xil domain**: mijoz, hamkor (xodim), xizmat katalogi, buyurtma statuslari.

## Ishga tushirish

Backend (alohida terminal):

```powershell
cd C:\ibrohim\projects\e-makon
.\.venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py seed_catalog
python manage.py seed_demo
python manage.py runserver
```

Panel:

```powershell
cd superadmin_panel
copy .env.example .env.local   # ixtiyoriy
npm install
npm run dev
```

→ http://localhost:3000

Kirish: superadmin telefon + parol (`python manage.py createsuperuser`).

API: `NEXT_PUBLIC_API_BASE_URL` (default `http://127.0.0.1:8000/api/v1`).

## Routes

| Path | Ma'nosi (mobil bilan) |
|------|--------|
| `/` | Dashboard KPI |
| `/hisobotlar` | Analitika |
| `/foydalanuvchilar` | Mobil mijozlar |
| `/hamkorlar` | Xodimlar (buyurtmaga tayinlash) |
| `/xizmatlar` | Katalog CRUD |
| `/buyurtmalar` | Status mashinasi: Yangi → Kelishilmoqda → Bog'lanildi → Bajarildi |
| `/bannerlar` | Mobil bannerlar |
| `/aloqa` | Support ticketlar |
| `/ball-tizimi` | Bajarilgan buyurtmadan ball |
| `/xarita` | Mijoz/hamkor geo |
| `/sozlamalar` | Profil va adminlar |

## Stack

- Next.js 16 + React 19
- Tailwind CSS 4 (primary `#88d982`)
- Django REST `/api/v1` (JWT)
