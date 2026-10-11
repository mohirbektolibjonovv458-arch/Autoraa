from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from accounts.views import tokens_for
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
        self.user = User.objects.create_user("ali@example.com", "Kuchli-parol-2026", first_name="Ali")
        self.c.credentials(HTTP_AUTHORIZATION="Bearer " + tokens_for(self.user)["access"])

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
        tok = tokens_for(User.objects.create_user(phone="+998901112233"))["access"]
        other.credentials(HTTP_AUTHORIZATION="Bearer " + tok)
        self.assertEqual(other.patch(f"/api/grants/checklist/{item}/", {"done": False}, format="json").status_code, 404)
        detail = self.c.get(f"/api/grants/{g.id}/").json()
        self.assertIn(detail["match"]["level"], {"good", "partial", "low", "unknown"})


class QuizTests(Base):
    def _correct_answers(self, attempt_id):
        from learning.models import Attempt

        plan = Attempt.objects.get(pk=attempt_id).answers["plan"]
        return {str(i): e["perm"].index(e["correct_index"]) for i, e in enumerate(plan)}

    def test_start_submit_mistakes(self):
        quiz = Quiz.objects.get(title="Present Simple vs Present Continuous")
        r = self.c.post(f"/api/learn/quizzes/{quiz.id}/start/")
        self.assertEqual(r.status_code, 201)
        self.assertNotIn("correct_index", r.json()["questions"][0])
        self.assertEqual(len(r.json()["questions"]), 8)  # bazadan tasodifiy 8 tasi
        answers = self._correct_answers(r.json()["attempt"])
        answers["7"] = (answers["7"] + 1) % 4  # bitta xato
        res = self.c.post(f"/api/learn/attempts/{r.json()['attempt']}/submit/", {"answers": answers}, format="json").json()
        self.assertEqual(res["score"], 7)
        self.assertEqual(self.c.post(f"/api/learn/attempts/{r.json()['attempt']}/submit/", {"answers": answers}, format="json").status_code, 400)
        m = self.c.get("/api/learn/mistakes/").json()
        self.assertEqual(len(m), 1)
        q = Question.objects.get(pk=m[0]["question"]["id"])
        fix = self.c.post("/api/learn/mistakes/submit/", {"answers": {str(q.id): q.correct_index}}, format="json").json()
        self.assertEqual(fix["fixed"], 1)
        self.assertEqual(self.c.get("/api/learn/mistakes/").json(), [])
        self.user.refresh_from_db()
        self.assertEqual(self.user.streak, 1)

    def test_attempts_differ(self):
        quiz = Quiz.objects.get(title="Present Simple vs Present Continuous")
        rounds = [tuple((q["text"], tuple(q["options"])) for q in self.c.post(f"/api/learn/quizzes/{quiz.id}/start/").json()["questions"]) for _ in range(4)]
        self.assertGreater(len(set(rounds)), 1)  # tartib/tanlov/variantlar har safar boshqacha

    def test_generated_quiz_new_numbers_each_time(self):
        quiz = Quiz.objects.get(generator="linear")
        a = self.c.post(f"/api/learn/quizzes/{quiz.id}/start/").json()
        b = self.c.post(f"/api/learn/quizzes/{quiz.id}/start/").json()
        self.assertNotEqual([q["text"] for q in a["questions"]], [q["text"] for q in b["questions"]])
        res = self.c.post(f"/api/learn/attempts/{a['attempt']}/submit/", {"answers": self._correct_answers(a["attempt"])}, format="json").json()
        self.assertEqual(res["score"], res["total"])

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
    def test_token_cleanup(self):
        from accounts import telegram
        with mock.patch.dict("os.environ", {"TELEGRAM_BOT_TOKEN": ' "123:abc" '}):
            self.assertEqual(telegram.token(), "123:abc")
        with mock.patch.dict("os.environ", {"TELEGRAM_BOT_TOKEN": "TELEGRAM_BOT_TOKEN=123:abc"}):
            self.assertEqual(telegram.token(), "123:abc")

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


