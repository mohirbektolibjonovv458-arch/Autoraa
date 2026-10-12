"""Haftalik hisobot: oxirgi 7 kun va undan oldingi 7 kun solishtiriladi."""
from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone

from .levels import level_for

FIELDS = ("xp", "quizzes", "tasks_done", "words_reviewed", "lessons", "focus_minutes", "ai_messages")


def _sum(user, start, end):
    from .models import ActivityDay

    qs = ActivityDay.objects.filter(user=user, date__gte=start, date__lte=end)
    agg = qs.aggregate(**{f: Sum(f) for f in FIELDS})
    out = {f: agg[f] or 0 for f in FIELDS}
    out["active_days"] = qs.filter(xp__gt=0).count()
    return out


def summary(user, today=None):
    today = today or timezone.localdate()
    start = today - timedelta(days=6)
    cur = _sum(user, start, today)
    prev = _sum(user, start - timedelta(days=7), start - timedelta(days=1))
    best = None
    from .models import ActivityDay

    b = ActivityDay.objects.filter(user=user, date__gte=start, date__lte=today, xp__gt=0).order_by("-xp").first()
    if b:
        best = {"date": b.date, "xp": b.xp}
    return {"from": start, "to": today, "current": cur, "previous": prev, "best_day": best,
            "xp_change": cur["xp"] - prev["xp"], "level": level_for(user.xp), "streak": user.streak}


def text(s):
    c = s["current"]
    arrow = "📈" if s["xp_change"] > 0 else ("📉" if s["xp_change"] < 0 else "➖")
    return (f"{c['xp']} XP to'pladingiz ({arrow} {s['xp_change']:+d}), {c['active_days']}/7 kun faol, "
            f"{c['quizzes']} ta test, {c['focus_minutes']} daqiqa fokus, {c['words_reviewed']} ta so'z takrorlandi.")
