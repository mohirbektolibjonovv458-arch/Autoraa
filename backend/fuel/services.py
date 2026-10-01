from core.hours import is_open
"""Shoxobcha holatini hisoblash: oxirgi 3 soatdagi foydalanuvchi belgilari asosida."""
from collections import defaultdict
from datetime import timedelta

from django.utils import timezone

from accounts.utils import haversine_km

from .models import AVAILABLE, FUEL_UNITS, STATUS_LABELS, FuelReport

FRESH_HOURS = 3        # holat shuncha vaqt dolzarb
CONFIRM_MINUTES = 60   # tasdiqlashlar oynasi
PRICE_DAYS = 14        # narx shuncha kun dolzarb


def build_status(stations):
    """{station_id: {fuel: {...}}} — har bir shoxobcha va yoqilg'i bo'yicha joriy holat."""
    ids = [s.id for s in stations]
    now = timezone.now()
    out = defaultdict(dict)
    if not ids:
        return out
    recent = FuelReport.objects.filter(station_id__in=ids, created_at__gte=now - timedelta(hours=24)).values(
        "station_id", "fuel", "status", "price", "created_at", "user_id")
    prices = FuelReport.objects.filter(station_id__in=ids, price__isnull=False, created_at__gte=now - timedelta(days=PRICE_DAYS)).values(
        "station_id", "fuel", "price", "created_at")
    groups = defaultdict(list)
    for r in recent:
        groups[(r["station_id"], r["fuel"])].append(r)
    for (sid, fuel), items in groups.items():
        items.sort(key=lambda x: x["created_at"], reverse=True)
        last = items[0]
        age_min = int((now - last["created_at"]).total_seconds() // 60)
        fresh = age_min <= FRESH_HOURS * 60
        confirms = len({r["user_id"] for r in items if r["status"] == last["status"] and (now - r["created_at"]).total_seconds() <= CONFIRM_MINUTES * 60})
        out[sid][fuel] = {
            "status": last["status"] if fresh else "unknown",
            "label": STATUS_LABELS[last["status"]] if fresh else "Ma'lumot eskirgan",
            "last_status": last["status"], "last_label": STATUS_LABELS[last["status"]],
            "minutes_ago": age_min, "confirms": max(confirms, 1) if fresh else 0,
            "available": fresh and last["status"] in AVAILABLE,
        }
    latest_price = {}
    for p in sorted(prices, key=lambda x: x["created_at"]):
        latest_price[(p["station_id"], p["fuel"])] = p["price"]
    for (sid, fuel), price in latest_price.items():
        out[sid].setdefault(fuel, {"status": "unknown", "label": "Ma'lumot yo'q", "minutes_ago": None, "confirms": 0, "available": False})
        out[sid][fuel]["price"] = price
        out[sid][fuel]["unit"] = FUEL_UNITS.get(fuel, "")
    return out


def serialize_station(s, st=None, lat=None, lng=None, subs=None):
    st = st or {}
    return {
        "id": s.id, "name": s.name, "brand": s.brand, "address": s.address, "lat": s.lat, "lng": s.lng,
        "fuels": s.fuels, "fuels_confirmed": s.fuels_confirmed, "is_24_7": s.is_24_7, "opening_hours": s.opening_hours,
        "open_now": is_open(s.opening_hours, is_24_7=s.is_24_7),
        "phone": s.phone, "is_verified": s.is_verified, "source": s.source,
        "distance_km": round(haversine_km(lat, lng, s.lat, s.lng), 1) if lat is not None and lng is not None else None,
        "status": st, "subscribed": sorted(subs or []),
    }


def notify_subscribers(station, fuel, reporter):
    """Holat «yo'q/yopiq/noma'lum» dan «bor» ga o'tganda obunachilarga xabar."""
    from core.models import notify
    from .models import FuelSubscription
    now = timezone.now()
    subs = FuelSubscription.objects.filter(station=station, fuel=fuel).exclude(user=reporter).select_related("user")
    for sub in subs:
        if sub.last_notified and now - sub.last_notified < timedelta(hours=2):
            continue
        notify(sub.user, f"⛽ {station.name}: {fuel.capitalize()} bor!", f"Hozirgina foydalanuvchi belgiladi. {station.address}".strip(),
               "system", f"/app/fuel?station={station.id}", telegram=True)
        sub.last_notified = now
        sub.save(update_fields=["last_notified"])
