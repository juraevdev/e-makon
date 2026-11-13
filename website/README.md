# E-MAKON portfolio sayt (`e-makon.uz`)

Statik portfolio: loyiha tushuntirish + Superadmin / Admin / Mobile / Bot havolalari.

## Lokal ko‘rish

```powershell
cd website
python -m http.server 4173
```

Ochish: http://127.0.0.1:4173/

## Production

Host nginx apex (`e-makon.uz`) shu papkani serve qiladi — `deploy/host-nginx/e-makon.conf`.

Telegram bot username o‘zgarsa, saytda `main.js` ichidagi default (`emakonBot`) ni yangilang yoki `window.EMAKON_BOT_USERNAME` belgilang.
