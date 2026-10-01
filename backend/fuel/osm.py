"""OpenStreetMap (Overpass API) dan butun O'zbekiston bo'yicha yoqilg'i shoxobchalarini import qilish.

- Ma'lumot manbai: OpenStreetMap (ODbL) — «© OpenStreetMap contributors» atributsiyasi xaritada ko'rsatiladi.
- Butun mamlakat BITTA so'rov bilan, server tomonida, haftasiga bir marta yuklanadi (Overpass foydalanish qoidalariga mos).
  Frontend hech qachon Overpass'ga murojaat qilmaydi — faqat bizning API dan xarita ko'rinishidagi qismni oladi.
- Yoqilg'i turi: avval aniq OSM teglari (fuel:cng, fuel:lpg, fuel:octane_*, fuel:diesel), bo'lmasa nomidan
  (AGNKS/metan/CNG → metan, AGZS/propan/LPG → propan). Taxmin qilingan tur `fuels_confirmed=False` bilan belgilanadi.
- Foydalanuvchilar qo'shgan shoxobchalar va ular belgilagan yoqilg'i turlari saqlanib qoladi.
"""
import json
import logging
import re

import requests
from django.conf import settings
from django.utils import timezone

from .models import FuelImport, FuelStation

log = logging.getLogger("avtora")
OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
QUERY = """[out:json][timeout:240];
area["ISO3166-1"="UZ"][admin_level=2]->.uz;
(
  nwr["amenity"="fuel"](area.uz);
  nwr["amenity"="charging_station"](area.uz);
);
out center tags;"""
# O'zbekiston chegaralari (biroz zaxira bilan) — noto'g'ri koordinatalarni chiqarib tashlash uchun
UZ_BOUNDS = (37.0, 55.9, 45.7, 73.3)  # janub, g'arb, shimol, sharq

RX_METAN = re.compile(r"metan|метан|agnks|агнкс|agzks|cng|kompr|компр|\bгаз.?метан", re.I)
RX_PROPAN = re.compile(r"propan|пропан|agzs|агзс|lpg|\bgaz\b|\bгаз\b|suyultirilgan", re.I)


def _yes(tags, k):
    return str(tags.get(k, "")).strip().lower() in ("yes", "1", "true", "only")


def detect_fuels(tags):
    """(yoqilg'i turlari, aniq teg orqali tasdiqlanganmi)"""
    if tags.get("amenity") == "charging_station":
        return ["elektr"], True
    fuels, confirmed = [], False
    if _yes(tags, "fuel:cng") or _yes(tags, "fuel:biogas"):
        fuels.append("metan"); confirmed = True
    if _yes(tags, "fuel:lpg"):
        fuels.append("propan"); confirmed = True
    if any(_yes(tags, k) for k in tags if k.startswith("fuel:octane_")) or _yes(tags, "fuel:gasoline"):
        fuels.append("benzin"); confirmed = True
    if _yes(tags, "fuel:diesel") or _yes(tags, "fuel:HGV_diesel"):
        fuels.append("dizel"); confirmed = True
    if not fuels:
        text = " ".join(str(tags.get(k, "")) for k in ("name", "name:uz", "name:ru", "name:en", "brand", "operator", "description"))
        if RX_METAN.search(text):
            fuels.append("metan")
        if RX_PROPAN.search(text) and "metan" not in fuels:
            fuels.append("propan")
        if not fuels:
            fuels = ["benzin"]  # teg yo'q oddiy AZS — odatda benzin (taxmin)
    return fuels, confirmed


