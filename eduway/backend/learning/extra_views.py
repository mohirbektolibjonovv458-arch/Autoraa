"""Fokus taymer, kunlik challenge va ingliz tili darajasini aniqlash testi."""
import random
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.models import ActivityDay
from core.progress import award, notify, record

from . import placement
from .models import DailyChallenge, FocusSession, Mistake, Question, StudyTask
from .serializers import QuestionPublicSerializer

FOCUS_MIN, FOCUS_MAX = 5, 120
FOCUS_DAILY_CAP = 600  # kuniga ko'pi bilan 10 soat hisobga olinadi
CHALLENGE_SIZE = 5


# --- Fokus taymer ---

def _focus_today(user):
    row = ActivityDay.objects.filter(user=user, date=timezone.localdate()).first()
    return row.focus_minutes if row else 0


@api_view(["GET"])
def focus_overview(request):
    u = request.user
    today = timezone.localdate()
    start = today - timedelta(days=6)
    act = {a.date: a.focus_minutes for a in ActivityDay.objects.filter(user=u, date__gte=start)}
    active = FocusSession.objects.filter(user=u, finished_at__isnull=True).first()
    sessions = FocusSession.objects.filter(user=u, finished_at__isnull=False).select_related("task")[:10]
    total = ActivityDay.objects.filter(user=u).aggregate(s=Sum("focus_minutes"))["s"] or 0
    return Response({
        "today": act.get(today, 0),
        "goal": u.daily_minutes,
        "total": total,
        "week": [{"date": start + timedelta(days=i), "minutes": act.get(start + timedelta(days=i), 0)} for i in range(7)],
        "active": {"id": active.id, "planned_minutes": active.planned_minutes, "started_at": active.started_at, "label": active.label} if active else None,
        "sessions": [{"id": s.id, "label": s.label or (s.task.title if s.task else ""), "minutes": s.minutes, "started_at": s.started_at} for s in sessions],
    })


@api_view(["POST"])
def focus_start(request):
    u = request.user
    try:
        planned = int(request.data.get("minutes", 25))
    except (TypeError, ValueError):
        return Response({"detail": "Daqiqa noto'g'ri."}, status=400)
    if not FOCUS_MIN <= planned <= FOCUS_MAX:
        return Response({"detail": f"{FOCUS_MIN}–{FOCUS_MAX} daqiqa oralig'ida tanlang."}, status=400)
    task = None
    if tid := request.data.get("task"):
        task = StudyTask.objects.filter(pk=tid, user=u).first()
    # tugallanmay qolgan eski sessiya yopiladi (hisobga olinmaydi)
    FocusSession.objects.filter(user=u, finished_at__isnull=True).update(finished_at=timezone.now(), minutes=0)
    s = FocusSession.objects.create(user=u, planned_minutes=planned, task=task, label=str(request.data.get("label", ""))[:120])
    return Response({"id": s.id, "planned_minutes": planned, "started_at": s.started_at, "label": s.label}, status=201)


