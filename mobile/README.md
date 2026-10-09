# My Garden — Flutter mobil ilova

Stitch dizayniga mos dark UI (`#121414`, primary `#88d982`).

## Ishga tushirish

```powershell
# 1) Backend (alohida terminal)
cd D:\Cloude\projects\e-makon
.\.venv\Scripts\Activate.ps1
python manage.py runserver 0.0.0.0:8000

# 2) Mobil
cd mobile
flutter pub get
flutter run
```

### API manzil

Default: `https://api.e-makon.uz/api/v1` (production server) — oddiy `flutter build apk --release` shu serverga ulanadi.

Lokal backend bilan (telefon/qurilma):

```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.x.x:8000/api/v1
```

Windows desktop:

```powershell
flutter run -d windows --dart-define=API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## Ekranlar

Splash → Onboarding → Login (+998) → OTP → Home (9 xizmat) → Detail → Order 1–3 → Success → Orders / Profile

OTP: backend `OTP_DEBUG_RETURN_CODE=True` bo‘lsa, kod ekranda ko‘rinadi.
