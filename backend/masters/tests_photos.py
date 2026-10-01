"""Sharh rasmlari va «oldin/keyin» portfolio."""
import io
from datetime import date, timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import User
from masters.models import Booking, MasterPhoto, MasterProfile


def img(name="a.jpg", gps=False):
    b = io.BytesIO(); im = Image.new("RGB", (60, 40), "red")
    if gps:
        ex = im.getexif(); ex[0x8825] = {1: "N", 2: (41.0, 18.0, 0.0)}; im.save(b, "JPEG", exif=ex)
    else:
        im.save(b, "JPEG")
    return SimpleUploadedFile(name, b.getvalue(), "image/jpeg")


class PhotoTests(TestCase):
    def setUp(self):
        cache.clear()
        patch("accounts.utils.tg_call", return_value={"ok": True}).start()
        self.addCleanup(patch.stopall)
        self.cl = User.objects.create_user(phone="+998901000901", role="user", first_name="Ali", last_name="Valiyev")
        self.u = User.objects.create_user(phone="+998901000902", role="usta", first_name="Usta")
        self.m = MasterProfile.objects.create(user=self.u)

    def c(self, u):
        c = APIClient(); c.force_authenticate(u); return c

    def test_review_with_photos_and_privacy(self):
        b = Booking.objects.create(user=self.cl, master=self.m, service_name="Bo'yoq", date=date.today() - timedelta(days=1), time="10:00", price=1, status="completed")
        r = self.c(self.cl).post(f"/api/masters/bookings/{b.id}/review/", {"rating": 5, "text": "Zo'r", "photos": [img(gps=True), img("b.jpg")]}, format="multipart")
        self.assertEqual(r.status_code, 201)
        d = APIClient().get(f"/api/masters/{self.m.id}/").data["reviews"][0]
        self.assertEqual(len(d["photos"]), 2)
        self.assertEqual(d["user_name"], "Ali V.")           # familiya to'liq ko'rsatilmaydi
        self.assertEqual(d["service"], "Bo'yoq")
        path = self.m.reviews.first().photos.first().image.path
        self.assertEqual(dict(Image.open(path).getexif()), {})  # GPS metama'lumot o'chirilgan

    def test_review_rejects_non_image(self):
        b = Booking.objects.create(user=self.cl, master=self.m, service_name="X", date=date.today() - timedelta(days=1), time="10:00", price=1, status="completed")
        bad = SimpleUploadedFile("x.jpg", b"not an image", "image/jpeg")
        self.assertEqual(self.c(self.cl).post(f"/api/masters/bookings/{b.id}/review/", {"rating": 5, "photos": [bad]}, format="multipart").status_code, 400)

    def test_before_after_portfolio(self):
        r = self.c(self.u).post("/api/masters/me/photos/", {"image": img(), "before": img("b.jpg"), "caption": "Kuzov"}, format="multipart")
        self.assertEqual(r.status_code, 201)
        ph = APIClient().get(f"/api/masters/{self.m.id}/").data["photos"][0]
        self.assertTrue(ph["before"] and ph["image"])
        self.assertEqual(self.c(self.cl).post("/api/masters/me/photos/", {"image": img()}, format="multipart").status_code, 403)
        self.assertEqual(MasterPhoto.objects.count(), 1)
