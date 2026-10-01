import os
import math
import threading
from core.hours import is_open
from core.params import str_in
from datetime import timedelta

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin
from accounts.utils import haversine_km

from .models import FuelImport, AVAILABLE, FUEL_UNITS, FUELS, STATUS_LABELS, STATUSES, FuelReport, FuelStation, FuelSubscription
from .services import build_status, notify_subscribers, serialize_station

FUEL_KEYS = {k for k, _ in FUELS}
STATUS_KEYS = {k for k, _ in STATUSES}
PRICE_RANGE = {"metan": (1000, 15000), "propan": (2000, 20000), "benzin": (5000, 30000), "dizel": (5000, 30000), "elektr": (300, 15000)}
REPORT_MAX_KM = 2.0
REPORT_COOLDOWN_MIN = 10


def fnum(v):
    try:
        x = float(v)
        return x if math.isfinite(x) else None
    except (TypeError, ValueError):
        return None


def clean_hours(v):
    """Faqat tushunarli ish vaqtini saqlaymiz (masalan «07:00-23:00»)."""
    v = str_in(v)[:60]
    from core.hours import parse
    return v if v and parse(v) is not None else ""


def bump_map_cache():
    from django.core.cache import cache
    try:
        cache.incr("fuelmap:ver")
    except ValueError:
        cache.set("fuelmap:ver", 1, None)


def my_subs(request, ids):
    if not request.user.is_authenticated:
        return {}
    out = {}
    for sid, fuel in FuelSubscription.objects.filter(user=request.user, station_id__in=ids).values_list("station_id", "fuel"):
        out.setdefault(sid, []).append(fuel)
    return out


class MetaView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"fuels": [{"key": k, "label": l, "unit": FUEL_UNITS[k]} for k, l in FUELS],
                         "statuses": [{"key": k, "label": l} for k, l in STATUSES]})


class StationsView(APIView):
    """Eng yaqin shoxobchalar ro'yxati (masofa bo'yicha, sahifalab). Ro'yxatdan o'tmagan foydalanuvchi ham ko'ra oladi.
    Foydalanuvchi koordinatasi faqat masofani hisoblash uchun ishlatiladi — hech qayerda saqlanmaydi."""
    permission_classes = [AllowAny]

    def get(self, request):
        p = request.query_params
        lat = fnum(p.get("lat")); lng = fnum(p.get("lng"))
        if lat is not None and not (-90 <= lat <= 90): lat = None
        if lng is not None and not (-180 <= lng <= 180): lng = None
        radius = min(max(fnum(p.get("radius")) or 25, 1), 150)
        fuel = p.get("fuel") if p.get("fuel") in FUEL_KEYS else None
        limit = int(min(max(fnum(p.get("limit")) or 50, 1), 100))
        offset = int(min(max(fnum(p.get("offset")) or 0, 0), 5000))
        qs = FuelStation.objects.filter(is_active=True)
        if lat is not None and lng is not None:
            dlat = radius / 111.0
            dlng = radius / (111.0 * max(0.2, math.cos(math.radians(lat))))
            qs = qs.filter(lat__range=(lat - dlat, lat + dlat), lng__range=(lng - dlng, lng + dlng))
        if p.get("q"):
            q = str(p["q"])[:60]
            qs = qs.filter(Q(name__icontains=q) | Q(address__icontains=q) | Q(brand__icontains=q))
        items = list(qs.only("id", "name", "brand", "address", "lat", "lng", "fuels", "fuels_confirmed", "is_24_7", "opening_hours",
                             "phone", "is_verified", "source")[:5000])
        if fuel:
            items = [s for s in items if fuel in (s.fuels or [])]
        if lat is not None and lng is not None:
            for s in items:
                s._d = haversine_km(lat, lng, s.lat, s.lng)
            items = [s for s in items if s._d <= radius]
            items.sort(key=lambda s: s._d)
        if p.get("open_now") in ("1", "true"):
            items = [s for s in items if is_open(s.opening_hours, is_24_7=s.is_24_7) is True]
        if p.get("only_available") in ("1", "true") and fuel:
            st_all = build_status(items)
            items = [s for s in items if st_all.get(s.id, {}).get(fuel, {}).get("available")]
        total = len(items)
        page = items[offset:offset + limit]
        st = build_status(page)
        subs = my_subs(request, [s.id for s in page])
        return Response({"count": total, "has_more": offset + limit < total, "next_offset": offset + limit if offset + limit < total else None,
                         "results": [serialize_station(s, st.get(s.id), lat, lng, subs.get(s.id)) for s in page]})

    def post(self, request):
        """Yangi shoxobcha taklif qilish (xaritada yo'q bo'lsa)."""
        if not request.user.is_authenticated:
            return Response({"detail": "Kirish talab qilinadi."}, status=401)
        d = request.data
        lat, lng = fnum(d.get("lat")), fnum(d.get("lng"))
        name = str_in(d.get("name"))
        fuels = [f for f in (d.get("fuels") if isinstance(d.get("fuels"), list) else []) if isinstance(f, str) and f in FUEL_KEYS]
        if not name or lat is None or lng is None or not fuels:
            return Response({"detail": "Nomi, xaritadagi joyi va kamida bitta yoqilg'i turini kiriting."}, status=400)
        if not (37 <= lat <= 46 and 55 <= lng <= 74):
            return Response({"detail": "Joy O'zbekiston hududidan tashqarida."}, status=400)
        today = FuelStation.objects.filter(added_by=request.user, created_at__gte=timezone.now() - timedelta(days=1)).count()
        if today >= 5 and request.user.role != "admin":
            return Response({"detail": "Bir kunda ko'pi bilan 5 ta shoxobcha qo'shish mumkin."}, status=429)
        near = [s for s in FuelStation.objects.filter(is_active=True, lat__range=(lat - 0.002, lat + 0.002), lng__range=(lng - 0.003, lng + 0.003))
                if haversine_km(lat, lng, s.lat, s.lng) < 0.12]
        if near:
            return Response({"detail": f"Bu joyda «{near[0].name}» allaqachon bor.", "station_id": near[0].id}, status=400)
        s = FuelStation.objects.create(name=name[:150], address=str_in(d.get("address"))[:250], lat=lat, lng=lng, fuels=fuels,
                                       is_24_7=bool(d.get("is_24_7")), source="user", added_by=request.user,
                                       is_verified=request.user.role == "admin", fuels_confirmed=True,
                                       opening_hours=clean_hours(d.get("opening_hours")))
        bump_map_cache()
        return Response(serialize_station(s, {}, lat, lng), status=201)


class StationDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        s = get_object_or_404(FuelStation, pk=pk, is_active=True)
        lat, lng = fnum(request.query_params.get("lat")), fnum(request.query_params.get("lng"))
        st = build_status([s])
        reports = s.reports.filter(created_at__gte=timezone.now() - timedelta(hours=24)).select_related("user")[:30]
        data = serialize_station(s, st.get(s.id), lat, lng, my_subs(request, [s.id]).get(s.id))
        data["reports"] = [{
            "id": r.id, "fuel": r.fuel, "status": r.status, "label": STATUS_LABELS[r.status], "price": r.price,
            "user": f"{r.user.first_name} {r.user.last_name[:1]}.".strip(" ."), "created_at": r.created_at,
        } for r in reports]
        return Response(data)


class ReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        s = get_object_or_404(FuelStation, pk=pk, is_active=True)
        d = request.data
        fuel, status = str_in(d.get("fuel")), str_in(d.get("status"))
        if fuel not in FUEL_KEYS or status not in STATUS_KEYS:
            return Response({"detail": "Yoqilg'i turi yoki holat noto'g'ri."}, status=400)
        lat, lng = fnum(d.get("lat")), fnum(d.get("lng"))
        if lat is None or lng is None:
            return Response({"detail": "Belgilash uchun GPS (joylashuv) ga ruxsat bering — ma'lumot ishonchli bo'lishi uchun faqat shoxobcha yonida belgilanadi.", "code": "gps_required"}, status=400)
        dist = haversine_km(lat, lng, s.lat, s.lng)
        if dist > REPORT_MAX_KM:
            return Response({"detail": f"Siz shoxobchadan {dist:.1f} km uzoqdasiz. Holatni faqat shoxobcha yonida ({REPORT_MAX_KM:g} km gacha) belgilash mumkin.", "code": "too_far"}, status=400)
        last = FuelReport.objects.filter(station=s, user=request.user, fuel=fuel).first()
        if last and timezone.now() - last.created_at < timedelta(minutes=REPORT_COOLDOWN_MIN):
            left = REPORT_COOLDOWN_MIN - int((timezone.now() - last.created_at).total_seconds() // 60)
            return Response({"detail": f"Siz bu shoxobchani yaqinda belgiladingiz. {left} daqiqadan so'ng qayta belgilashingiz mumkin."}, status=429)
        price = None
        if d.get("price") not in (None, ""):
            price = int(fnum(d.get("price")) or 0)
            lo, hi = PRICE_RANGE[fuel]
            if not lo <= price <= hi:
                return Response({"detail": f"Narx noto'g'ri ko'rinadi ({lo:,}–{hi:,} so'm oralig'ida bo'lishi kerak).".replace(",", " ")}, status=400)
        before = build_status([s]).get(s.id, {}).get(fuel, {})
        FuelReport.objects.create(station=s, user=request.user, fuel=fuel, status=status, price=price)
        bump_map_cache()
        if fuel not in (s.fuels or []):
            s.fuels = sorted(set(s.fuels or []) | {fuel})
            s.save(update_fields=["fuels"])
        if status in AVAILABLE and not before.get("available"):
            threading.Thread(target=notify_subscribers, args=(s, fuel, request.user), daemon=True).start()
        week = FuelReport.objects.filter(user=request.user, created_at__gte=timezone.now() - timedelta(days=7)).count()
        return Response({"ok": True, "status": build_status([s]).get(s.id, {}), "my_week": week}, status=201)


class SubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        s = get_object_or_404(FuelStation, pk=pk)
        fuel = str_in(request.data.get("fuel")) or "metan"
        if fuel not in FUEL_KEYS:
            return Response({"detail": "Yoqilg'i turi noto'g'ri."}, status=400)
        sub = FuelSubscription.objects.filter(user=request.user, station=s, fuel=fuel).first()
        if sub:
            sub.delete()
            return Response({"subscribed": False})
        if FuelSubscription.objects.filter(user=request.user).count() >= 20:
            return Response({"detail": "Ko'pi bilan 20 ta shoxobchaga obuna bo'lish mumkin."}, status=400)
        FuelSubscription.objects.create(user=request.user, station=s, fuel=fuel)
        return Response({"subscribed": True, "telegram": bool(request.user.telegram_chat_id)})


class MyFuelView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subs = list(FuelSubscription.objects.filter(user=request.user).select_related("station"))
        stations = [x.station for x in subs]
        st = build_status(stations)
        lat, lng = fnum(request.query_params.get("lat")), fnum(request.query_params.get("lng"))
        return Response([{"fuel": x.fuel, "station": serialize_station(x.station, st.get(x.station_id), lat, lng, [x.fuel])} for x in subs])


class LeadersView(APIView):
    """Haftaning eng faol yordamchilari — gamifikatsiya."""
    permission_classes = [AllowAny]

    def get(self, request):
        since = timezone.now() - timedelta(days=7)
        rows = (FuelReport.objects.filter(created_at__gte=since).values("user_id", "user__first_name", "user__last_name")
                .annotate(c=Count("id")).order_by("-c")[:10])
        leaders = [{"user_id": r["user_id"], "name": f"{r['user__first_name']} {(r['user__last_name'] or '')[:1]}.".strip(" ."), "count": r["c"]} for r in rows]
        me = None
        if request.user.is_authenticated:
            mine = FuelReport.objects.filter(user=request.user)
            week = mine.filter(created_at__gte=since).count()
            rank = None
            if week:
                rank = FuelReport.objects.filter(created_at__gte=since).values("user_id").annotate(c=Count("id")).filter(c__gt=week).count() + 1
            me = {"week": week, "total": mine.count(), "rank": rank}
        today = FuelReport.objects.filter(created_at__gte=timezone.now() - timedelta(hours=24)).count()
        return Response({"leaders": leaders, "me": me, "reports_24h": today, "stations": FuelStation.objects.filter(is_active=True).count()})


# ---------------- admin ----------------
_import_state = {"running": False, "last": None}


class AdminStationsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = FuelStation.objects.all().order_by("-created_at")
        p = request.query_params
        if p.get("q"):
            qs = qs.filter(Q(name__icontains=p["q"]) | Q(address__icontains=p["q"]))
        if p.get("status") == "pending":
            qs = qs.filter(is_verified=False, is_active=True)
        elif p.get("status") == "hidden":
            qs = qs.filter(is_active=False)
        qs = qs.annotate(reports_count=Count("reports"))
        return Response({
            "results": [{**serialize_station(s), "is_active": s.is_active, "reports_count": s.reports_count, "created_at": s.created_at,
                         "added_by": s.added_by.full_name if s.added_by else None} for s in qs[:300]],
            "total": FuelStation.objects.count(), "pending": FuelStation.objects.filter(is_verified=False, is_active=True).count(),
            "reports_24h": FuelReport.objects.filter(created_at__gte=timezone.now() - timedelta(hours=24)).count(),
            "import": {**_import_state, "history": [{"at": r.started_at, "ok": r.ok, "total": r.total, "added": r.added, "updated": r.updated,
                                                     "deactivated": r.deactivated, "error": r.error, "source": r.source}
                                                    for r in FuelImport.objects.all()[:5]]},
        })

    def post(self, request):
        """OpenStreetMap'dan import (fonda) yoki yuklangan Overpass JSON faylidan (server Overpass'ga ulana olmasa)."""
        up = request.FILES.get("file")
        if up:
            import tempfile
            from .osm import import_osm
            if up.size > 60 * 1024 * 1024:
                return Response({"detail": "Fayl juda katta (60 MB gacha)."}, status=400)
            with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
                for chunk in up.chunks():
                    tmp.write(chunk)
            try:
                a, u = import_osm(tmp.name)
            except Exception as exc:
                return Response({"detail": f"Import xatosi: {str(exc)[:200]}"}, status=400)
            finally:
                os.unlink(tmp.name)
            bump_map_cache()
            return Response({"detail": f"Import tugadi: {a} ta yangi, {u} ta yangilandi."})
        if _import_state["running"]:
            return Response({"detail": "Import allaqachon ketmoqda."}, status=400)

        def run():
            from django.db import connection
            from .osm import import_osm
            _import_state["running"] = True
            try:
                a, u = import_osm()
                _import_state["last"] = f"{timezone.localtime():%d.%m %H:%M} — {a} ta yangi, {u} ta yangilandi"
            except Exception as exc:
                _import_state["last"] = f"Xato: {exc}"
            finally:
                _import_state["running"] = False
                connection.close()
        threading.Thread(target=run, daemon=True).start()
        return Response({"detail": "Import boshlandi. 1–3 daqiqada tugaydi."})


class AdminStationDetailView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        s = get_object_or_404(FuelStation, pk=pk)
        for f in ("name", "brand", "address", "phone"):
            if f in request.data:
                setattr(s, f, (request.data[f] or "")[:250])
        for f in ("is_verified", "is_active", "is_24_7"):
            if f in request.data:
                setattr(s, f, bool(request.data[f]))
        if "fuels" in request.data:
            raw = request.data["fuels"] if isinstance(request.data["fuels"], list) else []
            s.fuels = [x for x in raw if isinstance(x, str) and x in FUEL_KEYS]
        s.save()
        return Response(serialize_station(s))

    def delete(self, request, pk):
        get_object_or_404(FuelStation, pk=pk).delete()
        return Response(status=204)


class AdminReportsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = FuelReport.objects.select_related("station", "user")[:150]
        return Response([{"id": r.id, "station": r.station.name, "station_id": r.station_id, "fuel": r.fuel, "status": r.status,
                          "label": STATUS_LABELS[r.status], "price": r.price, "user": r.user.full_name, "user_phone": r.user.phone,
                          "created_at": r.created_at} for r in qs])

    def delete(self, request):
        raw = request.data.get("ids")
        ids = [i for i in (raw if isinstance(raw, list) else []) if isinstance(i, int)][:500]
        n = FuelReport.objects.filter(id__in=ids).delete()[0]
        return Response({"deleted": n})


class MapView(APIView):
    """Xarita uchun: faqat ko'rinib turgan hudud (bbox). Uzoqlashtirilganda serverning o'zi guruhlaydi (klaster),
    shuning uchun butun O'zbekiston hech qachon bitta javobda frontendga yuborilmaydi. Javoblar 60 soniya keshlanadi."""
    permission_classes = [AllowAny]
    MAX_POINTS = 600

    def get(self, request):
        from django.core.cache import cache
        p = request.query_params
        s, w, n, e = (fnum(p.get(k)) for k in ("south", "west", "north", "east"))
        if None in (s, w, n, e) or not (-90 <= s < n <= 90) or not (-180 <= w < e <= 180):
            return Response({"detail": "Xarita chegaralari noto'g'ri."}, status=400)
        # O'zbekiston atrofi bilan cheklaymiz (xarita juda uzoqlashtirilsa ham)
        s, w, n, e = max(s, 36.5), max(w, 55.0), min(n, 46.5), min(e, 74.0)
        if s >= n or w >= e:
            return Response({"mode": "points", "items": [], "total": 0})
        zoom = int(min(max(fnum(p.get("zoom")) or 10, 3), 19))
        fuel = p.get("fuel") if p.get("fuel") in FUEL_KEYS else None
        ver = cache.get("fuelmap:ver", 0)  # yangi belgi/shoxobcha qo'shilganda kesh avtomatik eskiradi
        key = f"fuelmap:{ver}:{fuel}:{p.get('open_now') or 0}:{int(timezone.now().timestamp() // 300)}:{zoom}:{round(s, 2)}:{round(w, 2)}:{round(n, 2)}:{round(e, 2)}"
        hit = cache.get(key)
        if hit is not None:
            return Response(hit)
        rows = list(FuelStation.objects.filter(is_active=True, lat__range=(s, n), lng__range=(w, e))
                    .values("id", "name", "lat", "lng", "fuels", "fuels_confirmed", "opening_hours", "is_24_7")[:20000])
        if fuel:
            rows = [r for r in rows if fuel in (r["fuels"] or [])]
        open_only = p.get("open_now") in ("1", "true")
        for r in rows:
            r["open_now"] = is_open(r.pop("opening_hours"), is_24_7=r.pop("is_24_7"))
        if open_only:
            rows = [r for r in rows if r["open_now"] is True]
        if len(rows) > self.MAX_POINTS or zoom <= 9:
            # server tomonida klasterlash: katak o'lchami masshtabga bog'liq
            cell = 360 / (2 ** zoom) * 0.9
            grid = {}
            for r in rows:
                k2 = (int(r["lat"] // cell), int(r["lng"] // cell))
                g = grid.setdefault(k2, {"lat": 0.0, "lng": 0.0, "count": 0, "fuels": {}})
                g["lat"] += r["lat"]; g["lng"] += r["lng"]; g["count"] += 1
                for f in r["fuels"] or []:
                    g["fuels"][f] = g["fuels"].get(f, 0) + 1
            items = [{"lat": round(g["lat"] / g["count"], 5), "lng": round(g["lng"] / g["count"], 5), "count": g["count"], "fuels": g["fuels"]}
                     for g in grid.values()]
            data = {"mode": "clusters", "items": items, "total": len(rows)}
        else:
            ids = [r["id"] for r in rows]
            st = build_status([type("S", (), {"id": i})() for i in ids])
            items = [{**r, "status": st.get(r["id"], {})} for r in rows]
            data = {"mode": "points", "items": items, "total": len(rows)}
        cache.set(key, data, 60)
        return Response(data)


class AlongRouteView(APIView):
    """Marshrut bo'yidagi shoxobchalar: yo'ldan `buffer_km` ichida, yo'l boshidan masofa bo'yicha tartiblangan.
    Shaharlararo safarda «keyingi metan qayerda» degan savolga javob."""
    permission_classes = [AllowAny]

    def post(self, request):
        pts = request.data.get("points")
        if not isinstance(pts, list) or len(pts) < 2:
            return Response({"detail": "Marshrut nuqtalari yo'q."}, status=400)
        clean = []
        for p in pts[:2000]:
            try:
                la, lo = float(p[0]), float(p[1])
            except (TypeError, ValueError, IndexError, KeyError):
                return Response({"detail": "Marshrut nuqtalari noto'g'ri."}, status=400)
            if not (36.5 <= la <= 46.5 and 55.0 <= lo <= 74.0):
                return Response({"detail": "Marshrut O'zbekiston hududida bo'lishi kerak."}, status=400)
            clean.append((la, lo))
        from .geo import along as along_fn, bbox, prepare, simplify
        line = simplify(clean)
        buf = min(max(fnum(request.data.get("buffer_km")) or 1.5, 0.3), 5.0)
        fuel = str_in(request.data.get("fuel"))
        fuel = fuel if fuel in FUEL_KEYS else None
        s_la, n_la, w_lo, e_lo = bbox(line, buf)
        qs = FuelStation.objects.filter(is_active=True, lat__range=(s_la, n_la), lng__range=(w_lo, e_lo))
        items = [s for s in qs[:20000] if not fuel or fuel in (s.fuels or [])]
        if request.data.get("open_now") in (True, 1, "1", "true"):
            items = [s for s in items if is_open(s.opening_hours, is_24_7=s.is_24_7) is True]
        segs, cum = prepare(line)
        found = []
        for st, al, off in along_fn(segs, items, buf, lambda x: (x.lat, x.lng)):
            st._along, st._off = al, off
            found.append(st)
        found.sort(key=lambda s: s._along)
        found = found[:80]
        st = build_status(found)
        out = []
        for s in found:
            d = serialize_station(s, st.get(s.id), None, None)
            d["along_km"], d["off_km"] = round(s._along, 1), round(s._off, 2)
            out.append(d)
        return Response({"route_km": round(cum, 1), "count": len(out), "results": out})
