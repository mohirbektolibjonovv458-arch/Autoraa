"""Xavfsizlik testlari: ruxsatsiz kirish (IDOR), rol/huquqlar, ma'lumot oshkor bo'lishi, fayl yuklash, sarlavhalar.
python manage.py test core.tests_security"""
import io
from datetime import date, timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import AuthCode, TelegramLink, User
from chat.models import Conversation, Message
from core.models import Notification
from evacuator.models import EvacuatorProfile, SOSRequest
from fuel.models import FuelStation, FuelSubscription
from garage.models import CarDocument, Expense, Vehicle
from market.models import PartOrder, Product, Shop
from masters.models import Booking, MasterPhoto, MasterProfile, Service
from premium.models import PremiumPayment


def jpeg(gps=False):
    img = Image.new("RGB", (40, 40), "blue")
    b = io.BytesIO()
    if gps:
        ex = img.getexif(); ex[0x8825] = {1: "N", 2: (41.0, 18.0, 0.0)}; ex[0x010F] = "Cam"
        img.save(b, "JPEG", exif=ex)
    else:
        img.save(b, "JPEG")
    return b.getvalue()


class SecurityBase(TestCase):
    def setUp(self):
        cache.clear()
        patch("accounts.utils.tg_call", return_value={"ok": True}).start()
        patch("accounts.views.send_auth_message", return_value=True).start()
        self.addCleanup(patch.stopall)
        mk = lambda phone, role="user", **kw: User.objects.create_user(phone=phone, role=role, first_name="T", **kw)
        self.a, self.b = mk("+998901000101"), mk("+998901000102")
        self.u1, self.u2 = mk("+998901000103", "usta"), mk("+998901000104", "usta")
        self.e1 = mk("+998901000105", "evakuator", lat=41.3, lng=69.2)
        self.admin = User.objects.create_superuser("+998901000199", "Kuchli-Parol-2026")
        self.m1 = MasterProfile.objects.create(user=self.u1)
        self.m2 = MasterProfile.objects.create(user=self.u2)
        EvacuatorProfile.objects.create(user=self.e1)
        self.svc = Service.objects.create(master=self.m1, name="S", category="motor", price=1000)
        self.car = Vehicle.objects.create(owner=self.a, brand="Chevrolet", model="Cobalt")
        self.doc = CarDocument.objects.create(vehicle=self.car, kind="osago", expires_on=date.today())
        self.exp = Expense.objects.create(vehicle=self.car, amount=100, date=date.today())
        self.booking = Booking.objects.create(user=self.a, master=self.m1, service_name="S", date=date.today() + timedelta(days=1), time="10:00", price=1000)
        self.sos = SOSRequest.objects.create(user=self.a, kind="evakuator", lat=41.31, lng=69.21)
        for u in (self.u1, self.u2):
            u.premium_until = __import__("django.utils.timezone", fromlist=["x"]).now() + timedelta(days=10); u.save()
        self.shop1 = Shop.objects.create(owner=self.u1, name="Shop1")
        self.prod = Product.objects.create(shop=self.shop1, name="Filtr", category="filtr", price=1000, stock=5)
        self.order = PartOrder.objects.create(user=self.a, shop=self.shop1, product=self.prod, product_name="Filtr", quantity=1, price=1000, total=1000)
        self.conv = Conversation.objects.create(user1=self.a, user2=self.u1)
        self.msg = Message.objects.create(conversation=self.conv, sender=self.a, text="maxfiy")
        self.notif = Notification.objects.create(user=self.a, title="maxfiy")
        self.pay = PremiumPayment.objects.create(user=self.u1, amount=40000, months=1)
        self.c = APIClient()

    def as_(self, u):
        self.c = APIClient(); self.c.force_authenticate(u); return self.c


