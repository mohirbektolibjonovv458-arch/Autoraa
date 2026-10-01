from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from accounts.models import User
from core.geo import Polyline
from core.params import float_param, int_param, str_in
from core.routing import RouteError, fetch_route
from fuel.models import FuelStation
from garage.models import Vehicle
from masters.models import MasterProfile

from .assistant import progress_messages, save_messages, start_messages
from .models import Trip, TripSettings

UZ = (36.5, 55.0, 46.5, 74.0)
SKIP = "(o'tkazib yuborildi)"


class ProgressThrottle(UserRateThrottle):
    scope = "trip_progress"


def point(d):
    """{lat, lng, name} ni tekshiradi — O'zbekiston hududida bo'lmagan yoki noto'g'ri nuqta qabul qilinmaydi."""
    if not isinstance(d, dict):
        return None
    lat, lng = float_param(d.get("lat"), None, UZ[0], UZ[2]), float_param(d.get("lng"), None, UZ[1], UZ[3])
    if lat is None or lng is None:
        return None
    return {"lat": round(lat, 6), "lng": round(lng, 6), "name": str_in(d.get("name"))[:120] or f"{lat:.4f}, {lng:.4f}"}


def settings_for(user):
    return TripSettings.objects.get_or_create(user=user)[0]


def settings_data(st):
    return {"enabled": st.enabled, "voice": st.voice, "fuel_alerts": st.fuel_alerts, "safety_alerts": st.safety_alerts,
            "periodic": st.periodic, "interval_min": st.interval_min}


def ru(request):
    return getattr(request.user, "lang", "uz") == "ru"


