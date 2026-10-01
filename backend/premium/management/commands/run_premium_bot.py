"""Premium to'lov boti.
Ishga tushirish: python manage.py run_premium_bot

Adminlar uchun: har bir yangi to'lov (sayt yoki bot orqali) chek rasmi bilan keladi.
«✅ Pul tushdi — tasdiqlash» bosilsa — usta Premium oladi va zapchast do'koni ochiladi.

Ustalar uchun: /start -> raqam ulash -> karta raqami ko'rsatiladi -> pul o'tkazib,
chek rasmini botga yuboradi («Pul soldim»). To'lov admin tasdig'iga ketadi.
Admin bo'lish: saytdagi ADMIN akkauntingiz raqami bilan botda «Raqamni ulashish» bosing — shu bilan
to'lovlar sizga kela boshlaydi. Hech narsa sozlash shart emas."""
import time

import requests
from django.conf import settings
from django.db import close_old_connections

from accounts.utils import BOT_STATUS
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from accounts.models import User
from accounts.utils import normalize_phone, tg_call
from core.models import SiteSettings
from premium.models import PremiumBotChat, PremiumPayment
from premium.services import admin_chat_ids, approve_payment, fmt_card, fmt_money, notify_admins_new_payment, reject_payment

CONTACT_KB = {"keyboard": [[{"text": "📱 Raqamni ulashish", "request_contact": True}]], "resize_keyboard": True, "one_time_keyboard": True}
MAIN_KB = {"keyboard": [[{"text": "💳 Premium sotib olish"}], [{"text": "✅ Pul soldim"}, {"text": "📊 Holatim"}]], "resize_keyboard": True}