class AnonymousTests(SecurityBase):
    PRIVATE = ["/api/auth/me/", "/api/garage/vehicles/", "/api/garage/summary/", "/api/masters/bookings/", "/api/orders/my/",
               "/api/chat/", "/api/notifications/", "/api/sos/", "/api/premium/info/", "/api/fuel/my/", "/api/masters/favorites/",
               "/api/admin/dashboard/", "/api/admin/users/", "/api/fuel/admin/stations/", "/api/shop/me/"]

    def test_private_endpoints_require_login(self):
        c = APIClient()
        for url in self.PRIVATE:
            self.assertIn(c.get(url).status_code, (401, 403), url)

    def test_anonymous_cannot_harvest_phones(self):
        data = APIClient().get("/api/masters/").data["results"]
        self.assertTrue(data)
        self.assertTrue(all(m["user"]["phone"] == "" for m in data))
        self.assertEqual(APIClient().get(f"/api/masters/{self.m1.id}/").data["user"]["phone"], "")


class RoleTests(SecurityBase):
    def test_user_cannot_use_admin_api(self):
        for u in (self.a, self.u1, self.e1):
            c = self.as_(u)
            for url in ("/api/admin/dashboard/", "/api/admin/users/", "/api/admin/payments/", "/api/admin/settings/", "/api/fuel/admin/stations/"):
                self.assertEqual(c.get(url).status_code, 403, (u.role, url))
            self.assertEqual(c.patch(f"/api/admin/users/{self.b.id}/", {"is_active": False}, format="json").status_code, 403)
            self.assertEqual(c.post(f"/api/admin/payments/{self.pay.id}/approve/").status_code, 403)
            self.assertEqual(c.post("/api/admin/broadcast/", {"title": "x"}, format="json").status_code, 403)

    def test_role_restricted_endpoints(self):
        c = self.as_(self.a)
        self.assertEqual(c.get("/api/masters/me/").status_code, 403)
        self.assertEqual(c.get("/api/sos/available/").status_code, 403)
        self.assertEqual(c.post(f"/api/sos/{self.sos.id}/accept/").status_code, 403)
        self.assertEqual(c.post("/api/premium/pay/").status_code, 403)

    def test_mass_assignment_on_profile(self):
        c = self.as_(self.a)
        c.patch("/api/auth/me/", {"role": "admin", "is_staff": True, "is_superuser": True, "phone": "+998900000001",
                                   "premium_until": "2099-01-01T00:00:00Z", "is_active": False}, format="json")
        self.a.refresh_from_db()
        self.assertEqual((self.a.role, self.a.is_staff, self.a.is_superuser, self.a.phone, self.a.premium_until, self.a.is_active),
                         ("user", False, False, "+998901000101", None, True))

    def test_register_cannot_create_admin(self):
        TelegramLink.objects.create(phone="+998901000150", chat_id=5)
        AuthCode.objects.create(phone="+998901000150", code="1111", purpose="register")
        r = APIClient().post("/api/auth/register/", {"phone": "+998901000150", "code": "1111", "first_name": "X", "role": "admin"}, format="json")
        u = User.objects.filter(phone="+998901000150").first()
        self.assertTrue(r.status_code == 400 or (u and u.role != "admin" and not u.is_staff))


