"""Yoqilg'i xaritasi: OSM import, butun O'zbekiston bo'yicha hudud (bbox) va klaster, yaqinlik, plita proksisi."""
import json
import tempfile
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from .models import FuelImport, FuelStation
from .osm import import_osm, parse

# Test uchun Overpass formatidagi namunaviy javob (har viloyat markazi yaqinida bittadan element).
REGION_POINTS = {
    "Toshkent": (41.2995, 69.2401), "Samarqand": (39.6542, 66.9597), "Buxoro": (39.7747, 64.4286), "Andijon": (40.7821, 72.3442),
    "Fargona": (40.3842, 71.7843), "Namangan": (40.9983, 71.6726), "Qarshi": (38.8606, 65.7891), "Termiz": (37.2242, 67.2783),
    "Jizzax": (40.1158, 67.8422), "Guliston": (40.4897, 68.7842), "Navoiy": (40.0844, 65.3792), "Urganch": (41.55, 60.6333),
    "Nukus": (42.46, 59.6103),
}


def overpass_sample():
    els, i = [], 1
    for name, (lat, lng) in REGION_POINTS.items():
        els.append({"type": "node", "id": i, "lat": lat + 0.01, "lon": lng + 0.01,
                    "tags": {"amenity": "fuel", "name": f"{name} AGNKS", "fuel:cng": "yes", "opening_hours": "24/7", "phone": "+998 71 000 00 00"}}); i += 1
        els.append({"type": "way", "id": i, "center": {"lat": lat - 0.01, "lon": lng - 0.01},
                    "tags": {"amenity": "fuel", "name": f"{name} AZS", "fuel:octane_92": "yes", "fuel:diesel": "yes", "opening_hours": "Mo-Su 07:00-23:00"}}); i += 1
        els.append({"type": "node", "id": i, "lat": lat + 0.02, "lon": lng - 0.02, "tags": {"amenity": "fuel", "name": f"АГЗС {name}"}}); i += 1
    els.append({"type": "node", "id": 999, "lat": 55.75, "lon": 37.62, "tags": {"amenity": "fuel", "name": "Moskva (chegara tashqarisi)"}})
    return {"elements": els}


