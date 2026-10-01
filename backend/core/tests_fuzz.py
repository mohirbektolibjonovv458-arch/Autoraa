"""Barcha API endpointlariga noto'g'ri turdagi ma'lumot yuboriladi — hech biri 500 qaytarmasligi kerak."""
import re
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import get_resolver
from rest_framework.test import APIClient

from accounts.models import User
from core.vapid import generate

PUB, PRIV = generate()

KEYS = ["status", "rating", "lat", "lng", "price", "quantity", "date", "time", "items", "user_id", "fuel", "months", "phone", "code",
        "text", "name", "fuels", "expires_on", "amount", "premium_days", "mileage", "stock", "title", "body", "role", "address", "kind",
        "category", "service", "master", "vehicle", "first_name", "email", "endpoint", "old_endpoint", "keys", "refresh", "password", "ids", "specialties"]
BODIES = [{}, {k: [1, {"a": 2}] for k in KEYS}, {k: 123456789012 for k in KEYS}, {k: "inf" for k in KEYS}]


def api_paths():
    out = []

    def walk(p, pre=""):
        for e in p.url_patterns:
            if hasattr(e, "url_patterns"):
                walk(e, pre + str(e.pattern))
            else:
                out.append(pre + str(e.pattern))
    walk(get_resolver())
    paths = []
    for u in out:
        if not u.startswith("api/") or "tiles" in u:
            continue
        p = "/" + re.sub(r"\(\?P<\w+>[^)]*\)", "1", u).replace("^", "").replace("$", "").replace("\\.", ".")
        paths.append(re.sub(r"<\w+:?\w*>", "1", p))
    return paths


# push kalitlari bilan — aks holda push endpointlari ataylab 503 («sozlanmagan») qaytaradi va haqiqiy kod tekshirilmaydi
@override_settings(VAPID_PUBLIC_KEY=PUB, VAPID_PRIVATE_KEY=PRIV)
class FuzzTests(TestCase):
    def test_no_server_errors_on_malformed_input(self):
        patch("accounts.utils.tg_call", return_value={"ok": True}).start()
        patch("accounts.views.send_auth_message", return_value=True).start()
        patch("core.push.wake_worker").start()
        self.addCleanup(patch.stopall)
        users = [None, User.objects.create_user(phone="+998901000701", role="user"), User.objects.create_user(phone="+998901000702", role="usta"),
                 User.objects.create_superuser("+998901000703", "Kuchli-Parol-2026")]
        bad = []
        for u in users:
            for path in api_paths():
                if path == "/api/auth/me/":
                    continue
                for method in ("post", "patch"):
                    for body in BODIES:
                        cache.clear()
                        c = APIClient(raise_request_exception=False)
                        if u:
                            c.force_authenticate(u)
                        r = getattr(c, method)(path, body, format="json")
                        if r.status_code >= 500:
                            bad.append((u and u.role, method, path, r.status_code))
        self.assertEqual(bad, [])
