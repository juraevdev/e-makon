<<<<<<< HEAD
# mygarden_app

A new Flutter project.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Lab: Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Cookbook: Useful Flutter samples](https://docs.flutter.dev/cookbook)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
=======
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

Default: `http://10.0.2.2:8000/api/v1` (Android emulator → host).

Telefon/qurilma uchun:

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
>>>>>>> 63cd8e2c5ad351605a7b5f99b986ce243e9059a8
