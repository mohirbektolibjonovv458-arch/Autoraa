from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from core.progress import award, record

from . import prompts, service
from .models import MODES, Conversation, Message, UsageDay, WritingReview

HISTORY_MESSAGES = 20
MAX_MESSAGE_CHARS = 4000
PREMIUM_MODES = {"speaking"}


class AIThrottle(UserRateThrottle):
    """AI so'rovlari uchun alohida daqiqalik chegara (kunlik limitdan tashqari)."""

    scope = "ai"


def ai_error(e):
    return Response({"detail": e.message, "code": e.code}, status=e.status)


def premium(user):
    return user.is_premium or user.is_staff


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "role", "content", "feedback", "created"]


class ConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = ["id", "mode", "title", "created", "updated"]


@api_view(["GET"])
def status(request):
    u = request.user
    return Response({
        "configured": service.is_configured(),
        "used_today": service.used_today(u),
        "limit": service.daily_limit(u),
        "plan": u.plan,
        "premium_modes": sorted(PREMIUM_MODES),
        "modes": [{"id": m, "label": l, "locked": m in PREMIUM_MODES and not premium(u)} for m, l in MODES],
    })


@api_view(["GET"])
def conversations(request):
    qs = Conversation.objects.filter(user=request.user)
    if m := request.query_params.get("mode"):
        qs = qs.filter(mode=m)
    return Response(ConversationSerializer(qs[:50], many=True).data)


@api_view(["GET", "DELETE"])
def conversation_detail(request, pk):
    c = get_object_or_404(Conversation, pk=pk, user=request.user)
    if request.method == "DELETE":
        c.delete()
        return Response(status=204)
    return Response({**ConversationSerializer(c).data, "messages": MessageSerializer(c.messages.all(), many=True).data})


def _career_context(user):
    from career.models import CareerResult

    r = CareerResult.objects.filter(user=user).first()
    if not r:
        return "The student has not taken the EduWay career test yet."
    from career.test_data import DIMENSIONS

    dims = ", ".join(f"{DIMENSIONS[k]['name']} ({k}) {v}%" for k, v in sorted(r.scores.items(), key=lambda x: -x[1]))
    top = "; ".join(f"{m['title']} {m['match']}%" for m in r.matches[:5])
    return f"Latest EduWay career test (RIASEC interest profile): {dims}. Top matches from the platform's scoring: {top}."


def _catalog_context(user):
    """Katalogdagi tasdiqlangan/tasdiqlanmagan ma'lumotlarni AI ga beramiz — u o'zidan to'qib chiqarmasligi uchun."""
    from catalog.models import FavoriteUniversity, SavedGrant

    lines = []
    for f in FavoriteUniversity.objects.filter(user=user).select_related("university")[:5]:
        u = f.university
        lines.append(f"Favourite university: {u.name} ({u.city}, {u.country}); official site {u.website}; data verified: {'yes' if u.verified else 'no'}")
    for s in SavedGrant.objects.filter(user=user).select_related("grant")[:5]:
        g = s.grant
        dl = g.deadline.isoformat() if g.deadline else (g.deadline_note or "not specified")
        lines.append(f"Saved grant: {g.name} ({g.country}); deadline in catalog: {dl}; verified: {'yes' if g.verified else 'no'}; official page {g.official_url}")
    return "\n".join(lines)


@api_view(["POST"])
@throttle_classes([AIThrottle])
def chat(request):
    u = request.user
    text = str(request.data.get("message", "")).strip()
    if not text:
        return Response({"detail": "Xabar bo'sh."}, status=400)
    if len(text) > MAX_MESSAGE_CHARS:
        return Response({"detail": f"Xabar juda uzun (maks. {MAX_MESSAGE_CHARS} belgi)."}, status=400)
    conv_id = request.data.get("conversation")
    if conv_id:
        conv = get_object_or_404(Conversation, pk=conv_id, user=u)
        mode = conv.mode
    else:
        mode = request.data.get("mode", "tutor")
        if mode not in dict(MODES):
            return Response({"detail": "Noto'g'ri rejim."}, status=400)
        conv = None
    if mode in PREMIUM_MODES and not premium(u):
        return Response({"detail": "Ovozli speaking mashqlari Premium tarifda mavjud.", "code": "premium_required"}, status=403)
    try:
        service.check_quota(u)
    except service.AIError as e:
        return ai_error(e)

    history = []
    if conv:
        history = [{"role": m.role, "content": m.content} for m in conv.messages.order_by("-created", "-id")[:HISTORY_MESSAGES]][::-1]
        # tarix foydalanuvchi xabari bilan boshlanishi kerak
        while history and history[0]["role"] != "user":
            history.pop(0)
    extra = ""
    if mode == "career":
        extra = _career_context(u) + "\n" + _catalog_context(u)
    elif mode in ("planner", "tutor"):
        extra = _catalog_context(u)
    effort = "low" if mode == "speaking" else "medium"
    max_tokens = 2000 if mode == "speaking" else 8000
    try:
        answer, usage = service.ask(prompts.system_for(mode, u, extra), history + [{"role": "user", "content": text}],
                                    user=u, max_tokens=max_tokens, effort=effort)
    except service.AIError as e:
        return ai_error(e)

    if not conv:
        conv = Conversation.objects.create(user=u, mode=mode, title=text[:80])
    um = Message.objects.create(conversation=conv, role="user", content=text)
    am = Message.objects.create(conversation=conv, role="assistant", content=answer, **usage)
    conv.save(update_fields=["updated"])
    service.add_usage(u, usage)
    record(u, "ai")
    if Message.objects.filter(conversation__user=u, role="user").count() >= 10:
        award(u, "ai_curious")
    return Response({
        "conversation": ConversationSerializer(conv).data,
        "user_message": MessageSerializer(um).data,
        "message": MessageSerializer(am).data,
        "used_today": service.used_today(u),
        "limit": service.daily_limit(u),
    })


