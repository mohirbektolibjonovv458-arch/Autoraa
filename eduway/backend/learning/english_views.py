from datetime import timedelta

from django.db.models import Avg, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.progress import award, record

from .models import Attempt, Lesson, LessonProgress, VocabWord
from .serializers import LessonListSerializer, VocabSerializer

LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
FREE_VOCAB_LIMIT = 150


def lesson_locked(lesson, user):
    return lesson.is_premium and not (user.is_premium or user.is_staff)


@api_view(["GET"])
def lessons(request):
    qs = Lesson.objects.filter(is_published=True)
    if v := request.query_params.get("skill"):
        qs = qs.filter(skill=v)
    if v := request.query_params.get("level"):
        qs = qs.filter(level=v)
    done = set(LessonProgress.objects.filter(user=request.user).values_list("lesson_id", flat=True))
    return Response([{**LessonListSerializer(l).data, "completed": l.id in done, "locked": lesson_locked(l, request.user)} for l in qs])


@api_view(["GET"])
def lesson_detail(request, pk):
    l = get_object_or_404(Lesson, pk=pk, is_published=True)
    if lesson_locked(l, request.user):
        return Response({"detail": "Bu dars Premium tarifda mavjud.", "code": "premium_required"}, status=403)
    data = LessonListSerializer(l).data
    data.update(content=l.content, listening_text=l.listening_text,
                completed=LessonProgress.objects.filter(user=request.user, lesson=l).exists())
    return Response(data)


@api_view(["POST"])
def lesson_complete(request, pk):
    l = get_object_or_404(Lesson, pk=pk, is_published=True)
    if lesson_locked(l, request.user):
        return Response({"detail": "Bu dars Premium tarifda mavjud."}, status=403)
    _, created = LessonProgress.objects.get_or_create(user=request.user, lesson=l)
    if created:
        record(request.user, "lesson")
    return Response({"completed": True, "new": created})


@api_view(["GET"])
def english_overview(request):
    u = request.user
    level = u.english_level or "A2"
    done = set(LessonProgress.objects.filter(user=u).values_list("lesson_id", flat=True))
    idx = LEVEL_ORDER.index(level) if level in LEVEL_ORDER else 1
    levels = LEVEL_ORDER[max(0, idx - 1): idx + 2]
    recommended = [l for l in Lesson.objects.filter(is_published=True, level__in=levels).exclude(pk__in=done)
                   if not lesson_locked(l, u)][:4]
    skills = {}
    for skill, _ in Lesson.SKILLS:
        total = Lesson.objects.filter(is_published=True, skill=skill).count()
        completed = Lesson.objects.filter(pk__in=done, skill=skill).count()
        skills[skill] = {"total": total, "completed": completed}
    attempts = Attempt.objects.filter(user=u, finished_at__isnull=False, quiz__subject__in=["english", "ielts"])
    recent = [{"title": a.quiz.title, "percent": a.percent, "date": a.finished_at} for a in attempts.select_related("quiz")[:5]]
    return Response({
        "level": u.english_level,
        "ielts_score": u.ielts_score,
        "recommended": [{**LessonListSerializer(l).data, "completed": False, "locked": False} for l in recommended],
        "skills": skills,
        "due_words": VocabWord.objects.filter(user=u, due__lte=timezone.localdate()).count(),
        "total_words": VocabWord.objects.filter(user=u).count(),
        "recent_quizzes": recent,
        "quiz_avg": round(sum(r["percent"] for r in recent) / len(recent)) if recent else None,
    })


@api_view(["GET", "POST"])
def vocab(request):
    u = request.user
    if request.method == "GET":
        qs = VocabWord.objects.filter(user=u)
        if request.query_params.get("due") == "1":
            qs = qs.filter(due__lte=timezone.localdate())
        if q := request.query_params.get("q", "").strip()[:80]:
            qs = qs.filter(word__icontains=q)
        return Response(VocabSerializer(qs[:500], many=True).data)
    if not (u.is_premium or u.is_staff) and VocabWord.objects.filter(user=u).count() >= FREE_VOCAB_LIMIT:
        return Response({"detail": f"Bepul tarifda lug'atga {FREE_VOCAB_LIMIT} tagacha so'z saqlash mumkin.", "code": "premium_required"}, status=403)
    s = VocabSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    if VocabWord.objects.filter(user=u, word__iexact=s.validated_data["word"]).exists():
        return Response({"detail": "Bu so'z lug'atingizda bor."}, status=400)
    s.save(user=u, due=timezone.localdate())
    if VocabWord.objects.filter(user=u).count() >= 25:
        award(u, "words_25")
    return Response(s.data, status=201)


@api_view(["PATCH", "DELETE"])
def vocab_item(request, pk):
    w = get_object_or_404(VocabWord, pk=pk, user=request.user)
    if request.method == "DELETE":
        w.delete()
        return Response(status=204)
    s = VocabSerializer(w, data=request.data, partial=True)
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data)


def schedule(w, quality):
    """SM-2 ga asoslangan soddalashtirilgan intervalli takrorlash. quality: 0=yana, 1=qiyin, 2=yaxshi, 3=oson."""
    if quality == 0:
        w.lapses += 1
        w.reps = 0
        w.interval_days = 0
        w.ease = max(1.3, w.ease - 0.2)
        w.due = timezone.localdate()
        return w
    w.reps += 1
    if w.reps == 1:
        w.interval_days = 1 if quality < 3 else 2
    elif w.reps == 2:
        w.interval_days = 3 if quality == 1 else 5
    else:
        mult = {1: 1.2, 2: w.ease, 3: w.ease * 1.3}[quality]
        w.interval_days = max(w.interval_days + 1, round(w.interval_days * mult))
    w.ease = max(1.3, min(3.0, w.ease + {1: -0.15, 2: 0, 3: 0.15}[quality]))
    w.due = timezone.localdate() + timedelta(days=w.interval_days)
    return w


@api_view(["POST"])
def vocab_review(request, pk):
    w = get_object_or_404(VocabWord, pk=pk, user=request.user)
    q = request.data.get("quality")
    if q not in (0, 1, 2, 3):
        return Response({"detail": "quality 0–3 bo'lishi kerak."}, status=400)
    schedule(w, q).save()
    record(request.user, "word")
    return Response(VocabSerializer(w).data)
