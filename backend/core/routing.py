"""Ilova ichida marshrut: A (foydalanuvchi) → B (shoxobcha/usta).
Server orqali marshrut xizmatiga so'rov yuboriladi (kalit bo'lsa faqat serverda), natija 10 daqiqa keshlanadi.

.env:
  ROUTING_URL — OSRM mos manzil (sukut: OSRM ochiq serveri — kichik trafik uchun; ko'p foydalanuvchida o'z OSRM
                serveringizni yoki tijoriy xizmatni ulang), {profile}, {coords} va ixtiyoriy {key} bilan.
Foydalanuvchi koordinatalari saqlanmaydi va logga yozilmaydi."""
import hashlib
import logging

import requests
from django.conf import settings
from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView

log = logging.getLogger("avtora")
UZ = (36.5, 55.0, 46.5, 74.0)

MANEUVER = {
    "depart": "Yo'lga chiqing", "arrive": "Manzilga yetib keldingiz", "roundabout": "Aylanma yo'lga kiring", "rotary": "Aylanma yo'lga kiring",
    "merge": "Yo'lga qo'shiling", "on ramp": "Kirish yo'liga o'ting", "off ramp": "Chiqish yo'liga o'ting", "fork": "Ayrilishda",
    "end of road": "Yo'l oxirida", "continue": "To'g'ri davom eting", "new name": "To'g'ri davom eting", "turn": "Buriling",
}
MODIFIER = {"left": "chapga", "right": "o'ngga", "slight left": "biroz chapga", "slight right": "biroz o'ngga",
            "sharp left": "keskin chapga", "sharp right": "keskin o'ngga", "straight": "to'g'ri", "uturn": "orqaga qayriling"}


def _pt(raw):
    try:
        lat, lng = (float(x) for x in str(raw).split(",")[:2])
    except (TypeError, ValueError):
        return None
    s, w, n, e = UZ
    return (lat, lng) if s <= lat <= n and w <= lng <= e else None


def _step_text(st):
    m = st.get("maneuver") or {}
    typ, mod = m.get("type", ""), m.get("modifier", "")
    road = st.get("name") or ""
    if typ in ("depart", "arrive"):
        base = MANEUVER[typ]
    elif typ in ("turn", "end of road", "fork") and mod:
        base = f"{MANEUVER.get(typ, 'Buriling')} {MODIFIER.get(mod, '')}".replace("Buriling ", "").strip()
        base = base[0].upper() + base[1:] + (" buriling" if typ == "turn" else "")
    else:
        base = MANEUVER.get(typ, "Davom eting")
    return f"{base}{' — ' + road if road and typ != 'arrive' else ''}"


class RouteThrottleAnon(AnonRateThrottle):
    scope = "routing"


class RouteThrottleUser(UserRateThrottle):
    scope = "routing"


class RouteError(Exception):
    def __init__(self, status, detail):
        super().__init__(detail)
        self.status, self.detail = status, detail