class NewFeatureTests(Base):
    def test_focus_minutes_counted_by_server_time(self):
        from learning.models import FocusSession

        s = self.c.post("/api/learn/focus/start/", {"minutes": 25, "label": "Matematika"}, format="json").json()
        self.assertEqual(self.c.post("/api/learn/focus/start/", {"minutes": 500}, format="json").status_code, 400)
        # mijoz vaqtini aldab bo'lmaydi: darhol yakunlasa 0 daqiqa
        FocusSession.objects.filter(pk=s["id"]).update(started_at=timezone.now() - timedelta(minutes=40))
        r = self.c.post(f"/api/learn/focus/{s['id']}/finish/", {}, format="json").json()
        self.assertEqual(r["minutes"], 25)  # rejalashtirilgandan oshmaydi
        self.assertEqual(r["today"], 25)
        self.assertEqual(self.c.post(f"/api/learn/focus/{s['id']}/finish/", {}, format="json").status_code, 400)
        s2 = self.c.post("/api/learn/focus/start/", {"minutes": 15}, format="json").json()
        self.assertEqual(self.c.post(f"/api/learn/focus/{s2['id']}/finish/", {}, format="json").json()["minutes"], 0)
        self.assertEqual(self.c.get("/api/learn/focus/").json()["today"], 25)
        self.assertEqual(self.c.get("/api/dashboard/").json()["focus"]["today"], 25)

    def test_daily_challenge_once_per_day(self):
        from learning.models import DailyChallenge

        d = self.c.get("/api/learn/challenge/").json()
        self.assertFalse(d["done"])
        self.assertEqual(len(d["questions"]), 5)
        self.assertEqual(d["questions"], self.c.get("/api/learn/challenge/").json()["questions"])  # kun davomida o'zgarmaydi
        plan = DailyChallenge.objects.get(user=self.user).plan
        answers = {str(i): e["perm"].index(e["correct_index"]) for i, e in enumerate(plan)}
        r = self.c.post("/api/learn/challenge/submit/", {"answers": answers}, format="json").json()
        self.assertEqual(r["score"], 5)
        self.assertEqual(self.c.post("/api/learn/challenge/submit/", {"answers": answers}, format="json").status_code, 400)
        self.assertTrue(self.c.get("/api/learn/challenge/").json()["done"])
        self.assertTrue(self.c.get("/api/dashboard/").json()["challenge_done"])

    def test_placement_sets_level(self):
        from learning.placement import QUESTIONS

        qs = self.c.get("/api/learn/placement/").json()["questions"]
        self.assertNotIn("correct", qs[0])
        ans = {str(q["id"]): q["answer"] for q in QUESTIONS if q["level"] in ("A1", "A2", "B1")}
        r = self.c.post("/api/learn/placement/submit/", {"answers": ans}, format="json").json()
        self.assertEqual(r["level"], "B1")
        self.user.refresh_from_db()
        self.assertEqual(self.user.english_level, "B1")
        self.assertEqual(self.c.post("/api/learn/placement/submit/", {"answers": {}}, format="json").json()["level"], "A1")

    def test_search(self):
        r = self.c.get("/api/search/?q=Toshkent").json()["results"]
        self.assertTrue(any(x["type"] == "university" for x in r))
        self.assertTrue(any(x["type"] == "career" for x in self.c.get("/api/search/?q=dasturchi").json()["results"]))
        self.assertEqual(self.c.get("/api/search/?q=a").json()["results"], [])


class PushTests(Base):
    def test_subscribe_and_notification_push(self):
        from unittest import mock as m

        k = self.c.get("/api/push/key/").json()
        self.assertEqual(len(k["public_key"]), 87)
        self.assertEqual(self.c.get("/api/push/key/").json()["public_key"], k["public_key"])  # barqaror
        bad = {"subscription": {"endpoint": "https://evil.example/x", "keys": {"p256dh": "a", "auth": "b"}}}
        self.assertEqual(self.c.post("/api/push/subscribe/", bad, format="json").status_code, 400)
        good = {"subscription": {"endpoint": "https://fcm.googleapis.com/fcm/send/abc", "keys": {"p256dh": "p", "auth": "a"}}}
        self.assertEqual(self.c.post("/api/push/subscribe/", good, format="json").status_code, 201)
        class SyncThread:  # fon oqimini testda sinxron bajaramiz
            def __init__(self, target, args, **kw):
                self.target, self.args = target, args

            def start(self):
                self.target(*self.args)

        with m.patch("pywebpush.webpush") as wp, m.patch("core.push.threading.Thread", SyncThread), \
                m.patch("core.push.close_old_connections"), self.captureOnCommitCallbacks(execute=True):
            from core.progress import notify
            notify(self.user, "Salom", "Test")
        self.assertTrue(wp.called)
        payload = wp.call_args.kwargs["data"]
        self.assertIn("Salom", payload)

    def test_evening_reminder_only_for_inactive_subscribed(self):
        from core.models import Notification, PushSubscription
        from core.scheduler import evening_reminders

        PushSubscription.objects.create(user=self.user, endpoint="https://fcm.googleapis.com/fcm/send/x", p256dh="p", auth="a")
        with mock.patch("core.push.notify_push"):
            self.assertEqual(evening_reminders(), 1)
            self.assertTrue(Notification.objects.filter(user=self.user, kind="reminder").exists())
            self.user.push_reminders = False
            self.user.save()
            self.assertEqual(evening_reminders(), 0)



