"""Chat: tahrirlash, o'chirish (ikkala tomonda), ovozli xabar, o'zgarishlarni sinxronlash va xavfsizlik."""
import os
import time
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from chat.models import Conversation, Message

WEBM = b"\x1aE\xdf\xa3" + b"\x00" * 200  # WebM/Opus sarlavhasi (Chrome, Android)
M4A = b"\x00\x00\x00\x18ftypM4A " + b"\x00" * 200  # iPhone (Safari) yozuvi


class ChatTests(TestCase):
    def setUp(self):
        cache.clear()
        patch("accounts.utils.tg_call", return_value={"ok": True}).start()
        patch("core.push.wake_worker").start()
        self.addCleanup(patch.stopall)
        self.a = User.objects.create_user(phone="+998901000901", first_name="Ali", role="user")
        self.u = User.objects.create_user(phone="+998901000902", first_name="Usta", role="usta")
        self.x = User.objects.create_user(phone="+998901000903", first_name="Begona", role="user")
        self.conv = Conversation.objects.create(user1=self.a, user2=self.u)

    def c(self, user):
        cl = APIClient(); cl.force_authenticate(user); return cl

    def url(self, mid=None):
        return f"/api/chat/{self.conv.id}/messages/" + (f"{mid}/" if mid else "")

    def send(self, user, **data):
        return self.c(user).post(self.url(), data, format="multipart" if any(hasattr(v, "read") for v in data.values()) else "json")

    def test_edit_own_message(self):
        mid = self.send(self.a, text="Salom").data["id"]
        r = self.c(self.a).patch(self.url(mid), {"text": "Assalomu alaykum"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.data["text"], r.data["edited"]), ("Assalomu alaykum", True))
        # bo'sh matn va juda uzun matn — rad
        self.assertEqual(self.c(self.a).patch(self.url(mid), {"text": "  "}, format="json").status_code, 400)
        self.assertEqual(self.c(self.a).patch(self.url(mid), {"text": "x" * 2001}, format="json").status_code, 400)

    def test_cannot_touch_others_messages(self):
        mid = self.send(self.a, text="Mening xabarim").data["id"]
        self.assertEqual(self.c(self.u).patch(self.url(mid), {"text": "buzdim"}, format="json").status_code, 403)
        self.assertEqual(self.c(self.u).delete(self.url(mid)).status_code, 403)
        self.assertEqual(self.c(self.x).patch(self.url(mid), {"text": "buzdim"}, format="json").status_code, 404)  # suhbat a'zosi emas
        self.assertEqual(self.c(self.x).delete(self.url(mid)).status_code, 404)
        self.assertEqual(Message.objects.get(pk=mid).text, "Mening xabarim")

    def test_edit_window(self):
        mid = self.send(self.a, text="eski").data["id"]
        Message.objects.filter(pk=mid).update(created_at=timezone.now() - timedelta(hours=49))
        self.assertEqual(self.c(self.a).patch(self.url(mid), {"text": "yangi"}, format="json").status_code, 400)
        self.assertEqual(self.c(self.a).delete(self.url(mid)).status_code, 200)  # o'chirish — istalgan vaqtda

    def test_delete_removes_content_and_files_for_both(self):
        r = self.send(self.a, audio=SimpleUploadedFile("v.webm", WEBM, "audio/webm"), duration="7")
        mid = r.data["id"]
        path = Message.objects.get(pk=mid).audio.path
        self.assertTrue(os.path.exists(path))
        r = self.c(self.a).delete(self.url(mid))
        self.assertTrue(r.data["deleted"]); self.assertIsNone(r.data["audio"])
        self.assertFalse(os.path.exists(path))  # fayl diskdan o'chirildi
        msgs = self.c(self.u).get(self.url()).data["messages"]
        m = next(x for x in msgs if x["id"] == mid)
        self.assertTrue(m["deleted"]); self.assertEqual(m["text"], ""); self.assertIsNone(m["audio"])
        lst = self.c(self.u).get("/api/chat/").data
        self.assertEqual(lst[0]["last_message"], "🚫 Xabar o'chirildi")
        self.assertEqual(self.c(self.a).patch(self.url(mid), {"text": "qaytar"}, format="json").status_code, 400)

    def test_voice_message_formats_and_private_url(self):
        r = self.send(self.a, audio=SimpleUploadedFile("voice.webm", WEBM, "audio/webm"), duration="12.4")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["audio_duration"], 12)
        url = r.data["audio"]
        self.assertTrue(url.startswith("/api/chat/audio/"))
        resp = APIClient().get(url)
        self.assertEqual(resp.status_code, 200); self.assertEqual(resp["Content-Type"], "audio/webm")
        self.assertEqual(b"".join(resp.streaming_content)[:4], WEBM[:4])
        self.assertEqual(APIClient().get(url.split("?")[0]).status_code, 404)  # imzosiz — yo'q
        self.assertEqual(APIClient().get(url + "x").status_code, 404)
        # iPhone (m4a) ham qabul qilinadi; kengaytma haqiqiy formatga qarab
        r = self.send(self.u, audio=SimpleUploadedFile("rec.webm", M4A, "audio/webm"), duration="3")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(Message.objects.get(pk=r.data["id"]).audio.name.endswith(".m4a"))
        self.assertEqual(APIClient().get(r.data["audio"])["Content-Type"], "audio/mp4")
        self.assertEqual(self.c(self.u).get("/api/chat/").data[0]["last_message"], "🎤 Ovozli xabar")

    def test_voice_rejects_fake_and_large_files(self):
        for bad in (b"<?php system($_GET['c']); ?>", b"\x89PNG\r\n\x1a\n" + b"0" * 100, b""):
            r = self.send(self.a, audio=SimpleUploadedFile("voice.webm", bad or b"x", "audio/webm"))
            self.assertEqual(r.status_code, 400, bad[:10])
        big = SimpleUploadedFile("voice.webm", WEBM + b"0" * (5 * 1024 * 1024), "audio/webm")
        self.assertEqual(self.send(self.a, audio=big).status_code, 400)
        r = self.send(self.a, audio=SimpleUploadedFile("v.webm", WEBM, "audio/webm"), duration="99999")
        self.assertEqual(r.data["audio_duration"], 180)  # 3 daqiqadan oshmaydi

    def test_sync_returns_edits_deletes_and_read_receipts(self):
        m1 = self.send(self.a, text="birinchi").data["id"]
        m2 = self.send(self.a, text="ikkinchi").data["id"]
        d = self.c(self.a).get(self.url()).data  # yuboruvchi oynasi
        since, after = d["server_time"], d["messages"][-1]["id"]
        time.sleep(0.05)
        self.c(self.u).get(self.url())  # usta o'qidi
        self.c(self.a).patch(self.url(m1), {"text": "birinchi (tuzatildi)"}, format="json")
        self.c(self.a).delete(self.url(m2))
        d = self.c(self.a).get(self.url(), {"after": after, "since": since}).data
        ch = {x["id"]: x for x in d["changed"]}
        self.assertEqual(ch[m1]["text"], "birinchi (tuzatildi)"); self.assertTrue(ch[m1]["is_read"])
        self.assertTrue(ch[m2]["deleted"])
        self.assertEqual(d["messages"], [])

    def test_voice_notification_text(self):
        from core.models import Notification
        self.send(self.a, audio=SimpleUploadedFile("v.webm", WEBM, "audio/webm"))
        n = Notification.objects.get(user=self.u, kind="chat")
        self.assertIn("🎤 Ovozli xabar", n.body); self.assertEqual(n.push_body, "Sizga yangi xabar keldi")

    def test_voice_file_not_public_via_media(self):
        r = self.send(self.a, audio=SimpleUploadedFile("v.webm", WEBM, "audio/webm"))
        name = Message.objects.get(pk=r.data["id"]).audio.name
        self.assertTrue(name.startswith("chat-audio/"))
        self.assertEqual(APIClient().get("/media/" + name).status_code, 404)  # faqat imzoli havola orqali
