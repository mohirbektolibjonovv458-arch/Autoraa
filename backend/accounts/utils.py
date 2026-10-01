import json
import logging
import math
import re

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def normalize_phone(raw):
    digits = re.sub(r"\D", "", str(raw or ""))
    if len(digits) == 9:
        digits = "998" + digits
    if len(digits) != 12 or not digits.startswith("998"):
        return None
    return "+" + digits


def tg_call(token, method, data=None, files=None, timeout=15):
    """Telegram Bot API ga oddiy so'rov. Xato bo'lsa None qaytaradi."""
    if not token:
        return None
    url = f"{settings.TELEGRAM_API_BASE}/bot{token}/{method}"
    try:
        if files:
            payload = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in (data or {}).items()}
            r = requests.post(url, data=payload, files=files, timeout=timeout)
        else:
            r = requests.post(url, json=data or {}, timeout=timeout)
        res = r.json()
        if not res.get("ok") and method != "getUpdates":
            logger.warning("Telegram %s xato: %s", method, res.get("description"))
        return res
    except Exception as exc:  # tarmoq xatosi
        if method != "getUpdates":
            logger.warning("Telegram %s ulanib bo'lmadi: %s", method, exc.__class__.__name__)
        return None


_USERNAMES = {}
_FAILED_AT = {}


def bot_username(token, fallback=""):
    """Bot username ni Telegramdan (getMe) avtomatik oladi va eslab qoladi."""
    if not token:
        return fallback
    if token not in _USERNAMES:
        import time
        if time.time() - _FAILED_AT.get(token, 0) < 60:
            return fallback
        res = tg_call(token, "getMe", timeout=8)
        uname = ((res or {}).get("result") or {}).get("username") if res and res.get("ok") else None
        if uname:
            _USERNAMES[token] = uname
        else:
            _FAILED_AT[token] = time.time()
            return fallback
    return _USERNAMES[token]


def auth_bot_url():
    return f"https://t.me/{bot_username(settings.AUTH_BOT_TOKEN, settings.AUTH_BOT_USERNAME)}?start=code"


def premium_bot_username():
    return bot_username(settings.PREMIUM_BOT_TOKEN, settings.PREMIUM_BOT_USERNAME)


def send_auth_message(chat_id, text, reply_markup=None):
    data = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        data["reply_markup"] = reply_markup
    res = tg_call(settings.AUTH_BOT_TOKEN, "sendMessage", data)
    return bool(res and res.get("ok"))


def notify_user_telegram(user, text):
    if user and user.telegram_chat_id:
        return send_auth_message(user.telegram_chat_id, text)
    return False


def haversine_km(lat1, lng1, lat2, lng2):
    if None in (lat1, lng1, lat2, lng2):
        return None
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 1)


# Botlar holati (monitoring uchun /api/health/ da ko'rinadi; tokenlar chiqmaydi)
BOT_STATUS = {"auth": "not_started", "premium": "not_started"}