def compute_route(a, b):
    """A → B marshrut (a, b = (lat, lng)). Natija 10 daqiqa keshlanadi. Xatoda RouteError."""
    key = "route:" + hashlib.sha1(f"{a[0]:.4f},{a[1]:.4f}>{b[0]:.4f},{b[1]:.4f}".encode()).hexdigest()
    hit = cache.get(key)
    if hit:
        return hit
    coords = f"{a[1]:.6f},{a[0]:.6f};{b[1]:.6f},{b[0]:.6f}"
    url = settings.ROUTING_URL.format(profile="driving", coords=coords, key=settings.ROUTING_KEY)
    try:
        r = requests.get(url, timeout=10, headers={"User-Agent": f"Avtora/1.0 (+{settings.SITE_URL or 'https://avtora.uz'})"})
        data = r.json()
    except Exception as exc:
        log.warning("Marshrut xizmati javob bermadi: %s", exc.__class__.__name__)
        raise RouteError(503, "Marshrut xizmati hozir javob bermayapti. Tashqi navigatorni oching.")
    if not r.ok or data.get("code") != "Ok" or not data.get("routes"):
        raise RouteError(404, "Bu nuqtalar orasida yo'l topilmadi.")
    route = data["routes"][0]
    line = route.get("geometry", {}).get("coordinates") or []
    step = max(1, len(line) // 600)  # frontendga ortiqcha nuqta yubormaymiz
    pts = [[round(p[1], 6), round(p[0], 6)] for p in line[::step]]
    if line and pts[-1] != [round(line[-1][1], 6), round(line[-1][0], 6)]:
        pts.append([round(line[-1][1], 6), round(line[-1][0], 6)])
    steps = []
    for leg in route.get("legs", []):
        for st in leg.get("steps", []):
            if st.get("distance", 0) < 5 and st.get("maneuver", {}).get("type") not in ("depart", "arrive"):
                continue
            steps.append({"text": _step_text(st), "distance_m": round(st.get("distance", 0))})
    out = {"distance_km": round(route.get("distance", 0) / 1000, 1), "duration_min": max(1, round(route.get("duration", 0) / 60)),
           "points": pts, "steps": steps[:40], "provider": settings.ROUTING_ATTRIBUTION}
    cache.set(key, out, 600)
    return out


class RouteError(Exception):
    def __init__(self, msg, status=503):
        super().__init__(msg); self.status = status


def fetch_route(a, b, max_points=600):
    """a, b: (lat, lng). Qaytaradi: {distance_km, duration_min, points [[lat,lng]], steps, provider}. Kesh 10 daqiqa."""
    key = "route:" + hashlib.sha1(f"{a[0]:.4f},{a[1]:.4f}>{b[0]:.4f},{b[1]:.4f}:{max_points}".encode()).hexdigest()
    hit = cache.get(key)
    if hit:
        return hit
    coords = f"{a[1]:.6f},{a[0]:.6f};{b[1]:.6f},{b[0]:.6f}"
    url = settings.ROUTING_URL.format(profile="driving", coords=coords, key=settings.ROUTING_KEY)
    try:
        r = requests.get(url, timeout=10, headers={"User-Agent": f"Avtora/1.0 (+{settings.SITE_URL or 'https://avtora.uz'})"})
        data = r.json()
    except Exception as exc:
        log.warning("Marshrut xizmati javob bermadi: %s", exc.__class__.__name__)
        raise RouteError("Marshrut xizmati hozir javob bermayapti. Tashqi navigatorni oching.", 503)
    if not r.ok or data.get("code") != "Ok" or not data.get("routes"):
        raise RouteError("Bu nuqtalar orasida yo'l topilmadi.", 404)
    route = data["routes"][0]
    line = route.get("geometry", {}).get("coordinates") or []
    step = max(1, len(line) // max_points)
    pts = [[round(p[1], 6), round(p[0], 6)] for p in line[::step]]
    if line and pts[-1] != [round(line[-1][1], 6), round(line[-1][0], 6)]:
        pts.append([round(line[-1][1], 6), round(line[-1][0], 6)])
    steps = []
    for leg in route.get("legs", []):
        for st in leg.get("steps", []):
            if st.get("distance", 0) < 5 and st.get("maneuver", {}).get("type") not in ("depart", "arrive"):
                continue
            steps.append({"text": _step_text(st), "distance_m": round(st.get("distance", 0))})
    out = {"distance_km": round(route.get("distance", 0) / 1000, 1), "duration_min": max(1, round(route.get("duration", 0) / 60)),
           "points": pts, "steps": steps[:40], "provider": settings.ROUTING_ATTRIBUTION}
    cache.set(key, out, 600)
    return out


class RouteView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RouteThrottleAnon, RouteThrottleUser]

    def get(self, request):
        a, b = _pt(request.query_params.get("from")), _pt(request.query_params.get("to"))
        if not a or not b:
            return Response({"detail": "Boshlanish yoki manzil nuqtasi noto'g'ri (O'zbekiston hududida bo'lishi kerak)."}, status=400)
        try:
            return Response(fetch_route(a, b))
        except RouteError as e:
            return Response({"detail": str(e)}, status=e.status)

class GeocodeThrottle(AnonRateThrottle):
    scope = "geocode"


class GeocodeUserThrottle(UserRateThrottle):
    scope = "geocode"


class GeocodeView(APIView):
    """Joy qidirish («Samarqand», «Chorsu bozori») — O'zbekiston bo'yicha. OpenStreetMap Nominatim, server orqali, 1 kun kesh."""
    permission_classes = [AllowAny]
    throttle_classes = [GeocodeThrottle, GeocodeUserThrottle]

    def get(self, request):
        q = str(request.query_params.get("q") or "").strip()[:80]
        if len(q) < 3:
            return Response([])
        lang = "ru" if request.query_params.get("lang") == "ru" else "uz"
        key = "geo:" + hashlib.sha1(f"{lang}:{q.lower()}".encode()).hexdigest()
        hit = cache.get(key)
        if hit is not None:
            return Response(hit)
        try:
            r = requests.get(settings.GEOCODE_URL, timeout=8, params={
                "q": q, "format": "jsonv2", "countrycodes": "uz", "limit": 6, "accept-language": f"{lang},ru,en", "addressdetails": 0,
            }, headers={"User-Agent": f"Avtora/1.0 (+{settings.SITE_URL or 'https://avtora.uz'})"})
            rows = r.json() if r.ok else []
        except Exception as exc:
            log.warning("Geokod xizmati javob bermadi: %s", exc.__class__.__name__)
            return Response({"detail": "Joy qidirish xizmati hozir javob bermayapti."}, status=503)
        out = []
        for x in rows if isinstance(rows, list) else []:
            try:
                lat, lng = float(x["lat"]), float(x["lon"])
            except (KeyError, TypeError, ValueError):
                continue
            if not _pt(f"{lat},{lng}"):
                continue
            name = str(x.get("name") or x.get("display_name", "")).strip()[:80]
            full = str(x.get("display_name") or "")[:160]
            out.append({"name": name or full, "address": full, "lat": round(lat, 6), "lng": round(lng, 6)})
        cache.set(key, out, 86400)
        return Response(out)
