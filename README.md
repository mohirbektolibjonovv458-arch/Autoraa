# Avtora

Avtomobil xizmatlari platformasi: sayt + admin panel + 2 ta Telegram bot. Hammasi **bitta buyruq** bilan ishga tushadi.

Botlar allaqachon ulangan (`backend/.env` ichida tokenlar yozilgan). Demo ma'lumot yo'q — baza bo'sh, real foydalanuvchilar ro'yxatdan o'tadi.

---

## Ishga tushirish (3 qadam)

**1. Python o'rnating** (bir marta) — https://www.python.org/downloads/
Windows'da o'rnatishda **"Add Python to PATH"** belgisini albatta qo'ying.

**2. Ishga tushiring**
- **Windows:** `start.bat` faylini ikki marta bosing
- **Linux / macOS / server:** `./start.sh`

Birinchi marta kutubxonalar o'rnatiladi (1–3 daqiqa) va **admin telefon raqami + parol** so'raladi — bu sizning admin panelga kirishingiz.

**3. Oching**
- Sayt: http://localhost:8000
- Admin panel: http://localhost:8000/admin/login

Oyna ochiq turguncha sayt ham, ikkala bot ham ishlaydi. To'xtatish — `Ctrl + C`.

---

## Birinchi sozlash (1 daqiqa)

Premium to'lovlar sizga Telegramda kelishi uchun:

1. Premium botni oching (nomi ishga tushganda oynada `✅ Premium bot: @...` deb chiqadi).
2. `/start` → **«📱 Raqamni ulashish»** — admin qilib yaratgan raqamingiz bilan.
3. Bot «Admin sifatida ulandingiz» deydi. Tamom.

Bir nechta admin bo'lsa: admin panel → Foydalanuvchilar'da ularga admin roli bering, ular ham shu tarzda botga ulanadi.

---

## Qanday ishlaydi

**Ro'yxatdan o'tish / kirish (Kod boti)**
Foydalanuvchi saytda raqamini yozadi → birinchi marta bo'lsa sayt kod botini ochishni so'raydi → botda «Raqamni ulashish» → sayt 4 xonali kodni botga yuboradi → kodni kiritadi. Kod 3 daqiqa amal qiladi.
Foydalanuvchi, Usta va Evakuator alohida ro'yxatdan o'tadi, har biri o'z paneliga tushadi.

**Premium (Premium bot) — 40 000 so'm / oy**
1. Usta saytda (Premium bo'limi) yoki Premium botda karta raqamini ko'radi: `4073 4200 7954 5178`.
2. Pul o'tkazadi, chek rasmini yuboradi, **«✅ Pul soldim»**.
3. Sizga botda chek + **✅ Tasdiqlash / ❌ Rad etish** tugmalari keladi.
4. Bank ilovangizda pul tushganini ko'rib, tasdiqlaysiz → ustaning zapchast do'koni avtomatik ochiladi, ustaga xabar boradi.

Karta raqami va narxni admin panel → Sayt sozlamalari'dan o'zgartirasiz. Premium tugasa do'kon mahsulotlari yashiriladi, uzaytirilsa qaytadi.

> Karta-karta o'tkazmani hech bir dastur o'zi tekshira olmaydi (buning uchun Payme/Click merchant shartnomasi kerak), shuning uchun oxirgi tasdiq sizda.

---

## Imkoniyatlar

**Mijoz:**
- Usta topish: ro'yxat, xarita va sevimlilar ko'rinishi.
- Onlayn bron, SOS va evakuator (jonli kuzatuv, joylashuvni yaqinlarga yuborish).
- Ehtiyot qismlar: mahsulot va do'kon sahifalari, savat.
- Umumiy qidiruv, chat, baho qoldirish, «Qayta bron».
- **Mening avtomobilim:**
  - Holati: servis, moy, shina, texosmotrgacha qolgan km.
  - Hujjatlar: OSAGO, KASKO, texosmotr, ishonchnoma, tonirovka, gaz ballon, prava.
  - Xarajatlar: oylik grafik.
  - Servis tarixi.

**⛽ Yoqilg'i xaritasi (har kungi foydalanish uchun):**
- Metan, propan, benzin, dizel va elektr quvvatlash shoxobchalari xaritada.
- Haydovchilar holatni belgilaydi: bor / navbat kichik / navbat katta / yo'q / yopiq, narx bilan. Belgi 3 soat dolzarb, bir necha kishi tasdiqlasa ko'rsatiladi.
- Ishonchlilik: faqat shoxobchadan 2 km radiusda (GPS bilan) belgilash mumkin, bir kishi 10 daqiqada bir marta.
- «Gaz kelsa xabar ber» — sevimli shoxobchada «yo'q» → «bor» bo'lganda Telegram'ga xabar keladi.
- Haftaning eng faol yordamchilari reytingi.
- Ro'yxatdan o'tmasdan ko'rish: `/yoqilgi` sahifasi (reklama va o'sish uchun havolani ulashing).
- Telegram kod botida: /metan, /propan, /benzin → joylashuv yuboriladi → eng yaqin shoxobchalar holati bilan.
- Shoxobchalar birinchi ishga tushishda OpenStreetMap'dan avtomatik yuklanadi (© OpenStreetMap contributors). Xaritada yo'q shoxobchani foydalanuvchilar qo'shadi, admin tasdiqlaydi.
- Admin panel → «Yoqilg'i shoxobchalari»: tasdiqlash, yashirish, noto'g'ri belgilarni o'chirish, OSM'dan yangilash.

