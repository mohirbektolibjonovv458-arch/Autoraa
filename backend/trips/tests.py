"""SAFAR: marshrut, yo'l bo'yi shoxobchalar, AI eslatmalari (masofa/vaqt/dedup), sozlamalar, maxfiylik, egalik."""
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from fuel.models import FuelStation
from garage.models import Vehicle

from .models import Trip, TripNotification

A, B = (41.3111, 69.2797), (39.6542, 66.9597)   # Toshkent → Samarqand (to'g'ri chiziq ~ 270 km)
LINE = [[A[0] + (B[0] - A[0]) * i / 100, A[1] + (B[1] - A[1]) * i / 100] for i in range(101)]
OSRM = {"code": "Ok", "routes": [{"distance": 270000, "duration": 3 * 3600 + 600, "geometry": {"coordinates": [[p[1], p[0]] for p in LINE]},
        "legs": [{"steps": [{"distance": 0, "name": "", "maneuver": {"type": "depart"}}]}]}]}
def at(i):  # i-nuqta ~ i*2.7 km (kasr qiymat ham mumkin)
    k = min(int(i), 99); f = i - k
    return [LINE[k][0] + (LINE[k + 1][0] - LINE[k][0]) * f, LINE[k][1] + (LINE[k + 1][1] - LINE[k][1]) * f]


