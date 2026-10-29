# E-MAKON — To‘liq loyiha hujjati

**Platforma:** bog‘dorchilik, landshaft va uy-joy atrofini parvarishlash xizmatlari uchun raqamli bozor  
**Hujjat turi:** mahsulot, biznes va texnik umumiy tavsif  
**Sana:** 2026-yil

---

## 1. Loyiha nima?

**E-MAKON** — mijozlar, xizmat ko‘rsatuvchi firmalar va platforma ma’muriyatini birlashtiradigan marketplace. Mijoz telefon ilovasi yoki Telegram bot orqali xizmat buyurtma qiladi; firmalar o‘z panelidan buyurtmani qabul qiladi, xodim tayinlaydi, jadval va moliya bilan ishlaydi; E-MAKON markazi sifat, to‘lov (escrow), moderatsiya va hisobotlarni nazorat qiladi.

**Asosiy g‘oya:** “Makoningiz — bir platformada.”  
Bog‘, hovli, daraxt, gazon, sug‘orish va yillik parvarish kabi xizmatlar tartibli, shaffof va kuzatiladigan bo‘ladi.

---

## 2. Kim uchun?

| Ishtirokchi | Vazifasi |
|-------------|----------|
| **Mijoz** | Xizmat tanlaydi, firma/vaqt tanlaydi, to‘laydi, holatni kuzatadi |
| **Firma (hamkor)** | Taklif va narx beradi, buyurtma bajaradi, xodim va jadvalni boshqaradi |
| **Xodim / brigada** | Buyurtmaga biriktiriladi, ish bosqichlarini bajaradi |
| **Firma administratori** | Firma paneli orqali operatsiyani yuritadi |
| **Platforma (superadmin)** | Firmalar, katalog, moliya, sifat, bannerlar, ball tizimi |
| **Investor** (ixtiyoriy modul) | Platforma tomonida hisobga olinadi |

---

## 3. Loyihaning har bir qismi

### 3.1. Backend API (`apps/` + `config/`)

**Rol:** butun tizimning “miyasi” — barcha ma’lumot va biznes qoidalari shu yerda.

| Modul | Nima qiladi |
|-------|-------------|
| `accounts` | Telefon orqali OTP, JWT, admin parol bilan kirish |
| `organizations` | Firmalar (multi-tenant), status, komissiya, sinov, jarima |
| `catalog` | Xizmat turlari, firma takliflari, moderatsiya |
| `orders` | Buyurtma, media, holatlar, bandlik jadvali, to‘lov/escrow |
| `staff` | Xodimlar, admin profili va imkoniyatlar |
| `care` | Yillik parvarish shartnomalari va tashriflar |
| `support` | Ticket va chat |
| `loyalty` | Ballar va mukofotlar |
| `analytics` | Dashboard, hisobot, xarita ma’lumotlari |
| `notifications` | Redis navbati orqali bildirishnomalar |

**Texnologiya:** Django + DRF, JWT, PostgreSQL (prod) / SQLite (dev), Redis.

**Foyda:** bitta manba (source of truth) — mobil, bot va panellar bir xil qoidalarga bo‘ysunadi.

---

### 3.2. Mobil ilova (`mobile/`)

**Rol:** mijozning asosiy kanali (Android / iOS / Web).

**Asosiy imkoniyatlar:**
- Onboarding, OTP orqali kirish
- Katalog, bannerlar, yaqin firmalar
- Buyurtma: firma, manzil, vaqt sloti, rasm, tasdiqlash
- Buyurtmalar holati va to‘lov ekrani
- Chat / xabarlar
- Profil, ballar (loyalty)
- Sevimlilar va sharhlar (qisman)

**Texnologiya:** Flutter.

**Foyda:** mijoz do‘kon yoki call-markazsiz, o‘z telefonidan buyurtma beradi.

---

### 3.3. Telegram bot (`bot/`)

**Rol:** qo‘shimcha mijoz kanali — Telegram ichida buyurtma va bildirishnomalar.

**Muhim:** bot o‘z bazasida biznes ma’lumot saqlamaydi; faqat API chaqiradi (JWT + service key).

**Foyda:** O‘zbekistonda Telegram keng tarqalgan — past “kirish to‘siq” bilan yangi mijozlarni jalb qilish.

---

### 3.4. Firma admin paneli (`admin_panel/`)

**Rol:** xizmat ko‘rsatuvchi firma uchun boshqaruv paneli.

**Asosiy bo‘limlar:**
- Bosh sahifa (ko‘rsatkichlar)
- Buyurtmalar + jonli jadval (Schedule)
- Xizmatlar, xodimlar, mijozlar
- Parvarish shartnomalari
- Moliya, xarita, murojaatlar
- Hisobotlar, firma profili, sozlamalar

**Texnologiya:** Next.js.

**Foyda:** firma Excel/telefon o‘rniga professional operatsiya yuritadi.

---

### 3.5. Superadmin paneli (`superadmin_panel/`)

**Rol:** platforma egasi / E-MAKON markazi.