**Usta:**
- Buyurtmalar, xizmat va narxlar.
- Ishlardan namunalar (rasmlar).
- Tezkor SOS so'rovlari.
- Premium va zapchast do'koni. Premium ustalar qidiruvda yuqoriroq chiqadi.

**Evakuator:** online rejim, yaqin so'rovlar, navigator, tarif.

**Admin:** statistika, foydalanuvchilar, ustalarni tasdiqlash, to'lovlar, do'konlar, jonli xarita, blog, sozlamalar.

**Avtomatik eslatmalar (Telegram + saytda):**
- Hujjat muddati tugashiga 30, 7, 3, 1 kun qolganda.
- Bron vaqti yaqinlashganda — mijozga ham, ustaga ham.
- Premium tugashiga 3 kun qolganda.

**Telefonga o'rnatish:** sayt ilova sifatida o'rnatiladi (bosh ekranda Avtora belgisi, SOS tezkor tugmasi).
- Android: brauzerda «O'rnatish» tugmasi.
- iPhone: Safari → Ulashish → «Bosh ekranga qo'shish».

---

## Yoqilg'i xaritasi — ma'lumotlar qayerdan olinadi

- **Manba:** OpenStreetMap (Overpass API). Butun O'zbekiston bo'yicha benzin, dizel, propan (LPG), metan (CNG) shoxobchalari va elektr quvvatlash stansiyalari yuklanadi.
- **Qanday yuklanadi:** server birinchi ishga tushganda o'zi yuklaydi, keyin **haftada bir marta** avtomatik yangilaydi.
- **Frontend Overpass'ga murojaat qilmaydi.** U faqat bizning API'dan xaritada ko'rinib turgan hududni oladi. Uzoqlashtirilganda server nuqtalarni guruhlaydi (klaster), javoblar 60 soniya keshlanadi.
- **Yoqilg'i turi:**
  - aniq OSM teglaridan olinadi (`fuel:cng`, `fuel:lpg`, `fuel:octane_*`, `fuel:diesel`);
  - teg bo'lmasa nomidan aniqlanadi (AGNKS → metan, AGZS → propan) va ilovada «nomidan aniqlangan» deb ko'rsatiladi.