class AdminProtectionTests(SecurityBase):
    def test_admin_cannot_login_with_sms_code_only(self):
        TelegramLink.objects.create(phone=self.admin.phone, chat_id=77)
        AuthCode.objects.create(phone=self.admin.phone, code="2222", purpose="login")
        r = APIClient().post("/api/auth/login/", {"phone": self.admin.phone, "code": "2222"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_admin_login_requires_telegram_2fa(self):
        c = APIClient()
        r = c.post("/api/auth/admin-login/", {"phone": self.admin.phone, "password": "Kuchli-Parol-2026"}, format="json")
        self.assertEqual(r.status_code, 403)  # Telegram ulanmagan — kirib bo'lmaydi
        TelegramLink.objects.create(phone=self.admin.phone, chat_id=77)
        r = c.post("/api/auth/admin-login/", {"phone": self.admin.phone, "password": "Kuchli-Parol-2026"}, format="json")
        self.assertTrue(r.data.get("two_factor"))
        self.assertNotIn("access", r.data)
        code = AuthCode.objects.filter(phone=self.admin.phone, purpose="admin").latest("created_at").code
        bad = "0000" if code != "0000" else "1111"
        self.assertEqual(c.post("/api/auth/admin-login/", {"phone": self.admin.phone, "password": "Kuchli-Parol-2026", "code": bad}, format="json").status_code, 400)
        r = c.post("/api/auth/admin-login/", {"phone": self.admin.phone, "password": "Kuchli-Parol-2026", "code": code}, format="json")
        self.assertIn("access", r.data)

    def test_admin_wrong_password_lockout_and_generic_message(self):
        c = APIClient()
        r1 = c.post("/api/auth/admin-login/", {"phone": self.admin.phone, "password": "xato"}, format="json")
        r2 = c.post("/api/auth/admin-login/", {"phone": "+998909999999", "password": "xato"}, format="json")
        self.assertEqual(r1.data["detail"], r2.data["detail"])  # hisob borligini bilib bo'lmaydi
        for _ in range(5):
            c.post("/api/auth/admin-login/", {"phone": self.admin.phone, "password": "xato"}, format="json")
        self.assertEqual(c.post("/api/auth/admin-login/", {"phone": self.admin.phone, "password": "Kuchli-Parol-2026"}, format="json").status_code, 429)

    @override_settings(ADMIN_ALLOWED_IPS=["10.1.1.1"])
    def test_admin_ip_allowlist(self):
        self.assertEqual(self.as_(self.admin).get("/api/admin/dashboard/").status_code, 403)

    def test_non_admin_password_user_cannot_use_admin_login(self):
        self.a.set_password("Kuchli-Parol-2026"); self.a.save()
        r = APIClient().post("/api/auth/admin-login/", {"phone": self.a.phone, "password": "Kuchli-Parol-2026"}, format="json")
        self.assertEqual(r.status_code, 400)


class IDORTests(SecurityBase):
    def test_garage_isolated(self):
        c = self.as_(self.b)
        v = self.car.id
        for m, url in [("get", f"/api/garage/vehicles/{v}/"), ("patch", f"/api/garage/vehicles/{v}/"), ("delete", f"/api/garage/vehicles/{v}/"),
                       ("post", f"/api/garage/vehicles/{v}/make_primary/"), ("get", f"/api/garage/vehicles/{v}/documents/"),
                       ("post", f"/api/garage/vehicles/{v}/documents/"), ("get", f"/api/garage/vehicles/{v}/expenses/"),
                       ("post", f"/api/garage/vehicles/{v}/mileage/"), ("patch", f"/api/garage/documents/{self.doc.id}/"),
                       ("delete", f"/api/garage/documents/{self.doc.id}/"), ("delete", f"/api/garage/expenses/{self.exp.id}/")]:
            self.assertEqual(getattr(c, m)(url, {}, format="json").status_code, 404, url)
        self.assertTrue(Vehicle.objects.filter(pk=v).exists())
        self.assertEqual(c.get("/api/garage/vehicles/").data, [])

    def test_booking_isolated(self):
        c = self.as_(self.b)
        self.assertEqual(c.post(f"/api/masters/bookings/{self.booking.id}/status/", {"status": "cancelled"}, format="json").status_code, 403)
        self.assertNotIn(self.booking.id, [x["id"] for x in c.get("/api/masters/bookings/").data])
        c = self.as_(self.u2)  # boshqa usta
        self.assertEqual(c.post(f"/api/masters/bookings/{self.booking.id}/status/", {"status": "confirmed"}, format="json").status_code, 403)
        self.assertEqual(c.patch(f"/api/masters/me/services/{self.svc.id}/", {"price": 1}, format="json").status_code, 404)
        self.assertEqual(c.delete(f"/api/masters/me/services/{self.svc.id}/").status_code, 404)

    def test_booking_state_machine(self):
        c = self.as_(self.u1)
        self.assertEqual(c.post(f"/api/masters/bookings/{self.booking.id}/status/", {"status": "completed"}, format="json").status_code, 400)
        for s in ("confirmed", "in_progress"):
            self.assertEqual(c.post(f"/api/masters/bookings/{self.booking.id}/status/", {"status": s}, format="json").status_code, 200)
        self.assertEqual(self.as_(self.a).post(f"/api/masters/bookings/{self.booking.id}/status/", {"status": "cancelled"}, format="json").status_code, 400)

    def test_sos_isolated_and_private(self):
        c = self.as_(self.b)
        self.assertEqual(c.get(f"/api/sos/{self.sos.id}/").status_code, 403)
        self.assertEqual(c.post(f"/api/sos/{self.sos.id}/cancel/").status_code, 404)
        self.assertEqual(c.post(f"/api/sos/{self.sos.id}/review/", {"rating": 1}, format="json").status_code, 404)
        c = self.as_(self.e1)
        self.assertEqual(c.post(f"/api/sos/{self.sos.id}/status/", {"status": "completed"}, format="json").status_code, 404)  # qabul qilmagan
        self.assertEqual(c.get("/api/sos/available/").data[0]["client"]["phone"], "")

    def test_shop_isolated_and_state_machine(self):
        c = self.as_(self.u2)
        self.assertEqual(c.patch(f"/api/shop/me/products/{self.prod.id}/", {"price": 1}, format="multipart").status_code, 404)
        self.assertEqual(c.delete(f"/api/shop/me/products/{self.prod.id}/").status_code, 404)
        self.assertEqual(c.post(f"/api/shop/me/orders/{self.order.id}/status/", {"status": "cancelled"}, format="json").status_code, 404)
        self.assertEqual(self.as_(self.b).post(f"/api/parts/orders/{self.order.id}/cancel/").status_code, 404)
        c = self.as_(self.u1)
        self.assertEqual(c.post(f"/api/shop/me/orders/{self.order.id}/status/", {"status": "delivered"}, format="json").status_code, 400)
        self.assertEqual(c.post(f"/api/shop/me/orders/{self.order.id}/status/", {"status": "cancelled"}, format="json").status_code, 200)
        self.assertEqual(c.post(f"/api/shop/me/orders/{self.order.id}/status/", {"status": "new"}, format="json").status_code, 400)
        self.prod.refresh_from_db(); self.assertEqual(self.prod.stock, 6)  # zaxira faqat bir marta qaytdi

    def test_chat_isolated(self):
        c = self.as_(self.b)
        self.assertEqual(c.get(f"/api/chat/{self.conv.id}/messages/").status_code, 404)
        self.assertEqual(c.post(f"/api/chat/{self.conv.id}/messages/", {"text": "hi"}, format="json").status_code, 404)
        self.assertEqual(c.post("/api/chat/start/", {"user_id": self.a.id}, format="json").status_code, 403)  # begona mijozga yozib bo'lmaydi
        self.assertEqual(c.post("/api/chat/start/", {"user_id": self.u1.id}, format="json").status_code, 200)  # ustaga — mumkin
        self.assertEqual(self.as_(self.u2).post("/api/chat/start/", {"user_id": self.a.id}, format="json").status_code, 403)
        self.assertEqual(self.as_(self.u1).post("/api/chat/start/", {"user_id": self.a.id}, format="json").status_code, 200)  # bron bor

    def test_notifications_and_payments_isolated(self):
        c = self.as_(self.b)
        c.post(f"/api/notifications/{self.notif.id}/read/")
        self.notif.refresh_from_db(); self.assertFalse(self.notif.is_read)
        self.assertEqual(c.get("/api/notifications/").data["results"], [])
        self.assertEqual(self.as_(self.u2).get("/api/premium/payments/").data, [])

    def test_portfolio_and_fuel_isolated(self):
        ph = MasterPhoto.objects.create(master=self.m1, image=SimpleUploadedFile("p.jpg", jpeg(), "image/jpeg"))
        self.assertEqual(self.as_(self.u2).delete(f"/api/masters/me/photos/{ph.id}/").status_code, 404)
        st = FuelStation.objects.create(name="S", lat=41.3, lng=69.2, fuels=["metan"])
        FuelSubscription.objects.create(user=self.a, station=st, fuel="metan")
        self.assertEqual(self.as_(self.b).get("/api/fuel/my/").data, [])


class FileSecurityTests(SecurityBase):
    def test_private_files_not_public(self):
        m = Message.objects.create(conversation=self.conv, sender=self.a, image=SimpleUploadedFile("c.jpg", jpeg(), "image/jpeg"))
        c = APIClient()
        self.assertEqual(c.get("/media/" + m.image.name).status_code, 404)
        self.assertEqual(c.get(f"/api/chat/file/{m.id}/").status_code, 404)
        self.assertEqual(c.get(f"/api/chat/file/{m.id}/?s=bad").status_code, 404)
        url = self.as_(self.a).get(f"/api/chat/{self.conv.id}/messages/").data["messages"][-1]["image"]
        self.assertEqual(APIClient().get(url).status_code, 200)
        self.assertEqual(c.get(f"/api/premium/receipt/{self.pay.id}/").status_code, 404)
        # fayl diskdan yo'qolgan bo'lsa (Volume ulanmagan) — server xatosi emas, 404
        import os
        os.remove(m.image.path)
        self.assertEqual(APIClient(raise_request_exception=False).get(url).status_code, 404)

    def test_upload_rejects_non_images_and_strips_gps(self):
        c = self.as_(self.a)
        r = c.patch("/api/auth/me/", {"avatar": SimpleUploadedFile("x.jpg", b"<?php system($_GET['c']); ?>", "image/jpeg")}, format="multipart")
        self.assertEqual(r.status_code, 400)
        r = c.patch("/api/auth/me/", {"avatar": SimpleUploadedFile("evil.html", b"<script>alert(1)</script>", "text/html")}, format="multipart")
        self.assertEqual(r.status_code, 400)
        r = c.patch("/api/auth/me/", {"avatar": SimpleUploadedFile("me.jpg", jpeg(gps=True) + b"<script>x</script>", "image/jpeg")}, format="multipart")
        self.assertEqual(r.status_code, 200)
        self.a.refresh_from_db()
        raw = open(self.a.avatar.path, "rb").read()
        self.assertNotIn(b"<script>", raw)
        self.assertEqual(dict(Image.open(self.a.avatar.path).getexif()), {})
        self.assertTrue(self.a.avatar.name.endswith(".jpg"))

    def test_path_traversal(self):
        for p in ("/media/../config/settings.py", "/media/..%2Fconfig%2Fsettings.py", "/..%2F..%2Fetc%2Fpasswd"):
            r = APIClient().get(p)
            self.assertNotIn(b"SECRET_KEY", getattr(r, "content", b"") or b"", p)


class HeadersAndLeakTests(SecurityBase):
    def test_security_headers(self):
        r = APIClient().get("/")
        self.assertIn("default-src 'self'", r["Content-Security-Policy"])
        self.assertEqual(r["X-Frame-Options"], "DENY")
        self.assertEqual(self.as_(self.a).get("/api/auth/me/")["Cache-Control"], "no-store")

    def test_cors_blocks_foreign_origins(self):
        r = APIClient().get("/api/masters/", HTTP_ORIGIN="https://evil.example")
        self.assertNotIn("Access-Control-Allow-Origin", r)

    def test_no_secrets_in_api(self):
        me = self.as_(self.a).get("/api/auth/me/").data
        for k in ("password", "telegram_chat_id", "is_staff", "is_superuser"):
            self.assertNotIn(k, me)
        users = self.as_(self.admin).get("/api/admin/users/").data
        self.assertTrue(all("password" not in u for u in users))
        s = APIClient().get("/api/settings/").data
        self.assertNotIn("card_number", s)

    def test_errors_do_not_leak_internals(self):
        r = self.as_(self.a).post(f"/api/masters/bookings/{self.booking.id}/review/", {"rating": "x"}, format="json")
        self.assertNotIn("Traceback", str(r.content))
