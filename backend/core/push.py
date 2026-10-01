"""Web Push (VAPID) — telefon/kompyuter bildirishnoma paneliga xabar (ilova yopiq bo'lsa ham).

Oqim: hodisa (bron, chat, SOS...) → notify() → Notification(push_state="pending") [outbox]
      → fon worker → Web Push xizmati (Chrome/Android: FCM, Firefox: Mozilla, Safari/iOS: Apple) → qurilma.
- Kalitlar (VAPID) faqat serverda; brauzerga faqat ochiq (public) kalit beriladi.
- Yaroqsiz obunalar (404/410) avtomatik o'chiriladi, ketma-ket xatolarda o'chiriladi.
- Outbox bazada — server qayta ishga tushsa ham navbatdagi xabarlar yo'qolmaydi.
"""
import json
import logging
import sys
import threading
import time
from datetime import timedelta
from urllib.parse import urlparse

from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone

log = logging.getLogger("avtora")
_wake = threading.Event()
_started = [False]

# Faqat ma'lum push xizmatlari manzillariga so'rov yuboriladi (SSRF — server orqali ichki tarmoqqa hujumdan himoya)
ALLOWED_PUSH_HOSTS = (
    "fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "push.services.mozilla.com",
    "web.push.apple.com", "notify.windows.com", "push.apple.com",
)


def endpoint_allowed(url):
    try:
        u = urlparse(url)
    except Exception:
        return False
    host = (u.hostname or "").lower()
    return u.scheme == "https" and any(host == h or host.endswith("." + h) for h in ALLOWED_PUSH_HOSTS)


RETRY_PAUSES = (0, 1, 3)  # soniya: 1-urinish darhol, keyin 1 s va 3 s kutib

_KEY_STATE = {}


def key_state():
    """(ok, sabab) — kalitlar bir marta tekshiriladi va natija eslab qolinadi."""
    k = (settings.VAPID_PUBLIC_KEY, settings.VAPID_PRIVATE_KEY)
    if k not in _KEY_STATE:
        if not all(k):
            _KEY_STATE[k] = (False, "VAPID kalitlari kiritilmagan")
        else:
            from .vapid import check_keys
            _KEY_STATE[k] = check_keys(*k)
            if not _KEY_STATE[k][0]:
                log.error("Push o'chirildi: %s. .env / Railway Variables'dagi VAPID qatorlarini tekshiring.", _KEY_STATE[k][1])
    return _KEY_STATE[k]


def enabled():
    return key_state()[0]


def payload_for(n):
    unread = n.user.notifications.filter(is_read=False).count()
    return json.dumps({
        "title": n.title,
        "body": n.push_body,
        "url": n.link or "/app/notifications",
        "tag": n.dedup_key or f"{n.kind}-{n.id}",
        "id": n.id,
        "kind": n.kind,
        "unread": unread,
        "urgent": n.urgent,
    }, ensure_ascii=False)


def send_to_subscription(sub, data, urgent=False, topic=None):
    """True — yetkazildi; False — xato. Yaroqsiz obunani o'chiradi."""
    from pywebpush import WebPushException, webpush
    if not endpoint_allowed(sub.endpoint):
        sub.is_active = False
        sub.save(update_fields=["is_active"])
        return False
    headers = {"Urgency": "high" if urgent else "normal"}
    if topic:
        headers["Topic"] = "".join(ch for ch in topic if ch.isalnum())[:32]  # takroriy xabar qurilmada almashtiriladi
    code, err = None, None
    # vaqtinchalik xatolar (tarmoq uzilishi, 429, 5xx) — qisqa kutib qayta urinamiz, xabar yo'qolmasin
    for pause in RETRY_PAUSES:
        if pause:
            time.sleep(pause)
        try:
            webpush(
                subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                data=data, vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT}, ttl=24 * 3600, headers=headers, timeout=10,
            )
            sub.failures, sub.last_success = 0, timezone.now()
            sub.save(update_fields=["failures", "last_success"])
            return True
        except WebPushException as exc:
            code, err = getattr(exc.response, "status_code", None), None
            if code in (404, 410):  # obuna bekor qilingan / muddati o'tgan
                sub.delete()
                return False
            if not (code is None or code == 429 or code >= 500):
                break  # 400/401/403/413 — qayta urinish foyda bermaydi
        except Exception as exc:
            code, err = None, exc.__class__.__name__
    sub.failures += 1
    if sub.failures >= 5:
        sub.is_active = False
    sub.save(update_fields=["failures", "is_active"])
    log.warning("Web Push xatosi %s (obuna %s)", err or code, sub.id)
    return False


def process_pending(batch=100):
    """Navbatdagi bildirishnomalarni yuboradi. Qaytaradi: yuborilganlar soni."""
    from core.models import Notification
    sent = 0
    # juda eski (1 soatdan ortiq) yuborilmaganlarini endi yubormaymiz — eskirgan xabar qurilmaga kelmasin
    Notification.objects.filter(push_state="pending", created_at__lt=timezone.now() - timedelta(hours=1)).update(push_state="failed")
    items = list(Notification.objects.filter(push_state="pending").select_related("user").order_by("id")[:batch])
    for n in items:
        # bir vaqtda bir nechta worker bo'lsa ham bitta xabar bir marta yuboriladi
        if not Notification.objects.filter(pk=n.pk, push_state="pending").update(push_state="sent"):
            continue
        subs = list(n.user.push_subs.filter(is_active=True))
        if not subs or not n.user.is_active:
            Notification.objects.filter(pk=n.pk).update(push_state="none")
            continue
        data = payload_for(n)
        ok = [send_to_subscription(s, data, n.urgent, n.dedup_key or None) for s in subs]
        if any(ok):
            sent += 1
        else:
            Notification.objects.filter(pk=n.pk).update(push_state="failed")
    return sent


def _loop():
    while True:
        _wake.wait(timeout=5)
        _wake.clear()
        try:
            close_old_connections()
            while process_pending():
                pass
        except Exception as exc:
            log.warning("Push worker xatosi: %s", exc)
        finally:
            close_old_connections()


def start_worker():
    if _started[0] or not enabled():
        return False
    _started[0] = True
    threading.Thread(target=_loop, daemon=True, name="push-worker").start()
    return True


def wake_worker():
    # server boshqa usulda ishga tushirilgan bo'lsa ham (gunicorn, runserver) — xabar navbatda qolib ketmasin
    if not _started[0] and "test" not in sys.argv:
        start_worker()
    _wake.set()
