"""Bron qulayliklari: xizmatsiz bron, vaqtni o'zgartirish, bekor qilish sababi."""
from datetime import date, timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from core.models import Notification
from masters.models import Booking, MasterProfile, Service


class BookingUXTests(TestCase):
    def setUp(self):
        cache.clear()
        patch("accounts.utils.tg_call", return_value={"ok": True}).start()
        self.addCleanup(patch.stopall)
        self.cl = User.objects.create_user(phone="+998901000801", role="user", first_name="Ali")
        self.u = User.objects.create_user(phone="+998901000802", role="usta", first_name="Usta")
        self.m = MasterProfile.objects.create(user=self.u, work_hours="09:00 - 18:00", address="Chilonzor")
        self.day = str(date.today() + timedelta(days=1))

    def c(self, u):
        c = APIClient(); c.force_authenticate(u); return c

    def test_booking_without_services(self):
        r = self.c(self.cl).post("/api/masters/bookings/", {"master": self.m.id, "date": self.day, "time": "10:00"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual((r.data["service_name"], r.data["price"]), ("Ko'rik va maslahat", 0))

    def test_wrong_service_id_rejected(self):
        other = Service.objects.create(master=MasterProfile.objects.create(user=User.objects.create_user(phone="+998901000803", role="usta")), name="X", category="motor", price=5)
        r = self.c(self.cl).post("/api/masters/bookings/", {"master": self.m.id, "service": other.id, "date": self.day, "time": "10:00"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_reschedule_both_sides(self):
        bid = self.c(self.cl).post("/api/masters/bookings/", {"master": self.m.id, "date": self.day, "time": "10:00"}, format="json").data["id"]
        self.c(self.u).post(f"/api/masters/bookings/{bid}/status/", {"status": "confirmed"}, format="json")
        r = self.c(self.cl).post(f"/api/masters/bookings/{bid}/reschedule/", {"date": self.day, "time": "11:00"}, format="json")
        self.assertEqual(r.status_code, 200)
        b = Booking.objects.get(pk=bid)
        self.assertEqual((b.time, b.status), ("11:00", "pending"))  # mijoz o'zgartirdi — usta qayta tasdiqlaydi
        self.assertTrue(Notification.objects.filter(user=self.u, title__icontains="vaqtini o'zgartirdi").exists())
        self.assertEqual(self.c(self.u).post(f"/api/masters/bookings/{bid}/reschedule/", {"date": self.day, "time": "20:00"}, format="json").status_code, 400)  # ish vaqtidan tashqari
        self.assertEqual(self.c(self.u).post(f"/api/masters/bookings/{bid}/reschedule/", {"date": self.day, "time": "12:00"}, format="json").status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.cl, title__icontains="Usta bron vaqtini").exists())
        stranger = User.objects.create_user(phone="+998901000809", role="user")
        self.assertEqual(self.c(stranger).post(f"/api/masters/bookings/{bid}/reschedule/", {"date": self.day, "time": "13:00"}, format="json").status_code, 403)

    def test_reschedule_to_busy_slot_rejected(self):
        a = self.c(self.cl).post("/api/masters/bookings/", {"master": self.m.id, "date": self.day, "time": "10:00"}, format="json").data["id"]
        other = User.objects.create_user(phone="+998901000804", role="user")
        self.c(other).post("/api/masters/bookings/", {"master": self.m.id, "date": self.day, "time": "11:00"}, format="json")
        r = self.c(self.cl).post(f"/api/masters/bookings/{a}/reschedule/", {"date": self.day, "time": "11:00"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_cancel_reason_reaches_client(self):
        bid = self.c(self.cl).post("/api/masters/bookings/", {"master": self.m.id, "date": self.day, "time": "10:00"}, format="json").data["id"]
        self.c(self.u).post(f"/api/masters/bookings/{bid}/status/", {"status": "cancelled", "reason": "Kasal bo'lib qoldim"}, format="json")
        n = Notification.objects.filter(user=self.cl, title__icontains="rad etildi").first()
        self.assertIn("Kasal bo'lib qoldim", n.body)