@api_view(["POST"])
def feedback(request, pk):
    m = get_object_or_404(Message, pk=pk, conversation__user=request.user, role="assistant")
    v = request.data.get("value")
    if v not in ("good", "bad", ""):
        return Response({"detail": "Noto'g'ri qiymat."}, status=400)
    m.feedback = v
    m.feedback_note = str(request.data.get("note", ""))[:300]
    m.reviewed = False
    m.save(update_fields=["feedback", "feedback_note", "reviewed"])
    return Response({"feedback": v})


@api_view(["GET", "POST"])
@throttle_classes([AIThrottle])
def writing(request):
    u = request.user
    if request.method == "GET":
        qs = WritingReview.objects.filter(user=u)[:20]
        return Response([{"id": w.id, "task_type": w.task_type, "prompt": w.prompt, "text": w.text, "result": w.result, "created": w.created} for w in qs])
    if not premium(u):
        return Response({"detail": "AI Writing tekshiruvi Premium tarifda mavjud.", "code": "premium_required"}, status=403)
    task = request.data.get("task_type", "task2")
    if task not in ("task1", "task2", "general"):
        return Response({"detail": "Noto'g'ri topshiriq turi."}, status=400)
    topic = str(request.data.get("prompt", "")).strip()[:1500]
    text = str(request.data.get("text", "")).strip()
    words = len(text.split())
    if words < 50:
        return Response({"detail": "Matn juda qisqa — kamida 50 so'z yozing."}, status=400)
    if words > 700:
        return Response({"detail": "Matn juda uzun — 700 so'zdan oshmasin."}, status=400)
    try:
        service.check_quota(u, cost=2)
        result, usage = service.ask(
            prompts.WRITING_SYSTEM,
            [{"role": "user", "content": f"Task type: IELTS Writing {task}\nTask prompt: {topic or '(not given)'}\nWord count: {words}\n\nStudent essay:\n{text}"}],
            user=u, max_tokens=12000, effort="medium", schema=prompts.WRITING_SCHEMA,
        )
    except service.AIError as e:
        return ai_error(e)
    result["word_count"] = words
    w = WritingReview.objects.create(user=u, task_type=task, prompt=topic, text=text, result=result)
    service.add_usage(u, usage, cost=2)
    record(u, "lesson", amount=0, xp=15)
    return Response({"id": w.id, "result": result, "created": w.created}, status=201)


@api_view(["POST"])
@throttle_classes([AIThrottle])
def plan(request, goal_id):
    from learning.models import StudyGoal, StudyTask

    u = request.user
    if not premium(u):
        return Response({"detail": "AI asosidagi shaxsiy reja Premium tarifda. Bepul tarifda shablon reja mavjud.", "code": "premium_required"}, status=403)
    g = get_object_or_404(StudyGoal, pk=goal_id, user=u, status="active")
    done = list(StudyTask.objects.filter(goal=g, done=True).order_by("-done_at").values_list("title", flat=True)[:15])
    missed = list(StudyTask.objects.filter(goal=g, done=False, date__lt=timezone.localdate()).values_list("title", flat=True)[:10])
    ctx = (f"Goal: {g.title} (type: {g.get_kind_display()}); target: {g.target or '-'}; current level: {g.current_level or '-'}; "
           f"deadline: {g.deadline or 'none'}; available minutes per day: {g.minutes_per_day}; today: {timezone.localdate()}.\n"
           f"Recently completed tasks: {', '.join(done) or 'none'}.\nMissed tasks: {', '.join(missed) or 'none'}.\n\n"
           + prompts.profile_context(u))
    try:
        service.check_quota(u, cost=2)
        result, usage = service.ask(prompts.PLAN_SYSTEM, [{"role": "user", "content": ctx}], user=u, max_tokens=8000, schema=prompts.PLAN_SCHEMA)
    except service.AIError as e:
        return ai_error(e)
    today = timezone.localdate()
    rows = []
    for t in result.get("tasks", [])[:28]:
        off = t.get("day_offset")
        if not isinstance(off, int) or not 0 <= off <= 6:
            continue
        link = t.get("link") or ""
        rows.append(StudyTask(user=u, goal=g, source="ai", date=today + timedelta(days=off), title=str(t["title"])[:200],
                              details=str(t.get("details", ""))[:500], minutes=max(5, min(300, int(t.get("minutes") or 20))),
                              link=link if link.startswith("/") else ""))
    if not rows:
        return Response({"detail": "AI reja tuza olmadi. Qayta urinib ko'ring."}, status=502)
    StudyTask.objects.filter(goal=g, done=False, source__in=["template", "ai"], date__gte=today).delete()
    StudyTask.objects.bulk_create(rows)
    service.add_usage(u, usage, cost=2)
    return Response({"summary": result.get("summary", ""), "created": len(rows)}, status=201)