@override_settings(SECRET_KEY="t" * 50)
class PhoneLoginTests(TestCase):
    """Telefon + Telegram kod oqimi. Telegram API soxtalashtiriladi, bot xabarlari webhook orqali yuboriladi."""

    def setUp(self):
        cache.clear()
        self.sent = []
        patcher = mock.patch("accounts.telegram.call", side_effect=self.fake_call)
        patcher.start()
        self.addCleanup(patcher.stop)
        env = mock.patch.dict("os.environ", {"TELEGRAM_BOT_TOKEN": "123:abc"})
        env.start()
        self.addCleanup(env.stop)
        from accounts import telegram
        telegram._username["value"] = "eduway_test_bot"
        self.c = APIClient()

    def fake_call(self, method, data=None, timeout=15):
        if method == "sendMessage":
            self.sent.append(data)
        return {"ok": True, "result": {}}

    def last_code(self):
        import re as _re
        return _re.search(r"<code>(\d{4})</code>", self.sent[-1]["text"]).group(1)

    def webhook(self, message):
        from accounts.telegram import webhook_secret
        return self.c.post("/api/auth/telegram/webhook/", {"update_id": 1, "message": message}, format="json",
                           HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN=webhook_secret())

    def test_full_flow_new_user_then_login(self):
        self.assertEqual(self.c.post("/api/auth/phone/start/", {"phone": "90 123 45 67"}, format="json").json()["code"], "not_registered")
        self.assertEqual(self.c.post("/api/auth/phone/start/", {"phone": "90 123 45 67", "mode": "register"}, format="json").status_code, 400)
        r = self.c.post("/api/auth/phone/start/", {"phone": "90 123 45 67", "mode": "register", "first_name": "Malika"}, format="json").json()
        self.assertEqual(r["status"], "need_bot")
        self.assertIn("t.me/eduway_test_bot?start=", r["bot_url"])
        tok = r["token"]
        chat = {"id": 555, "type": "private"}
        self.webhook({"chat": chat, "from": {"id": 555, "first_name": "Malika"}, "text": f"/start {tok}"})
        self.assertIn("Raqamni ulashish", str(self.sent[-1]))
        # boshqa odamning kontakti qabul qilinmaydi
        self.webhook({"chat": chat, "from": {"id": 555}, "contact": {"user_id": 777, "phone_number": "+998901234567"}})
        self.assertEqual(self.c.get(f"/api/auth/phone/status/?token={tok}").json()["status"], "need_bot")
        self.webhook({"chat": chat, "from": {"id": 555, "first_name": "Malika"}, "contact": {"user_id": 555, "phone_number": "998901234567"}})
        self.assertEqual(self.c.get(f"/api/auth/phone/status/?token={tok}").json()["status"], "code_sent")
        code = self.last_code()
        wrong = "0000" if code != "0000" else "1111"
        self.assertEqual(self.c.post("/api/auth/phone/verify/", {"token": tok, "code": wrong}, format="json").status_code, 400)
        v = self.c.post("/api/auth/phone/verify/", {"token": tok, "code": code}, format="json").json()
        self.assertTrue(v["is_new"])
        self.assertEqual(v["user"]["phone"], "+998901234567")
        self.assertEqual(v["user"]["first_name"], "Malika")
        # kod qayta ishlatilmaydi
        self.assertEqual(self.c.post("/api/auth/phone/verify/", {"token": tok, "code": code}, format="json").status_code, 400)
        # keyingi kirish: raqam ulangan — kod darhol keladi, bot ochish shart emas
        r2 = self.c.post("/api/auth/phone/start/", {"phone": "+998 90 123 45 67"}, format="json").json()
        self.assertEqual(r2["status"], "code_sent")
        v2 = self.c.post("/api/auth/phone/verify/", {"token": r2["token"], "code": self.last_code()}, format="json").json()
        self.assertFalse(v2["is_new"])
        self.assertEqual(User.objects.filter(phone="+998901234567").count(), 1)
        again = self.c.post("/api/auth/phone/start/", {"phone": "901234567", "mode": "register", "first_name": "X"}, format="json")
        self.assertEqual(again.json()["code"], "already_registered")

    def test_attempt_limit_and_bad_phone(self):
        self.assertEqual(self.c.post("/api/auth/phone/start/", {"phone": "12345"}, format="json").status_code, 400)
        from accounts.models import TelegramLink
        TelegramLink.objects.create(phone="+998901112233", chat_id=9)
        r = self.c.post("/api/auth/phone/start/", {"phone": "901112233", "mode": "register", "first_name": "Ali"}, format="json").json()
        for _ in range(5):
            self.c.post("/api/auth/phone/verify/", {"token": r["token"], "code": "abcd"}, format="json")
        code = self.last_code()
        res = self.c.post("/api/auth/phone/verify/", {"token": r["token"], "code": code}, format="json")
        self.assertEqual(res.json()["code"], "too_many")

    def test_webhook_requires_secret(self):
        self.assertEqual(self.c.post("/api/auth/telegram/webhook/", {"message": {}}, format="json").status_code, 403)

    def test_token_cleanup(self):
        from accounts import telegram
        with mock.patch.dict("os.environ", {"TELEGRAM_BOT_TOKEN": ' "123:abc" '}):
            self.assertEqual(telegram.token(), "123:abc")
        with mock.patch.dict("os.environ", {"TELEGRAM_BOT_TOKEN": "TELEGRAM_BOT_TOKEN=123:abc"}):
            self.assertEqual(telegram.token(), "123:abc")

    def test_not_configured(self):
        with mock.patch.dict("os.environ", {"TELEGRAM_BOT_TOKEN": ""}):
            self.assertEqual(self.c.post("/api/auth/phone/start/", {"phone": "901234567"}, format="json").status_code, 503)
