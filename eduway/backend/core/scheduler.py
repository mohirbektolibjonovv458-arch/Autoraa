"""Kunlik eslatmalar (cron shart emas): web-server ichida fon oqimi har 10 daqiqada vaqtni tekshiradi.
Har bir eslatma turi kuniga faqat bir marta yuboriladi (oxirgi sana bazada saqlanadi — bir nechta jarayon bo'lsa ham takrorlanmaydi)."""
import logging
import os
import sys
import threading
import time
from datetime import timedelta

from django.db import close_old_connections, transaction
from django.utils import timezone

log = logging.getLogger("eduway")

MORNING_HOUR = 9   # grant muddatlari
EVENING_HOUR = 19  # seriya va challenge eslatmasi
WEEKLY_HOUR = 18   # yakshanba — haftalik hisobot


def _claim(job, today):
    """Bugun bu ish bajarilmagan bo'lsa — egallab oladi (True)."""
    from .models import KeyValue

    with transaction.atomic():
        row, _ = KeyValue.objects.select_for_update().get_or_create(key=f"job:{job}", defaults={"value": ""})
        if row.value == today.isoformat():
            return False
        row.value = today.isoformat()
        row.save(update_fields=["value"])
        return True


def evening_reminders():
    from accounts.models import User
    from learning.models import DailyChallenge

    from .models import Notification

    today = timezone.localdate()
    n = 0
    done_challenge = set(DailyChallenge.objects.filter(date=today, completed=True).values_list("user_id", flat=True))
    for u in User.objects.filter(is_active=True, push_reminders=True, push_subscriptions__isnull=False).distinct():
        if u.last_active == today:
            continue
        if u.last_active == today - timedelta(days=1) and u.streak >= 2:
            title, body = f"🔥 {u.streak} kunlik seriyangiz uzilmasin!", "Bugun 10 daqiqa o'qish yetarli — kunlik challenge'ni bajaring."
        elif u.id not in done_challenge:
            title, body = "⚡ Bugungi 5 ta savol sizni kutmoqda", "Kunlik challenge'ni bajarib, bonus XP oling."
        else:
            continue
        Notification.objects.create(user=u, title=title, body=body, link="/challenge", kind="reminder")
        n += 1
    return n


def weekly_reports():
    from accounts.models import User

    from .models import Notification
    from .weekly import summary, text

    n = 0
    since = timezone.localdate() - timedelta(days=13)
    for u in User.objects.filter(is_active=True, last_active__gte=since):
        s = summary(u)
        if not s["current"]["xp"] and not s["previous"]["xp"]:
            continue
        Notification.objects.create(user=u, title="📊 Haftalik hisobotingiz tayyor", body=text(s), link="/progress", kind="report")
        n += 1
    return n


def morning_reminders():
    from .views import deadline_reminders

    return deadline_reminders()


def _loop():
    time.sleep(30)
    while True:
        try:
            close_old_connections()
            now = timezone.localtime()
            today = now.date()
            if now.hour >= MORNING_HOUR and _claim("morning", today):
                log.info("Ertalabki eslatmalar: %s", morning_reminders())
            if now.weekday() == 6 and now.hour >= WEEKLY_HOUR and _claim("weekly", today):
                log.info("Haftalik hisobotlar: %s", weekly_reports())
            if now.hour >= EVENING_HOUR and _claim("evening", today):
                log.info("Kechki eslatmalar: %s", evening_reminders())
        except Exception:  # noqa: BLE001
            log.exception("Rejalashtiruvchi xatosi")
        finally:
            close_old_connections()
        time.sleep(600)


def start():
    prog = os.path.basename(sys.argv[0]) if sys.argv else ""
    is_server = "waitress" in prog or "waitress" in " ".join(sys.argv[:3]) or "runserver" in sys.argv
    if os.getenv("EDUWAY_SCHEDULER", "1") == "1" and is_server:
        threading.Thread(target=_loop, daemon=True, name="eduway-scheduler").start()
