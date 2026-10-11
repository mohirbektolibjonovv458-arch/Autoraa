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

from . import placement, rounds
from .models import DailyChallenge, FocusSession, Question, StudyTask

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

CHALLENGE_GENERATORS = ["percent", "linear", "quadratic", "fractions", "physics", "informatics", "logic"]


def _build_challenge(user):
    """Har bir foydalanuvchiga har kuni boshqa savollar: 2 ta generator savoli + 3 ta bazadan (tasodifiy fanlar)."""
    rnd = random.SystemRandom()
    plan = []
    for name in rnd.sample(CHALLENGE_GENERATORS, 2):
        plan += rounds.from_generator(rnd, name, 1)
    pool = list(Question.objects.filter(quiz__is_published=True, quiz__is_premium=False, quiz__owner__isnull=True).values_list("id", flat=True))
    ids = rnd.sample(pool, min(CHALLENGE_SIZE - len(plan), len(pool)))
    plan += rounds.from_questions(rnd, Question.objects.filter(pk__in=ids))
    rnd.shuffle(plan)
    return plan


def _today_challenge(user):
    today = timezone.localdate()
    ch = DailyChallenge.objects.filter(user=user, date=today).first()
    if ch:
        return ch
    try:
        with transaction.atomic():
            return DailyChallenge.objects.create(user=user, date=today, plan=_build_challenge(user))
    except IntegrityError:  # parallel so'rov allaqachon yaratgan
        return DailyChallenge.objects.get(user=user, date=today)


@api_view(["GET"])
def challenge(request):
    u = request.user
    ch = _today_challenge(u)
    count = DailyChallenge.objects.filter(user=u, completed=True).count()
    if ch.completed:
        return Response({"date": ch.date, "done": True, "score": ch.score, "total": ch.total, "items": ch.answers.get("items", []), "count": count})
    return Response({"date": ch.date, "done": False, "count": count, "questions": rounds.public(ch.plan)})


@api_view(["POST"])
def challenge_submit(request):
    u = request.user
    answers = request.data.get("answers")
    if not isinstance(answers, dict):
        return Response({"detail": "Javoblar formati noto'g'ri."}, status=400)
    with transaction.atomic():
        ch = DailyChallenge.objects.select_for_update().filter(user=u, date=timezone.localdate()).first()
        if not ch:
            return Response({"detail": "Avval challenge'ni oching."}, status=400)
        if ch.completed:
            return Response({"detail": "Bugungi challenge allaqachon bajarilgan."}, status=400)
        items, score = rounds.grade(ch.plan, answers, u)
        ch.completed, ch.score, ch.total, ch.answers = True, score, len(items), {"items": items}
        ch.save()
    xp = 15 + 5 * score
    record(u, "quiz", xp=xp)
    award(u, "challenge_1")
    count = DailyChallenge.objects.filter(user=u, completed=True).count()
    if count >= 7:
        award(u, "challenge_7")
    return Response({"score": score, "total": len(items), "xp": xp, "items": items, "count": count})


# --- Daraja aniqlash ---

@api_view(["GET"])
def placement_test(request):
    return Response({"questions": placement.public_questions(random.SystemRandom()), "current": request.user.english_level})


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