def elapsed_min(trip):
    return int(((trip.ended_at or timezone.now()) - trip.started_at).total_seconds() // 60)


def dashboard(trip, pos_km, off_km=None):
    """Safar holati: qolgan masofa, taxminiy vaqt, har turdagi keyingi shoxobcha, yaqin servis."""
    remaining = max(0.0, trip.distance_km - pos_km)
    speed = trip.distance_km / trip.duration_min if trip.duration_min else 1.0  # km/daqiqa — marshrut xizmati bahosi
    ahead = [s for s in trip.stations if s["along_km"] > pos_km + 0.05]
    nxt = {}
    for f in ("metan", "propan", "benzin", "dizel", "elektr"):
        s = next((x for x in ahead if f in x.get("fuels", [])), None)
        nxt[f] = {"id": s["id"], "name": s["name"], "km": round(s["along_km"] - pos_km, 1)} if s else None
    any_fuel = ahead[0] if ahead else None
    svc = [x for x in trip.services if x["along_km"] > pos_km - 1]
    usta = next((x for x in svc if x["kind"] == "usta"), None)
    evak = next((x for x in svc if x["kind"] == "evakuator"), None)
    return {
        "progress_km": round(pos_km, 1), "remaining_km": round(remaining, 1),
        "eta_min": int(round(remaining / speed)) if speed else None,
        "percent": int(min(100, pos_km / trip.distance_km * 100)) if trip.distance_km else 0,
        "off_route": bool(off_km is not None and off_km > 2.0), "off_km": round(off_km, 2) if off_km is not None else None,
        "next": nxt, "next_fuel": {"id": any_fuel["id"], "name": any_fuel["name"], "km": round(any_fuel["along_km"] - pos_km, 1), "fuels": any_fuel["fuels"]} if any_fuel else None,
        "next_service": {**usta, "km": round(max(0, usta["along_km"] - pos_km), 1)} if usta else None,
        "next_evak": {**evak, "km": round(max(0, evak["along_km"] - pos_km), 1)} if evak else None,
        "elapsed_min": elapsed_min(trip),
    }


def trip_data(trip, full=True):
    d = {"id": trip.id, "status": trip.status, "fuel": trip.fuel, "start": {"name": trip.start_name, "lat": trip.start_lat, "lng": trip.start_lng},
         "dest": {"name": trip.dest_name, "lat": trip.dest_lat, "lng": trip.dest_lng}, "distance_km": trip.distance_km,
         "duration_min": trip.duration_min, "started_at": trip.started_at, "ended_at": trip.ended_at, "fuel_stops": trip.fuel_stops,
         "progress_km": round(trip.progress_km, 1), "elapsed_min": elapsed_min(trip),
         "vehicle": {"id": trip.vehicle_id, "title": f"{trip.vehicle.brand} {trip.vehicle.model}".strip()} if trip.vehicle_id else None,
         "notifications_count": trip.notifications.exclude(message=SKIP).count()}
    if full:
        d.update({"route": trip.route, "stations": trip.stations, "services": trip.services,
                  "notifications": [{"id": n.id, "kind": n.kind, "message": n.message, "trigger_km": n.trigger_km, "created_at": n.created_at}
                                    for n in trip.notifications.exclude(message=SKIP)]})
    return d


class TripSettingsView(APIView):
    def get(self, request):
        return Response(settings_data(settings_for(request.user)))

    def put(self, request):
        st = settings_for(request.user)
        d = request.data if isinstance(request.data, dict) else {}
        for k in ("enabled", "voice", "fuel_alerts", "safety_alerts", "periodic"):
            if k in d:
                setattr(st, k, d[k] in (True, 1, "1", "true"))
        if "interval_min" in d:
            st.interval_min = int_param(d["interval_min"], 20, 10, 60)
        st.save()
        return Response(settings_data(st))

    patch = put


class TripListCreateView(APIView):
    def get(self, request):
        qs = Trip.objects.filter(user=request.user).exclude(status="active").select_related("vehicle")[:30]
        return Response([trip_data(t, full=False) for t in qs])

    def post(self, request):
        u = request.user
        active = Trip.objects.filter(user=u, status="active").first()
        if active:
            return Response({"detail": "Sizda davom etayotgan safar bor.", "trip_id": active.id}, status=409)
        d = request.data if isinstance(request.data, dict) else {}
        a, b = point(d.get("start")), point(d.get("dest"))
        if not a or not b:
            return Response({"detail": "Boshlanish va manzil nuqtasini tanlang (O'zbekiston hududida)."}, status=400)
        vehicle = None
        if d.get("vehicle"):
            vehicle = Vehicle.objects.filter(pk=int_param(d.get("vehicle"), 0), owner=u).first()
            if not vehicle:
                return Response({"detail": "Avtomobil topilmadi."}, status=404)
        fuel = str_in(d.get("fuel")) or (vehicle.fuel_type if vehicle and vehicle.fuel_type else "")
        if fuel not in dict(Trip.FUELS):
            return Response({"detail": "Avtomobilingiz yoqilg'i turini tanlang."}, status=400)
        try:
            route = fetch_route((a["lat"], a["lng"]), (b["lat"], b["lng"]))
        except RouteError as e:
            return Response({"detail": str(e)}, status=e.status)
        line = Polyline(route["points"])
        if line.total_km < 0.3:
            return Response({"detail": "Boshlanish va manzil juda yaqin."}, status=400)
        # yo'l bo'yidagi haqiqiy shoxobchalar (2 km ichida)
        s_, w_, n_, e_ = line.expanded_bbox(2.0)
        stations = []
        for s in FuelStation.objects.filter(is_active=True, lat__range=(s_, n_), lng__range=(w_, e_))[:30000]:
            along, off = line.project(s.lat, s.lng)
            if off <= 2.0:
                stations.append({"id": s.id, "name": s.name, "lat": s.lat, "lng": s.lng, "fuels": s.fuels or [], "along_km": round(along, 2),
                                 "off_km": round(off, 2), "is_24_7": s.is_24_7, "opening_hours": s.opening_hours})
        stations.sort(key=lambda x: x["along_km"])
        # yo'l bo'yidagi ustalar (3 km) va evakuatorlar (15 km)
        services = []
        s2, w2, n2, e2 = line.expanded_bbox(15.0)
        for m in MasterProfile.objects.filter(user__is_active=True, user__lat__range=(s2, n2), user__lng__range=(w2, e2)).select_related("user")[:3000]:
            along, off = line.project(m.user.lat, m.user.lng)
            if off <= 3.0:
                services.append({"kind": "usta", "id": m.id, "name": m.title or m.user.full_name, "lat": round(m.user.lat, 3), "lng": round(m.user.lng, 3),
                                 "along_km": round(along, 2), "off_km": round(off, 2), "rating": m.rating})
        for ev in User.objects.filter(role="evakuator", is_active=True, lat__range=(s2, n2), lng__range=(w2, e2))[:2000]:
            along, off = line.project(ev.lat, ev.lng)
            if off <= 15.0:
                services.append({"kind": "evakuator", "id": ev.id, "name": ev.first_name or "Evakuator", "lat": round(ev.lat, 3), "lng": round(ev.lng, 3),
                                 "along_km": round(along, 2), "off_km": round(off, 2)})
        services.sort(key=lambda x: x["along_km"])
        trip = Trip.objects.create(user=u, vehicle=vehicle, fuel=fuel, start_name=a["name"], start_lat=a["lat"], start_lng=a["lng"],
                                   dest_name=b["name"], dest_lat=b["lat"], dest_lng=b["lng"], route=route["points"], stations=stations,
                                   services=services, distance_km=round(line.total_km, 1), duration_min=route["duration_min"],
                                   last_lat=a["lat"], last_lng=a["lng"], last_seen=timezone.now())
        if vehicle and not vehicle.fuel_type:
            vehicle.fuel_type = fuel
            vehicle.save(update_fields=["fuel_type"])
        st = settings_for(u)
        said = save_messages(trip, st, start_messages(trip, st, ru(request)), 0)
        out = trip_data(trip)
        out.update({"dashboard": dashboard(trip, 0.0, 0.0), "said": said, "settings": settings_data(st), "steps": route["steps"],
                    "provider": route["provider"]})
        return Response(out, status=201)


class TripActiveView(APIView):
    def get(self, request):
        t = Trip.objects.filter(user=request.user, status="active").select_related("vehicle").first()
        if not t:
            return Response(None)
        out = trip_data(t)
        out.update({"dashboard": dashboard(t, t.progress_km), "settings": settings_data(settings_for(request.user))})
        return Response(out)


class TripDetailView(APIView):
    def get(self, request, pk):
        t = get_object_or_404(Trip.objects.select_related("vehicle"), pk=pk, user=request.user)
        return Response(trip_data(t))


class TripProgressView(APIView):
    """Joriy nuqta (faqat foydalanuvchi ruxsat berganda brauzer yuboradi). Iz saqlanmaydi — faqat oxirgi nuqta."""
    throttle_classes = [ProgressThrottle]

    def post(self, request, pk):
        t = get_object_or_404(Trip, pk=pk, user=request.user)
        if t.status != "active":
            return Response({"detail": "Safar yakunlangan."}, status=400)
        p = point(request.data if isinstance(request.data, dict) else {})
        if not p:
            return Response({"detail": "Joylashuv noto'g'ri."}, status=400)
        acc = float_param(request.data.get("accuracy"), None, 0, 100000)
        line = Polyline(t.route)
        along, off = line.project(p["lat"], p["lng"])
        # aniqligi past (>300 m) yoki yo'ldan uzoq nuqta safar holatini orqaga surmaydi
        if (acc is None or acc <= 300) and off <= 2.0:
            t.progress_km = max(t.progress_km, along)
        t.last_lat, t.last_lng, t.last_seen = p["lat"], p["lng"], timezone.now()
        t.save(update_fields=["progress_km", "last_lat", "last_lng", "last_seen"])
        st = settings_for(request.user)
        em = elapsed_min(t)
        said = save_messages(t, st, progress_messages(t, st, t.progress_km, em, ru(request)), em)
        return Response({"dashboard": dashboard(t, t.progress_km, off), "said": said})


class TripFuelStopView(APIView):
    def post(self, request, pk):
        t = get_object_or_404(Trip, pk=pk, user=request.user, status="active")
        Trip.objects.filter(pk=t.pk).update(fuel_stops=t.fuel_stops + 1)
        return Response({"fuel_stops": t.fuel_stops + 1})


class TripFinishView(APIView):
    def post(self, request, pk):
        t = get_object_or_404(Trip, pk=pk, user=request.user)
        if t.status == "active":
            t.status = "cancelled" if request.data.get("cancel") in (True, "1", 1) else "finished"
            t.ended_at = timezone.now()
            t.last_lat = t.last_lng = None  # maxfiylik: oxirgi joylashuv o'chiriladi
            t.save(update_fields=["status", "ended_at", "last_lat", "last_lng"])
        return Response({**trip_data(t, full=False), "summary": {
            "start": t.start_name, "dest": t.dest_name, "distance_km": t.distance_km, "travelled_km": round(t.progress_km, 1),
            "duration_min": elapsed_min(t), "fuel_stops": t.fuel_stops,
            "notifications": t.notifications.exclude(message=SKIP).count()}})
