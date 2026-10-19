"""Baho (mezonlar, teglar, usta javobi, eslatma) va avtoservis sahifasi (tur, qulayliklar, servis rasmlari, xizmat tavsifi)."""
import io
from datetime import date, timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import User
from core.models import Notification
from core.reminders import review_reminders
from masters.models import Booking, MasterProfile, Review, Service


def jpeg(c="red"):
    b = io.BytesIO(); Image.new("RGB", (40, 40), c).save(b, "JPEG"); return SimpleUploadedFile("a.jpg", b.getvalue(), "image/jpeg")


class ServisTests(TestCase):
    def setUp(self):
        cache.clear()
        patch("accounts.utils.tg_call", return_value={"ok": True}).start(); self.addCleanup(patch.stopall)
        self.u = User.objects.create_user(phone="+998901000961", first_name="Rustam", role="usta"); self.m = MasterProfile.objects.create(user=self.u)
        self.a = User.objects.create_user(phone="+998901000962", first_name="Ali", last_name="Valiyev", role="user")
        self.o = User.objects.create_user(phone="+998901000963", first_name="Boshqa", role="usta"); MasterProfile.objects.create(user=self.o)

    def c(self, u):
        cl = APIClient(); cl.force_authenticate(u); return cl

    def booking(self):
        b = Booking.objects.create(user=self.a, master=self.m, service_name="Diagnostika", date=date.today(), time="10:00", status="in_progress")
        r = self.c(self.u).post(f"/api/masters/bookings/{b.id}/status/", {"status": "completed"})
        self.assertEqual(r.status_code, 200); b.refresh_from_db(); self.assertIsNotNone(b.completed_at)
        return b

    def test_review_with_criteria_tags_reply_and_summary(self):
        b = self.booking()
        # yangi bajarilgan ish — «baholang» oynasi uchun
        tr = self.c(self.a).get("/api/masters/bookings/to-review/").data
        self.assertEqual(tr["booking"]["id"], b.id); self.assertIn("Halol narx", tr["tags"])
        r = self.c(self.a).post(f"/api/masters/bookings/{b.id}/review/", {"rating": 5, "quality": 5, "price_fair": 4, "on_time": 5, "politeness": 9,
                                                                         "tags": ["Halol narx", "Sifatli ish", "<script>"], "text": "Zo'r"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["tags"], ["Halol narx", "Sifatli ish"]); self.assertEqual(r.data["politeness"], 5)  # chegaradan oshgani 5 ga
        self.assertIsNone(self.c(self.a).get("/api/masters/bookings/to-review/").data["booking"])
        self.assertEqual(self.c(self.a).post(f"/api/masters/bookings/{b.id}/review/", {"rating": 1}).status_code, 400)  # ikkinchi marta yo'q
        rid = r.data["id"]
        # javob: faqat shu usta
        self.assertEqual(self.c(self.o).post(f"/api/masters/reviews/{rid}/reply/", {"text": "x"}).status_code, 404)
        self.assertEqual(self.c(self.a).post(f"/api/masters/reviews/{rid}/reply/", {"text": "x"}).status_code, 403)
        rr = self.c(self.u).post(f"/api/masters/reviews/{rid}/reply/", {"text": "Rahmat, yana keling!"})
        self.assertEqual(rr.status_code, 200); self.assertTrue(Notification.objects.filter(user=self.a, title__contains="javob").exists())
        d = APIClient().get(f"/api/masters/{self.m.id}/").data
        s = d["rating_summary"]
        self.assertEqual(s["dist"]["5"], 1); self.assertEqual(s["criteria"]["price_fair"]["avg"], 4.0)
        self.assertEqual(dict(s["tags"])["Halol narx"], 1); self.assertEqual(d["reviews"][0]["reply"], "Rahmat, yana keling!")
        self.assertEqual(d["rating"], 5.0)

    def test_review_reminder_once_after_2h(self):
        b = self.booking()
        self.assertEqual(review_reminders(), 0)  # hali 2 soat o'tmagan
        Booking.objects.filter(pk=b.pk).update(completed_at=timezone.now() - timedelta(hours=3))
        self.assertEqual(review_reminders(), 1); self.assertEqual(review_reminders(), 0)
        n = Notification.objects.filter(user=self.a, kind="review").latest("id")
        self.assertIn(f"review=booking-{b.id}", n.link)
        b2 = self.booking(); Review.objects.create(master=self.m, user=self.a, booking=b2, rating=5)
        Booking.objects.filter(pk=b2.pk).update(completed_at=timezone.now() - timedelta(hours=3))
        self.assertEqual(review_reminders(), 0)  # baholangan — eslatma yo'q

    def test_servis_profile_amenities_photos_services(self):
        cl = self.c(self.u)
        r = cl.patch("/api/masters/me/", {"kind": "servis", "staff_count": 6, "amenities": ["wifi", "kafolat", "hack"]}, format="json")
        self.assertEqual(r.status_code, 200, r.data); self.assertEqual(r.data["amenities"], ["wifi", "kafolat"])
        self.assertEqual(cl.patch("/api/masters/me/", {"kind": "bank"}, format="json").status_code, 400)
        self.assertEqual(cl.patch("/api/masters/me/", {"staff_count": 0}, format="json").status_code, 400)
        p = cl.post("/api/masters/me/photos/", {"image": jpeg(), "kind": "place", "before": jpeg("blue")}, format="multipart")
        self.assertEqual(p.status_code, 201); self.assertEqual(p.data["kind"], "place"); self.assertIsNone(p.data["before"])
        s = cl.post("/api/masters/me/services/", {"name": "Motor kapital ta'mir", "category": "motor", "price": 3000000, "price_from": "true",
                                                  "duration": "3 kun", "description": "Porshen, halqa, vkladish", "image": jpeg()}, format="multipart")
        self.assertEqual(s.status_code, 201, s.data); self.assertTrue(s.data["price_from"]); self.assertTrue(s.data["image"])
        e = cl.patch(f"/api/masters/me/services/{s.data['id']}/", {"remove_image": "1", "description": "Yangilandi"}, format="multipart")
        self.assertEqual(e.status_code, 200, e.data); self.assertIsNone(e.data["image"]); self.assertEqual(e.data["description"], "Yangilandi")
        lst = APIClient().get("/api/masters/", {"kind": "servis"}).data
        self.assertEqual([x["id"] for x in lst["results"]], [self.m.id]); self.assertEqual(lst["results"][0]["staff_count"], 6)
        self.assertEqual(APIClient().get("/api/masters/", {"kind": "usta"}).data["count"], 1)
        d = APIClient().get(f"/api/masters/{self.m.id}/").data
        self.assertEqual(d["photos"][0]["kind"], "place"); self.assertEqual(d["services"][0]["description"], "Yangilandi")
        opts = APIClient().get("/api/masters/review-options/").data
        self.assertIn("wifi", opts["amenities"])
