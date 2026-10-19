"""Avtomatik eslatmalar (python manage.py start ichida har 30 daqiqada ishlaydi):
- avtomobil hujjati muddati (30, 7, 3, 1 kun qolganda, tugagan kuni)
- bron vaqti yaqinlashganda (mijoz va usta)
- Premium tugashiga 3 kun va 1 kun qolganda (usta)
- ish tugaganidan 2 soat o'tib hali baho qo'yilmagan bo'lsa — bir marta «ishni baholang»"""
from datetime import datetime, timedelta

from django.utils import timezone

from accounts.models import User
from core.models import notify
from garage.models import CarDocument
from masters.models import Booking

DOC_DAYS = {30, 7, 3, 1, 0}


def document_reminders():
    today = timezone.localdate()
    sent = 0
    for d in CarDocument.objects.filter(expires_on__lte=today + timedelta(days=30), expires_on__gte=today - timedelta(days=1)).select_related("vehicle__owner"):
        left = (d.expires_on - today).days
        if left not in DOC_DAYS or d.last_reminded == today:
            continue
        car = f"{d.vehicle.brand} {d.vehicle.model}".strip()
        name = d.title or d.get_kind_display()
        when = "bugun tugaydi" if left == 0 else f"{left} kundan keyin tugaydi ({d.expires_on:%d.%m.%Y})"
        notify(d.vehicle.owner, f"⏰ {name} {when}", f"{car}. Yangilashni unutmang — jarima va muammolardan saqlaning.", "system", "/app/cars", telegram=True)
        d.last_reminded = today
        d.save(update_fields=["last_reminded"])
        sent += 1
    return sent


def booking_reminders():
    now = timezone.localtime()
    today, tomorrow = now.date(), now.date() + timedelta(days=1)
    sent = 0
    qs = Booking.objects.filter(reminded=False, status__in=["pending", "confirmed"], date__in=[today, tomorrow]).select_related("user", "master__user")
    for b in qs:
        try:
            at = timezone.make_aware(datetime.combine(b.date, datetime.strptime(b.time, "%H:%M").time()))
        except ValueError:
            continue
        hours = (at - now).total_seconds() / 3600
        if not (0 < hours <= 3 or (b.date == tomorrow and now.hour >= 18)):
            continue
        day = "Bugun" if b.date == today else "Ertaga"
        master = b.master.title or b.master.user.full_name
        notify(b.user, f"📅 {day} soat {b.time} — {b.service_name}", f"Usta: {master}. {b.master.address}", "order", "/app/orders", telegram=True)
        notify(b.master.user, f"📅 {day} soat {b.time} — mijoz keladi", f"{b.user.full_name}, {b.service_name}", "order", "/app/usta/orders", telegram=True)
        b.reminded = True
        b.save(update_fields=["reminded"])
        sent += 1
    return sent


def premium_reminders():
    now = timezone.now()
    sent = 0
    for u in User.objects.filter(role="usta", premium_until__gt=now, premium_until__lte=now + timedelta(days=3)):
        left = (u.premium_until - now).days
        key = f"premium-{u.premium_until:%Y%m%d}-{left}"
        if u.notifications.filter(link=f"/app/usta/premium#{key}").exists():
            continue
        notify(u, f"💎 Premium {left + 1} kundan keyin tugaydi", "Do'koningiz yopilib qolmasligi uchun obunani uzaytiring.", "premium", f"/app/usta/premium#{key}", telegram=True)
        sent += 1
    return sent


def review_reminders():
    now = timezone.now()
    sent = 0
    qs = Booking.objects.filter(status="completed", review__isnull=True, review_reminded=False,
                                completed_at__lte=now - timedelta(hours=2), completed_at__gte=now - timedelta(days=3)).select_related("user", "master__user")
    for b in qs:
        master = b.master.title or b.master.user.full_name
        notify(b.user, f"⭐ {master} ishini baholang", f"{b.service_name} — fikringiz boshqa haydovchilarga yaxshi usta tanlashga yordam beradi.",
               "review", f"/app/orders?review=booking-{b.id}", dedup=f"rv-{b.id}")
        b.review_reminded = True
        b.save(update_fields=["review_reminded"])
        sent += 1
    return sent


def run_all():
    from masters.stories import purge_expired_stories
    purge_expired_stories()  # 24 soatlik hikoyalar — fayli bilan o'chiriladi
    return document_reminders() + booking_reminders() + premium_reminders() + review_reminders()