class ImportTests(TestCase):
    def test_parse_types_hours_phone_and_bounds(self):
        items = parse(overpass_sample())
        self.assertEqual(len(items), 39)  # Moskva chiqarib tashlandi
        agnks = next(x for x in items if x["name"] == "Toshkent AGNKS")
        self.assertEqual((agnks["fuels"], agnks["fuels_confirmed"], agnks["is_24_7"], agnks["phone"]), (["metan"], True, True, "+998 71 000 00 00"))
        azs = next(x for x in items if x["name"] == "Samarqand AZS")
        self.assertEqual((sorted(azs["fuels"]), azs["opening_hours"]), (["benzin", "dizel"], "Mo-Su 07:00-23:00"))
        agzs = next(x for x in items if x["name"] == "АГЗС Nukus")
        self.assertEqual((agzs["fuels"], agzs["fuels_confirmed"]), (["propan"], False))  # nomidan taxmin

    def test_import_from_file_idempotent_and_keeps_user_data(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(overpass_sample(), f)
        self.assertEqual(import_osm(f.name), (39, 0))
        st = FuelStation.objects.get(name="Toshkent AZS")
        st.fuels = st.fuels + ["metan"]; st.save()  # foydalanuvchi belgilagan tur
        self.assertEqual(import_osm(f.name), (0, 39))  # qayta import — dublikat yo'q
        self.assertIn("metan", FuelStation.objects.get(name="Toshkent AZS").fuels)
        self.assertTrue(FuelImport.objects.filter(ok=True).exists())


class MapApiTests(TestCase):
    def setUp(self):
        cache.clear()
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(overpass_sample(), f)
        import_osm(f.name)
        self.c = APIClient()

    def test_every_region_has_stations_in_its_viewport(self):
        for name, (lat, lng) in REGION_POINTS.items():
            r = self.c.get("/api/fuel/map/", {"south": lat - 0.2, "west": lng - 0.3, "north": lat + 0.2, "east": lng + 0.3, "zoom": 12})
            self.assertEqual(r.status_code, 200, name)
            self.assertEqual(r.data["mode"], "points", name)
            self.assertEqual(len(r.data["items"]), 3, name)
            for it in r.data["items"]:  # koordinatalar joyida
                self.assertLess(abs(it["lat"] - lat), 0.05); self.assertLess(abs(it["lng"] - lng), 0.05)

    def test_whole_country_is_clustered_not_dumped(self):
        r = self.c.get("/api/fuel/map/", {"south": 37, "west": 56, "north": 45.6, "east": 73.2, "zoom": 6})
        self.assertEqual(r.data["mode"], "clusters")
        self.assertEqual(sum(c["count"] for c in r.data["items"]), 39)
        self.assertLess(len(r.data["items"]), 39)

    def test_filter_by_type(self):
        lat, lng = REGION_POINTS["Andijon"]
        q = {"south": lat - 0.2, "west": lng - 0.3, "north": lat + 0.2, "east": lng + 0.3, "zoom": 12}
        self.assertEqual(len(self.c.get("/api/fuel/map/", {**q, "fuel": "metan"}).data["items"]), 1)
        self.assertEqual(len(self.c.get("/api/fuel/map/", {**q, "fuel": "propan"}).data["items"]), 1)
        self.assertEqual(len(self.c.get("/api/fuel/map/", {**q, "fuel": "benzin"}).data["items"]), 1)

    def test_nearest_sorted_and_paginated(self):
        lat, lng = REGION_POINTS["Buxoro"]
        r = self.c.get("/api/fuel/stations/", {"lat": lat, "lng": lng, "radius": 30, "limit": 2})
        d = [x["distance_km"] for x in r.data["results"]]
        self.assertEqual(d, sorted(d)); self.assertTrue(r.data["has_more"]); self.assertEqual(r.data["count"], 3)
        r2 = self.c.get("/api/fuel/stations/", {"lat": lat, "lng": lng, "radius": 30, "limit": 2, "offset": r.data["next_offset"]})
        self.assertEqual(len(r2.data["results"]), 1)
        self.assertIn("opening_hours", r.data["results"][0])

    def test_bad_params(self):
        self.assertEqual(self.c.get("/api/fuel/map/", {"south": "x"}).status_code, 400)
        self.assertEqual(self.c.get("/api/fuel/map/", {"south": 50, "west": 1, "north": 60, "east": 2}).data["items"], [])
        self.assertEqual(self.c.get("/api/fuel/stations/", {"lat": "nan", "radius": "abc", "limit": "zz"}).status_code, 200)


class TileProxyTests(TestCase):
    def test_tile_validation_and_cache(self):
        c = APIClient()
        self.assertEqual(c.get("/api/map/tiles/25/1/1.png").status_code, 404)
        self.assertEqual(c.get("/api/map/tiles/3/9/1.png").status_code, 404)
        fake = MagicMock(ok=True, content=b"\x89PNGfake", headers={"Content-Type": "image/png"})
        with tempfile.TemporaryDirectory() as d, self.settings(TILE_CACHE_DIR=d, MAP_TILE_KEY="SECRET123", MAP_TILE_URL="https://t.example/{z}/{x}/{y}.png?key={key}"):
            with patch("core.tiles._session.get", return_value=fake) as g:
                r = c.get("/api/map/tiles/5/20/12.png")
                self.assertEqual(r.status_code, 200)
                self.assertIn("SECRET123", g.call_args[0][0])        # kalit faqat serverdan provayderga
                self.assertNotIn(b"SECRET123", r.content)
                c.get("/api/map/tiles/5/20/12.png")
                self.assertEqual(g.call_count, 1)                  # ikkinchisi diskdagi keshdan


class SatelliteLayerTests(TestCase):
    def test_sat_and_labels_layers(self):
        c = APIClient()
        jpg = MagicMock(ok=True, content=b"\xff\xd8\xffJPEG", headers={"Content-Type": "image/jpeg"})
        with tempfile.TemporaryDirectory() as d, self.settings(TILE_CACHE_DIR=d, SAT_TILE_URL="https://sat.example/{z}/{y}/{x}", SAT_LABELS_URL="https://lab.example/{z}/{y}/{x}"):
            with patch("core.tiles._session.get", return_value=jpg) as g:
                r = c.get("/api/map/sat/15/22000/12000.img")
                self.assertEqual((r.status_code, r["Content-Type"]), (200, "image/jpeg"))
                self.assertEqual(g.call_args[0][0], "https://sat.example/15/12000/22000")  # {z}/{y}/{x} tartibi
                c.get("/api/map/sat/15/22000/12000.img"); self.assertEqual(g.call_count, 1)  # keshdan
                self.assertEqual(c.get("/api/map/labels/15/22000/12000.img").status_code, 200)
        self.assertEqual(c.get("/api/map/foo/1/1/1.img").status_code, 404)
        self.assertEqual(c.get("/api/map/sat/25/1/1.img").status_code, 404)


class AlongRouteAndOpenTests(TestCase):
    def setUp(self):
        cache.clear()
        # Toshkent → Samarqand yo'li bo'ylab (taxminiy to'g'ri chiziq) va chetdagi shoxobchalar
        self.a = FuelStation.objects.create(name="Yo'l bo'yi metan", lat=40.975, lng=68.33, fuels=["metan"], opening_hours="24/7", is_24_7=True)
        self.b = FuelStation.objects.create(name="Yo'l bo'yi benzin", lat=40.48, lng=66.97, fuels=["benzin"], opening_hours="Mo-Su 00:00-00:01")
        self.c = FuelStation.objects.create(name="Uzoqda", lat=41.60, lng=67.00, fuels=["metan"])
        self.pts = [[41.30 - i * 0.0825, 69.24 - i * 0.228] for i in range(21)]  # 41.30,69.24 → 39.65,64.68 atrofi

    def test_along_route_sorted_and_filtered(self):
        c = APIClient()
        r = c.post("/api/fuel/along/", {"points": self.pts, "buffer_km": 5}, format="json")
        self.assertEqual(r.status_code, 200)
        names = [x["name"] for x in r.data["results"]]
        self.assertNotIn("Uzoqda", names)
        self.assertEqual(names[0], "Yo'l bo'yi metan")  # yo'l boshiga yaqinrog'i birinchi
        self.assertTrue(all(x["off_km"] <= 5 for x in r.data["results"]))
        r = c.post("/api/fuel/along/", {"points": self.pts, "buffer_km": 5, "fuel": "metan"}, format="json")
        self.assertEqual([x["name"] for x in r.data["results"]], ["Yo'l bo'yi metan"])
        r = c.post("/api/fuel/along/", {"points": self.pts, "buffer_km": 5, "open_now": True}, format="json")
        self.assertIn("Yo'l bo'yi metan", [x["name"] for x in r.data["results"]])
        self.assertEqual(c.post("/api/fuel/along/", {"points": [[55.7, 37.6], [55.8, 37.7]]}, format="json").status_code, 400)
        self.assertEqual(c.post("/api/fuel/along/", {"points": "x"}, format="json").status_code, 400)

    def test_open_now_field(self):
        r = APIClient().get("/api/fuel/stations/", {"lat": 40.975, "lng": 68.33, "radius": 5})
        self.assertIs(r.data["results"][0]["open_now"], True)

    def test_geocode_proxy(self):
        rows = [{"name": "Samarqand", "display_name": "Samarqand, O'zbekiston", "lat": "39.65", "lon": "66.96"},
                {"name": "Moskva", "display_name": "Moskva", "lat": "55.7", "lon": "37.6"}]
        with patch("core.routing.requests.get", return_value=MagicMock(ok=True, json=lambda: rows)):
            r = APIClient().get("/api/map/geocode/", {"q": "Samarqand"})
        self.assertEqual([x["name"] for x in r.data], ["Samarqand"])  # O'zbekistondan tashqari chiqarib tashlandi
        self.assertEqual(APIClient().get("/api/map/geocode/", {"q": "ab"}).data, [])
