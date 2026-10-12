"""Telegram bot orqali telefon raqamni tasdiqlash va 4 xonali kirish kodini yuborish.

Oqim:
 1. Ilovada raqam kiritiladi -> LoginRequest (token) yaratiladi.
 2. Raqam botga ilgari ulangan bo'lsa — kod darhol botga yuboriladi.
    Aks holda ilova botni t.me/<bot>?start=<token> havolasi bilan ochadi; foydalanuvchi «Raqamni ulashish»ni bosadi,
    Telegram raqam egasini tasdiqlaydi, bot raqamni bog'laydi va kodni yuboradi.
 3. Foydalanuvchi ilovaga qaytib kodni kiritadi -> kirish yoki yangi akkaunt.

Ishlash rejimi: domen ma'lum bo'lsa (Railway) — webhook (Telegram xabarlarni o'zi yuboradi), aks holda lokal sinov uchun long polling.
Bot tokeni faqat muhit o'zgaruvchisida: TELEGRAM_BOT_TOKEN.
"""
import hashlib
import hmac
import logging
import os
import re
import secrets
import sys
import threading
import time
from datetime import timedelta

import requests
from django.conf import settings
from django.db import close_old_connections, transaction
from django.utils import timezone

log = logging.getLogger("eduway")
API = os.getenv("TELEGRAM_API_BASE", "https://api.telegram.org").rstrip("/")

CONTACT_KB = {"keyboard": [[{"text": "📱 Raqamni ulashish", "request_contact": True}]], "resize_keyboard": True, "one_time_keyboard": True}
REMOVE_KB = {"remove_keyboard": True}
COMMANDS = [("stats", "Mening statistikam"), ("challenge", "Bugungi challenge"), ("word", "Kun so'zi"),
            ("notify", "Bildirishnomalarni yoqish/o'chirish"), ("help", "Yordam")]


