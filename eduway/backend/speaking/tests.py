from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from accounts.views import tokens_for
from core.models import Achievement

from .models import SpeakBlock, SpeakProfile, SpeakSession


class SpeakingTests(TestCase):
    def setUp(self):
        cache.clear()
        y = timezone.localdate().year
        self.u1 = self.make("+998901000001", "Aziz", y - 20)
        self.u2 = self.make("+998901000002", "Bekzod", y - 25)
        self.teen = self.make("+998901000003", "Kamola", y - 17)
        self.kid = self.make("+998901000004", "Sardor", y - 14)

    def make(self, phone, name, by):
        u = User.objects.create_user(phone=phone, first_name=name, birth_year=by)
        SpeakProfile.objects.create(user=u, rules_accepted_at=timezone.now())
        return u

    def client_for(self, u):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION="Bearer " + tokens_for(u)["access"])
        return c

    def test_age_gate_and_groups(self):
        r = self.client_for(self.kid).post("/api/speak/find/", {"level": "B1"}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json()["code"], "age")
        # 17 yoshli o'quvchi kattalar bilan juftlashmaydi
        self.client_for(self.u1).post("/api/speak/find/", {"level": "B1"}, format="json")
        r = self.client_for(self.teen).post("/api/speak/find/", {"level": "B1"}, format="json")
        self.assertEqual(r.json()["status"], "waiting")

    def test_rules_required(self):
        p = self.u1.speak_profile
        p.rules_accepted_at = None
        p.save()
        c = self.client_for(self.u1)
        self.assertEqual(c.post("/api/speak/find/", {"level": "B1"}, format="json").json()["code"], "rules")
        self.assertTrue(c.post("/api/speak/rules/").json()["eligibility"]["ok"])

    def test_match_signal_end_xp(self):
        c1, c2 = self.client_for(self.u1), self.client_for(self.u2)
        s = c1.post("/api/speak/find/", {"level": "B1"}, format="json").json()
        self.assertEqual(s["status"], "waiting")
        m = c2.post("/api/speak/find/", {"level": "B2"}, format="json").json()  # qo'shni daraja ham mos
        self.assertEqual(m["status"], "matched")
        self.assertEqual(m["id"], s["id"])
        self.assertEqual(m["role"], "callee")
        self.assertTrue(m["topic"]["p1"])
        r = c1.post(f"/api/speak/{s['id']}/signal/", {"signals": [{"kind": "offer", "payload": {"sdp": "x", "type": "offer"}}]}, format="json")
        self.assertEqual(r.status_code, 200)
        p = c2.get(f"/api/speak/{s['id']}/").json()
        self.assertEqual(p["signals"][0]["kind"], "offer")
        self.assertEqual(c1.get(f"/api/speak/{s['id']}/").json()["signals"], [])  # o'z signalini olmaydi
        # begona foydalanuvchi sessiyani ko'ra olmaydi
        self.assertEqual(self.client_for(self.teen).get(f"/api/speak/{s['id']}/").status_code, 404)
        SpeakSession.objects.filter(pk=s["id"]).update(matched_at=timezone.now() - timedelta(minutes=5))
        e = c1.post(f"/api/speak/{s['id']}/end/").json()
        self.assertEqual(e["status"], "ended")
        self.assertEqual(e["xp"], 25)
        self.u2.refresh_from_db()
        self.assertEqual(self.u2.xp, 25)
        self.assertTrue(Achievement.objects.filter(user=self.u2, code="speak_1").exists())
        self.assertEqual(c2.post(f"/api/speak/{s['id']}/rate/", {"stars": 5}, format="json").status_code, 200)
        self.assertEqual(c1.get("/api/speak/config/").json()["stats"]["rating"]["avg"], 5.0)

    def test_short_call_no_xp(self):
        c1, c2 = self.client_for(self.u1), self.client_for(self.u2)
        s = c1.post("/api/speak/find/", {"level": "B1"}, format="json").json()
        c2.post("/api/speak/find/", {"level": "B1"}, format="json")
        self.assertEqual(c2.post(f"/api/speak/{s['id']}/end/").json()["xp"], 0)

    def test_report_blocks_and_auto_suspends(self):
        bad = self.u2
        y = timezone.localdate().year
        for i in range(3):
            rep = self.make(f"+99890200000{i}", f"R{i}", y - 30)
            cr, cb = self.client_for(rep), self.client_for(bad)
            s = cr.post("/api/speak/find/", {"level": "B1"}, format="json").json()
            self.assertEqual(cb.post("/api/speak/find/", {"level": "B1"}, format="json").json()["status"], "matched")
            r = cr.post(f"/api/speak/{s['id']}/report/", {"reason": "harassment"}, format="json")
            self.assertEqual(r.status_code, 200)
            self.assertTrue(SpeakBlock.objects.filter(user=rep, blocked=bad).exists())
            if i == 2:
                break  # uchinchi shikoyatdan so'ng avtomatik to'xtatiladi
            # bloklangandan keyin qayta juftlashmaydi
            cr.post("/api/speak/find/", {"level": "B1"}, format="json")
            self.assertEqual(cb.post("/api/speak/find/", {"level": "B1"}, format="json").json()["status"], "waiting")
            cb.post(f"/api/speak/{SpeakSession.objects.filter(a=bad).first().pk}/end/")
            cr.post(f"/api/speak/{SpeakSession.objects.filter(a=rep, status='waiting').first().pk}/end/")
        bad.speak_profile.refresh_from_db()
        self.assertTrue(bad.speak_profile.suspended)
        self.assertEqual(self.client_for(bad).post("/api/speak/find/", {"level": "B1"}, format="json").json()["code"], "suspended")

    def test_partner_timeout_ends_call(self):
        c1, c2 = self.client_for(self.u1), self.client_for(self.u2)
        s = c1.post("/api/speak/find/", {"level": "B1"}, format="json").json()
        c2.post("/api/speak/find/", {"level": "B1"}, format="json")
        SpeakSession.objects.filter(pk=s["id"]).update(b_seen=timezone.now() - timedelta(minutes=1))
        self.assertEqual(c1.get(f"/api/speak/{s['id']}/").json()["status"], "ended")

    def test_stale_waiting_not_matched(self):
        c1, c2 = self.client_for(self.u1), self.client_for(self.u2)
        s = c1.post("/api/speak/find/", {"level": "B1"}, format="json").json()
        SpeakSession.objects.filter(pk=s["id"]).update(a_seen=timezone.now() - timedelta(minutes=1))
        self.assertEqual(c2.post("/api/speak/find/", {"level": "B1"}, format="json").json()["status"], "waiting")

    def test_birth_year_locked(self):
        c = self.client_for(self.kid)
        r = c.patch("/api/auth/me/", {"birth_year": 1990}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_admin_reports(self):
        admin = User.objects.create_superuser("adm@example.com", "Kuchli-parol-2026")
        c1, c2 = self.client_for(self.u1), self.client_for(self.u2)
        s = c1.post("/api/speak/find/", {"level": "B1"}, format="json").json()
        c2.post("/api/speak/find/", {"level": "B1"}, format="json")
        c1.post(f"/api/speak/{s['id']}/report/", {"reason": "personal", "note": "raqam so'radi"}, format="json")
        ca = self.client_for(admin)
        lst = ca.get("/api/admin/speak-reports/").json()
        self.assertEqual(lst[0]["reported"]["id"], self.u2.id)
        self.assertTrue(ca.post(f"/api/admin/speak-reports/{lst[0]['id']}/review/", {"action": "suspend"}, format="json").json()["suspended"])
        self.assertEqual(ca.get("/api/admin/speak-reports/").json(), [])
        self.assertEqual(self.client_for(self.u1).get("/api/admin/speak-reports/").status_code, 403)

    def test_abandoned_matched_session_closed(self):
        c1, c2 = self.client_for(self.u1), self.client_for(self.u2)
        s = c1.post("/api/speak/find/", {"level": "B1"}, format="json").json()
        c2.post("/api/speak/find/", {"level": "B1"}, format="json")
        old = timezone.now() - timedelta(minutes=5)
        SpeakSession.objects.filter(pk=s["id"]).update(a_seen=old, b_seen=old, matched_at=old - timedelta(minutes=1))
        self.client_for(self.teen).post("/api/speak/find/", {"level": "B1"}, format="json")
        x = SpeakSession.objects.get(pk=s["id"])
        self.assertEqual(x.status, "ended")
        self.assertEqual(x.ended_at, old)
