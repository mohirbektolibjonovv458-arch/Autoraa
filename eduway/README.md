# EduWay AI

O‘quvchilar uchun ta’lim platformasi. EduWay (kasb, universitet, grantlar) va BilimAI (o‘zbek tilidagi AI ustoz) bitta ilovada.

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS. Avval telefon uchun qilingan, planshet va kompyuterda ham ishlaydi. Yorug‘ va qorong‘i rejim bor.
- **Backend:** Python, Django, Django REST Framework, JWT autentifikatsiya.
- **Baza:** PostgreSQL. `POSTGRES_*` berilmasa, lokal sinov uchun SQLite ishlatiladi.
- **AI:** Anthropic Claude API. Standart model `claude-opus-5-5`, `AI_MODEL` orqali o‘zgartiriladi. Kalit faqat backend muhitida turadi.

> Bu papka repozitoriydagi Avtora loyihasidan alohida. Avtora kodiga tegilmagan.

---

## Funksiyalar holati

✅ ishlaydi · ⚙️ sozlash talab qiladi · ⛔ hali amalga oshirilmagan

| Modul | Holat | Izoh |
|---|---|---|
| Kirish / ro‘yxatdan o‘tish: telefon raqam + Telegram bot kodi | ⚙️ | `TELEGRAM_BOT_TOKEN` kerak. Raqam → bot (Start + «Raqamni ulashish») → 4 xonali kod → kirish; yangi raqam bo‘lsa akkaunt avtomatik ochiladi. Botga o‘tib qaytganda holat saqlanadi. Kod 5 daqiqa amal qiladi, 5 ta urinish, xeshlangan holda saqlanadi |
| Darajalar (11 ta: «Yangi boshlovchi» → «Afsona»), daraja oshganda bildirishnoma | ✅ | XP asosida, Bosh sahifa va Profilda |
| Telegram bildirishnomalar va bot buyruqlari (/stats, /challenge, /word, /notify, /help) | ⚙️ | `TELEGRAM_BOT_TOKEN` kerak; Sozlamalarda o‘chirish mumkin |
| Haftalik hisobot (yakshanba 18:00 + Natijalar sahifasida) | ✅ | Joriy va o‘tgan hafta solishtiriladi |
| Kun so‘zi (talaffuz + lug‘atga qo‘shish) | ✅ | 56 ta akademik so‘z, har kuni almashadi |
| Administrator kirishi (`/admin-login`) | ✅ | Email + parol (`python manage.py create_admin`) |
| Chiqish, akkauntni o‘chirish | ✅ | JWT (access + refresh, rotatsiya, blacklist). Kirish so‘rovlari cheklangan (10/daqiqa) |
| Animatsiyali boshlang‘ich ekran, tanishtiruv, onboarding | ✅ | |
| Shaxsiy profil (bosqich, sinf, qiziqishlar, fanlar, maqsadlar, til darajasi, IELTS) | ✅ | |
| Bosh sahifa | ✅ | Bugungi reja, streak, haftalik faollik, maqsadlar, ingliz tili, muddatlar, tavsiyalar. Hammasi real ma’lumotdan |
| Kasb tanlash testi (RIASEC) va natija | ✅ | 18 tasdiq, 3 vaziyat, maqsadlar. Har bir tavsiya sababi bilan, «yo‘l-yo‘riq» sifatida ko‘rsatiladi |
| Kasblar katalogi (20 ta kasb) | ✅ | Vazifalar, ko‘nikmalar, fanlar, ta’lim yo‘nalishlari, rivojlanish yo‘li |
| Universitetlar katalogi: qidiruv, filtr, sevimlilar, solishtirish | ✅ | 18 ta OTM. Barchasi **«Tekshirilmagan»** belgisi bilan (pastga qarang) |
| Grantlar: moslik tekshiruvi, saqlash, holat, hujjatlar checklisti | ✅ | 9 ta grant. Rasmiy havolalar bor; aniq muddatlar admin tasdiqlaguncha bo‘sh |
| Grant muddati eslatmalari | ⚙️ | `python manage.py send_reminders` kuniga bir marta cron orqali ishga tushirilishi kerak |
| Testlar: vaqt cheklovi, tekshirish, izohlar, zaif mavzular, tavsiyalar | ✅ | Vaqt server tomonida hisoblanadi |
| Xatolar asosida takrorlash | ✅ | |
| Ingliz tili: darslar (A1–B2), Grammar/Vocabulary/Reading/Listening/Writing/Speaking/IELTS | ✅ | Listening matnini brauzer ovozi o‘qiydi |
| Lug‘at va intervalli takrorlash (SM-2 asosida) | ✅ | |
| O‘quv reja: maqsadlar, shablon asosidagi 7 kunlik reja, vazifalar, hafta ko‘rinishi | ✅ | |
| Natijalar: grafiklar, fanlar, mavzular tahlili, yutuqlar (badge), XP, streak | ✅ | |
| Bildirishnomalar (ilova ichida) | ✅ | Push yoki email yo‘q |
| **BilimAI:** AI Tutor, English Coach, Career Advisor, Study Planner | ⚙️ | `ANTHROPIC_API_KEY` kerak. Kalitsiz «AI ulanmagan» deb aniq ko‘rsatiladi |
| AI IELTS Writing tahlili (taxminiy band, xatolar, yaxshilangan variant) | ⚙️ | Premium + API kaliti. Natija «taxminiy, rasmiy emas» deb belgilanadi |
| AI shaxsiy reja (7 kun), AI test generatori, AI kasb tahlili | ⚙️ | API kaliti kerak (reja va testlar Premium) |
| Ovozli AI (Speaking) | ⚙️ | Premium + API kaliti. Nutq brauzerning Web Speech API’si orqali tanib olinadi (Chrome/Edge). Serverga faqat matn boradi, audio saqlanmaydi |
| AI limitlari va rate limiting | ✅ | Kunlik: bepul 15, Premium 200 (sozlanadi). Bundan tashqari daqiqasiga 12 ta so‘rov |
| AI javoblarini baholash va admin moderatsiyasi | ✅ | |
| Bepul / Premium tariflar, backendda tekshirish | ✅ | Barcha premium cheklovlar server tomonida |
| Premium to‘lovi | ⚙️ | Onlayn to‘lov ulanmagan. `PREMIUM_PAYMENT_INSTRUCTIONS` berilsa: foydalanuvchi so‘rov yuboradi, admin to‘lovni tekshirib qo‘lda tasdiqlaydi. Aks holda Premium’ni faqat admin beradi |
| Payme / Click / karta orqali avtomatik to‘lov | ⛔ | Merchant shartnomasi va kalitlari kerak |
| Admin panel (`/admin`) | ✅ | Foydalanuvchilar, Premium so‘rovlar, universitetlar va yo‘nalishlar, grantlar, kasblar, testlar va savollar, darslar, AI moderatsiyasi, xatolar jurnali, xizmat holati |
| Django admin (`/django-admin/`) | ✅ | Zaxira boshqaruv paneli |
| Parolni email orqali tiklash | ⛔ | SMTP sozlamasi kerak. Hozircha server administratori `python manage.py changepassword <email>` bilan parolni almashtira oladi |
| Telefonga ilova sifatida o'rnatish (PWA) | ✅ | Android/Chrome/Edge'da «Yuklab olish» tugmasi bir bosishda o'rnatadi; iPhone'da Safari orqali qadamma-qadam qo'llanma chiqadi. Ikonka, ishga tushish ekrani, offline sahifa |
| Push-bildirishnomalar (ilova yopiq bo'lsa ham) | ✅ | Barcha ilova ichidagi bildirishnomalar telefonga ham boradi. VAPID kalitlari avtomatik yaratilib bazada saqlanadi — sozlash shart emas. iPhone'da faqat Bosh ekranga o'rnatilgan ilovada ishlaydi (iOS 16.4+) |
| Kunlik eslatmalar | ✅ | Server o'zi 09:00 da grant muddatlari, 19:00 da seriya/challenge eslatmasini yuboradi (cron shart emas). Foydalanuvchi sozlamalarda o'chira oladi |
| Kunlik challenge | ✅ | Har kuni har bir foydalanuvchiga 5 ta savol, bonus XP, xatolar takrorlash ro'yxatiga tushadi |
| Fokus taymer (Pomodoro) | ✅ | Vaqt server tomonida hisoblanadi, kunlik maqsad, vazifaga bog'lash |
| Ingliz tili darajasini aniqlash testi | ✅ | 25 savol (A1–C1), natija profilga yoziladi |
| Global qidiruv (Ctrl+K) | ✅ | Kasblar, universitetlar, grantlar, darslar, testlar |
| App Store / Google Play'dagi native ilova | ⛔ | PWA bilan o'rnatish yetarli; do'konlarga chiqarish uchun alohida qadoqlash kerak |

### Ma’lumotlar ishonchliligi

Universitet va grantlar katalogida faqat nomi, shahri, rasmiy sayti va umumiy tavsifi to‘ldirilgan. **Kontrakt narxlari, aniq muddatlar va minimal ballar ataylab bo‘sh qoldirilgan.** Ular har yili o‘zgaradi, tekshirilmagan raqamni haqiqat sifatida ko‘rsatib bo‘lmaydi. Barcha yozuvlar `verified=False` holatida va interfeysda «Tekshirilmagan» ogohlantirishi bilan chiqadi. Administrator ma’lumotni rasmiy manbadan tekshirib, narx va muddatlarni kiritadi, keyin «Tasdiqlangan» deb belgilaydi. Tasdiqlash uchun manba havolasi majburiy. AI ham katalogdagi ma’lumot va uning holati bilan ishlaydi, muddat yoki narxni o‘zidan to‘qimaydi.

---

## Lokal ishga tushirish

Kerak bo‘ladi: Python 3.11+, Node.js 20+.

```bash
cd eduway
./start.sh                       # venv, kutubxonalar, frontend build, migratsiya, boshlang'ich kontent, server
# boshqa terminalda (bir marta):
cd eduway/backend && ../.venv/bin/python manage.py create_admin
```

Sayt: http://127.0.0.1:8000 · Admin panel: http://127.0.0.1:8000/admin (admin akkaunti bilan kiring).

Frontend’ni alohida ishlab chiqish (hot reload):

```bash
cd eduway/frontend && npm install && npm run dev     # http://localhost:5173, /api -> 127.0.0.1:8000
```

## AI’ni ulash

1. https://console.anthropic.com saytida API kalit yarating.
2. `eduway/backend/.env` fayliga yozing:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   AI_MODEL=claude-opus-5-5
   ```
3. Serverni qayta ishga tushiring va ulanishni tekshiring:
   ```bash
   python manage.py check_ai
   ```
   Bu buyruq haqiqiy so‘rov yuboradi va javobni ko‘rsatadi. Admin panelning «Umumiy holat» sahifasida AI holati, haftalik so‘rovlar, tokenlar va xatolar ko‘rinadi.

Kalit brauzerga yuborilmaydi va repozitoriyga yozilmaydi (`.env` fayli `.gitignore`da). AI xatolari (noto‘g‘ri kalit, limit, timeout, tarmoq) foydalanuvchiga tushunarli xabar sifatida ko‘rsatiladi va `ErrorLog`ga yoziladi. Muvaffaqiyatsiz so‘rov kunlik limitdan yechilmaydi.

## Railway'ga joylash

1. Ushbu papka ichidagilarni (README, `Dockerfile`, `railway.json`, `backend/`, `frontend/` ...) yangi GitHub repozitoriy **ildiziga** yuklang.
2. Railway → **New Project → Deploy from GitHub repo** → repozitoriyni tanlang. `railway.json` va `Dockerfile` avtomatik ishlatiladi.
3. Shu loyihaga **+ New → Database → PostgreSQL** qo'shing.
4. Ilova servisi → **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (Postgres servisiga havola)
   - `DEBUG` = `0`
   - `ANTHROPIC_API_KEY` = kalitingiz (AI uchun)
   - `TELEGRAM_BOT_TOKEN` = @BotFather bergan bot tokeni (telefon orqali kirish uchun). Railway'da bot **webhook** rejimida ishlaydi — domen avtomatik aniqlanadi
   - ixtiyoriy: `AI_MODEL`, `AI_DAILY_LIMIT_FREE`, `AI_DAILY_LIMIT_PREMIUM`, `PREMIUM_PRICE_UZS`, `PREMIUM_PAYMENT_INSTRUCTIONS`
   - `SECRET_KEY` = kamida 50 belgili tasodifiy satr (berilmasa, har deployda yangisi yaratiladi va foydalanuvchilar qayta kirishi kerak bo'ladi)
5. **Settings → Networking → Generate Domain.** Domen `ALLOWED_HOSTS`ga avtomatik qo'shiladi (`RAILWAY_PUBLIC_DOMAIN`), HTTPS sozlamalari ham avtomatik yoqiladi.
6. Admin yaratish: servis → **⋯ → Shell** (yoki `railway ssh`) orqali:
   ```bash
   python manage.py create_admin
   python manage.py check_ai        # AI kaliti ishlayotganini tekshirish
   ```

Har deployda migratsiyalar va boshlang'ich kontent avtomatik qo'llanadi. Kontent takroran yuklanmaydi va admin kiritgan o'zgarishlarni bosib ketmaydi.

## Serverga joylash (Docker + PostgreSQL)

```bash
cd eduway
cp backend/.env.example backend/.env       # DEBUG=0, ALLOWED_HOSTS=sizning-domen.uz, ANTHROPIC_API_KEY ...
export POSTGRES_PASSWORD='kuchli-parol'
docker compose up -d --build
docker compose exec app python manage.py create_admin
```

Ishlab chiqarish uchun `.env` sozlamalari:

| O‘zgaruvchi | Ma’nosi |
|---|---|
| `DEBUG=0` | Majburiy |
| `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` | Domeningiz (`https://` bilan CSRF uchun) |
| `HTTPS=1` | Agar HTTPS proksi (Caddy/nginx) orqasida bo‘lsa: HSTS, secure cookie, redirect |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | AI |
| `AI_DAILY_LIMIT_FREE`, `AI_DAILY_LIMIT_PREMIUM` | Kunlik AI limitlari |
| `PREMIUM_PRICE_UZS`, `PREMIUM_PAYMENT_INSTRUCTIONS` | Premium narxi va to‘lov ko‘rsatmasi (masalan, karta raqami va egasi) |

Konteyner HTTP’ni 8000-portda beradi. HTTPS uchun oldiga Caddy yoki nginx qo‘ying. Grant eslatmalari uchun cron: `docker compose exec app python manage.py send_reminders`.

## Testlar

```bash
cd eduway/backend && python manage.py test core       # 20 ta API testi (SQLite yoki POSTGRES_* bilan)
# brauzer sinovlari (server 8000-portda ishlab turganda; Playwright kerak):
python e2e/smoke.py              # telefon ekrani: ro'yxatdan o'tishdan admin panelgacha to'liq oqim
python e2e/smoke.py --desktop    # kompyuter ekrani
python e2e/ai_flow.py            # AI oqimi: backend ANTHROPIC_BASE_URL=http://127.0.0.1:8765 bilan, e2e/fake_anthropic.py ishlab turgan bo'lishi kerak
```

## Arxitektura

```
eduway/
  backend/
    accounts/   foydalanuvchi modeli (email bilan kirish), profil, JWT
    career/     RIASEC testi, kasblar, natijalar
    catalog/    universitetlar, yo'nalishlar, grantlar, moslik tekshiruvi, checklist
    learning/   testlar, xatolar, darslar, lug'at (SM-2), maqsadlar, vazifalar, statistika
    ai/         Claude integratsiyasi (service.py), promptlar, suhbatlar, limitlar, Writing/plan/test generatori
    billing/    tariflar, Premium so'rovlari (qo'lda tasdiqlash)
    core/       dashboard, bildirishnomalar, XP/streak/yutuqlar, admin API, xatolar jurnali, boshlang'ich kontent
  frontend/src/
    pages/      barcha sahifalar (admin/ — admin panel)
    components/ dizayn tizimi (ui.tsx), navigatsiya, toast, logo
    lib/        API mijozi (token yangilash), auth, markdown, ovoz, format
```

Xavfsizlik: barcha API’lar standart holatda autentifikatsiya talab qiladi. Admin endpoint’lari `IsAdmin` (is_staff) bilan himoyalangan. Admin rolini faqat superuser bera oladi, admin o‘zini bloklay olmaydi. Foydalanuvchi faqat o‘z ma’lumotlarini ko‘radi (barcha so‘rovlar `user=request.user` bilan filtrlanadi). Kiritilgan ma’lumotlar validatsiya qilinadi, markdown renderer HTML ishlatmaydi (XSS yo‘q), havolalar faqat `http(s)` yoki ilova ichidagi yo‘l bo‘lishi mumkin. Kutilmagan xatolar foydalanuvchiga tafsilotsiz qaytadi va jurnalga yoziladi.