- **Foydalanuvchi ma'lumotlari:** foydalanuvchilar qo'shgan shoxobchalar va ular belgilagan turlar yangilanishda o'chmaydi. OSM'dan olib tashlangan shoxobchalar yashiriladi.
- **Joylashuv maxfiyligi:** foydalanuvchi joylashuvi faqat masofani hisoblash uchun so'rovda yuboriladi — bazada saqlanmaydi va boshqalarga ko'rsatilmaydi.
- **Qo'lda yangilash:** admin panel → Yoqilg'i shoxobchalari → «Yangilash», yoki `python manage.py import_fuel_stations`.

**Agar server Overpass'ga ulana olmasa** (firewall va h.k.):
1. https://overpass-turbo.eu saytiga kiring.
2. Quyidagi so'rovni yozing va **Export → raw data (JSON)** qiling:
   ```
   [out:json][timeout:240];
   area["ISO3166-1"="UZ"][admin_level=2]->.uz;
   ( nwr["amenity"="fuel"](area.uz); nwr["amenity"="charging_station"](area.uz); );
   out center tags;
   ```
3. Admin panel → Yoqilg'i → «JSON fayldan import». Yoki buyruq bilan: `python manage.py import_fuel_stations --file export.json`.

**Xarita plitalari (fon xaritasi):** server orqali proksilanadi va diskda keshlanadi (`backend/tilecache`). Sukut bo'yicha OpenStreetMap ishlatiladi — u kichik va o'rta trafik uchun mo'ljallangan. Foydalanuvchilar ko'paysa, tijoriy provayder ulang (MapTiler, Stadia va h.k.). Buning uchun `.env` da yozing:
- `MAP_TILE_URL` — provayder manzili;
- `MAP_TILE_KEY` — kalit (faqat serverda qoladi, brauzerga chiqmaydi);
- `MAP_ATTRIBUTION` — xaritadagi mualliflik yozuvi.

---

## Serverga joylash (production)

