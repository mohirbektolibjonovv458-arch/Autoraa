"""Web Push: obuna xavfsizligi, yetkazish, dublikatlar, yaroqsiz qurilmalar va asosiy hodisalar oqimi."""
import json
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from chat.models import Conversation
from core.models import Notification, PushSubscription, notify
from core.push import process_pending
from core.vapid import generate
from evacuator.models import EvacuatorProfile
from masters.models import MasterProfile, Service

PUB, PRIV = generate()
FCM = "https://fcm.googleapis.com/fcm/send/"


def sub_body(i="abc"):
    return {"endpoint": FCM + i, "keys": {"p256dh": "BNc" + "x" * 80, "auth": "authsecret123"}}


@override_settings(VAPID_PUBLIC_KEY=PUB, VAPID_PRIVATE_KEY=PRIV, VAPID_SUBJECT="mailto:t@avtora.uz")
class PushTests(TestCase):
    def setUp(self):
        cache.clear()
        patch("accounts.utils.tg_call", return_value={"ok": True}).start()
        self.sent = []
        self.wp = patch("pywebpush.webpush", side_effect=lambda **kw: self.sent.append(kw)).start()
        patch("core.push.wake_worker").start()
        patch("core.push.RETRY_PAUSES", (0, 0, 0)).start()
        self.addCleanup(patch.stopall)
        self.a = User.objects.create_user(phone="+998901000301", first_name="Ali", role="user")
        self.b = User.objects.create_user(phone="+998901000302", first_name="Vali", role="user")
        self.u = User.objects.create_user(phone="+998901000303", first_name="Usta", role="usta")
        self.m = MasterProfile.objects.create(user=self.u, work_hours="09:00 - 18:00")
        self.svc = Service.objects.create(master=self.m, name="Diagnostika", category="motor", price=1000)

    def c(self, user):
        c = APIClient(); c.force_authenticate(user); return c

    def subscribe(self, user, i):
        return self.c(user).post("/api/push/subscribe/", sub_body(i), format="json")

    def payloads(self):
        return [json.loads(k["data"]) for k in self.sent]

    # --- obuna xavfsizligi
    def test_public_key_only(self):
        d = APIClient().get("/api/push/key/").data
        self.assertEqual(d["public_key"], PUB); self.assertNotIn(PRIV, json.dumps(d))

    def test_ssrf_and_validation(self):
        c = self.c(self.a)
        for bad in ("http://fcm.googleapis.com/x", "https://127.0.0.1/x", "https://evil.com/fcm.googleapis.com", "https://fcm.googleapis.com.evil.com/x", "file:///etc/passwd"):
            self.assertEqual(c.post("/api/push/subscribe/", {"endpoint": bad, "keys": {"p256dh": "x", "auth": "y"}}, format="json").status_code, 400, bad)
        self.assertEqual(APIClient().post("/api/push/subscribe/", sub_body(), format="json").status_code, 401)
        self.assertEqual(self.subscribe(self.a, "d1").status_code, 201)

    def test_device_moves_to_new_account_and_limits(self):
        self.subscribe(self.a, "shared")
        self.subscribe(self.b, "shared")  # shu qurilmada boshqa odam kirdi
        self.assertEqual(PushSubscription.objects.get(endpoint=FCM + "shared").user, self.b)
        for i in range(12):
            self.subscribe(self.a, f"dev{i}")
        self.assertEqual(self.a.push_subs.count(), 10)

    def test_unsubscribe_only_own(self):
        self.subscribe(self.a, "mine")
        self.assertEqual(self.c(self.b).post("/api/push/unsubscribe/", {"endpoint": FCM + "mine"}, format="json").data["removed"], 0)
        self.assertEqual(self.c(self.a).post("/api/push/unsubscribe/", {"endpoint": FCM + "mine"}, format="json").data["removed"], 1)

    def test_endpoints_never_exposed(self):
        self.subscribe(self.a, "secret-endpoint")
        for url in ("/api/auth/me/", "/api/push/status/", "/api/notifications/"):
            self.assertNotIn("secret-endpoint", json.dumps(self.c(self.a).get(url).data, default=str))

    # --- yetkazish
    def test_delivery_goes_only_to_owner_devices(self):
        self.subscribe(self.a, "a1"); self.subscribe(self.a, "a2"); self.subscribe(self.b, "b1")
        notify(self.a, "Salom", "Test", "system", "/app/notifications")
        process_pending()
        self.assertEqual(sorted(k["subscription_info"]["endpoint"] for k in self.sent), [FCM + "a1", FCM + "a2"])
        self.assertEqual(Notification.objects.get(user=self.a).push_state, "sent")

    def test_no_device_no_push_request(self):
        notify(self.a, "Salom")
        process_pending()
        self.assertEqual(self.sent, []); self.assertEqual(Notification.objects.get().push_state, "none")

    def test_dedup(self):
        self.subscribe(self.a, "a1")
        notify(self.a, "SOS", dedup="sos-1-new"); notify(self.a, "SOS", dedup="sos-1-new")
        process_pending()
        self.assertEqual(Notification.objects.count(), 1); self.assertEqual(len(self.sent), 1)

    def test_invalid_tokens_cleaned(self):
        from pywebpush import WebPushException
        self.subscribe(self.a, "gone"); self.subscribe(self.a, "flaky")

        def fake(**kw):
            ep = kw["subscription_info"]["endpoint"]
            raise WebPushException("x", response=MagicMock(status_code=410 if ep.endswith("gone") else 500))
        self.wp.side_effect = fake
        for _ in range(5):
            notify(self.a, "t"); process_pending()
        self.assertFalse(PushSubscription.objects.filter(endpoint=FCM + "gone").exists())
        self.assertFalse(PushSubscription.objects.get(endpoint=FCM + "flaky").is_active)

    def test_blocked_or_deleted_user_devices_removed(self):
        self.subscribe(self.a, "a1")
        admin = User.objects.create_superuser("+998901000399", "Kuchli-Parol-2026")
        self.c(admin).patch(f"/api/admin/users/{self.a.id}/", {"is_active": False}, format="json")
        self.assertEqual(self.a.push_subs.count(), 0)

    # --- hodisalar oqimi
    def test_booking_chat_sos_flows(self):
        self.subscribe(self.a, "client"); self.subscribe(self.u, "usta")
        day = str(date.today() + timedelta(days=1))
        bid = self.c(self.a).post("/api/masters/bookings/", {"master": self.m.id, "service": self.svc.id, "date": day, "time": "10:00"}, format="json").data["id"]
        self.c(self.u).post(f"/api/masters/bookings/{bid}/status/", {"status": "confirmed"}, format="json")
        conv = Conversation.objects.create(user1=self.a, user2=self.u)
        self.c(self.a).post(f"/api/chat/{conv.id}/messages/", {"text": "Mening maxfiy manzilim: X ko'chasi"}, format="json")
        ev = User.objects.create_user(phone="+998901000304", role="evakuator", first_name="Ev", is_online=True, lat=41.3, lng=69.2)
        EvacuatorProfile.objects.create(user=ev); self.subscribe(ev, "evak")
        sid = self.c(self.a).post("/api/sos/", {"kind": "evakuator", "lat": 41.31, "lng": 69.21}, format="json").data["id"]
        self.c(ev).post(f"/api/sos/{sid}/accept/", {}, format="json")
        process_pending()
        by_ep = {}
        for k in self.sent:
            by_ep.setdefault(k["subscription_info"]["endpoint"].rsplit("/", 1)[1], []).append(json.loads(k["data"]))
        usta = by_ep["usta"]; client = by_ep["client"]; evak = by_ep["evak"]
        self.assertTrue(any(p["title"].endswith("Yangi bron") and p["url"] == f"/app/usta/orders?focus={bid}" for p in usta))
        self.assertTrue(any("tasdiqlandi" in p["title"] and p["url"] == f"/app/orders?focus=booking-{bid}" for p in client))
        chat = next(p for p in usta if p["kind"] == "chat")
        self.assertEqual(chat["url"], f"/app/chat/{conv.id}")
        self.assertNotIn("maxfiy", json.dumps(chat, ensure_ascii=False))  # xabar matni qulf ekraniga chiqmaydi
        self.assertTrue(any(p["kind"] == "sos" and p["urgent"] for p in evak))
        self.assertTrue(any("Yordam topildi" in p["title"] and p["url"] == f"/app/sos?id={sid}" for p in client))
        self.assertTrue(all(k["headers"]["Urgency"] in ("high", "normal") for k in self.sent))

    # --- usta: yangi bron telefon qulflangan / ilova yopiq bo'lsa ham darhol (yuqori ustuvorlik)
    def test_new_booking_reaches_master_urgently(self):
        self.subscribe(self.u, "usta")
        day = str(date.today() + timedelta(days=1))
        bid = self.c(self.a).post("/api/masters/bookings/", {"master": self.m.id, "service": self.svc.id, "date": day, "time": "11:00"}, format="json").data["id"]
        process_pending()
        k = next(k for k in self.sent if json.loads(k["data"])["title"].endswith("Yangi bron"))
        self.assertEqual(k["headers"]["Urgency"], "high")  # Android Doze rejimida ham kechikmaydi
        p = json.loads(k["data"])
        self.assertTrue(p["urgent"]); self.assertEqual(p["url"], f"/app/usta/orders?focus={bid}")
        self.sent.clear()
        self.c(self.a).post(f"/api/masters/bookings/{bid}/status/", {"status": "cancelled"}, format="json")
        process_pending()
        self.assertTrue(any(k["headers"]["Urgency"] == "high" and "bekor" in json.loads(k["data"])["title"] for k in self.sent))

    def test_transient_error_retried(self):
        from pywebpush import WebPushException
        self.subscribe(self.u, "usta")
        calls = []

        def flaky(**kw):
            calls.append(1)
            if len(calls) < 3:
                raise WebPushException("x", response=MagicMock(status_code=503))
            self.sent.append(kw)
        self.wp.side_effect = flaky
        notify(self.u, "📅 Yangi bron", urgent=True); process_pending()
        self.assertEqual(len(calls), 3); self.assertEqual(len(self.sent), 1)
        self.assertEqual(Notification.objects.get(user=self.u).push_state, "sent")
        self.assertEqual(PushSubscription.objects.get(endpoint=FCM + "usta").failures, 0)

    def test_permanent_error_not_retried(self):
        from pywebpush import WebPushException
        self.subscribe(self.u, "usta")
        self.wp.side_effect = lambda **kw: (_ for _ in ()).throw(WebPushException("x", response=MagicMock(status_code=400)))
        notify(self.u, "t"); process_pending()
        self.assertEqual(self.wp.call_count, 1)

    def test_resubscribe_keeps_owner(self):
        self.subscribe(self.u, "old")
        anon = APIClient()
        body = {"old_endpoint": FCM + "old", "endpoint": FCM + "new", "keys": {"p256dh": "BNc" + "y" * 80, "auth": "newauth"}}
        self.assertEqual(anon.post("/api/push/resubscribe/", body, format="json").status_code, 200)
        self.assertFalse(PushSubscription.objects.filter(endpoint=FCM + "old").exists())
        self.assertEqual(PushSubscription.objects.get(endpoint=FCM + "new").user, self.u)
        # noma'lum eski manzil bilan begona obunani o'g'irlab bo'lmaydi
        self.assertEqual(anon.post("/api/push/resubscribe/", {**body, "old_endpoint": FCM + "guess"}, format="json").status_code, 404)
        bad = {**body, "old_endpoint": FCM + "new", "endpoint": "https://evil.com/x"}
        self.assertEqual(anon.post("/api/push/resubscribe/", bad, format="json").status_code, 400)

    # --- «Sinov xabari»: ilovadan chiqib, telefon sozlamalarini tekshirish uchun
    def test_push_test_endpoint(self):
        c = self.c(self.u)
        self.assertEqual(c.post("/api/push/test/").status_code, 409)  # qurilma yo'q
        self.subscribe(self.u, "usta")
        with patch("threading.Timer") as timer:
            r = c.post("/api/push/test/")
            self.assertEqual(r.status_code, 200); self.assertEqual(r.data["devices"], 1)
            self.assertEqual(c.post("/api/push/test/").status_code, 429)  # spamdan himoya
            timer.call_args[0][1]()  # kechiktirilgan yuborishni darhol bajaramiz
        process_pending()
        k = next(k for k in self.sent if "Sinov" in json.loads(k["data"])["title"])
        self.assertEqual(k["headers"]["Urgency"], "high")
        self.assertEqual(APIClient().post("/api/push/test/").status_code, 401)

    # --- chat: HAR bir xabar telefonga yetadi (oldin birinchisi o'qilmaguncha keyingilari jim qolardi)
    def test_every_chat_message_notifies(self):
        self.subscribe(self.u, "usta")
        conv = Conversation.objects.create(user1=self.a, user2=self.u)
        c = self.c(self.a)
        for t in ("Salom", "Ertaga kelaman", "Javob bering"):
            c.post(f"/api/chat/{conv.id}/messages/", {"text": t}, format="json")
            process_pending()
        chat = [k for k in self.sent if json.loads(k["data"])["kind"] == "chat"]
        self.assertEqual(len(chat), 3)
        p = [json.loads(k["data"]) for k in chat]
        self.assertTrue(all(x["tag"] == f"chat-{conv.id}" and x["urgent"] for x in p))  # telefonda bitta, har safar jiringlaydi
        self.assertTrue(all(k["headers"]["Urgency"] == "high" for k in chat))
        self.assertEqual(p[-1]["body"], "Sizga 3 ta yangi xabar keldi")
        self.assertNotIn("Javob", json.dumps(p, ensure_ascii=False))  # matn qulf ekraniga chiqmaydi
        # ilova ichidagi ro'yxat to'lib ketmaydi: suhbat bo'yicha bitta o'qilmagan yozuv
        self.assertEqual(self.u.notifications.filter(kind="chat", is_read=False).count(), 1)

    # --- SOS: hech kim qabul qilmasa — takroriy ogohlantirish, qabul qilingach to'xtaydi
    def test_sos_escalation(self):
        from django.utils import timezone
        from evacuator.models import SOSRequest
        from evacuator.views import escalate_sos
        ev = User.objects.create_user(phone="+998901000305", role="evakuator", first_name="Ev", is_online=True, lat=41.3, lng=69.2)
        EvacuatorProfile.objects.create(user=ev); self.subscribe(ev, "evak")
        sid = self.c(self.a).post("/api/sos/", {"kind": "evakuator", "lat": 41.31, "lng": 69.21}, format="json").data["id"]
        sos = SOSRequest.objects.get(pk=sid)
        t0 = sos.updated_at
        self.assertEqual(escalate_sos(t0 + timedelta(seconds=10)), 0)
        self.assertEqual(escalate_sos(t0 + timedelta(seconds=45)), 1)
        self.assertEqual(escalate_sos(t0 + timedelta(seconds=50)), 0)   # bir takror — bir marta
        self.assertEqual(escalate_sos(t0 + timedelta(seconds=100)), 1)  # 2-takror
        self.assertEqual(escalate_sos(t0 + timedelta(seconds=200)), 1)  # 3-takror
        self.assertEqual(escalate_sos(t0 + timedelta(seconds=230)), 0)  # 3 tadan ortiq emas
        process_pending()
        sos_p = [json.loads(k["data"]) for k in self.sent if json.loads(k["data"])["kind"] == "sos"]
        self.assertEqual(len(sos_p), 4)
        self.assertTrue(all(x["urgent"] for x in sos_p))
        self.c(ev).post(f"/api/sos/{sid}/accept/", {}, format="json")
        self.assertEqual(escalate_sos(timezone.now() + timedelta(seconds=100)), 0)  # qabul qilingan — jim

    def test_status_diagnostics(self):
        self.assertEqual(self.c(self.u).get("/api/push/status/").data["devices"], 0)
        notify(self.u, "Yo'q qurilma")
        self.subscribe(self.u, "usta-secret")
        notify(self.u, "Bor qurilma"); process_pending()
        d = self.c(self.u).get("/api/push/status/").data
        self.assertEqual(d["devices"], 1); self.assertIsNotNone(d["last_success"])
        self.assertEqual([r["push"] for r in d["recent"]], ["sent", "none"])
        self.assertNotIn("usta-secret", json.dumps(d, default=str))

    # ===== To'liq talablar bo'yicha testlar (1–8) =====
    def _payloads(self, ep):
        return [json.loads(k["data"]) for k in self.sent if k["subscription_info"]["endpoint"].endswith("/" + ep)]

    def test_req_chat_both_directions_generic_lock_text(self):
        """Test 1–2: User → Usta va Usta → User; qulf ekranida maxfiy matn yo'q; bosilganda shu chat ochiladi."""
        self.subscribe(self.a, "client"); self.subscribe(self.u, "usta")
        conv = Conversation.objects.create(user1=self.a, user2=self.u)
        self.c(self.a).post(f"/api/chat/{conv.id}/messages/", {"text": "Mashinam raqami 01A777AA"}, format="json")
        self.c(self.u).post(f"/api/chat/{conv.id}/messages/", {"text": "Manzilim: Chilonzor 5"}, format="json")
        process_pending()
        to_usta, to_client = self._payloads("usta"), self._payloads("client")
        self.assertEqual((to_usta[0]["title"], to_usta[0]["body"]), ("🔔 Avtora", "Sizga yangi xabar keldi"))
        self.assertEqual((to_client[0]["title"], to_client[0]["body"]), ("🔔 Avtora", "Sizga yangi xabar keldi"))
        self.assertEqual((to_usta[0]["type"], to_usta[0]["object_id"]), ("new_message", conv.id))
        for p in to_usta + to_client:
            self.assertEqual(p["url"], f"/app/chat/{conv.id}")
            blob = json.dumps(p, ensure_ascii=False)
            for secret in ("01A777AA", "Chilonzor", "Ali", "Usta", "Vali"):
                self.assertNotIn(secret, blob)

    def test_req_no_push_when_recipient_is_viewing_that_chat(self):
        """9-talab: usta aynan shu chatni ochib turgan bo'lsa — push yo'q; chatdan chiqsa — push bor."""
        from django.core.cache import cache as c_
        from chat.views import viewing_key
        self.subscribe(self.u, "usta")
        conv = Conversation.objects.create(user1=self.a, user2=self.u)
        self.c(self.u).get(f"/api/chat/{conv.id}/messages/", {"active": "1"})  # usta chatni ko'rib turibdi
        self.c(self.a).post(f"/api/chat/{conv.id}/messages/", {"text": "1"}, format="json"); process_pending()
        self.assertEqual(self._payloads("usta"), [])
        c_.delete(viewing_key(self.u.id, conv.id))  # usta chatdan chiqdi / ilovani yopdi (12 s o'tdi)
        self.c(self.a).post(f"/api/chat/{conv.id}/messages/", {"text": "2"}, format="json"); process_pending()
        self.assertEqual(len(self._payloads("usta")), 1)
        # fonda turgan sahifa (active yo'q) push'ni to'xtatmaydi
        self.c(self.u).get(f"/api/chat/{conv.id}/messages/")
        self.c(self.a).post(f"/api/chat/{conv.id}/messages/", {"text": "3"}, format="json"); process_pending()
        self.assertEqual(len(self._payloads("usta")), 2)

    def test_req_booking_and_sos_texts_and_links(self):
        """Test 3–4: bron → ustaga (bron sahifasiga), SOS → evakuatorga; umumiy matn."""
        self.subscribe(self.u, "usta")
        ev = User.objects.create_user(phone="+998901000306", role="evakuator", first_name="Ev", is_online=True, lat=41.3, lng=69.2)
        EvacuatorProfile.objects.create(user=ev); self.subscribe(ev, "evak")
        day = str(date.today() + timedelta(days=1))
        bid = self.c(self.a).post("/api/masters/bookings/", {"master": self.m.id, "service": self.svc.id, "date": day, "time": "12:00"}, format="json").data["id"]
        self.c(self.a).post("/api/sos/", {"kind": "evakuator", "lat": 41.31, "lng": 69.21}, format="json")
        process_pending()
        bk = self._payloads("usta")[0]
        self.assertEqual((bk["title"], bk["body"]), ("🔔 Yangi bron", "Sizga yangi xizmat bron qilindi"))
        self.assertEqual((bk["type"], bk["object_id"]), ("new_booking", bid))
        self.assertEqual(bk["url"], f"/app/usta/orders?focus={bid}")
        self.assertNotIn("Ali", json.dumps(bk, ensure_ascii=False))
        sos = self._payloads("evak")[0]
        self.assertTrue(sos["title"].startswith("🚨 Avtora SOS")); self.assertIn("Yaqin atrofda yordam so'rovi mavjud", sos["body"])
        self.assertEqual(sos["url"], "/app/evak"); self.assertTrue(sos["urgent"]); self.assertEqual(sos["type"], "evacuator_request")

    def test_req_multiple_devices_all_receive(self):
        """7-talab: User → Device 1, 2, 3 — bittasi buzilsa ham qolganlariga yetadi."""
        from pywebpush import WebPushException
        for d in ("d1", "d2", "d3"):
            self.subscribe(self.u, d)

        def fake(**kw):
            if kw["subscription_info"]["endpoint"].endswith("d2"):
                raise WebPushException("x", response=MagicMock(status_code=410))
            self.sent.append(kw)
        self.wp.side_effect = fake
        notify(self.u, "📅 Yangi bron", urgent=True); process_pending()
        self.assertEqual(sorted(k["subscription_info"]["endpoint"][-2:] for k in self.sent), ["d1", "d3"])
        self.assertFalse(PushSubscription.objects.filter(endpoint=FCM + "d2").exists())  # yaroqsiz token tozalandi
        self.assertEqual(Notification.objects.get(user=self.u).push_state, "sent")

    def test_req_invalid_token_replaced_by_new(self):
        """8-talab: token yaroqsiz (403/VAPID) → o'chiriladi; ilova yangi token yuboradi → keyingilari yangi token orqali."""
        from pywebpush import WebPushException
        self.subscribe(self.u, "old")
        self.wp.side_effect = lambda **kw: (_ for _ in ()).throw(WebPushException("x", response=MagicMock(status_code=403)))
        notify(self.u, "1", urgent=True); process_pending()
        self.assertFalse(PushSubscription.objects.get(endpoint=FCM + "old").is_active)
        self.assertEqual(self.wp.call_count, 1)
        self.wp.side_effect = lambda **kw: self.sent.append(kw)
        self.subscribe(self.u, "new")  # syncPush: ilova ochilganda yangi token
        notify(self.u, "2", urgent=True); process_pending()
        self.assertEqual([k["subscription_info"]["endpoint"][-3:] for k in self.sent], ["new"])

    def test_req_sequential_notifications_all_delivered(self):
        """Test 7: ketma-ket 10 ta xabar — hammasi yetadi, birinchisida to'xtab qolmaydi."""
        self.subscribe(self.u, "usta")
        conv = Conversation.objects.create(user1=self.a, user2=self.u)
        day = date.today() + timedelta(days=2)
        for i in range(5):
            self.c(self.a).post(f"/api/chat/{conv.id}/messages/", {"text": f"m{i}"}, format="json")
            process_pending()
        for t in ("10:00", "11:00", "13:00"):
            self.c(self.b).post("/api/masters/bookings/", {"master": self.m.id, "service": self.svc.id, "date": str(day), "time": t}, format="json")
            process_pending()
        p = self._payloads("usta")
        self.assertEqual(sum(1 for x in p if x["kind"] == "chat"), 5)
        self.assertEqual(sum(1 for x in p if "bron" in x["body"].lower()), 2)  # 3-bron: «2 ta faol bron» chegarasi

    def test_req_logout_login_keeps_push(self):
        """Test 8: logout → qurilma obunasi o'chadi (boshqa odamga xabar bormaydi); login → yangi obuna, push davom etadi."""
        self.subscribe(self.u, "phone")
        self.c(self.u).post("/api/push/unsubscribe/", {"endpoint": FCM + "phone"}, format="json")  # logout
        notify(self.u, "logout paytida"); process_pending()
        self.assertEqual(self.sent, [])
        self.subscribe(self.u, "phone2")  # login → syncPush
        notify(self.u, "📅 Yangi bron", urgent=True); process_pending()
        self.assertEqual(len(self.sent), 1)

    def test_req_order_push_and_error_diagnostics_and_telegram_throttle(self):
        """Buyurtma → sotuvchiga push (new_order); push xatosi saqlanadi va diagnostikada ko'rinadi; chat Telegram'i spam emas."""
        from pywebpush import WebPushException
        from market.models import Product, Shop
        from django.utils import timezone as tz
        self.u.premium_until = tz.now() + timedelta(days=30); self.u.save(update_fields=["premium_until"])
        shop = Shop.objects.create(owner=self.u, name="Do'kon")
        prod = Product.objects.create(shop=shop, name="Moy filtri", price=50000, stock=5)
        self.subscribe(self.u, "usta")
        r = self.c(self.a).post("/api/parts/orders/", {"items": [{"product": prod.id, "quantity": 1}], "address": "Toshkent", "phone": "+998901000301"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        process_pending()
        p = self._payloads("usta")[0]
        self.assertEqual((p["title"], p["body"], p["type"]), ("🔔 Yangi buyurtma", "Sizga yangi buyurtma keldi", "new_order"))
        self.assertTrue(p["urgent"])
        # push xizmati xatosi saqlanadi (endpoint emas)
        self.wp.side_effect = lambda **kw: (_ for _ in ()).throw(WebPushException("x", response=MagicMock(status_code=403, text="VAPID mismatch")))
        notify(self.u, "t"); process_pending()
        d = self.c(self.u).get("/api/push/status/").data
        self.assertIn("403", d["last_error"]); self.assertIn("VAPID", d["last_error"])
        # chat: push — har xabarda, Telegram — suhbat bo'yicha daqiqasiga bittadan
        self.wp.side_effect = lambda **kw: self.sent.append(kw)
        self.u.telegram_chat_id = 777; self.u.save(update_fields=["telegram_chat_id"])
        conv = Conversation.objects.create(user1=self.a, user2=self.u)
        with patch("accounts.utils.notify_user_telegram") as tg:
            for i in range(3):
                self.c(self.a).post(f"/api/chat/{conv.id}/messages/", {"text": str(i)}, format="json")
            import time; time.sleep(0.3)
        self.assertEqual(tg.call_count, 1)
