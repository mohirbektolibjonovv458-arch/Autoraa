"""Ustalar hikoyalari: joylash, 24 soat, tahrirlash, o'chirish, ko'rildi, xavfsizlik."""
import io
import os
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import User
from masters.models import MasterProfile, Story, StoryView
from masters.stories import purge_expired_stories


def jpeg(color="red"):
    b = io.BytesIO(); Image.new("RGB", (60, 100), color).save(b, "JPEG"); return SimpleUploadedFile("s.jpg", b.getvalue(), "image/jpeg")


class StoryTests(TestCase):
    URL = "/api/masters/stories/"

    def setUp(self):
        cache.clear()
        patch("accounts.utils.tg_call", return_value={"ok": True}).start(); self.addCleanup(patch.stopall)
        self.u1 = User.objects.create_user(phone="+998901000951", first_name="Rustam", role="usta"); self.m1 = MasterProfile.objects.create(user=self.u1)
        self.u2 = User.objects.create_user(phone="+998901000952", first_name="Bekzod", role="usta"); self.m2 = MasterProfile.objects.create(user=self.u2)
        self.a = User.objects.create_user(phone="+998901000953", first_name="Ali", role="user")

    def c(self, u):
        cl = APIClient(); cl.force_authenticate(u); return cl

    def post(self, u, **d):
        return self.c(u).post(self.URL, {"image": jpeg(), **d}, format="multipart")

    def test_only_masters_can_post_and_image_required(self):
        self.assertEqual(self.post(self.a).status_code, 403)
        self.assertEqual(self.c(self.u1).post(self.URL, {"caption": "x"}, format="multipart").status_code, 400)
        bad = SimpleUploadedFile("s.jpg", b"<?php echo 1; ?>", "image/jpeg")
        self.assertEqual(self.c(self.u1).post(self.URL, {"image": bad}, format="multipart").status_code, 400)
        r = self.post(self.u1, caption="Yangi diagnostika uskunasi")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertAlmostEqual((Story.objects.get().expires_at - timezone.now()).total_seconds(), 24 * 3600, delta=60)
        self.assertEqual(APIClient().get(self.URL).status_code, 401)

    def test_feed_grouping_seen_and_order(self):
        self.post(self.u1, caption="1"); self.post(self.u1, caption="2"); s3 = self.post(self.u2, caption="3").data["id"]
        g = self.c(self.a).get(self.URL).data["groups"]
        self.assertEqual(len(g), 2); self.assertEqual(g[0]["name"], "Bekzod")  # eng yangisi oldinda
        self.assertEqual([x["caption"] for x in g[1]["stories"]], ["1", "2"])
        self.assertNotIn("views", g[0]["stories"][0])  # boshqalar ko'rishlar sonini ko'rmaydi
        self.c(self.a).post(f"{self.URL}{s3}/view/"); self.c(self.a).post(f"{self.URL}{s3}/view/")
        self.assertEqual(StoryView.objects.count(), 1)  # bir kishi — bir marta
        g = self.c(self.a).get(self.URL).data["groups"]
        self.assertEqual(g[-1]["name"], "Bekzod"); self.assertTrue(g[-1]["all_seen"])  # ko'rilgan — oxirda
        own = self.c(self.u2).get(self.URL).data
        self.assertTrue(own["can_post"]); self.assertTrue(own["groups"][0]["own"]); self.assertEqual(own["groups"][0]["stories"][0]["views"], 1)
        self.c(self.u2).post(f"{self.URL}{s3}/view/")  # o'zini ko'rish hisoblanmaydi
        self.assertEqual(StoryView.objects.count(), 1)

    def test_24h_expiry_and_purge_removes_file(self):
        sid = self.post(self.u1).data["id"]
        path = Story.objects.get(pk=sid).image.path
        Story.objects.filter(pk=sid).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.c(self.a).get(self.URL).data["groups"], [])
        self.assertEqual(self.c(self.a).post(f"{self.URL}{sid}/view/").status_code, 404)
        self.assertEqual(self.c(self.u1).patch(f"{self.URL}{sid}/", {"caption": "x"}, format="json").status_code, 404)
        self.assertEqual(purge_expired_stories(), 1)
        self.assertFalse(Story.objects.exists()); self.assertFalse(os.path.exists(path))

    def test_edit_and_delete_own_only(self):
        sid = self.post(self.u1, caption="eski").data["id"]
        exp = Story.objects.get(pk=sid).expires_at
        self.assertEqual(self.c(self.u2).patch(f"{self.URL}{sid}/", {"caption": "buzdim"}, format="json").status_code, 403)
        self.assertEqual(self.c(self.a).delete(f"{self.URL}{sid}/").status_code, 403)
        r = self.c(self.u1).patch(f"{self.URL}{sid}/", {"caption": "yangi matn"}, format="json")
        self.assertEqual((r.status_code, r.data["caption"], r.data["edited"]), (200, "yangi matn", True))
        old = Story.objects.get(pk=sid).image.path
        r = self.c(self.u1).patch(f"{self.URL}{sid}/", {"image": jpeg("blue")}, format="multipart")
        self.assertEqual(r.status_code, 200)
        s = Story.objects.get(pk=sid)
        self.assertNotEqual(s.image.path, old); self.assertFalse(os.path.exists(old))  # eski rasm o'chirildi
        self.assertEqual(s.expires_at, exp)  # tahrir muddatni uzaytirmaydi
        self.assertEqual(self.c(self.u1).patch(f"{self.URL}{sid}/", {"caption": "x" * 201}, format="json").status_code, 400)
        path = s.image.path
        self.assertEqual(self.c(self.u1).delete(f"{self.URL}{sid}/").status_code, 204)
        self.assertFalse(Story.objects.exists()); self.assertFalse(os.path.exists(path))

    def test_admin_can_moderate_and_limit(self):
        sid = self.post(self.u1).data["id"]
        admin = User.objects.create_superuser("+998901000959", "Kuchli-Parol-2026")
        self.assertEqual(self.c(admin).delete(f"{self.URL}{sid}/").status_code, 204)
        for _ in range(Story.MAX_ACTIVE):
            self.assertEqual(self.post(self.u1).status_code, 201)
        self.assertEqual(self.post(self.u1).status_code, 400)

    def test_blocked_master_hidden(self):
        self.post(self.u1)
        self.u1.is_active = False; self.u1.save()
        self.assertEqual(self.c(self.a).get(self.URL).data["groups"], [])
