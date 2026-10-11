from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Grant, University
from learning.models import Question, Quiz


def fake_response(text, stop="end_turn"):
    return SimpleNamespace(stop_reason=stop, content=[SimpleNamespace(type="thinking"), SimpleNamespace(type="text", text=text)],
                           usage=SimpleNamespace(input_tokens=11, output_tokens=7))


class Base(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_content", verbosity=0)

    def setUp(self):
        cache.clear()  # throttling hisoblagichlari testlar orasida tozalanadi
        self.c = APIClient()
        r = self.c.post("/api/auth/register/", {"email": "Ali@Example.com", "password": "Kuchli-parol-2026", "first_name": "Ali"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.user = User.objects.get(email="ali@example.com")
        self.c.credentials(HTTP_AUTHORIZATION="Bearer " + r.json()["access"])

    def make_premium(self, user=None):
        u = user or self.user
        u.premium_until = timezone.now() + timedelta(days=30)
        u.save()


class AuthTests(Base):
    def test_login_and_profile(self):
        c = APIClient()
        self.assertEqual(c.post("/api/auth/login/", {"email": "ali@example.com", "password": "wrong"}, format="json").status_code, 400)
        r = c.post("/api/auth/login/", {"email": "ALI@example.com", "password": "Kuchli-parol-2026"}, format="json")
        self.assertEqual(r.status_code, 200)
        r = self.c.patch("/api/auth/me/", {"education_stage": "school", "grade": 10, "interests": ["dasturlash"], "onboarded": True, "ielts_score": 6.5}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["grade"], 10)
        self.assertEqual(self.c.patch("/api/auth/me/", {"grade": 15}, format="json").status_code, 400)
        self.assertEqual(self.c.patch("/api/auth/me/", {"ielts_score": 6.3}, format="json").status_code, 400)
        # read-only maydonlarni o'zgartirib bo'lmaydi
        self.c.patch("/api/auth/me/", {"premium_until": "2030-01-01T00:00:00Z", "xp": 9999}, format="json")
        self.user.refresh_from_db()
        self.assertIsNone(self.user.premium_until)
        self.assertNotEqual(self.user.xp, 9999)

    def test_duplicate_and_weak_password(self):
        c = APIClient()
        self.assertEqual(c.post("/api/auth/register/", {"email": "ali@example.com", "password": "Kuchli-parol-2026", "first_name": "A"}, format="json").status_code, 400)
        self.assertEqual(c.post("/api/auth/register/", {"email": "b@example.com", "password": "12345678", "first_name": "B"}, format="json").status_code, 400)

    def test_requires_auth(self):
        self.assertEqual(APIClient().get("/api/dashboard/").status_code, 401)


class CareerTests(Base):
    def test_full_flow(self):
        t = self.c.get("/api/career/test/").json()
        answers = {"statements": [5 if i % 6 == 1 else 2 for i in range(len(t["statements"]))],
                   "style": {q["id"]: 0 for q in t["style"]}, "goals": ["discover"], "subjects": ["matematika", "informatika"]}
        r = self.c.post("/api/career/submit/", answers, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        data = r.json()
        self.assertEqual(max(data["scores"], key=data["scores"].get), "I")
        self.assertTrue(data["matches"][0]["reasons"])
        self.assertIn(data["matches"][0]["field"], {"it", "science", "medicine"})
        bad = dict(answers, statements=[9] * len(t["statements"]))
        self.assertEqual(self.c.post("/api/career/submit/", bad, format="json").status_code, 400)
        slug = data["matches"][0]["slug"]
        self.assertTrue(self.c.post(f"/api/career/careers/{slug}/save/").json()["saved"])
        self.assertTrue(self.c.get(f"/api/career/careers/{slug}/").json()["saved"])


class CatalogTests(Base):
    def test_universities_filter_and_favorite(self):
        r = self.c.get("/api/universities/?field=it&country=O'zbekiston").json()
        self.assertGreater(r["count"], 0)
        uid = r["results"][0]["id"]
        self.c.post(f"/api/universities/{uid}/favorite/")
        fav = self.c.get("/api/universities/?favorites=1").json()
        self.assertEqual([u["id"] for u in fav["results"]], [uid])
        self.assertEqual(len(self.c.get(f"/api/universities/compare/?ids={uid},999").json()), 1)
        University.objects.filter(pk=uid).update(is_published=False)
        self.assertEqual(self.c.get(f"/api/universities/{uid}/").status_code, 404)

    def test_grant_save_and_checklist(self):
        g = Grant.objects.first()
        r = self.c.post(f"/api/grants/{g.id}/save/")
        self.assertEqual(r.status_code, 201)
        saved = r.json()
        self.assertGreater(saved["progress"]["total"], 0)
        item = saved["checklist"][0]["id"]
        self.assertTrue(self.c.patch(f"/api/grants/checklist/{item}/", {"done": True}, format="json").json()["done"])
        other = APIClient()
        tok = other.post("/api/auth/register/", {"email": "x@example.com", "password": "Kuchli-parol-2026", "first_name": "X"}, format="json").json()["access"]
        other.credentials(HTTP_AUTHORIZATION="Bearer " + tok)
        self.assertEqual(other.patch(f"/api/grants/checklist/{item}/", {"done": False}, format="json").status_code, 404)
        detail = self.c.get(f"/api/grants/{g.id}/").json()
        self.assertIn(detail["match"]["level"], {"good", "partial", "low", "unknown"})


class QuizTests(Base):
    def test_start_submit_mistakes(self):
        quiz = Quiz.objects.get(title="Foizlar va nisbatlar")
        r = self.c.post(f"/api/learn/quizzes/{quiz.id}/start/")
        self.assertEqual(r.status_code, 201)
        self.assertNotIn("correct_index", r.json()["questions"][0])
        qs = list(quiz.questions.all())
        answers = {str(q.id): q.correct_index for q in qs[:-1]}
        answers[str(qs[-1].id)] = (qs[-1].correct_index + 1) % len(qs[-1].options)
        res = self.c.post(f"/api/learn/attempts/{r.json()['attempt']}/submit/", {"answers": answers}, format="json").json()
        self.assertEqual(res["score"], len(qs) - 1)
        self.assertEqual(self.c.post(f"/api/learn/attempts/{r.json()['attempt']}/submit/", {"answers": answers}, format="json").status_code, 400)
        m = self.c.get("/api/learn/mistakes/").json()
        self.assertEqual(len(m), 1)
        fix = self.c.post("/api/learn/mistakes/submit/", {"answers": {str(qs[-1].id): qs[-1].correct_index}}, format="json").json()
        self.assertEqual(fix["fixed"], 1)
        self.assertEqual(self.c.get("/api/learn/mistakes/").json(), [])
        self.user.refresh_from_db()
        self.assertEqual(self.user.streak, 1)
        self.assertGreater(self.user.xp, 0)

    def test_premium_quiz_locked(self):
        quiz = Quiz.objects.filter(is_premium=True).first()
        self.assertEqual(self.c.post(f"/api/learn/quizzes/{quiz.id}/start/").status_code, 403)
        self.make_premium()
        self.assertEqual(self.c.post(f"/api/learn/quizzes/{quiz.id}/start/").status_code, 201)

    def test_private_quiz_hidden_from_others(self):
        other = User.objects.create_user("o@example.com", "Kuchli-parol-2026")
        q = Quiz.objects.create(title="Shaxsiy", subject="math", owner=other)
        Question.objects.create(quiz=q, text="1+1", options=["2", "3"], correct_index=0)
        self.assertEqual(self.c.post(f"/api/learn/quizzes/{q.id}/start/").status_code, 404)
        self.assertNotIn(q.id, [x["id"] for x in self.c.get("/api/learn/quizzes/").json()])


class EnglishAndPlanTests(Base):
    def test_vocab_review_schedule(self):
        w = self.c.post("/api/learn/vocab/", {"word": "deadline", "translation": "oxirgi muddat"}, format="json").json()
        self.assertEqual(self.c.post("/api/learn/vocab/", {"word": "Deadline", "translation": "x"}, format="json").status_code, 400)
        r = self.c.post(f"/api/learn/vocab/{w['id']}/review/", {"quality": 2}, format="json").json()
        self.assertEqual(r["interval_days"], 1)
        r = self.c.post(f"/api/learn/vocab/{w['id']}/review/", {"quality": 3}, format="json").json()
        self.assertEqual(r["interval_days"], 5)
        r = self.c.post(f"/api/learn/vocab/{w['id']}/review/", {"quality": 0}, format="json").json()
        self.assertEqual(r["interval_days"], 0)

    def test_goal_limit_and_template_plan(self):
        g = self.c.post("/api/learn/goals/", {"title": "IELTS 7.0", "kind": "ielts", "target": "7.0", "minutes_per_day": 60}, format="json")
        self.assertEqual(g.status_code, 201)
        self.assertEqual(self.c.post("/api/learn/goals/", {"title": "Matematika", "kind": "math"}, format="json").status_code, 403)
        r = self.c.post(f"/api/learn/goals/{g.json()['id']}/generate/")
        self.assertGreaterEqual(r.json()["created"], 7)
        today = self.c.get(f"/api/learn/tasks/?date={timezone.localdate()}").json()
        self.assertTrue(today)
        self.assertLessEqual(sum(t["minutes"] for t in today), 60)
        t = self.c.patch(f"/api/learn/tasks/{today[0]['id']}/", {"done": True}, format="json").json()
        self.assertTrue(t["done"])
        d = self.c.get("/api/dashboard/").json()
        self.assertEqual(d["today"]["done"], 1)
        self.assertEqual(d["streak"], 1)

    def test_free_stats_limited(self):
        s = self.c.get("/api/learn/stats/").json()
        self.assertEqual(s["range_days"], 14)
        self.assertNotIn("trend", s)


class AdminTests(Base):
    def test_admin_only(self):
        self.assertEqual(self.c.get("/api/admin/overview/").status_code, 403)
        self.assertEqual(self.c.post("/api/admin/universities/", {}, format="json").status_code, 403)
        self.user.is_staff = True
        self.user.save()
        self.assertEqual(self.c.get("/api/admin/overview/").status_code, 200)
        r = self.c.post("/api/admin/universities/", {"name": "Test", "city": "Toshkent", "website": "https://example.uz", "verified": True}, format="json")
        self.assertEqual(r.status_code, 400)  # tasdiqlash uchun manba kerak
        r = self.c.post("/api/admin/universities/", {"name": "Test", "city": "Toshkent", "website": "https://example.uz", "source_url": "https://example.uz", "verified": True}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        # oddiy admin o'zini bloklay olmaydi va boshqaga admin rolini bera olmaydi
        self.assertEqual(self.c.patch(f"/api/admin/users/{self.user.id}/", {"is_active": False}, format="json").status_code, 400)
        other = User.objects.create_user("o@example.com", "Kuchli-parol-2026")
        self.assertEqual(self.c.patch(f"/api/admin/users/{other.id}/", {"is_staff": True}, format="json").status_code, 400)
        r = self.c.post(f"/api/admin/users/{other.id}/premium/", {"days": 30}, format="json")
        self.assertEqual(r.json()["plan"], "premium")

    @override_settings(PREMIUM_PAYMENT_INSTRUCTIONS="Karta: test")
    def test_premium_request_flow(self):
        self.assertEqual(self.c.post("/api/billing/requests/", {"months": 1}, format="json").status_code, 400)
        r = self.c.post("/api/billing/requests/", {"months": 3, "payment_reference": "chek 123"}, format="json")
        self.assertEqual(r.status_code, 201)
        admin = User.objects.create_superuser("admin@example.com", "Kuchli-parol-2026")
        ac = APIClient()
        ac.force_authenticate(admin)
        self.assertEqual(ac.post(f"/api/admin/premium-requests/{r.json()['id']}/review/", {"action": "approve"}, format="json").status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_premium)

    def test_premium_request_without_payment_config(self):
        r = self.c.post("/api/billing/requests/", {"months": 1, "payment_reference": "x"}, format="json")
        self.assertEqual(r.status_code, 503)
        self.assertFalse(self.c.get("/api/billing/plans/").json()["payment_configured"])


class AITests(Base):
    @override_settings(ANTHROPIC_API_KEY="")
    def test_not_configured(self):
        self.assertFalse(self.c.get("/api/ai/status/").json()["configured"])
        r = self.c.post("/api/ai/chat/", {"mode": "tutor", "message": "Salom"}, format="json")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json()["code"], "ai_not_configured")

    @override_settings(ANTHROPIC_API_KEY="test-key", AI_DAILY_LIMIT_FREE=2)
    @mock.patch("ai.service.client")
    def test_chat_history_and_quota(self, client):
        create = client.return_value.beta.messages.create
        create.return_value = fake_response("x = 3")
        r = self.c.post("/api/ai/chat/", {"mode": "tutor", "message": "2x = 6 ni yeching"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        conv = r.json()["conversation"]["id"]
        self.assertEqual(r.json()["message"]["content"], "x = 3")
        kwargs = create.call_args.kwargs
        self.assertEqual(kwargs["thinking"], {"type": "adaptive"})
        self.assertIn("Ali", kwargs["system"])
        r = self.c.post("/api/ai/chat/", {"conversation": conv, "message": "Tushunmadim"}, format="json")
        self.assertEqual(len(create.call_args.kwargs["messages"]), 3)  # tarix + yangi savol
        r = self.c.post("/api/ai/chat/", {"conversation": conv, "message": "Yana"}, format="json")
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.json()["code"], "ai_limit_reached")
        detail = self.c.get(f"/api/ai/conversations/{conv}/").json()
        self.assertEqual(len(detail["messages"]), 4)

    @override_settings(ANTHROPIC_API_KEY="test-key")
    @mock.patch("ai.service.client")
    def test_upstream_errors_are_mapped(self, client):
        import anthropic
        import httpx2

        req = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
        client.return_value.beta.messages.create.side_effect = anthropic.APITimeoutError(request=req)
        r = self.c.post("/api/ai/chat/", {"mode": "tutor", "message": "Salom"}, format="json")
        self.assertEqual(r.status_code, 504)
        client.return_value.beta.messages.create.side_effect = None
        client.return_value.beta.messages.create.return_value = fake_response("", stop="refusal")
        self.assertEqual(self.c.post("/api/ai/chat/", {"mode": "tutor", "message": "Salom"}, format="json").status_code, 422)
        from ai.models import UsageDay
        self.assertFalse(UsageDay.objects.filter(user=self.user, count__gt=0).exists())  # muvaffaqiyatsiz so'rov limitdan yechilmaydi

    @override_settings(ANTHROPIC_API_KEY="test-key")
    @mock.patch("ai.service.client")
    def test_premium_features_enforced_on_backend(self, client):
        client.return_value.beta.messages.create.return_value = fake_response('{"title":"T","questions":[]}')
        self.assertEqual(self.c.post("/api/ai/chat/", {"mode": "speaking", "message": "Hello"}, format="json").status_code, 403)
        self.assertEqual(self.c.post("/api/ai/writing/", {"text": "word " * 60}, format="json").status_code, 403)
        self.assertEqual(self.c.post("/api/ai/quiz/", {"subject": "math", "topic": "Kasrlar"}, format="json").status_code, 403)
        client.return_value.beta.messages.create.assert_not_called()

    @override_settings(ANTHROPIC_API_KEY="test-key")
    @mock.patch("ai.service.client")
    def test_ai_quiz_and_plan_for_premium(self, client):
        import json

        self.make_premium()
        quiz_json = {"title": "Kasrlar", "questions": [
            {"text": f"{i}/2 + {i}/2 = ?", "options": [str(i), "0", "1", "2"], "correct_index": 0, "explanation": "...", "topic": "Kasrlar"} for i in range(3, 9)]}
        client.return_value.beta.messages.create.return_value = fake_response(json.dumps(quiz_json))
        r = self.c.post("/api/ai/quiz/", {"subject": "math", "topic": "Kasrlar", "count": 6}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(Quiz.objects.get(pk=r.json()["quiz"]).owner, self.user)

        goal = self.c.post("/api/learn/goals/", {"title": "IELTS", "kind": "ielts", "minutes_per_day": 45}, format="json").json()
        plan = {"summary": "Reja", "tasks": [{"day_offset": d, "title": "Reading", "details": "1 matn", "minutes": 30, "link": "/practice"} for d in range(7)]
                + [{"day_offset": 12, "title": "X", "details": "", "minutes": 10, "link": "https://evil.example"}]}
        client.return_value.beta.messages.create.return_value = fake_response(json.dumps(plan))
        r = self.c.post(f"/api/ai/plan/{goal['id']}/", format="json")
        self.assertEqual(r.json()["created"], 7)
