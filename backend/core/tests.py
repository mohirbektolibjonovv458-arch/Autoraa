"""Asosiy biznes jarayonlari uchun avtomatik testlar: python manage.py test"""
import io
from datetime import date, timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import AuthCode, TelegramLink, User
from masters.models import Booking, MasterProfile, Service


def png(name="r.png"):
    b = io.BytesIO()
    Image.new("RGB", (20, 20), "red").save(b, "PNG")
    return SimpleUploadedFile(name, b.getvalue(), content_type="image/png")


class Base(TestCase):
    def setUp(self):
        cache.clear()
        self.c = APIClient()
        self.send = patch("accounts.views.send_auth_message", return_value=True).start()
        patch("accounts.utils.tg_call", return_value={"ok": True}).start()
        self.addCleanup(patch.stopall)

    def user(self, phone, role="user", **kw):
        return User.objects.create_user(phone=phone, role=role, first_name=kw.pop("first_name", "Test"), **kw)

    def auth(self, u):
        self.c.force_authenticate(u)


class AuthTests(Base):
    phone = "+998901112233"

    def test_register_requires_telegram_link(self):
        r = self.c.post("/api/auth/send-code/", {"phone": "901112233", "purpose": "register"}, format="json")
        self.assertEqual(r.data["code"], "telegram_not_linked")
        self.assertFalse(AuthCode.objects.exists())  # ulanmagan raqamga kod yaratilmaydi

    def test_full_register_and_login(self):
        TelegramLink.objects.create(phone=self.phone, chat_id=111)
        r = self.c.post("/api/auth/send-code/", {"phone": "90 111 22 33", "purpose": "register"}, format="json")
        self.assertEqual(r.status_code, 200)
        code = AuthCode.objects.get(phone=self.phone).code
        self.assertNotIn(code, str(r.data))  # kod javobda qaytmaydi
        r = self.c.post("/api/auth/register/", {"phone": self.phone, "code": code, "first_name": "Ali", "role": "usta", "specialties": ["motor"]}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(MasterProfile.objects.filter(user__phone=self.phone).exists())
        self.assertIn("access", r.data)
        # kod qayta ishlamaydi
        r = self.c.post("/api/auth/login/", {"phone": self.phone, "code": code}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_wrong_code_attempts_and_lock(self):
        TelegramLink.objects.create(phone=self.phone, chat_id=111)
        self.user(self.phone)
        AuthCode.objects.create(phone=self.phone, code="1111", purpose="login", attempts=5)
        AuthCode.objects.create(phone=self.phone, code="1234", purpose="login", attempts=4)
        r = self.c.post("/api/auth/login/", {"phone": self.phone, "code": "0000"}, format="json")
        self.assertIn("0 ta urinish", r.data["detail"])
        r = self.c.post("/api/auth/login/", {"phone": self.phone, "code": "1234"}, format="json")
        self.assertIn("Juda ko'p", r.data["detail"])  # 1 soatlik blok

    def test_blocked_user_cannot_login_or_refresh(self):
        TelegramLink.objects.create(phone=self.phone, chat_id=111)
        u = self.user(self.phone)
        AuthCode.objects.create(phone=self.phone, code="4321", purpose="login")
        r = self.c.post("/api/auth/login/", {"phone": self.phone, "code": "4321"}, format="json")
        refresh = r.data["refresh"]
        u.is_active = False
        u.save()
        r = self.c.post("/api/auth/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_logout_blacklists_refresh(self):
        TelegramLink.objects.create(phone=self.phone, chat_id=111)
        self.user(self.phone)
        AuthCode.objects.create(phone=self.phone, code="4321", purpose="login")
        refresh = self.c.post("/api/auth/login/", {"phone": self.phone, "code": "4321"}, format="json").data["refresh"]
        self.assertEqual(self.c.post("/api/auth/logout/", {"refresh": refresh}, format="json").status_code, 204)
        self.assertEqual(self.c.post("/api/auth/refresh/", {"refresh": refresh}, format="json").status_code, 401)

    def test_admin_login_lockout(self):
        User.objects.create_superuser(self.phone, "strongpass1")
        for _ in range(5):
            self.c.post("/api/auth/admin-login/", {"phone": self.phone, "password": "bad"}, format="json")
        r = self.c.post("/api/auth/admin-login/", {"phone": self.phone, "password": "strongpass1"}, format="json")
        self.assertEqual(r.status_code, 429)

    def test_uzbek_validation_messages(self):
        u = self.user(self.phone)
        self.auth(u)
        from garage.models import Vehicle
        v = Vehicle.objects.create(owner=u, brand="Chevrolet", model="Cobalt")
        r = self.c.post(f"/api/garage/vehicles/{v.id}/expenses/", {"category": "yoqilgi", "date": str(date.today())}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["detail"], "Summa: majburiy maydon")


class BookingTests(Base):
    def setUp(self):
        super().setUp()
        self.client_u = self.user("+998901000001")
        mu = self.user("+998901000002", role="usta")
        self.master = MasterProfile.objects.create(user=mu, work_hours="09:00 - 18:00")
        self.svc = Service.objects.create(master=self.master, name="Diagnostika", category="motor", price=100000)
        self.auth(self.client_u)
        self.day = str(date.today() + timedelta(days=1))

    def book(self, t="10:00", day=None):
        return self.c.post("/api/masters/bookings/", {"master": self.master.id, "service": self.svc.id, "date": day or self.day, "time": t}, format="json")

    def test_booking_rules(self):
        self.assertEqual(self.book().status_code, 201)
        self.assertEqual(self.book().status_code, 400)                                  # band vaqt
        self.assertEqual(self.book("20:00").status_code, 400)                           # ish vaqtidan tashqari
        self.assertEqual(self.book(day=str(date.today() - timedelta(days=1))).status_code, 400)  # o'tgan kun
        self.assertEqual(self.book(day="bad").status_code, 400)

    def test_slots_follow_work_hours(self):
        slots = [s["time"] for s in self.c.get(f"/api/masters/{self.master.id}/slots/", {"date": self.day}).data]
        self.assertEqual(slots[0], "09:00")
        self.assertEqual(slots[-1], "17:00")

    def test_review_only_after_completion(self):
        b = Booking.objects.get(pk=self.book().data["id"])
        self.assertEqual(self.c.post(f"/api/masters/bookings/{b.id}/review/", {"rating": 5}, format="json").status_code, 400)
        b.status = "completed"
        b.save()
        self.assertEqual(self.c.post(f"/api/masters/bookings/{b.id}/review/", {"rating": 4}, format="json").status_code, 201)
        self.master.refresh_from_db()
        self.assertEqual(self.master.rating, 4.0)


class PremiumTests(Base):
    def test_premium_flow_and_private_receipt(self):
        usta = self.user("+998901000003", role="usta")
        MasterProfile.objects.create(user=usta)
        self.auth(usta)
        r = self.c.post("/api/shop/me/products/", {"name": "Filtr", "price": 1000, "category": "filtr"}, format="multipart")
        self.assertEqual(r.status_code, 403)  # premiumsiz do'kon yopiq
        bad = SimpleUploadedFile("x.png", b"not an image", content_type="image/png")
        self.assertEqual(self.c.post("/api/premium/pay/", {"receipt": bad}, format="multipart").status_code, 400)
        r = self.c.post("/api/premium/pay/", {"receipt": png(), "months": 1}, format="multipart")
        self.assertEqual(r.status_code, 201)
        from premium.models import PremiumPayment
        p = PremiumPayment.objects.get()
        # chek /media/ orqali ochiq emas
        self.assertEqual(self.c.get("/media/" + p.receipt.name).status_code, 404)
        admin = User.objects.create_superuser("+998900000000", "strongpass1")
        self.auth(admin)
        url = self.c.get("/api/admin/payments/").data[0]["receipt"]
        self.assertEqual(APIClient().get(url).status_code, 200)            # imzoli havola ishlaydi
        self.assertEqual(APIClient().get(url + "x").status_code, 404)      # buzilgan imzo
        self.assertEqual(self.c.post(f"/api/admin/payments/{p.id}/approve/").status_code, 200)
        usta.refresh_from_db()
        self.assertTrue(usta.is_premium)
        self.auth(usta)
        r = self.c.post("/api/shop/me/products/", {"name": "Filtr", "price": 1000, "category": "filtr", "stock": 3}, format="multipart")
        self.assertEqual(r.status_code, 201)


class SosTests(Base):
    def test_sos_accept_rate(self):
        cl = self.user("+998901000004")
        ev = self.user("+998901000005", role="evakuator", lat=41.3, lng=69.2, is_online=True)
        from evacuator.models import EvacuatorProfile
        EvacuatorProfile.objects.create(user=ev, base_price=100000, price_per_km=5000)
        self.auth(cl)
        sid = self.c.post("/api/sos/", {"kind": "evakuator", "lat": 41.31, "lng": 69.21}, format="json").data["id"]
        self.assertEqual(self.c.post("/api/sos/", {"kind": "evakuator", "lat": 41.31, "lng": 69.21}, format="json").status_code, 400)
        self.auth(ev)
        self.assertEqual(self.c.post(f"/api/sos/{sid}/accept/", {}, format="json").status_code, 200)
        for st in ("on_the_way", "arrived", "completed"):
            self.assertEqual(self.c.post(f"/api/sos/{sid}/status/", {"status": st}, format="json").status_code, 200)
        self.auth(cl)
        self.assertEqual(self.c.post(f"/api/sos/{sid}/review/", {"rating": 5}, format="json").status_code, 200)
        ev.evacuator.refresh_from_db()
        self.assertEqual(ev.evacuator.rating, 5.0)


class FuelTests(Base):
    def test_report_rules_and_subscription(self):
        from fuel.models import FuelStation
        from core.models import Notification
        s = FuelStation.objects.create(name="AGNKS", lat=41.3, lng=69.2, fuels=["metan"])
        a, b = self.user("+998901000006"), self.user("+998901000007")
        self.auth(b)
        self.c.post(f"/api/fuel/stations/{s.id}/subscribe/", {"fuel": "metan"}, format="json")
        self.auth(a)
        url = f"/api/fuel/stations/{s.id}/report/"
        self.assertEqual(self.c.post(url, {"fuel": "metan", "status": "bor"}, format="json").status_code, 400)                          # GPS yo'q
        self.assertEqual(self.c.post(url, {"fuel": "metan", "status": "bor", "lat": 41.5, "lng": 69.5}, format="json").status_code, 400)  # uzoq
        with patch("fuel.views.threading.Thread") as th:
            th.side_effect = lambda target, args, daemon: type("T", (), {"start": lambda self_: target(*args)})()
            self.assertEqual(self.c.post(url, {"fuel": "metan", "status": "bor", "lat": 41.301, "lng": 69.201, "price": 3400}, format="json").status_code, 201)
        self.assertEqual(self.c.post(url, {"fuel": "metan", "status": "yoq", "lat": 41.301, "lng": 69.201}, format="json").status_code, 429)  # 10 daqiqa
        self.assertTrue(Notification.objects.filter(user=b, title__icontains="bor").exists())
        st = APIClient().get("/api/fuel/stations/", {"lat": 41.3, "lng": 69.2, "fuel": "metan"}).data["results"][0]["status"]["metan"]
        self.assertEqual((st["status"], st["price"]), ("bor", 3400))


class SecurityTests(Base):
    def test_admin_endpoints_forbidden_for_users(self):
        self.auth(self.user("+998901000008"))
        for url in ("/api/admin/dashboard/", "/api/admin/users/", "/api/admin/payments/", "/api/fuel/admin/stations/"):
            self.assertEqual(self.c.get(url).status_code, 403, url)

    def test_cannot_read_others_chat(self):
        from chat.models import Conversation
        a, b, x = self.user("+998901000009"), self.user("+998901000010"), self.user("+998901000011")
        conv = Conversation.objects.create(user1=a, user2=b)
        self.auth(x)
        self.assertEqual(self.c.get(f"/api/chat/{conv.id}/messages/").status_code, 404)

    def test_health(self):
        self.assertEqual(self.c.get("/api/health/").status_code, 200)


class AuditRegressionTests(Base):
    def test_premium_cannot_be_approved_twice(self):
        from premium.models import PremiumPayment
        from premium.services import approve_payment, reject_payment
        usta = self.user("+998901000020", role="usta")
        p = PremiumPayment.objects.create(user=usta, amount=40000, months=1)
        self.assertTrue(approve_payment(p, "a"))
        self.assertFalse(approve_payment(p, "b"))   # ikkinchi marta — yo'q
        self.assertFalse(reject_payment(p, "c"))    # tasdiqlangandan keyin rad etib bo'lmaydi
        usta.refresh_from_db()
        self.assertLess((usta.premium_until - timezone.now()).days, 31)

    def test_sos_available_hides_client_phone_and_far_requests(self):
        from evacuator.models import EvacuatorProfile, SOSRequest
        cl = self.user("+998901000021", first_name="Ali")
        cl.last_name = "Valiyev"; cl.save()
        ev = self.user("+998901000022", role="evakuator", lat=41.30, lng=69.24, is_online=True)
        EvacuatorProfile.objects.create(user=ev)
        SOSRequest.objects.create(user=cl, kind="evakuator", lat=41.31, lng=69.25)       # yaqin
        SOSRequest.objects.create(user=cl, kind="evakuator", lat=39.65, lng=66.96)       # Samarqand — uzoq
        self.auth(ev)
        data = self.c.get("/api/sos/available/").data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["client"]["phone"], "")
        self.assertEqual(data[0]["client"]["full_name"], "Ali")

    def test_client_location_not_exposed(self):
        from accounts.serializers import UserShortSerializer
        u = self.user("+998901000023", lat=41.3, lng=69.2)
        self.assertIsNone(UserShortSerializer(u).data["lat"])
        m = self.user("+998901000024", role="usta", lat=41.3, lng=69.2)
        self.assertEqual(UserShortSerializer(m).data["lat"], 41.3)

    def test_bad_rating_is_400_not_500(self):
        cl = self.user("+998901000025")
        mu = self.user("+998901000026", role="usta")
        master = MasterProfile.objects.create(user=mu)
        b = Booking.objects.create(user=cl, master=master, service_name="X", date=date.today(), time="10:00", price=1, status="completed")
        self.auth(cl)
        self.assertEqual(self.c.post(f"/api/masters/bookings/{b.id}/review/", {"rating": "abc"}, format="json").status_code, 400)
