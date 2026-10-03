"""«Google bilan kirish»: token tekshiruvi (imzo, aud, iss, muddat), kirish, ro'yxatdan o'tish va mavjud hisobga ulash."""
import time
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import AuthCode, User

CID = "123-test.apps.googleusercontent.com"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def google_token(sub="g-100", email="ali@gmail.com", aud=CID, iss="https://accounts.google.com", exp=None, key=KEY, verified=True):
    now = int(time.time())
    return jwt.encode({"sub": sub, "email": email, "email_verified": verified, "given_name": "Ali", "family_name": "Valiyev",
                       "aud": aud, "iss": iss, "iat": now, "exp": exp or now + 3600}, key, algorithm="RS256", headers={"kid": "k1"})


@override_settings(GOOGLE_CLIENT_IDS=[CID])
class GoogleAuthTests(TestCase):
    def setUp(self):
        cache.clear()
        patch("accounts.google._signing_key", return_value=KEY.public_key()).start()  # Google ochiq kaliti o'rniga
        patch("accounts.utils.tg_call", return_value={"ok": True}).start()
        patch("accounts.views.send_auth_message", return_value=True).start()
        self.addCleanup(patch.stopall)
        self.c = APIClient()

    def g(self, token):
        return self.c.post("/api/auth/google/", {"credential": token}, format="json")

    def code(self, phone, purpose):
        AuthCode.objects.create(phone=phone, code="1234", purpose=purpose)
        return "1234"

    def test_rejects_bad_tokens(self):
        for bad in (google_token(key=OTHER_KEY), google_token(aud="boshqa-ilova"), google_token(iss="https://evil.com"),
                    google_token(exp=int(time.time()) - 3600), google_token(verified=False), "abc", "", None):
            r = self.g(bad)
            self.assertEqual(r.status_code, 400, bad)
            self.assertNotIn("access", r.data)

    @override_settings(GOOGLE_CLIENT_IDS=[])
    def test_disabled_without_client_id(self):
        self.assertEqual(self.g(google_token()).status_code, 400)
        self.assertEqual(APIClient().get("/api/settings/").data["google_client_id"], "")

    def test_client_id_public_but_nothing_secret(self):
        d = APIClient().get("/api/settings/").data
        self.assertEqual(d["google_client_id"], CID)

    def test_new_google_user_registers_with_phone_then_one_tap_login(self):
        r = self.g(google_token())
        self.assertEqual(r.data["status"], "need_phone")
        self.assertEqual((r.data["first_name"], r.data["last_name"], r.data["email"]), ("Ali", "Valiyev", "ali@gmail.com"))
        self.assertNotIn("access", r.data)
        ticket = r.data["ticket"]
        phone = "+998901234567"
        r = self.c.post("/api/auth/register/", {"phone": phone, "code": self.code(phone, "register"), "role": "user",
                                                "first_name": "Ali", "last_name": "Valiyev", "google_ticket": ticket}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        u = User.objects.get(phone=phone)
        self.assertEqual((u.google_sub, u.email), ("g-100", "ali@gmail.com"))
        self.assertNotIn("google_sub", r.data["user"])
        # keyingi safar — bir bosishda, kodsiz
        r = self.g(google_token())
        self.assertEqual(r.data["status"], "ok"); self.assertIn("access", r.data); self.assertEqual(r.data["user"]["phone"], phone)

    def test_existing_phone_user_links_google_via_login(self):
        u = User.objects.create_user(phone="+998901111111", first_name="Vali", role="usta")
        ticket = self.g(google_token(sub="g-200", email="vali@gmail.com")).data["ticket"]
        r = self.c.post("/api/auth/login/", {"phone": u.phone, "code": self.code(u.phone, "login"), "google_ticket": ticket}, format="json")
        self.assertEqual(r.status_code, 200)
        u.refresh_from_db(); self.assertEqual(u.google_sub, "g-200")
        self.assertEqual(self.g(google_token(sub="g-200", email="vali@gmail.com")).data["user"]["id"], u.id)

    def test_ticket_cannot_be_forged_or_steal_linked_account(self):
        a = User.objects.create_user(phone="+998902222222", first_name="A", google_sub="g-300")
        b = User.objects.create_user(phone="+998903333333", first_name="B")
        # soxta ticket — ulanmaydi
        self.c.post("/api/auth/login/", {"phone": b.phone, "code": self.code(b.phone, "login"), "google_ticket": "soxta"}, format="json")
        b.refresh_from_db(); self.assertIsNone(b.google_sub)
        # boshqa hisobga ulangan Google — ko'chirilmaydi
        from accounts.google import make_ticket
        t = make_ticket({"sub": "g-300", "email": "a@gmail.com", "first_name": "", "last_name": ""})
        self.c.post("/api/auth/login/", {"phone": b.phone, "code": self.code(b.phone, "login"), "google_ticket": t}, format="json")
        b.refresh_from_db(); self.assertIsNone(b.google_sub)
        a.refresh_from_db(); self.assertEqual(a.google_sub, "g-300")
        # ticket'ning o'zi bilan kirib bo'lmaydi — telefon kodi shart
        r = self.c.post("/api/auth/login/", {"phone": b.phone, "code": "0000", "google_ticket": t}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_blocked_and_admin_cannot_use_google(self):
        User.objects.create_user(phone="+998904444444", google_sub="g-400", is_active=False)
        self.assertEqual(self.g(google_token(sub="g-400")).status_code, 403)
        User.objects.create_superuser("+998905555555", "Kuchli-Parol-2026", google_sub="g-500")
        self.assertEqual(self.g(google_token(sub="g-500")).status_code, 403)
