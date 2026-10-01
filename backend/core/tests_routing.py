"""Ilova ichidagi marshrut: validatsiya, provayder javobini qayta ishlash, kesh, xatolar."""
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

OSRM = {"code": "Ok", "routes": [{"distance": 3240.5, "duration": 431.0,
        "geometry": {"coordinates": [[69.24, 41.30], [69.25, 41.305], [69.26, 41.31]]},
        "legs": [{"steps": [{"distance": 0, "name": "Amir Temur", "maneuver": {"type": "depart"}},
                            {"distance": 1200, "name": "Bunyodkor", "maneuver": {"type": "turn", "modifier": "left"}},
                            {"distance": 0, "name": "", "maneuver": {"type": "arrive"}}]}]}]}


class RouteTests(TestCase):
    def setUp(self):
        cache.clear()
        self.c = APIClient()

    def test_route_ok_and_cached(self):
        with patch("core.routing.requests.get", return_value=MagicMock(ok=True, json=lambda: OSRM)) as g:
            r = self.c.get("/api/map/route/", {"from": "41.30,69.24", "to": "41.31,69.26"})
            self.assertEqual(r.status_code, 200)
            self.assertEqual((r.data["distance_km"], r.data["duration_min"]), (3.2, 7))
            self.assertEqual(r.data["points"][0], [41.3, 69.24])  # [lat, lng] tartibida
            self.assertIn("Chapga buriling", r.data["steps"][1]["text"])
            self.c.get("/api/map/route/", {"from": "41.30,69.24", "to": "41.31,69.26"})
            self.assertEqual(g.call_count, 1)  # ikkinchisi keshdan

    def test_validation(self):
        for q in ({"from": "x", "to": "41,69"}, {"from": "55.7,37.6", "to": "41.3,69.2"}, {}):
            self.assertEqual(self.c.get("/api/map/route/", q).status_code, 400)

    def test_provider_down(self):
        with patch("core.routing.requests.get", side_effect=TimeoutError()):
            self.assertEqual(self.c.get("/api/map/route/", {"from": "41.30,69.24", "to": "41.31,69.26"}).status_code, 503)
        with patch("core.routing.requests.get", return_value=MagicMock(ok=True, json=lambda: {"code": "NoRoute", "routes": []})):
            self.assertEqual(self.c.get("/api/map/route/", {"from": "41.30,69.24", "to": "41.40,69.26"}).status_code, 404)