@api_view(["POST"])
def focus_finish(request, pk):
    u = request.user
    with transaction.atomic():
        s = get_object_or_404(FocusSession.objects.select_for_update(), pk=pk, user=u)
        if s.finished_at:
            return Response({"detail": "Sessiya allaqachon yakunlangan."}, status=400)
        elapsed = int((timezone.now() - s.started_at).total_seconds() // 60)
        minutes = max(0, min(elapsed, s.planned_minutes))
        minutes = min(minutes, max(0, FOCUS_DAILY_CAP - _focus_today(u)))
        s.minutes, s.finished_at = minutes, timezone.now()
        s.save(update_fields=["minutes", "finished_at"])
    xp = 0
    if minutes >= 1:
        xp = minutes // 5 * 2
        record(u, "focus", amount=minutes, xp=xp)
        total = ActivityDay.objects.filter(user=u).aggregate(s=Sum("focus_minutes"))["s"] or 0
        if total >= 60:
            award(u, "focus_60")
        if total >= 600:
            award(u, "focus_600")
        if request.data.get("complete_task") and s.task and not s.task.done:
            s.task.done, s.task.done_at = True, timezone.now()
            s.task.save(update_fields=["done", "done_at"])
            record(u, "task")
    return Response({"minutes": minutes, "xp": xp, "today": _focus_today(u), "goal": u.daily_minutes})


@api_view(["POST"])
def focus_cancel(request, pk):
    FocusSession.objects.filter(pk=pk, user=request.user, finished_at__isnull=True).update(finished_at=timezone.now(), minutes=0)
    return Response(status=204)


# --- Kunlik challenge ---

def _challenge_questions(user, date):
    pool = list(Question.objects.filter(quiz__is_published=True, quiz__is_premium=False, quiz__owner__isnull=True)
                .select_related("quiz").order_by("id").values_list("id", flat=True))
    rnd = random.Random(f"{user.id}:{date.isoformat()}")
    ids = rnd.sample(pool, min(CHALLENGE_SIZE, len(pool)))
    qmap = {q.id: q for q in Question.objects.filter(pk__in=ids).select_related("quiz")}
    return [qmap[i] for i in ids if i in qmap]


@api_view(["GET"])
def challenge(request):
    u = request.user
    today = timezone.localdate()
    done = DailyChallenge.objects.filter(user=u, date=today).first()
    streak = DailyChallenge.objects.filter(user=u).count()
    if done:
        return Response({"date": today, "done": True, "score": done.score, "total": done.total, "items": done.answers.get("items", []), "count": streak})
    qs = _challenge_questions(u, today)
    return Response({"date": today, "done": False, "count": streak,
                     "questions": [{**QuestionPublicSerializer(q).data, "subject": q.quiz.subject} for q in qs]})


@api_view(["POST"])
def challenge_submit(request):
    u = request.user
    today = timezone.localdate()
    answers = request.data.get("answers")
    if not isinstance(answers, dict):
        return Response({"detail": "Javoblar formati noto'g'ri."}, status=400)
    qs = _challenge_questions(u, today)
    items, score = [], 0
    for q in qs:
        raw = answers.get(str(q.id))
        chosen = raw if isinstance(raw, int) and 0 <= raw < len(q.options) else None
        correct = chosen == q.correct_index
        score += correct
        items.append({"question": q.id, "text": q.text, "options": q.options, "chosen": chosen, "correct_index": q.correct_index,
                      "correct": correct, "explanation": q.explanation, "topic": q.topic})
        if not correct:
            m, created = Mistake.objects.get_or_create(user=u, question=q)
            if not created:
                Mistake.objects.filter(pk=m.pk).update(times=m.times + 1, resolved=False)
    try:
        with transaction.atomic():
            DailyChallenge.objects.create(user=u, date=today, score=score, total=len(qs), answers={"items": items})
    except IntegrityError:
        return Response({"detail": "Bugungi challenge allaqachon bajarilgan."}, status=400)
    xp = 15 + 5 * score
    record(u, "quiz", xp=xp)
    award(u, "challenge_1")
    count = DailyChallenge.objects.filter(user=u).count()
    if count >= 7:
        award(u, "challenge_7")
    return Response({"score": score, "total": len(qs), "xp": xp, "items": items, "count": count})


# --- Daraja aniqlash ---

@api_view(["GET"])
def placement_test(request):
    return Response({"questions": placement.public_questions(), "current": request.user.english_level})


@api_view(["POST"])
def placement_submit(request):
    answers = request.data.get("answers")
    if not isinstance(answers, dict):
        return Response({"detail": "Javoblar formati noto'g'ri."}, status=400)
    level, breakdown = placement.evaluate(answers)
    u = request.user
    u.english_level = level
    u.save(update_fields=["english_level"])
    if award(u, "english_placed"):
        record(u, "quiz", xp=20)
    notify(u, f"Ingliz tili darajangiz: {level}", "Darslar va tavsiyalar endi shu darajaga moslashtiriladi.", "/english", "result")
    return Response({"level": level, "breakdown": breakdown})