class Command(BaseCommand):
    help = "Avtora Premium boti (long polling)"

    @property
    def token(self):
        return settings.PREMIUM_BOT_TOKEN

    def send(self, chat_id, text, markup=None):
        data = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
        if markup:
            data["reply_markup"] = markup
        tg_call(self.token, "sendMessage", data)

    def is_admin(self, tg_id):
        return tg_id in admin_chat_ids()

    # ---------- admin tugmalari ----------
    def handle_callback(self, cq):
        tg_id = cq["from"]["id"]
        data = cq.get("data", "")
        if not self.is_admin(tg_id):
            tg_call(self.token, "answerCallbackQuery", {"callback_query_id": cq["id"], "text": "Siz admin emassiz", "show_alert": True})
            return
        try:
            _, action, pid = data.split(":")
            p = PremiumPayment.objects.select_related("user").get(pk=int(pid))
        except Exception:
            tg_call(self.token, "answerCallbackQuery", {"callback_query_id": cq["id"], "text": "To'lov topilmadi"})
            return
        who = cq["from"].get("username") or cq["from"].get("first_name") or str(tg_id)
        if action == "approve":
            ok = approve_payment(p, by=f"tg:{who}")
            p.refresh_from_db()
            result = "✅ TASDIQLANDI — do'kon ochildi" if ok else f"Allaqachon ko'rib chiqilgan: {p.get_status_display()}"
        else:
            ok = reject_payment(p, by=f"tg:{who}")
            p.refresh_from_db()
            result = "❌ RAD ETILDI" if ok else f"Allaqachon ko'rib chiqilgan: {p.get_status_display()}"
        tg_call(self.token, "answerCallbackQuery", {"callback_query_id": cq["id"], "text": result})
        msg = cq.get("message") or {}
        suffix = f"\n\n<b>{result}</b> (@{who})"
        base = {"chat_id": msg.get("chat", {}).get("id"), "message_id": msg.get("message_id"), "parse_mode": "HTML"}
        if msg.get("photo"):
            tg_call(self.token, "editMessageCaption", {**base, "caption": (msg.get("caption") or "") + suffix})
        elif msg.get("text"):
            tg_call(self.token, "editMessageText", {**base, "text": msg["text"] + suffix})

    def send_payment_to(self, chat_id, p):
        from premium.services import payment_caption, payment_keyboard
        data = {"chat_id": chat_id, "parse_mode": "HTML", "reply_markup": payment_keyboard(p.id)}
        if p.receipt:
            data["caption"] = payment_caption(p)
            with p.receipt.open("rb") as f:
                tg_call(self.token, "sendPhoto", data, files={"photo": f})
        else:
            data["text"] = payment_caption(p)
            tg_call(self.token, "sendMessage", data)

    # ---------- foydalanuvchi xabarlari ----------
    def linked_user(self, chat_id):
        link = PremiumBotChat.objects.filter(chat_id=chat_id).first()
        return User.objects.filter(phone=link.phone).first() if link else None

    def download_photo(self, file_id):
        res = tg_call(self.token, "getFile", {"file_id": file_id})
        if not res or not res.get("ok"):
            return None
        path = res["result"]["file_path"]
        r = requests.get(f"{settings.TELEGRAM_API_BASE}/file/bot{self.token}/{path}", timeout=30)
        return ContentFile(r.content, name=f"tg_{file_id[-10:]}.jpg") if r.ok else None

    def handle_message(self, msg):
        chat_id = msg["chat"]["id"]
        if msg["chat"].get("type") != "private":
            return
        text = (msg.get("text") or "").strip()
        s = SiteSettings.load()

        if text == "/id":
            self.send(chat_id, f"Sizning chat ID: <code>{chat_id}</code>")
            return
        if self.is_admin(chat_id) and text == "/start":
            pending = PremiumPayment.objects.filter(status="pending").count()
            self.send(chat_id, f"👮 Siz admin sifatida ulangansiz.\nKutilayotgan to'lovlar: <b>{pending}</b>\n/pending — ro'yxat")
            return
        if self.is_admin(chat_id) and text == "/pending":
            items = PremiumPayment.objects.filter(status="pending").select_related("user")[:10]
            if not items:
                self.send(chat_id, "Kutilayotgan to'lov yo'q.")
            for p in items:
                self.send_payment_to(chat_id, p)
            return

        contact = msg.get("contact")
        if contact:
            if contact.get("user_id") != msg["from"]["id"]:
                self.send(chat_id, "O'zingizning raqamingizni yuboring.", CONTACT_KB)
                return
            phone = normalize_phone(contact.get("phone_number"))
            user = User.objects.filter(phone=phone).first() if phone else None
            if not user:
                self.send(chat_id, "Bu raqam Avtora'da ro'yxatdan o'tmagan. Avval saytda usta sifatida ro'yxatdan o'ting.", {"remove_keyboard": True})
                return
            is_admin = user.role == "admin" or user.is_superuser
            PremiumBotChat.objects.filter(chat_id=chat_id).exclude(phone=phone).delete()
            PremiumBotChat.objects.update_or_create(phone=phone, defaults={"chat_id": chat_id, "is_admin": is_admin})
            if is_admin:
                pending = PremiumPayment.objects.filter(status="pending").count()
                self.send(chat_id, f"👮 <b>Admin sifatida ulandingiz</b> ({user.full_name}).\n\nEndi har bir Premium to'lov cheki shu yerga «Tasdiqlash / Rad etish» tugmalari bilan keladi.\nKutilayotgan to'lovlar: <b>{pending}</b>\n/pending — ularni qayta ko'rsatish", {"remove_keyboard": True})
                return
            self.send(chat_id, f"✅ Hisob ulandi: <b>{user.full_name}</b>", MAIN_KB)
            return

        user = self.linked_user(chat_id)
        if not user:
            self.send(chat_id, "👋 <b>Avtora Premium</b>\n\nPremium bilan zapchast do'koningizni ochasiz. Boshlash uchun raqamingizni ulashing.", CONTACT_KB)
            return
        if user.role == "admin":
            self.send(chat_id, "👮 Siz adminsiz. Yangi to'lovlar shu yerga avtomatik keladi.\n/pending — kutilayotgan to'lovlar")
            return
        if user.role != "usta":
            self.send(chat_id, "Premium obuna faqat ustalar uchun.")
            return

        if msg.get("photo"):
            if PremiumPayment.objects.filter(user=user, status="pending").exists():
                self.send(chat_id, "⏳ Oldingi chekingiz tekshirilmoqda. Iltimos kuting.")
                return
            file = self.download_photo(msg["photo"][-1]["file_id"])
            p = PremiumPayment.objects.create(user=user, months=1, amount=s.premium_price, card_number=s.card_number,
                                              source="telegram", note=(msg.get("caption") or "")[:200])
            if file:
                p.receipt.save(file.name, file, save=True)
            notify_admins_new_payment(p)
            self.send(chat_id, f"📨 Chek qabul qilindi (#{p.id}).\nAdmin kartaga pul tushganini tekshiradi va tasdiqlagach do'koningiz avtomatik ochiladi.", MAIN_KB)
            return

        if text in ("/start", "💳 Premium sotib olish", "/premium"):
            self.send(chat_id,
                      f"💎 <b>Premium — {fmt_money(s.premium_price)} / oy</b>\n\n"
                      f"1️⃣ Quyidagi kartaga pul o'tkazing:\n<code>{fmt_card(s.card_number)}</code>\n{s.card_holder}\n\n"
                      "2️⃣ «✅ Pul soldim» tugmasini bosing va to'lov chekining rasmini (skrinshot) yuboring.\n\n"
                      "3️⃣ Admin pul tushganini tekshirib tasdiqlaydi — zapchast do'koningiz ochiladi.", MAIN_KB)
            return
        if text in ("✅ Pul soldim", "/paid"):
            self.send(chat_id, "📸 To'lov chekining rasmini (skrinshot) shu yerga yuboring.")
            return
        if text in ("📊 Holatim", "/status"):
            if user.is_premium:
                self.send(chat_id, f"💎 Premium faol: {user.premium_until:%d.%m.%Y} gacha.", MAIN_KB)
            else:
                last = PremiumPayment.objects.filter(user=user).first()
                st = f"Oxirgi to'lov #{last.id}: {last.get_status_display()}" if last else "To'lovlar yo'q"
                self.send(chat_id, f"Premium faol emas.\n{st}", MAIN_KB)
            return
        self.send(chat_id, "Menyudan tanlang yoki chek rasmini yuboring.", MAIN_KB)

    def handle(self, *args, **opts):
        if not self.token:
            self.stderr.write("PREMIUM_BOT_TOKEN .env faylida ko'rsatilmagan.")
            return
        tg_call(self.token, "deleteWebhook", {})
        n = len(admin_chat_ids())
        self.stdout.write(self.style.SUCCESS(f"Premium bot ishga tushdi. Ulangan adminlar: {n}" + ("" if n else " — admin raqami bilan botda «Raqamni ulashish» bosing")))
        offset = None
        fails = 0
        while True:
            data = {"timeout": 30, "allowed_updates": ["message", "callback_query"]}
            if offset:
                data["offset"] = offset
            res = tg_call(self.token, "getUpdates", data, timeout=40)
            if not res or not res.get("ok"):
                fails += 1
                BOT_STATUS["premium"] = "conflict" if res and res.get("error_code") == 409 else "error"
                if res and res.get("error_code") == 409:
                    if fails == 1:
                        self.stderr.write("Bu bot boshqa joyda ham ishlayapti (409). Faqat bitta nusxasini qoldiring.")
                elif fails == 1:
                    self.stderr.write("Telegramga ulanib bo'lmadi — qayta urinilmoqda...")
                time.sleep(min(30, 3 * fails))
                continue
            if fails:
                self.stdout.write("Telegram bilan aloqa tiklandi.")
            fails = 0
            BOT_STATUS["premium"] = "ok"
            if res["result"]:
                close_old_connections()  # PostgreSQL uzoq kutilgan ulanishni yopgan bo'lishi mumkin — yangisini olamiz
            for upd in res["result"]:
                offset = upd["update_id"] + 1
                try:
                    if "callback_query" in upd:
                        self.handle_callback(upd["callback_query"])
                    elif "message" in upd:
                        self.handle_message(upd["message"])
                except Exception as exc:
                    self.stderr.write(f"Xato: {exc}")