Telefonlarda GPS (SOS, xarita, yoqilg'i belgilari) faqat **HTTPS** saytda ishlaydi. Ikki yo'l bor:

### A) Docker bilan (tavsiya etiladi) — PostgreSQL + avtomatik HTTPS

1. Ubuntu server oling (2 GB RAM yetadi). **Shaxsiy ma'lumotlar qonuniga ko'ra server O'zbekistonda bo'lishi kerak.** Domenning A-yozuvini server IP siga yo'naltiring.
2. Docker o'rnating: `curl -fsSL https://get.docker.com | sh`
3. Loyihani serverga yuklang va `backend/.env` da to'ldiring:
   - `DOMAIN=avtora.uz` — shu bilan ALLOWED_HOSTS, CSRF, SITE_URL avtomatik sozlanadi;
   - `ADMIN_PHONE`, `ADMIN_PASSWORD` (kamida 8 belgi);
   - `POSTGRES_PASSWORD` allaqachon tasodifiy yozilgan.
4. Ishga tushiring:
   ```bash
   docker compose --env-file backend/.env up -d --build
   ```
   - Caddy bepul HTTPS sertifikatni o'zi oladi.
   - PostgreSQL bazasi ishga tushadi.
   - Har kuni baza zaxirasi `./backups` papkasiga olinadi (14 kun saqlanadi).
5. Tekshirish: `https://avtora.uz/api/health/` → `{"status": "ok"}`. Loglar: `docker compose logs -f app` va `backend/logs/avtora.log`.

Yangilash: yangi kodni yuklab, yana `docker compose --env-file backend/.env up -d --build`. Migratsiyalar avtomatik qo'llanadi.

### B) Dockersiz (VPS + Nginx)

`deploy/avtora.service` (systemd) va `deploy/nginx.conf` + certbot. Bu holda `.env` da `DOMAIN=...` va `HTTPS=1` yozing.

Muhim: botlar bir vaqtda faqat **bitta joyda** ishlashi kerak. Serverga qo'ygach, kompyuteringizdagi nusxani o'chiring.

---

## Ilovani o'rnatishni sinash (PWA)

Brauzerlar ilovani faqat **xavfsiz manzildan** o'rnatadi: `https://...` yoki kompyuterning o'zidagi `localhost`.

| Qayerda ochilgan | O'rnatiladimi |
|---|---|
| `http://localhost:8000` (`python manage.py start`) | ✅ Kompyuterda (Chrome/Edge: manzil qatoridagi ⊕ yoki menyudagi «Ilovani o'rnatish») |
| `http://localhost:5173` (`npm run dev`) | ❌ Dev rejim — service worker ataylab o'chiq |
| Telefonda `http://192.168...:8000` | ❌ http — telefon o'rnatishga ruxsat bermaydi |
| `https://...` (Railway yoki tunnel) | ✅ Telefonda ham, kompyuterda ham |

### Telefonda sinash (deploy qilmasdan)

Cloudflare'ning bepul tunneli kompyuteringizdagi saytga vaqtinchalik https manzil beradi:

1. `cloudflared` ni o'rnating: https://developers.cloudflare.com/cloudflared/ (Windows: `winget install Cloudflare.cloudflared`).
2. Birinchi terminalda: `python manage.py start`.
3. Ikkinchi terminalda: `cloudflared tunnel --url http://localhost:8000`.
4. Chiqqan `https://....trycloudflare.com` manzilini telefonda oching — pastda o'rnatish banneri chiqadi.

---

## Railway'ga joylash

Loyiha ildizida `Dockerfile` va `railway.json` bor — Railway ularni o'zi topadi.

1. **GitHub.** Loyihani GitHub'ga yuklang. `backend/.env` `.gitignore` da, u yuklanmaydi.
2. **Loyiha.** Railway → **New Project → Deploy from GitHub repo** → shu repozitoriyni tanlang.
3. **Baza.** Shu loyihaga **+ New → Database → PostgreSQL** qo'shing.
4. **Volume.** App servisiga Settings → Volumes → **mount path: `/data`** (yuklangan rasmlar deploy'dan keyin yo'qolmasligi uchun).
5. **Environment variables.** App servisi → Variables:

   | O'zgaruvchi | Qiymat |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference) |
   | `SECRET_KEY` | 50+ belgili tasodifiy satr |
   | `HTTPS` | `1` |
   | `TRUSTED_PROXY` | `*` |
   | `MEDIA_ROOT` | `/data/media` |
   | `TILE_CACHE_DIR` | `/data/tilecache` (xarita keshi) |
   | `RAILWAY_RUN_UID` | `0` (Volume'ga yozish huquqi uchun) |
   | `AUTH_BOT_TOKEN`, `PREMIUM_BOT_TOKEN` | bot tokenlari |
   | `ADMIN_PHONE`, `ADMIN_PASSWORD` | admin (parol 8+ belgi) |
   | `DOMAIN` | faqat o'z domeningiz bo'lsa (masalan `avtora.uz`); bo'lmasa Railway domeni avtomatik olinadi |

   `PORT` ni Railway o'zi beradi — yozmang.
6. **Domen.** Settings → Networking → **Generate Domain** (yoki Custom Domain). HTTPS'ni Railway o'zi beradi.
7. **Replikalar.** Faqat **1 ta replika** qoldiring — Telegram botlar ikki nusxada ishlay olmaydi.

### Deploy'dan keyin PWA tekshiruv ro'yxati

- [ ] `https://SIZNING-DOMEN/api/health/` → `{"status": "ok"}`
- [ ] `https://SIZNING-DOMEN/manifest.webmanifest` ochiladi (JSON)
- [ ] `https://SIZNING-DOMEN/sw.js` ochiladi
- [ ] Kompyuterda Chrome → F12 → **Application**:
  - Manifest bo'limida xato yo'q, ikonkalar ko'rinadi;
  - Service Workers bo'limida `sw.js` — *activated and is running*.
- [ ] Chrome → F12 → **Lighthouse** → Mobile → PWA / «Installable» — o'tadi
- [ ] Android Chrome'da saytni oching → 2–3 soniyadan keyin pastda «Avtora'ni telefoningizga o'rnating» banneri → **O'rnatish** → Chrome'ning o'rnatish oynasi → bosh ekranda Avtora belgisi
- [ ] Bosh ekrandan oching → manzil qatorisiz, alohida ilova oynasida ochiladi
- [ ] iPhone Safari → **Ulashish (⬆)** → **Bosh ekranga qo'shish** → bosh ekrandan ochganda manzil qatori yo'q, ochilish ekrani (splash) ko'rinadi
- [ ] Ilova ochiq turganda internetni o'chiring → sahifa almashtiring → «Internet aloqasi yo'q» sahifasi; internet yoqilsa o'zi yangilanadi
- [ ] Kirish, ro'yxatdan o'tish, chat, bron, SOS — o'rnatilgan ilovada ham ishlaydi

### PWA qanday ishlaydi

- **O'rnatish banneri** faqat telefonda, sayt birinchi ochilganda chiqadi:
  - login, ro'yxatdan o'tish va admin sahifalarida chiqmaydi;
  - «X» bosilsa 30 kun chiqmaydi;
  - ilova o'rnatilgan bo'lsa umuman chiqmaydi.
- **Android Chrome:** «O'rnatish» brauzerning haqiqiy o'rnatish oynasini ochadi. Brauzer o'rnatishni qo'llamasa, aniq ko'rsatma chiqadi:
  - Chrome: ⋮ menyu → «Ilovani o'rnatish»;
  - Samsung Internet: ≡ → «Sahifa qo'shish»;
  - iPhone: Ulashish → «Bosh ekranga qo'shish»;
  - Telegram/Instagram ichidagi brauzer: «Brauzerda ochish».
- **Service worker (keshlash qoidalari):**
  - API, chat, buyurtmalar va rasmlar hech qachon keshlanmaydi — har doim real ma'lumot;
  - sahifalar har doim serverdan olinadi, internet bo'lmasa — offline sahifa;
  - faqat hash'li JS/CSS, ikonkalar va shriftlar keshlanadi;
  - har deploy'da eski kesh avtomatik tozalanadi, foydalanuvchi eski versiyada qolib ketmaydi.

---

## Ilovani o'rnatish va Play Market

- **O'rnatish oqimi:**
  - Android Chrome/Edge va kompyuterda — brauzerning haqiqiy o'rnatish oynasi (`beforeinstallprompt`).
  - Holatlar: «Tasdiqlashingiz kutilmoqda» → «O'rnatilmoqda…» → **«Avtora o'rnatildi»** → «Ilovani ochish». Oxirgi holat faqat brauzer `appinstalled` hodisasini yuborganda chiqadi.
  - Brauzer yuklab olish foizini bermaydi, shuning uchun soxta foiz ko'rsatilmaydi.
- **iPhone:** Apple'ning «Ulashish → Bosh ekranga qo'shish» yo'riqnomasi. Brauzerga mos matn chiqadi (Safari, Chrome, Telegram ichidagi brauzer).
- **O'rnatilganidan keyin:** «O'rnatish» tugmalari yashiriladi. Chrome'da `getInstalledRelatedApps` orqali ham tekshiriladi.
- **Yangilanish:** yangi versiya chiqsa, «Avtora uchun yangi versiya mavjud → Yangilash» banneri chiqadi; foydalanuvchi bosganda yangilanadi.
- **Internet yo'q bo'lsa:** ilova qobig'i ochiladi va «Internet aloqasi yo'q» holati ko'rsatiladi. API javoblari, token va shaxsiy ma'lumotlar hech qachon keshlanmaydi.

**Play Market'ga chiqarish** — hozirgi PWA'ni Trusted Web Activity (TWA) sifatida o'raymiz, alohida mobil ilova yozish shart emas:
1. `npm i -g @bubblewrap/cli` → `bubblewrap init --manifest https://DOMEN/manifest.webmanifest` → `bubblewrap build` (AAB fayl hosil bo'ladi).
2. Play Console'da ilova yarating, AAB'ni yuklang va **App signing** bo'limidan SHA-256 barmoq izini oling.
3. `.env` ga yozing:
   - `TWA_PACKAGE_NAME=uz.avtora.app`
   - `TWA_SHA256_FINGERPRINTS=AA:BB:...`

   Shunda `https://DOMEN/.well-known/assetlinks.json` avtomatik ishlaydi va Android ilova manzil qatorisiz ochiladi.

---

## Push bildirishnomalar

Ilova yopiq bo'lsa ham telefon yoki kompyuterning bildirishnoma paneliga xabar keladi (Web Push, VAPID standarti). Firebase shart emas: Chrome/Android xabarlarni o'zi FCM orqali, Firefox Mozilla orqali, iPhone Apple orqali yetkazadi.

**Yoqish:**
- Foydalanuvchi ilovada **«Bildirishnomalarni yoqish»** bosadi (banner, Profil yoki Bildirishnomalar sahifasida).
- Ruxsat sahifa ochilishida so'ralmaydi. Rad etsa ham ilova ishlayveradi.
- **iPhone:** faqat bosh ekranga o'rnatilgan ilovada (iOS 16.4+).

**Kalitlar:** VAPID kalitlari birinchi ishga tushishda avtomatik yaratilib, `.env` ga yoziladi. Maxfiy kalit faqat serverda turadi. Railway'da ularni Variables'ga ko'chiring va boshqa o'zgartirmang — aks holda barcha qurilmalar qayta obuna bo'lishi kerak.

**Yetkazish:**
- Xabarlar bazadagi navbat orqali fon jarayonida yuboriladi, server qayta ishga tushsa ham yo'qolmaydi.
- Yaroqsiz qurilmalar avtomatik o'chiriladi.
- Bir xil hodisa takror yuborilmaydi.
- Chat matni telefon ekraniga chiqmaydi.

---

## Xavfsizlik

### Admin panelga kirish (faqat siz)
1. **Admin hisobi.** Birinchi ishga tushishda yaratiladi. Parol kamida 10 belgi bo'lishi va oddiy parol bo'lmasligi kerak. Parolni almashtirish: `python manage.py create_admin`.
2. **Telegram'ga ulash.** Admin raqamingizni **kod botiga** ulang: botda `/start` → «Raqamni ulashish». Busiz admin panelga kirib bo'lmaydi.
3. **Ikki bosqichli kirish.** `/admin/login` → telefon + parol → Telegram'ga kelgan 4 xonali kod. Har kirishda Telegram'ga IP manzili bilan xabar keladi.
4. **Qo'shimcha: IP cheklovi.** `.env` da `ADMIN_ALLOWED_IPS=1.2.3.4` yozsangiz, admin panel faqat shu IP'dan ochiladi.

Parol yoki kod xato kiritilsa bloklanadi: 5 marta xato parol → 15 daqiqa, soatiga 10 ta xato kod → 1 soat. Oddiy «kod bilan kirish» sahifasi orqali admin hisobiga kirib bo'lmaydi.

### Himoya choralari
- **Kirish:** Telegram kodi kriptografik tasodifiy, 3 daqiqa amal qiladi, raqam va IP bo'yicha urinishlar cheklangan.
- **Parollar:** Argon2 bilan saqlanadi.
- **Sessiyalar:** access token 30 daqiqa, refresh token aylanadi. Chiqish, bloklash va hisobni o'chirishda barcha sessiyalar bekor qilinadi.
- **Ruxsatlar:** har bir obyekt serverda egasi bo'yicha tekshiriladi. Boshqa odamning avtomobili, broni, SOS'i, chati, buyurtmasi, to'lovi yoki bildirishnomasini ID almashtirib ochib bo'lmaydi — buni avtomatik testlar tekshiradi.
- **Holatlar:** bron va buyurtma holatlari faqat to'g'ri ketma-ketlikda o'zgaradi (bosqichni sakrab o'tib bo'lmaydi).
- **Chat:** begona foydalanuvchiga yozib bo'lmaydi — faqat usta/evakuatorga yoki o'zaro buyurtma bo'lsa.
- **Maxfiy ma'lumotlar:**
  - ro'yxatdan o'tmaganlarga telefon raqamlar ko'rsatilmaydi;
  - mijozlarning joylashuvi hech kimga berilmaydi, ustalar joylashuvi ~100 m aniqlikda ko'rsatiladi;
  - SOS'da mijoz raqami faqat qabul qilgan evakuatorga ochiladi.
- **Fayllar:**
  - har bir rasm qayta kodlanadi, EXIF (jumladan GPS) o'chiriladi, 10 MB va 40 MP chegarasi bor, nomi tasodifiy;
  - chat rasmlari va to'lov cheklari faqat vaqtinchalik imzoli havola orqali ochiladi.
- **Sarlavhalar:** Content-Security-Policy, HSTS, X-Frame-Options, nosniff, Permissions-Policy. API javoblari keshlanmaydi. CORS faqat o'z domeningizga ruxsat beradi.
- **Kiritiladigan ma'lumotlar:** barcha matn uzunligi cheklangan, noto'g'ri sonlar xatoga olib kelmaydi. SQL faqat ORM orqali yoziladi. Xato bo'lganda texnik tafsilot foydalanuvchiga ko'rsatilmaydi.
- **Kutubxonalar:** `pip-audit` va `npm audit` — ma'lum zaifliklar yo'q.
- **Loglar:** xavfsizlik hodisalari (admin kirishi, xato urinishlar) `backend/logs/avtora.log` ga yoziladi.

**Frontend'ni kompyuterda build qilish uchun Node.js 20.19+ yoki 22+ kerak.** Faqat `start.bat` ishlatsangiz Node kerak emas.

## Testlar

```bash
cd backend && python manage.py test
```

Testlar asosiy jarayonlarni tekshiradi:
- ro'yxatdan o'tish va kirish, brute-force blok, logout, bloklangan foydalanuvchi;
- bron qoidalari va usta ish vaqti;
- Premium to'lov, chekning yopiqligi va do'kon ochilishi;
- SOS va baholash;
- yoqilg'i belgilari va obuna xabarlari;
- admin huquqlari va chat maxfiyligi.

---

## Foydali buyruqlar (`backend` papkasida, venv yoqilgan holda)

| Buyruq | Nima qiladi |
|---|---|
| `python manage.py start` | Hammasini ishga tushirish |
| `python manage.py create_admin` | Yangi admin / parolni almashtirish |
| `python manage.py start --port 9000` | Boshqa portda |
| `python manage.py import_fuel_stations` | Shoxobchalarni OpenStreetMap'dan qayta yuklash |
| `python manage.py backup` | Bazaning zaxira nusxasi (`backend/backups/`, kompyuterda har kuni avtomatik ham olinadi) |
| `python manage.py test` | Avtomatik testlar |

Zaxira nusxa: `backend/db.sqlite3` (baza) va `backend/media/` (rasmlar, cheklar) — shu ikkisini saqlab boring.

---

## Dizaynni o'zgartirsangiz (dasturchilar uchun)

Tayyor sayt `backend/frontend_build` da turibdi, shuning uchun Node.js shart emas. Frontend kodini (`frontend/src`) o'zgartirsangiz:

```bash
cd frontend
npm install
npm run build      # natija avtomatik backend/frontend_build ga tushadi
```

Ishlab chiqish rejimi: `npm run dev` (http://localhost:5173, API ni 8000-portdan oladi).

## Xavfsizlik

`backend/.env` faylida bot tokenlari va maxfiy kalit bor — uni hech kimga bermang, GitHub'ga yuklamang (`.gitignore` da bor). Token tarqalib ketsa: @BotFather → `/revoke` → yangi tokenni `.env` ga yozing.