@api_view(["POST"])
@throttle_classes([AIThrottle])
def career_advice(request, result_id):
    from career.models import CareerResult
    from career.test_data import DIMENSIONS

    u = request.user
    r = get_object_or_404(CareerResult, pk=result_id, user=u)
    dims = ", ".join(f"{DIMENSIONS[k]['name']} {v}%" for k, v in sorted(r.scores.items(), key=lambda x: -x[1]))
    top = "\n".join(f"- {m['title']} ({m['match']}%)" for m in r.matches[:5])
    q = (f"My career test interest profile: {dims}.\nPlatform's top matches:\n{top}\n"
         f"My favourite subjects: {', '.join(r.answers.get('subjects', [])) or '-'}.\n\n"
         "Explain in Uzbek: what my profile says about me, why the top 3 careers may fit, what skills to start building, "
         "which study directions to consider, and 3 small next steps for this month. Remind me this is guidance, not a final verdict. Keep it under 350 words.")
    try:
        service.check_quota(u)
        text, usage = service.ask(prompts.system_for("career", u), [{"role": "user", "content": q}], user=u, max_tokens=6000)
    except service.AIError as e:
        return ai_error(e)
    r.ai_advice = text
    r.save(update_fields=["ai_advice"])
    service.add_usage(u, usage)
    return Response({"ai_advice": text})


@api_view(["POST"])
@throttle_classes([AIThrottle])
def generate_quiz(request):
    from learning.models import SUBJECTS, Question, Quiz

    u = request.user
    if not premium(u):
        return Response({"detail": "AI test generatori Premium tarifda mavjud.", "code": "premium_required"}, status=403)
    subject = request.data.get("subject")
    if subject not in dict(SUBJECTS):
        return Response({"detail": "Fanni tanlang."}, status=400)
    topic = str(request.data.get("topic", "")).strip()[:120]
    if len(topic) < 2:
        return Response({"detail": "Mavzuni kiriting."}, status=400)
    level = request.data.get("level", "medium")
    if level not in ("easy", "medium", "hard", "A1", "A2", "B1", "B2", "C1", "C2"):
        level = "medium"
    try:
        count = max(5, min(15, int(request.data.get("count", 8))))
    except (TypeError, ValueError):
        count = 8
    if Quiz.objects.filter(owner=u).count() >= 100:
        return Response({"detail": "Shaxsiy testlar soni chegaraga yetdi (100). Eskilarini o'chiring."}, status=400)
    try:
        service.check_quota(u, cost=2)
        result, usage = service.ask(
            prompts.QUIZ_SYSTEM,
            [{"role": "user", "content": f"Subject: {dict(SUBJECTS)[subject]}\nTopic: {topic}\nLevel: {level}\nNumber of questions: {count}"}],
            user=u, max_tokens=12000, schema=prompts.QUIZ_SCHEMA,
        )
    except service.AIError as e:
        return ai_error(e)
    qs = [q for q in result.get("questions", []) if isinstance(q.get("options"), list) and len(q["options"]) >= 2
          and isinstance(q.get("correct_index"), int) and 0 <= q["correct_index"] < len(q["options"])][:15]
    if len(qs) < 3:
        return Response({"detail": "AI yaroqli test tuza olmadi. Qayta urinib ko'ring."}, status=502)
    quiz = Quiz.objects.create(title=str(result.get("title") or topic)[:160], subject=subject, topic=topic[:80], level=level,
                               description="AI yaratgan shaxsiy test — xato bo'lishi mumkin, shubhali savollarni tekshiring.",
                               time_limit_seconds=count * 75, owner=u)
    Question.objects.bulk_create([Question(quiz=quiz, text=q["text"], options=[str(o) for o in q["options"]][:6], correct_index=q["correct_index"],
                                           explanation=q.get("explanation", ""), topic=str(q.get("topic", ""))[:80], order=i) for i, q in enumerate(qs)])
    service.add_usage(u, usage, cost=2)
    return Response({"quiz": quiz.id, "title": quiz.title, "questions": len(qs)}, status=201)


@api_view(["GET"])
def usage_history(request):
    rows = UsageDay.objects.filter(user=request.user).order_by("-date")[:30]
    return Response([{"date": r.date, "count": r.count} for r in rows])
