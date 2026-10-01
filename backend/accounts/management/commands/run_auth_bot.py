"""Ro'yxatdan o'tish / kirish kodlari boti.
Ishga tushirish: python manage.py run_auth_bot
Foydalanuvchi /start bosadi -> «Raqamni ulashish» -> raqam va chat_id bog'lanadi.
Keyin saytda «Kod olish» bosilganda 4 xonali kod shu chatga keladi."""
import time
from html import escape

from django.conf import settings
from django.db import close_old_connections

from accounts.utils import BOT_STATUS
from django.core.management.base import BaseCommand

from accounts.models import TelegramLink, User
from accounts.utils import normalize_phone, tg_call

FUEL_KB = {
    "keyboard": [[{"text": "⛽ Yaqin metan"}, {"text": "🟢 Yaqin propan"}],
                 [{"text": "⛽ Yaqin benzin"}, {"text": "⚡ Elektr quvvatlash"}]],
    "resize_keyboard": True,
}
LOC_KB = {
    "keyboard": [[{"text": "📍 Joylashuvimni yuborish", "request_location": True}], [{"text": "⬅️ Orqaga"}]],
    "resize_keyboard": True,
}
FUEL_WORDS = {"metan": "metan", "propan": "propan", "benzin": "benzin", "dizel": "dizel", "elektr": "elektr", "zaryad": "elektr"}
STATUS_ICON = {"bor": "🟢", "navbat_kichik": "🟡", "navbat_katta": "🟠", "yoq": "🔴", "yopiq": "⚫", "unknown": "⚪"}

CONTACT_KB = {
    "keyboard": [[{"text": "📱 Raqamni ulashish", "request_contact": True}]],
    "resize_keyboard": True,
    "one_time_keyboard": True,
}