def parse(data):
    out = []
    s, w, n, e = UZ_BOUNDS
    for el in data.get("elements", []):
        tags = el.get("tags") or {}
        lat = el.get("lat") if el.get("lat") is not None else (el.get("center") or {}).get("lat")
        lng = el.get("lon") if el.get("lon") is not None else (el.get("center") or {}).get("lon")
        if lat is None or lng is None or not (s <= lat <= n and w <= lng <= e):
            continue
        fuels, confirmed = detect_fuels(tags)
        default = {"elektr": "Elektr quvvatlash stansiyasi", "metan": "Metan shoxobchasi", "propan": "Propan shoxobchasi"}.get(fuels[0], "Yoqilg'i quyish shoxobchasi")
        name = tags.get("name:uz") or tags.get("name") or tags.get("name:ru") or tags.get("brand") or tags.get("operator") or default
        addr = ", ".join(x for x in (tags.get("addr:city") or tags.get("addr:place"), tags.get("addr:street"), tags.get("addr:housenumber")) if x)
        hours = (tags.get("opening_hours") or "").strip()
        out.append({
            "external_id": f"osm:{el['type']}:{el['id']}", "name": name[:150], "brand": (tags.get("brand") or tags.get("operator") or "")[:80],
            "address": addr[:250], "lat": round(float(lat), 7), "lng": round(float(lng), 7), "fuels": fuels, "fuels_confirmed": confirmed,
            "is_24_7": hours == "24/7", "opening_hours": hours[:120],
            "phone": (tags.get("phone") or tags.get("contact:phone") or "")[:30],
            "region": (tags.get("addr:region") or tags.get("addr:state") or tags.get("is_in:state") or "")[:40],
        })
    return out


def fetch_overpass():
    headers = {"User-Agent": f"Avtora/1.0 (+{settings.SITE_URL or 'https://avtora.uz'})", "Accept": "application/json"}
    last_err = None
    for url in OVERPASS:
        try:
            r = requests.post(url, data={"data": QUERY}, headers=headers, timeout=300)
            if r.ok:
                return r.json(), url
            last_err = f"{url}: HTTP {r.status_code}"
        except Exception as exc:
            last_err = f"{url}: {exc.__class__.__name__}"
            log.warning("Overpass %s", last_err)
    raise RuntimeError(f"OpenStreetMap serveriga ulanib bo'lmadi ({last_err}).")


def apply_items(items, source="overpass"):
    """Bazaga yozish. Qaytaradi: (qo'shildi, yangilandi, o'chirildi)."""
    added = updated = 0
    seen = set()
    existing = {s.external_id: s for s in FuelStation.objects.filter(source="osm")}
    for item in items:
        seen.add(item["external_id"])
        st = existing.get(item["external_id"])
        if st:
            if st.fuels_confirmed and not item["fuels_confirmed"]:
                item.pop("fuels"); item.pop("fuels_confirmed")  # admin/foydalanuvchi tasdiqlagan turlarni taxmin bilan almashtirmaymiz
            else:
                item["fuels"] = sorted(set(st.fuels or []) | set(item["fuels"]))
            for k, v in item.items():
                setattr(st, k, v)
            if not st.is_active and st.reports.exists() is False:
                st.is_active = True
            st.save()
            updated += 1
        else:
            FuelStation.objects.create(source="osm", is_verified=True, **item)
            added += 1
    deactivated = 0
    # OSM'dan olib tashlangan shoxobchalar — faqat to'liq (katta) javob kelganda yashiriladi
    if len(items) >= 200:
        gone = [s for eid, s in existing.items() if eid not in seen and s.is_active]
        for s in gone:
            s.is_active = False
            s.save(update_fields=["is_active"])
        deactivated = len(gone)
    return added, updated, deactivated


def import_osm(file_path=None):
    """Butun O'zbekiston bo'yicha import. file_path berilsa — Overpass eksport JSON faylidan."""
    rec = FuelImport.objects.create(source="file" if file_path else "overpass")
    try:
        if file_path:
            with open(file_path, encoding="utf-8") as f:
                data = json.load(f)
        else:
            data, url = fetch_overpass()
        items = parse(data)
        if not items:
            raise RuntimeError("Javobda shoxobcha topilmadi.")
        a, u, d = apply_items(items)
        rec.ok, rec.total, rec.added, rec.updated, rec.deactivated = True, len(items), a, u, d
        return a, u
    except Exception as exc:
        rec.error = str(exc)[:300]
        raise
    finally:
        rec.finished_at = timezone.now()
        rec.save()


def needs_refresh(days=7):
    last = FuelImport.objects.filter(ok=True).first()
    return last is None or (timezone.now() - last.started_at).days >= days