**Asosiy bo‘limlar:**
- Dashboard va hisobotlar
- Firmalar, foydalanuvchilar, investorlar
- Xodimlar, xizmatlar (moderatsiya), buyurtmalar
- Parvarish, bannerlar, aloqa (chat/ticket)
- Ball tizimi, xarita, administratorlar, sozlamalar
- Moliya amallari: to‘lovni tasdiqlash, firmaga o‘tkazish, qaytarish, nizo, jazo

**Foyda:** markaziy nazorat, sifat va pul oqimi shaffofligi.

---

### 3.6. Deploy va infratuzilma (`deploy/`, `docker-compose.yml`)

**Rol:** serverda ishga tushirish.

- Docker: API, Postgres, Redis, nginx, bot
- Host nginx: `api.e-makon.uz`, `admin.e-makon.uz`, `superadmin.e-makon.uz`
- Panellarni pm2 orqali chiqarish skriptlari

**Foyda:** mahalliy demo emas, haqiqiy domen orqali ishlash imkoniyati.

---

### 3.7. Hujjatlar, demo va pitch (`docs/`, `pitch/`)

- Texnik topshiriq, smeta
- Investor taqdimoti (slaydlar)
- Demo ma’lumotlar (`seed_demo`)

**Foyda:** investor, hamkor va jamoa bilan bir xil tilda gaplashish.

---

## 4. Loyiha qanday ishlaydi? (oddiy oqim)

```
1) Mijoz ilova/botda xizmat tanlaydi
        ↓
2) Firma, sana, bo‘sh vaqt (slot), manzil, rasm yuboradi
        ↓
3) Buyurtma yaratiladi (status: Yangi)
        ↓
4) To‘lov (Click/Payme yoki vaqtincha test/qo‘lda tasdiq)
   Pul platforma escrow’ida ushlanadi
        ↓
5) Firma panelida buyurtma ko‘rinadi → qabul, xodim, vaqt
        ↓
6) Ish bosqichlari: Qabul → Yo‘lda → Yetib keldi → Ishlayapti → Tugadi
   Mijoz real vaqtda kuzatadi
        ↓
7) Platforma (superadmin) to‘lovni firmaga bo‘shatadi (komissiya ushlab qolinadi)
        ↓
8) Mijozga ball, sharh; kerak bo‘lsa chat/murojaat
```

**Yillik parvarish:** alohida shartnoma → tashriflar jadvali → firma bajaradi → platforma tasdiqlaydi.

**Rollar:**
- `customer` — mijoz  
- `worker` — xodim  
- `admin` — firma admini (o‘z firmasi doirasida)  
- `superadmin` — butun platforma  

---

## 5. Bizga (yaratuvchilarga) qanday foyda?

1. **Masshtablanadigan biznes modeli** — har yangi shahar/firma platformani qayta yozmasdan qo‘shiladi.  
2. **Takrorlanuvchi daromad** — komissiya, obuna/sinov, premium joylashuv, banner.  
3. **Ma’lumot aktiv** — talab, narx, hudud, mavsumiy trendlar (keyinchalik AI/narx tavsiyasi).  
4. **Brend kapitali** — “E-MAKON” xizmat sifatining kafolati sifatida tanilishi.  
5. **Investitsiya jozibadorligi** — marketplace + escrow + B2B (parvarish) bir paketda.  
6. **Jamoa va mahorat** — full-stack mahsulot: mobil, web, bot, backend, deploy.  
7. **Uzoq muddatli raqobat ustunligi** — faqat “e’lon doskasi” emas, to‘liq operatsion tizim.

---

## 6. Jamiyatga qanday foyda?

| Guruh | Foyda |
|-------|--------|
| **Aholi / uy egasi** | Ishonchli usta topish osonlashadi; narx va jarayon shaffof; telefon “ovlash” kamayadi |
| **Firmalar** | Yangi mijoz oqimi, raqamli boshqaruv, kamroq “soxta” buyurtma (nazorat bilan) |
| **Ishchilar** | Barqaror buyurtma, rasmiyroq ish tartibi, ko‘nikma bozorida o‘sish |
| **Shahар / mahalla** | Yashil hududlar, hovli-bog‘ parvarishi sifatliroq bo‘ladi |
| **Iqtisod** | Kichik biznes raqamlashtiriladi; soliq/hisob uchun iz qoldirish osonlashadi (kelajakda) |

**Ijtimoiy ta’sir:** “qora bozor” va tasodifiy kelishuvlar o‘rniga — shartnoma, tashrif, baho va kafolat madaniyati.

---

## 7. Avzalliklari (raqobatdan farqi)

1. **Niche fokus** — umumiy “usta chaqirish” emas, bog‘/landshaft/parvarishga ixtisoslashgan.  
2. **Escrow (pul himoyasi)** — mijoz to‘laydi, ish tugagach firmaga o‘tadi.  
3. **Jonli jarayon** — holat + ish bosqichlari + (imkoniyat bo‘yicha) xarita.  
4. **Bandlik jadvali** — bir vaqtga ikki buyurtma “urishib” ketmasligi.  
5. **Yillik parvarish** — bir martalik ishdan tashqari uzoq muddatli shartnoma.  
6. **Ko‘p kanal** — mobil + Telegram + ikki xil admin panel.  
7. **Sifat nazorati** — moderatsiya, jazo, savdo taqiqi, soxta zayavka belgilash.  
8. **Ball tizimi** — qayta buyurtmani rag‘batlantirish.  