class Command(BaseCommand):
    help = "Avtora kod boti (long polling)"

    def reply(self, chat_id, text, markup=None):
        data = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
        if markup:
            data["reply_markup"] = markup
        tg_call(settings.AUTH_BOT_TOKEN, "sendMessage", data)

    _fuel_choice = {}

    def fuel_nearby(self, chat_id, lat, lng, fuel):
        from fuel.models import FuelStation
        from fuel.services import build_status
        from accounts.utils import haversine_km
        qs = FuelStation.objects.filter(is_active=True, lat__range=(lat - 0.2, lat + 0.2), lng__range=(lng - 0.26, lng + 0.26))
        items = sorted([s for s in qs if fuel in (s.fuels or [])], key=lambda s: haversine_km(lat, lng, s.lat, s.lng))[:40]
        if not items:
            self.reply(chat_id, "Yaqin atrofda (≈20 km) bunday shoxobcha topilmadi.", FUEL_KB)
            return
        st = build_status(items)
        # avval «bor» deb belgilanganlar, keyin qolganlari — masofa bo'yicha
        items.sort(key=lambda s: (not st.get(s.id, {}).get(fuel, {}).get("available"), haversine_km(lat, lng, s.lat, s.lng)))
        lines = [f"⛽ <b>Yaqin {fuel} shoxobchalari</b>\n"]
        for s in items[:7]:
            x = st.get(s.id, {}).get(fuel, {})
            code = x.get("status", "unknown")
            info = x.get("label", "Ma'lumot yo'q")
            if code != "unknown" and x.get("minutes_ago") is not None:
                info += f" · {x['minutes_ago']} daq. oldin"
            if x.get("price"):
                info += f" · {x['price']:,} so'm".replace(",", " ")
            lines.append(f"{STATUS_ICON.get(code, '⚪')} <b>{escape(s.name)}</b> — {haversine_km(lat, lng, s.lat, s.lng):.1f} km\n    {info}\n    <a href=\"https://maps.google.com/?q={s.lat},{s.lng}\">Yo'l ko'rsatish</a>")
        site = settings.SITE_URL.rstrip("/") if settings.SITE_URL else ""
        lines.append("\n🟢 bor · 🟡 navbat kichik · 🟠 navbat katta · 🔴 yo'q · ⚪ ma'lumot yo'q")
        if site:
            lines.append(f"Holatni belgilash va xarita: {site}/app/fuel")
        tg_call(settings.AUTH_BOT_TOKEN, "sendMessage", {"chat_id": chat_id, "text": "\n".join(lines), "parse_mode": "HTML",
                                                        "disable_web_page_preview": True, "reply_markup": FUEL_KB})

    def handle_message(self, msg):
        chat_id = msg["chat"]["id"]
        if msg["chat"].get("type") != "private":
            return
        text = (msg.get("text") or "").lower()
        if text.startswith("⬅️"):
            self.reply(chat_id, "Qaysi yoqilg'i kerak?", FUEL_KB)
            return
        if msg.get("location"):
            loc = msg["location"]
            self.fuel_nearby(chat_id, loc["latitude"], loc["longitude"], self._fuel_choice.get(chat_id, "metan"))
            return
        for word, fuel in FUEL_WORDS.items():
            if word in text and (text.startswith("/") or text.startswith("⛽") or text.startswith("🟢") or text.startswith("⚡")):
                self._fuel_choice[chat_id] = fuel
                self.reply(chat_id, f"📍 Joylashuvingizni yuboring — eng yaqin <b>{fuel}</b> shoxobchalari va hozirgi holatini ko'rsataman.\n(Pastdagi «📍 Joylashuvimni yuborish» tugmasi)", LOC_KB)
                return
        contact = msg.get("contact")
        if contact:
            if contact.get("user_id") != msg["from"]["id"]:
                self.reply(chat_id, "Iltimos, boshqa odamning emas, o'zingizning raqamingizni yuboring.", CONTACT_KB)
                return
            phone = normalize_phone(contact.get("phone_number"))
            if not phone:
                self.reply(chat_id, "Faqat O'zbekiston (+998) raqamlari qabul qilinadi.")
                return
            TelegramLink.objects.filter(chat_id=chat_id).exclude(phone=phone).delete()
            TelegramLink.objects.update_or_create(phone=phone, defaults={
                "chat_id": chat_id,
                "username": msg["from"].get("username") or "",
                "first_name": msg["from"].get("first_name") or "",
            })
            User.objects.filter(phone=phone).update(telegram_chat_id=chat_id)
            self.reply(chat_id, f"✅ Raqamingiz ulandi: <b>{phone}</b>\n\nEndi saytga qayting va «Kod olish» tugmasini bosing. 4 xonali kod shu yerga keladi.\n\n⛽ Bonus: pastdagi tugmalar orqali yaqin metan/propan/benzin qayerda borligini bilib oling.",
                       FUEL_KB)
            return

        link = TelegramLink.objects.filter(chat_id=chat_id).first()
        if link:
            self.reply(chat_id, f"Raqamingiz ulangan: <b>{link.phone}</b>\nSaytda «Kod olish» tugmasini bosing — kod shu yerga keladi.\n\n⛽ Yaqin shoxobchalar holati — pastdagi tugmalar yoki /metan, /propan, /benzin", FUEL_KB)
        else:
            self.reply(chat_id, "👋 <b>Avtora</b> botiga xush kelibsiz!\n\nRo'yxatdan o'tish va kirish kodlarini olish uchun pastdagi tugma orqali telefon raqamingizni ulashing.\n\n⛽ Yaqin metan/propan/benzin qayerda borligini bilish uchun: /metan, /propan, /benzin", CONTACT_KB)

    def handle(self, *args, **opts):
        if not settings.AUTH_BOT_TOKEN:
            self.stderr.write("AUTH_BOT_TOKEN .env faylida ko'rsatilmagan.")
            return
        tg_call(settings.AUTH_BOT_TOKEN, "deleteWebhook", {})
        self.stdout.write(self.style.SUCCESS("Kod boti ishga tushdi..."))
        offset = None
        fails = 0
        while True:
            data = {"timeout": 30, "allowed_updates": ["message"]}
            if offset:
                data["offset"] = offset
            res = tg_call(settings.AUTH_BOT_TOKEN, "getUpdates", data, timeout=40)
            if not res or not res.get("ok"):
                fails += 1
                BOT_STATUS["auth"] = "conflict" if res and res.get("error_code") == 409 else "error"
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
            BOT_STATUS["auth"] = "ok"
            if res["result"]:
                close_old_connections()  # PostgreSQL uzoq kutilgan ulanishni yopgan bo'lishi mumkin — yangisini olamiz
            for upd in res["result"]:
                offset = upd["update_id"] + 1
                try:
                    if "message" in upd:
                        self.handle_message(upd["message"])
                except Exception as exc:
                    self.stderr.write(f"Xato: {exc}")
