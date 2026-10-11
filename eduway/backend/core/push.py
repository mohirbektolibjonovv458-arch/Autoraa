"""Web Push: ilova yopiq bo'lsa ham telefon/kompyuter bildirishnoma paneliga xabar.

- VAPID kalitlari: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY muhit o'zgaruvchilaridan, bo'lmasa birinchi kerak bo'lganda
  avtomatik yaratilib bazada saqlanadi (Railway'da qayta deploy qilinganda ham o'zgarmaydi).
- Har bir ilova ichidagi bildirishnoma (Notification) avtomatik ravishda push sifatida ham yuboriladi (signals.py).
- Yuborish fon oqimida bajariladi — API javobi kutib qolmaydi.
- Faqat ma'lum push xizmatlariga so'rov yuboriladi (SSRF himoyasi); yaroqsiz obunalar o'chiriladi.
"""
import base64
import json
import logging
import os
import threading
from urllib.parse import urlparse

from django.db import close_old_connections
from django.utils import timezone

log = logging.getLogger("eduway")

ALLOWED_HOSTS = ("fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com",
                 "push.services.mozilla.com", "web.push.apple.com", "notify.windows.com", "push.apple.com")
SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@eduway.uz")
_lock = threading.Lock()
_keys = None


def _b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def keys():
    """(public, private) — env'dan yoki bazadan; yo'q bo'lsa yaratiladi."""
    global _keys
    if _keys:
        return _keys
    pub, prv = os.getenv("VAPID_PUBLIC_KEY", "").strip(), os.getenv("VAPID_PRIVATE_KEY", "").strip()
    if pub and prv:
        _keys = (pub, prv)
        return _keys
    from .models import KeyValue

    with _lock:
        row = KeyValue.objects.filter(key="vapid").first()
        if not row:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.asymmetric import ec

            k = ec.generate_private_key(ec.SECP256R1())
            prv = _b64(k.private_numbers().private_value.to_bytes(32, "big"))
            pub = _b64(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
            row, _ = KeyValue.objects.get_or_create(key="vapid", defaults={"value": json.dumps({"public": pub, "private": prv})})
        d = json.loads(row.value)
        _keys = (d["public"], d["private"])
    return _keys


def endpoint_allowed(url):
    try:
        u = urlparse(url)
    except ValueError:
        return False
    host = (u.hostname or "").lower()
    return u.scheme == "https" and any(host == h or host.endswith("." + h) for h in ALLOWED_HOSTS)


def send_to(sub, payload):
    from pywebpush import WebPushException, webpush

    if not endpoint_allowed(sub.endpoint):
        sub.delete()
        return False
    try:
        webpush(subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                data=json.dumps(payload, ensure_ascii=False), vapid_private_key=keys()[1],
                vapid_claims={"sub": SUBJECT}, ttl=24 * 3600, timeout=10)
        sub.failures, sub.last_success = 0, timezone.now()
        sub.save(update_fields=["failures", "last_success"])
        return True
    except WebPushException as e:
        code = getattr(e.response, "status_code", None)
        if code in (400, 403, 404, 410):  # obuna bekor qilingan yoki boshqa kalit bilan olingan
            sub.delete()
            return False
        log.warning("Web Push xatosi %s", code)
    except Exception as e:  # noqa: BLE001 — tarmoq xatosi bildirishnomani to'xtatmasin
        log.warning("Web Push xatosi: %s", e.__class__.__name__)
    sub.failures += 1
    if sub.failures >= 5:
        sub.delete()
    else:
        sub.save(update_fields=["failures"])
    return False


def _send_user(user_id, payload):
    from .models import PushSubscription

    close_old_connections()
    try:
        for sub in PushSubscription.objects.filter(user_id=user_id):
            send_to(sub, payload)
    finally:
        close_old_connections()


def notify_push(notification):
    """Bildirishnomani fon oqimida qurilmalarga yuboradi."""
    from .models import PushSubscription

    if os.getenv("EDUWAY_PUSH", "1") != "1" or not PushSubscription.objects.filter(user_id=notification.user_id).exists():
        return
    payload = {"title": notification.title, "body": notification.body, "url": notification.link or "/notifications",
               "tag": f"{notification.kind}-{notification.id}", "kind": notification.kind}
    threading.Thread(target=_send_user, args=(notification.user_id, payload), daemon=True).start()
