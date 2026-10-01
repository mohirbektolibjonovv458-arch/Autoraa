# E2E sinov (ixtiyoriy, dasturchilar uchun)

Brauzerda haqiqiy foydalanuvchi kabi 18 ta asosiy jarayonni bosib tekshiradi:
- ro'yxatdan o'tish (usta, mijoz, evakuator), admin kirishi;
- xizmat, bron, chat, SOS, Premium (Telegram tasdig'i bilan);
- do'kon va xarid, garaj, yoqilg'i, profil, bildirishnomalar;
- chiqish va qayta kirish.

Haqiqiy Telegram o'rniga `fake_telegram.py` ishlatiladi — kodlar va xabarlar shu yerda ushlanadi.

```bash
pip install playwright && python -m playwright install chromium
cd backend && rm -f db.sqlite3                       # sinov bo'sh bazada o'tkaziladi
python ../e2e/fake_telegram.py &                      # 127.0.0.1:9900
export TELEGRAM_API_BASE=http://127.0.0.1:9900
export $(grep -E "^(AUTH_BOT_TOKEN|PREMIUM_BOT_TOKEN)=" .env | xargs)
ADMIN_PHONE=+998900000000 ADMIN_PASSWORD=secret12345 python manage.py start --port 8200 &
python ../e2e/e2e_test.py
```

Muhim: sinovni ishlab turgan (production) bazada o'tkazmang.