---

## 8. Daromad topish modellari

| Manba | Qanday ishlaydi |
|-------|-----------------|
| **Komissiya** | Har muvaffaqiyatli buyurtmadan platforma ulushi |
| **Firma obunasi / sinov** | Oy/yillik tarif, sinov muddati keyin to‘lov |
| **Banner / reklama** | Bosh sahifa karuseli, promo joylar |
| **Premium joylashuv** | Qidiruvda yuqoriroq ko‘rinish (kelajak) |
| **B2B parvarish** | Korxona, mahalla, maktab — yillik shartnomadan ulush |
| **Qo‘shimcha xizmatlar** | Sug‘urta, material marketplace, o‘qitish (kelajak) |

**Oddiy misol (taxminiy):**  
Buyurtma 1 000 000 so‘m, komissiya 10% → platformaga 100 000 so‘m.  
Oyiga 1 000 ta shunday buyurtma → ~100 mln so‘m GMV ulushi (faktlar bozorga qarab o‘zgaradi).

**Muhim:** hozir Click/Payme to‘liq avtomatlashtirilishi va SMS integratsiyasi production daromadni “ochadi”; ularsiz ham model aniq, lekin masshtab cheklangan.

---

## 9. Yangi ish o‘rinlari

### 9.1. Platforma ichida (E-MAKON jamoasi)
- Mahsulot va loyiha menejeri  
- Backend / mobil / frontend dasturchilar  
- DevOps / server  
- Mijozlar qo‘llab-quvvatlash (support)  
- Sifat va moderatsiya  
- Moliya / hisob-kitob operatori  
- Marketing va hamkorlik menejeri  
- Hududiy menejerlar (viloyatlar bo‘yicha)

### 9.2. Hamkor firmalarda
- Dispetcher / operator  
- Bog‘bon, landshaftchi, haydovchi, brigadir  
- Sotuv menejeri  
- Hisobchi (raqamli hisobotlar bilan)

### 9.3. Ekotizim
- Kontent va foto (xizmat galereyasi)  
- O‘qituvchi / trening (standart ish tartibi)  
- Logistika hamkorlari  

**Xulosa:** platforma o‘zi bir necha ofis ishini yaratadi; asosiy ish o‘rinlari esa **minglab mayda va o‘rta firmalarda** buyurtma oqimi orqali ko‘payadi.

---

## 10. Texnik arxitektura (qisqa)

```
[ Mobil Flutter ]──┐
[ Telegram bot  ]──┼──► [ Django REST API ] ──► [ Postgres ]
[ Firma panel   ]──┤            │
[ Superadmin    ]──┘            ├── Redis (navbat, kesh)
                                └── Media / static (nginx)
```

- **Multi-tenancy:** har firma o‘z ma’lumotini ko‘radi; superadmin — hammasi.  
- **Xavfsizlik yo‘nalishi:** JWT, OTP limitlari, logout/blacklist, rol va capability.  
- **Deploy:** docker-compose + host nginx + pm2 panellar.

---

## 11. Hozirgi holat va keyingi qadamlar (qisqa)

**Ishlayotgan asos:** API, panellar, mobil, bot skeleti, buyurtma/escrow, parvarish, ball, deploy konfiguratsiyasi.

**Production uchun muhim qadamlar (biznes nuqtai nazaridan):**
1. SMS (haqiqiy OTP)  
2. Click/Payme to‘liq callback  
3. Push-bildirishnomalar  
4. Store (Play / App Store) talablari  
5. Usta (worker) mobil rejimi  
6. Marketing va birinchi shahar uchun firmalar bazasi  

---

## 12. Xulosa

E-MAKON — bu faqat “ilova” emas. Bu:

- **mijoz uchun** — ishonchli xizmat olish yo‘li;  
- **firma uchun** — mijoz va boshqaruv tizimi;  
- **jamiyat uchun** — yashil muhit va rasmiyroq mehnat bozori;  
- **yaratuvchilar uchun** — komissiya va obuna asosidagi o‘sadigan raqamli biznes.

To‘g‘ri ishga tushirilsa, platforma bir vaqtda **daromad**, **ish o‘rinlari** va **ijtimoiy foyda** yaratadi.

---

## 13. Tezkor havolalar (mahalliy ishga tushirish)

| Qism | Manzil (dev) |
|------|----------------|
| API | `http://127.0.0.1:8000` · docs: `/api/docs/` |
| Superadmin | `http://localhost:3000` |
| Firma paneli | `http://localhost:3002` |
| Mobil (web) | `http://localhost:5000` (ishga tushirilganda) |
| Production API | `https://api.e-makon.uz` |

---

*Ushbu hujjat loyiha kod bazasi va texnik topshiriq asosida tayyorlangan. Raqamlar (komissiya foizi, buyurtma hajmi) biznes qarori bilan yangilanishi mumkin.*