def esc(s):
    return str(s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def token():
    # Railway'da qiymat ba'zan qo'shtirnoq yoki «TELEGRAM_BOT_TOKEN=» bilan qo'yilib qoladi — tozalaymiz
    t = os.getenv("TELEGRAM_BOT_TOKEN", "").strip().strip("'\"").strip()
    if t.startswith("TELEGRAM_BOT_TOKEN="):
        t = t.split("=", 1)[1].strip().strip("'\"")
    return t


def configured():
    return bool(token())


def call(method, data=None, timeout=15):
    if not configured():
        return None
    try:
        r = requests.post(f"{API}/bot{token()}/{method}", json=data or {}, timeout=timeout)
        res = r.json()
        if not res.get("ok") and method != "getUpdates":
            log.warning("Telegram %s: %s", method, res.get("description"))
        return res
    except Exception as e:  # noqa: BLE001 — tarmoq xatosi
        if method != "getUpdates":
            log.warning("Telegram %s ulanib bo'lmadi: %s", method, e.__class__.__name__)
        return None


_username = {"value": None, "failed": 0.0}


def bot_username():
    if _username["value"]:
        return _username["value"]
    if time.time() - _username["failed"] < 30:
        return os.getenv("TELEGRAM_BOT_USERNAME", "")
    res = call("getMe", timeout=8)
    name = ((res or {}).get("result") or {}).get("username") if res and res.get("ok") else None
    if name:
        _username["value"] = name
        return name
    _username["failed"] = time.time()
    return os.getenv("TELEGRAM_BOT_USERNAME", "")


def send(chat_id, text, markup=None):
    data = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if markup:
        data["reply_markup"] = markup
    res = call("sendMessage", data)
    return bool(res and res.get("ok"))


def normalize_phone(raw):
    digits = re.sub(r"\D", "", str(raw or ""))
    if len(digits) == 9:
        digits = "998" + digits
    if len(digits) != 12 or not digits.startswith("998"):
        return None
    return "+" + digits


def code_hash(phone, code):
    return hmac.new(settings.SECRET_KEY.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def send_code(req, chat_id):
    """Yangi 4 xonali kod yaratib, botga yuboradi."""
    code = f"{secrets.randbelow(10000):04d}"
    req.code_hash, req.code_sent_at, req.attempts = code_hash(req.phone, code), timezone.now(), 0
    req.save(update_fields=["code_hash", "code_sent_at", "attempts"])
    ok = send(chat_id, f"🔐 <b>EduWay AI</b> kirish kodi:\n\n<code>{code}</code>\n\nKodni ilovaga kiriting. U 5 daqiqa amal qiladi.\n"
                       "Kodni hech kimga bermang — EduWay xodimlari uni hech qachon so'ramaydi.", REMOVE_KB)
    return ok


def webhook_secret():
    return hmac.new(settings.SECRET_KEY.encode(), b"telegram-webhook", hashlib.sha256).hexdigest()[:48]


# --- Kelgan xabarlarni qayta ishlash (webhook ham, polling ham shu funksiyani chaqiradi) ---

def handle_update(upd):
    from .models import LoginRequest, TelegramLink, User

    msg = upd.get("message") or {}
    chat = msg.get("chat") or {}
    if chat.get("type") != "private":
        return
    chat_id, frm = chat["id"], msg.get("from") or {}
    text = (msg.get("text") or "").strip()

    if text.startswith("/start"):
        payload = text.split(maxsplit=1)[1] if " " in text else ""
        req = LoginRequest.objects.filter(token=payload, used=False).first() if payload else None
        if req:
            link = TelegramLink.objects.filter(chat_id=chat_id, phone=req.phone).first()
            if link:  # raqam shu Telegram akkauntiga allaqachon ulangan — darhol kod
                send_code(req, chat_id)
                return
            send(chat_id, f"👋 <b>EduWay AI</b>ga xush kelibsiz!\n\nIlovaga kirish uchun pastdagi <b>«📱 Raqamni ulashish»</b> tugmasini bosing — "
                          f"shu raqamga ({req.phone}) kod yuboraman.", CONTACT_KB)
            return
        send(chat_id, "👋 <b>EduWay AI</b> boti — ilovaga kirish kodlari shu yerga keladi.\n\n"
                      "Ilovada telefon raqamingizni kiriting va «Kod olish»ni bosing. Yoki hozir raqamingizni ulashing:", CONTACT_KB)
        return

    contact = msg.get("contact")
    if contact:
        if contact.get("user_id") != frm.get("id"):
            send(chat_id, "Iltimos, o'zingizning raqamingizni yuboring (pastdagi tugma orqali).", CONTACT_KB)
            return
        phone = normalize_phone(contact.get("phone_number"))
        if not phone:
            send(chat_id, "Hozircha faqat O'zbekiston (+998) raqamlari qabul qilinadi.")
            return
        with transaction.atomic():
            TelegramLink.objects.filter(chat_id=chat_id).exclude(phone=phone).delete()
            TelegramLink.objects.update_or_create(phone=phone, defaults={"chat_id": chat_id, "first_name": (frm.get("first_name") or "")[:64],
                                                                          "username": (frm.get("username") or "")[:64]})
            User.objects.filter(phone=phone).update(telegram_chat_id=chat_id)
        req = LoginRequest.objects.filter(phone=phone, used=False, created__gte=timezone.now() - timedelta(minutes=15)).order_by("-created").first()
        if req:
            send_code(req, chat_id)
        else:
            send(chat_id, f"✅ Raqamingiz ulandi: <b>{phone}</b>\n\nEndi ilovaga qayting va «Kod olish» tugmasini bosing — kod shu yerga keladi.", REMOVE_KB)
        return

    if text.startswith("/"):
        cmd = text.split()[0][1:].split("@")[0].lower()
        if cmd in {c for c, _ in COMMANDS}:
            send(chat_id, command_reply(cmd, chat_id), REMOVE_KB)
            return

    link = TelegramLink.objects.filter(chat_id=chat_id).first()
    if link:
        send(chat_id, f"Raqamingiz ulangan: <b>{link.phone}</b>\nIlovada «Kod olish»ni bosing — kod shu yerga keladi.")
    else:
        send(chat_id, "Ilovaga kirish uchun raqamingizni ulashing:", CONTACT_KB)


def command_reply(cmd, chat_id):
    from core.levels import level_for
    from core.progress import current_streak
    from core.words import word_for
    from learning.models import DailyChallenge

    from .models import User

    url = public_url()
    if cmd == "help":
        return "🤖 <b>EduWay AI boti</b>\n\n" + "\n".join(f"/{c} — {d}" for c, d in COMMANDS) + (f"\n\n🌐 {url}" if url else "")
    if cmd == "word":
        w = word_for(timezone.localdate())
        return f"📖 <b>Kun so'zi:</b> {w['word']} <i>({w['level']})</i>\n🇺🇿 {esc(w['translation'])}\n\n💬 <i>{esc(w['example'])}</i>"
    u = User.objects.filter(telegram_chat_id=chat_id, is_active=True).first()
    if not u:
        return "Bu Telegram akkaunt hali EduWay AI profiliga ulanmagan. Ilovada telefon raqamingiz bilan kiring — ulanish avtomatik bo'ladi."
    if cmd == "notify":
        u.telegram_notify = not u.telegram_notify
        u.save(update_fields=["telegram_notify"])
        return "🔔 Bildirishnomalar Telegramga yuboriladi." if u.telegram_notify else "🔕 Telegram bildirishnomalari o'chirildi. Qayta yoqish: /notify"
    if cmd == "stats":
        lv = level_for(u.xp)
        nxt = f"\nKeyingi daraja ({lv['next_title']}) uchun: {lv['to_next']} XP" if lv["next_title"] else ""
        from core.weekly import summary

        c = summary(u)["current"]
        return (f"📊 <b>{esc(u.first_name or 'Statistika')}</b>\n\n{lv['icon']} {lv['level']}-daraja · {lv['title']}\n⭐ {u.xp} XP{nxt}\n"
                f"🔥 Seriya: {current_streak(u)} kun (rekord {u.best_streak})\n\n<b>Shu hafta:</b> {c['xp']} XP, {c['quizzes']} test, "
                f"{c['focus_minutes']} daq. fokus, {c['active_days']}/7 faol kun")
    if cmd == "challenge":
        ch = DailyChallenge.objects.filter(user=u, date=timezone.localdate()).first()
        if ch and ch.completed:
            return f"✅ Bugungi challenge bajarilgan: {ch.score}/{ch.total}. Ertaga yangi savollar!"
        return "⚡ Bugungi 5 ta savol sizni kutmoqda — bonus XP oling!" + (f"\n\n👉 {url}/challenge" if url else "")
    return ""


# --- Ishga tushirish ---

def public_url():
    url = os.getenv("SITE_URL", "").strip().rstrip("/")
    if not url and os.getenv("RAILWAY_PUBLIC_DOMAIN"):
        url = "https://" + os.getenv("RAILWAY_PUBLIC_DOMAIN").strip()
    return url


def _polling():
    call("deleteWebhook", {})
    offset = None
    while True:
        res = call("getUpdates", {"timeout": 30, "offset": offset, "allowed_updates": ["message"]}, timeout=40)
        if not res or not res.get("ok"):
            time.sleep(5)
            continue
        for upd in res["result"]:
            offset = upd["update_id"] + 1
            try:
                close_old_connections()
                handle_update(upd)
            except Exception:  # noqa: BLE001
                log.exception("Telegram xabarini qayta ishlashda xato")


def _set_webhook(url):
    for attempt in range(5):
        res = call("setWebhook", {"url": f"{url}/api/auth/telegram/webhook/", "secret_token": webhook_secret(),
                                  "allowed_updates": ["message"], "drop_pending_updates": False})
        if res and res.get("ok"):
            log.info("Telegram webhook o'rnatildi")
            return
        time.sleep(5 * (attempt + 1))


def start():
    prog = " ".join(sys.argv[:3])
    if not configured() or os.getenv("EDUWAY_BOT", "1") != "1" or not ("waitress" in prog or "runserver" in sys.argv):
        return
    threading.Thread(target=lambda: call("setMyCommands", {"commands": [{"command": c, "description": d} for c, d in COMMANDS]}),
                     daemon=True, name="tg-commands").start()
    url = public_url()
    if url.startswith("https://"):
        threading.Thread(target=_set_webhook, args=(url,), daemon=True, name="tg-webhook").start()
    else:
        threading.Thread(target=_polling, daemon=True, name="tg-polling").start()