class TripTests(TestCase):
    def setUp(self):
        cache.clear()
        self.u = User.objects.create_user(phone="+998901001001", first_name="Ali")
        self.car = Vehicle.objects.create(owner=self.u, brand="Chevrolet", model="Cobalt", fuel_type="metan")
        # haqiqiy shoxobchalar yo'l bo'yida: metan ~ 40 km (i=15) va ~ 135 km (i=50); benzin ~ 54 km; uzoqda — hisobga olinmaydi
        self.m1 = FuelStation.objects.create(name="Chinoz AGNKS", lat=at(15)[0], lng=at(15)[1] + 0.005, fuels=["metan"])
        self.m2 = FuelStation.objects.create(name="Jizzax AGNKS", lat=at(50)[0], lng=at(50)[1], fuels=["metan"])
        self.b1 = FuelStation.objects.create(name="Yo'l AZS", lat=at(20)[0], lng=at(20)[1], fuels=["benzin"])
        FuelStation.objects.create(name="Uzoq", lat=42.2, lng=68.0, fuels=["metan"])
        self.c = APIClient(); self.c.force_authenticate(self.u)
        p = patch("core.routing.requests.get", return_value=MagicMock(ok=True, json=lambda: OSRM)); p.start(); self.addCleanup(p.stop)

    def start(self, **kw):
        body = {"start": {"lat": A[0], "lng": A[1], "name": "Toshkent"}, "dest": {"lat": B[0], "lng": B[1], "name": "Samarqand"}, "vehicle": self.car.id, **kw}
        return self.c.post("/api/trips/", body, format="json")

    def go(self, tid, i, **kw):
        return self.c.post(f"/api/trips/{tid}/progress/", {"lat": at(i)[0], "lng": at(i)[1], "accuracy": 20, **kw}, format="json")

    def test_create_uses_real_route_stations_and_car_fuel(self):
        r = self.start()
        self.assertEqual(r.status_code, 201)
        d = r.data
        self.assertEqual(d["fuel"], "metan")                        # avtomobildan
        self.assertEqual([s["name"] for s in d["stations"]], ["Chinoz AGNKS", "Yo'l AZS", "Jizzax AGNKS"])
        self.assertAlmostEqual(d["dashboard"]["next"]["metan"]["km"], 40.5, delta=2)
        self.assertIn("Safaringiz boshlandi", d["said"][0]["message"])
        self.assertTrue(any(s["speak"] for s in d["said"]))
        # 40 km dan keyingi metan va undan keyin ~95 km bo'shliq → ogohlantirish
        self.assertTrue(TripNotification.objects.filter(kind="gap").exists())
        self.assertEqual(self.start().status_code, 409)             # bitta faol safar

    def test_distance_alerts_once_and_only_most_important_spoken(self):
        tid = self.start().data["id"]
        r = self.go(tid, 12)                                         # ~8 km qoldi → «10 km» bosqichi
        texts = [s["message"] for s in r.data["said"]]
        self.assertTrue(any("metan shoxobchasi" in t for t in texts))
        self.assertEqual(sum(s["speak"] for s in r.data["said"]), 1)
        self.assertEqual(self.go(tid, 12).data["said"], [])          # takror yo'q
        r = self.go(tid, 14.4)                                       # ~1.6 km
        self.assertTrue(any("kilometrdan keyin metan" in s["message"] for s in r.data["said"]), r.data["said"])
        self.assertEqual(self.go(tid, 14.4).data["said"], [])

    def test_periodic_safety_suppressed_after_recent_message(self):
        tid = self.start().data["id"]
        Trip.objects.filter(pk=tid).update(started_at=timezone.now() - timedelta(minutes=21))
        r = self.go(tid, 3)                                          # yaqinda «boshlandi» aytilgan — davriy eslatma kerak emas
        self.assertFalse(any(s["kind"] == "safety" for s in r.data["said"]))
        TripNotification.objects.filter(trip_id=tid).update(created_at=timezone.now() - timedelta(minutes=30))
        r = self.go(tid, 4)
        self.assertTrue(any("daqiqadan beri yo'ldasiz" in s["message"] for s in r.data["said"]))

    def test_settings_respected(self):
        self.c.put("/api/trips/settings/", {"voice": False, "fuel_alerts": False}, format="json")
        tid = self.start().data["id"]
        r = self.go(tid, 13)
        self.assertFalse(any(s["kind"] in ("fuel", "gap") for s in r.data["said"]))
        self.c.put("/api/trips/settings/", {"enabled": False}, format="json")
        self.assertEqual(self.go(tid, 49).data["said"], [])

    def test_privacy_ownership_and_validation(self):
        tid = self.start().data["id"]
        other = User.objects.create_user(phone="+998901001002"); oc = APIClient(); oc.force_authenticate(other)
        self.assertEqual(oc.get(f"/api/trips/{tid}/").status_code, 404)
        self.assertEqual(oc.post(f"/api/trips/{tid}/progress/", {"lat": A[0], "lng": A[1]}, format="json").status_code, 404)
        self.assertEqual(oc.post(f"/api/trips/{tid}/finish/").status_code, 404)
        self.assertEqual(APIClient().get("/api/trips/active/").status_code, 401)
        self.assertEqual(self.c.post(f"/api/trips/{tid}/progress/", {"lat": 55.7, "lng": 37.6}, format="json").status_code, 400)  # UZ tashqarisi
        self.assertEqual(self.c.post(f"/api/trips/{tid}/progress/", {"lat": "nan", "lng": "x"}, format="json").status_code, 400)
        self.go(tid, 30)
        r = self.c.post(f"/api/trips/{tid}/finish/")
        self.assertEqual(r.data["status"], "finished")
        t = Trip.objects.get(pk=tid)
        self.assertIsNone(t.last_lat)                                 # oxirgi joylashuv o'chirildi
        self.assertAlmostEqual(r.data["summary"]["travelled_km"], 81, delta=3)
        self.assertEqual(self.c.get("/api/trips/").data[0]["id"], tid)  # tarix

    def test_no_route_and_bad_input(self):
        with patch("core.routing.requests.get", return_value=MagicMock(ok=True, json=lambda: {"code": "NoRoute", "routes": []})):
            self.assertEqual(self.start().status_code, 404)
        self.assertEqual(self.c.post("/api/trips/", {"start": {"lat": 1, "lng": 1}, "dest": {"lat": B[0], "lng": B[1]}}, format="json").status_code, 400)
        self.assertEqual(self.c.post("/api/trips/", {"start": "x", "dest": [1]}, format="json").status_code, 400)


class StartNoRepeatTests(TripTests):
    def test_start_info_not_repeated_by_first_gps_fix(self):
        tid = self.start().data["id"]                                 # «keyingi metan 40 km» start xabarida aytildi
        r = self.go(tid, 0)
        self.assertFalse(any(s["kind"] == "fuel" for s in r.data["said"]))
