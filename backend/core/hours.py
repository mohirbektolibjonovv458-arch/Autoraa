"""Ish vaqtini tahlil qilish va «hozir ochiqmi» hisoblash (Toshkent vaqti bilan).

Qo'llanadigan yozuvlar (OpenStreetMap opening_hours va ustalar kiritadigan oddiy ko'rinish):
  "24/7" · "08:00-20:00" · "08:00 - 20:00" · "Mo-Su 07:00-23:00" · "Mo-Fr 08:00-18:00; Sa 09:00-14:00; Su off"
  "Mo-Sa 08:00-12:00,13:00-18:00" · tungi oraliq "20:00-06:00"
Tushunib bo'lmaydigan yozuv uchun None qaytadi (ya'ni «noma'lum» — hech qachon «yopiq» deb taxmin qilinmaydi)."""
import re
from datetime import datetime

from django.utils import timezone

DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
_RANGE = re.compile(r"^(\d{1,2}):?(\d{2})?\s*[-–]\s*(\d{1,2}):?(\d{2})?$")


def _mins(h, m):
    return int(h) * 60 + int(m or 0)


def _parse_times(txt):
    out = []
    for part in txt.split(","):
        m = _RANGE.match(part.strip())
        if not m:
            return None
        a, b = _mins(m.group(1), m.group(2)), _mins(m.group(3), m.group(4))
        if not (0 <= a <= 1440 and 0 <= b <= 1440):
            return None
        out.append((a, b))
    return out


def _parse_days(txt):
    days = set()
    for part in txt.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            if a not in DAYS or b not in DAYS:
                return None
            i, j = DAYS.index(a), DAYS.index(b)
            rng = range(i, j + 1) if i <= j else list(range(i, 7)) + list(range(0, j + 1))
            days.update(rng)
        elif part in DAYS:
            days.add(DAYS.index(part))
        else:
            return None
    return days


def parse(spec, days_allowed=None):
    """-> {"always": True} yoki {weekday: [(boshlanish_daq, tugash_daq), ...]} yoki None"""
    s = (spec or "").strip()
    if not s:
        return None
    if s.replace(" ", "").lower() in ("24/7", "24x7", "kecha-kunduz", "24soat"):
        return {"always": True}
    table = {}
    for rule in [r.strip() for r in s.split(";") if r.strip()]:
        m = re.match(r"^((?:[A-Z][a-z](?:-[A-Z][a-z])?,?\s*)+)\s+(.+)$", rule)
        days, times = (set(range(7)), rule) if not m else (_parse_days(m.group(1).replace(" ", "")), m.group(2).strip())
        if days is None:
            return None
        if times.lower() in ("off", "closed"):
            for d in days:
                table[d] = []
            continue
        if times == "24/7" or times == "00:00-24:00":
            spans = [(0, 1440)]
        else:
            spans = _parse_times(times)
            if spans is None:
                return None
        for d in days:
            table[d] = spans
    if days_allowed is not None:
        for d in range(7):
            if d not in days_allowed:
                table[d] = []
    return table or None


def is_open(spec, now=None, is_24_7=False, days_allowed=None):
    """True / False / None (noma'lum)"""
    if is_24_7:
        return True if days_allowed is None or len(days_allowed) == 7 else _in_days(days_allowed, now)
    t = parse(spec, days_allowed)
    if t is None:
        return None
    if t.get("always"):
        return True
    now = timezone.localtime(now) if now else timezone.localtime()
    wd, m = now.weekday(), now.hour * 60 + now.minute
    for a, b in t.get(wd, []):
        if a <= b and a <= m < b:
            return True
        if a > b and m >= a:  # tungi oraliq: bugun boshlanib, ertaga tugaydi
            return True
    prev = (wd - 1) % 7
    for a, b in t.get(prev, []):
        if a > b and m < b:
            return True
    return False if (wd in t or any(isinstance(k, int) for k in t)) else None


def _in_days(days, now):
    now = timezone.localtime(now) if now else timezone.localtime()
    return now.weekday() in days
