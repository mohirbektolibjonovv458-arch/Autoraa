from collections import defaultdict

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.progress import award, notify, record

from . import rounds
from .models import Attempt, Mistake, Question, Quiz
from .serializers import QuestionPublicSerializer, QuizSerializer

GRACE_SECONDS = 15


def locked(quiz, user):
    return quiz.is_premium and not (user.is_premium or user.is_staff)


@api_view(["GET"])
def quiz_list(request):
    qs = Quiz.objects.filter(is_published=True).filter(Q(owner__isnull=True) | Q(owner=request.user)).annotate(question_count=Count("questions"))
    if request.query_params.get("mine") == "1":
        qs = qs.filter(owner=request.user)
    if v := request.query_params.get("subject"):
        qs = qs.filter(subject__in=v.split(","))
    if v := request.query_params.get("level"):
        qs = qs.filter(level=v)
    best = {}
    for quiz_id, sc, tot in Attempt.objects.filter(user=request.user, finished_at__isnull=False).values_list("quiz", "score", "total"):
        if tot:
            best[quiz_id] = max(best.get(quiz_id, 0), round(100 * sc / tot))
    out = []
    for q in qs:
        d = QuizSerializer(q).data
        d["locked"] = locked(q, request.user)
        d["question_count"] = q.questions_per_attempt if q.generator else min(q.questions_per_attempt, q.question_count)
        d["bank_size"] = None if q.generator else q.question_count
        d["best"] = best.get(q.id)
        out.append(d)
    out.sort(key=lambda d: (d["locked"], not d["generator"]))  # «har safar yangi» testlar birinchi
    return Response(out)


@api_view(["POST"])
def quiz_start(request, pk):
    quiz = get_object_or_404(Quiz.objects.filter(Q(owner__isnull=True) | Q(owner=request.user)), pk=pk, is_published=True)
    if locked(quiz, request.user):
        return Response({"detail": "Bu test Premium tarifda mavjud.", "code": "premium_required"}, status=403)
    plan = rounds.build_for_quiz(quiz)
    if not plan:
        return Response({"detail": "Bu testda hali savollar yo'q."}, status=400)
    attempt = Attempt.objects.create(user=request.user, quiz=quiz, total=len(plan), answers={"plan": plan})
    return Response({
        "attempt": attempt.id,
        "quiz": QuizSerializer(quiz).data | {"question_count": len(plan)},
        "questions": rounds.public(plan),
        "started_at": attempt.started_at,
    }, status=201)


def _weak_topics(user, subject=None, min_answers=3):
    stats = defaultdict(lambda: [0, 0])
    qs = Attempt.objects.filter(user=user, finished_at__isnull=False).select_related("quiz")
    if subject:
        qs = qs.filter(quiz__subject=subject)
    for a in qs[:200]:
        for item in a.answers.get("items", []):
            key = (a.quiz.subject, item.get("topic") or a.quiz.topic or "umumiy")
            stats[key][1] += 1
            stats[key][0] += 1 if item.get("correct") else 0
    out = [
        {"subject": s, "topic": t, "accuracy": round(100 * c / n), "answered": n}
        for (s, t), (c, n) in stats.items() if n >= min_answers
    ]
    out.sort(key=lambda x: x["accuracy"])
    return out


@api_view(["POST"])
def quiz_submit(request, pk):
    attempt = get_object_or_404(Attempt, pk=pk, user=request.user)
    if attempt.finished_at:
        return Response({"detail": "Bu urinish allaqachon yakunlangan."}, status=400)
    answers = request.data.get("answers")
    if not isinstance(answers, dict):
        return Response({"detail": "Javoblar formati noto'g'ri."}, status=400)
    plan = attempt.answers.get("plan") or []
    now = timezone.now()
    duration = int((now - attempt.started_at).total_seconds())
    limit = attempt.quiz.time_limit_seconds
    items, score = rounds.grade(plan, answers, request.user)
    questions = plan
    attempt.score, attempt.total = score, len(questions)
    attempt.finished_at, attempt.duration_seconds = now, duration
    attempt.overtime = bool(limit and duration > limit + GRACE_SECONDS)
    attempt.answers = {"plan": plan, "items": [{k: v for k, v in i.items() if k in ("question", "chosen", "correct", "topic")} for i in items]}
    attempt.save()
    record(request.user, "quiz")
    award(request.user, "first_quiz")
    pct = attempt.percent
    if pct == 100:
        award(request.user, "perfect_score")
    weak = [w for w in _weak_topics(request.user, attempt.quiz.subject) if w["accuracy"] < 60][:3]
    recs = []
    if pct < 60:
        recs.append({"title": "Xatolar ustida ishlash", "link": "/practice/mistakes"})
    for w in weak:
        recs.append({"title": f"«{w['topic']}» mavzusini AI bilan qayta o'rganing", "link": f"/ai?mode=tutor&topic={w['topic']}"})
    if pct >= 80:
        nxt = Quiz.objects.filter(subject=attempt.quiz.subject, is_published=True, owner__isnull=True, is_premium=False).exclude(pk=attempt.quiz_id).order_by("?").first()
        if nxt:
            recs.append({"title": f"Keyingi test: {nxt.title}", "link": f"/practice/quiz/{nxt.id}"})
    if pct >= 90:
        notify(request.user, "Ajoyib natija!", f"«{attempt.quiz.title}» testida {pct}%", "/progress", "result")
    return Response({"attempt": attempt.id, "score": score, "total": len(questions), "percent": pct, "duration_seconds": duration,
                     "overtime": attempt.overtime, "items": items, "weak_topics": weak, "recommendations": recs})


@api_view(["GET"])
def attempt_history(request):
    qs = Attempt.objects.filter(user=request.user, finished_at__isnull=False).select_related("quiz")[:50]
    return Response([{"id": a.id, "quiz": a.quiz_id, "title": a.quiz.title, "subject": a.quiz.subject, "score": a.score, "total": a.total,
                      "percent": a.percent, "duration_seconds": a.duration_seconds, "overtime": a.overtime, "finished_at": a.finished_at} for a in qs])


@api_view(["GET"])
def mistakes(request):
    qs = Mistake.objects.filter(user=request.user, resolved=False).select_related("question__quiz")[:100]
    return Response([{"id": m.id, "times": m.times, "question": QuestionPublicSerializer(m.question).data,
                      "quiz": m.question.quiz.title, "subject": m.question.quiz.subject} for m in qs])


@api_view(["POST"])
def mistakes_submit(request):
    """Xatolar asosida takrorlash: to'g'ri javob berilgan savollar «hal qilindi» deb belgilanadi."""
    answers = request.data.get("answers")
    if not isinstance(answers, dict) or len(answers) > 100:
        return Response({"detail": "Javoblar formati noto'g'ri."}, status=400)
    ids = [int(k) for k in answers if str(k).isdigit()]
    qmap = {q.id: q for q in Question.objects.filter(pk__in=ids, mistake__user=request.user)}
    items, fixed = [], 0
    for qid in ids:
        q = qmap.get(qid)
        if not q:
            continue
        chosen = answers.get(str(qid))
        correct = chosen == q.correct_index
        if correct:
            fixed += 1
            Mistake.objects.filter(user=request.user, question=q).update(resolved=True)
        items.append({"question": q.id, "text": q.text, "options": q.options, "chosen": chosen, "correct_index": q.correct_index,
                      "correct": correct, "explanation": q.explanation, "topic": q.topic})
    if items:
        record(request.user, "quiz", xp=5 * fixed)
    return Response({"fixed": fixed, "total": len(items), "items": items})
