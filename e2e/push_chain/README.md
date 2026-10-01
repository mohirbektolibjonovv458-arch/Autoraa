# Push zanjiri sinovi (Web Push, oxiridan oxirigacha)

Haqiqiy zanjir: **voqea (chat/bron/SOS) → backend → navbat (outbox) → Web Push shifrlash (VAPID, aes128gcm) → push provayder → service worker → telefon bildirishnomasi.**

Faqat Google FCM serveri soxta qabul qiluvchi bilan almashtiriladi (`serve.py`): u shifrlangan paketni ushlaydi,
sinov uni telefon kaliti bilan ochadi va Chromium'ning push kanali (DevTools `ServiceWorker.deliverPushMessage`)
orqali service worker'ga yetkazadi. Keyin ekrandagi bildirishnomalar (`registration.getNotifications()`) tekshiriladi.

Tekshiriladi: mijoz→usta va usta→mijoz chat, bron, SOS (+ takroriy ogohlantirish), ilova yopiq / boshqa sahifada,
ketma-ket xabarlar, chat ochiq bo'lsa push yo'qligi, qulf ekranida maxfiy matn yo'qligi, logout/login.

```bash
pip install playwright http_ece   # Chromium kerak (CHROMIUM_PATH bilan ko'rsatish mumkin)
cd frontend && npm run build && cd ..
PYTHON=backend/venv/bin/python ./e2e/push_chain/run.sh
```

Telefonning o'zi (Android Doze, batareya tejash, qulf ekrani) bu yerda sinalmaydi — buni haqiqiy telefonda
Profil → «Sinov xabarini yuborish» va «Diagnostika» bilan tekshiring.
