from collections import defaultdict
from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from accounts.serializers import achievement_list
from core.models import ActivityDay
from core.progress import current_streak

from .models import Attempt, LessonProgress, Mistake, StudyTask, VocabWord
from .quiz_views import _weak_topics


@api_view(["GET"])
def stats(request):
    u = request.user
    premium = u.is_premium or u.is_staff
    days = 90 if premium else 14
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)
    act = {a.date: a for a in ActivityDay.objects.filter(user=u, date__gte=start)}
    activity = []
    for i in range(days):
        d = start + timedelta(days=i)
        a = act.get(d)
        activity.append({"date": d, "xp": a.xp if a else 0, "tasks": a.tasks_done if a else 0, "quizzes": a.quizzes if a else 0})

    attempts = list(Attempt.objects.filter(user=u, finished_at__isnull=False).select_related("quiz").order_by("finished_at"))
    by_subject = defaultdict(list)
    for a in attempts:
        by_subject[a.quiz.subject].append(a.percent)
    subjects = [{"subject": s, "avg": round(sum(v) / len(v)), "count": len(v)} for s, v in by_subject.items()]
    trend = [{"date": a.finished_at.date(), "percent": a.percent, "subject": a.quiz.subject} for a in attempts[-30:]]

    data = {
        "premium": premium,
        "range_days": days,
        "totals": {
            "xp": u.xp,
            "streak": current_streak(u),
            "best_streak": u.best_streak,
            "quizzes": len(attempts),
            "tasks_done": StudyTask.objects.filter(user=u, done=True).count(),
            "lessons": LessonProgress.objects.filter(user=u).count(),
            "words": VocabWord.objects.filter(user=u).count(),
            "open_mistakes": Mistake.objects.filter(user=u, resolved=False).count(),
        },
        "activity": activity,
        "subjects": subjects,
        "achievements": achievement_list(u),
    }
    weak = _weak_topics(u)
    if premium:
        data["trend"] = trend
        data["topics"] = weak
    else:
        data["topics"] = [w for w in weak if w["accuracy"] < 60][:2]
        data["topics_locked"] = max(0, len(weak) - len(data["topics"]))
    return Response(data)
