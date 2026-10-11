from datetime import timedelta

from django.db import connection
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import ActivityDay, Notification
from .progress import current_streak


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
        db = True
    except Exception:  # noqa: BLE001
        db = False
    return Response({"ok": db, "db": db}, status=200 if db else 503)


@api_view(["GET"])
def dashboard(request):
    from ai import service
    from career.models import CareerResult, SavedCareer
    from catalog.models import FavoriteUniversity, Grant, SavedGrant
    from learning.models import Attempt, DailyChallenge, Mistake, StudyGoal, StudyTask, VocabWord

    u = request.user
    today = timezone.localdate()
    tasks = list(StudyTask.objects.filter(user=u, date=today).select_related("goal"))
    week_start = today - timedelta(days=6)
    act = {a.date: a for a in ActivityDay.objects.filter(user=u, date__gte=week_start)}
    week = [{"date": week_start + timedelta(days=i), "xp": act[week_start + timedelta(days=i)].xp if week_start + timedelta(days=i) in act else 0} for i in range(7)]

    goals = StudyGoal.objects.filter(user=u, status="active").prefetch_related("tasks")[:5]
    goal_data = []
    for g in goals:
        ts = list(g.tasks.all())
        goal_data.append({"id": g.id, "title": g.title, "kind": g.kind, "target": g.target, "deadline": g.deadline,
                          "done": sum(t.done for t in ts), "total": len(ts)})

    eng_attempts = Attempt.objects.filter(user=u, finished_at__isnull=False, quiz__subject__in=["english", "ielts"])[:10]
    eng_pcts = [a.percent for a in eng_attempts]

    saved = SavedGrant.objects.filter(user=u, grant__deadline__gte=today).select_related("grant").order_by("grant__deadline")[:3]
    deadlines = [{"id": s.grant.id, "name": s.grant.name, "deadline": s.grant.deadline, "days": (s.grant.deadline - today).days, "saved": True, "verified": s.grant.verified} for s in saved]
    if len(deadlines) < 3:
        extra = Grant.objects.filter(is_published=True, deadline__gte=today, deadline__lte=today + timedelta(days=120)).exclude(
            pk__in=[d["id"] for d in deadlines]).order_by("deadline")[: 3 - len(deadlines)]
        deadlines += [{"id": g.id, "name": g.name, "deadline": g.deadline, "days": (g.deadline - today).days, "saved": False, "verified": g.verified} for g in extra]

    recent = [{"title": a.quiz.title, "percent": a.percent, "date": a.finished_at, "subject": a.quiz.subject}
              for a in Attempt.objects.filter(user=u, finished_at__isnull=False).select_related("quiz")[:4]]

    last_result = CareerResult.objects.filter(user=u).first()
    due_words = VocabWord.objects.filter(user=u, due__lte=today).count()
    open_mistakes = Mistake.objects.filter(user=u, resolved=False).count()

    recs = []
    if not u.onboarded:
        recs.append({"title": "Profilingizni to'ldiring", "desc": "Tavsiyalar aniqroq bo'ladi", "link": "/onboarding", "icon": "user"})
    if not last_result:
        recs.append({"title": "Kasb tanlash testini topshiring", "desc": "10 daqiqa — sizga mos yo'nalishlar", "link": "/career/test", "icon": "compass"})
    if not u.english_level:
        recs.append({"title": "Ingliz tili darajangizni aniqlang", "desc": "25 savol — 7 daqiqa", "link": "/english/placement", "icon": "book"})
    if not goal_data:
        recs.append({"title": "O'quv maqsadini belgilang", "desc": "Masalan: IELTS 7.0 yoki grant yutish", "link": "/plan", "icon": "target"})
    if due_words:
        recs.append({"title": f"{due_words} ta so'zni takrorlang", "desc": "Intervalli takrorlash xotirani mustahkamlaydi", "link": "/english/vocab/review", "icon": "book"})
    if open_mistakes:
        recs.append({"title": f"{open_mistakes} ta xato ustida ishlang", "desc": "Oldingi testlardagi xatolar", "link": "/practice/mistakes", "icon": "refresh"})
    if not FavoriteUniversity.objects.filter(user=u).exists() and last_result:
        recs.append({"title": "Universitetlarni ko'rib chiqing", "desc": "Kasbingizga mos yo'nalishlar", "link": "/universities", "icon": "building"})

    return Response({
        "user": {"first_name": u.first_name, "full_name": u.full_name, "plan": u.plan, "onboarded": u.onboarded, "future_goals": u.future_goals},
        "streak": current_streak(u),
        "best_streak": u.best_streak,
        "xp": u.xp,
        "today": {"date": today, "tasks": [{"id": t.id, "title": t.title, "details": t.details, "minutes": t.minutes, "done": t.done, "link": t.link, "goal_title": t.goal.title if t.goal else None} for t in tasks],
                  "done": sum(t.done for t in tasks), "total": len(tasks), "xp": act[today].xp if today in act else 0},
        "week": week,
        "goals": goal_data,
        "english": {"level": u.english_level, "ielts_score": u.ielts_score, "avg": round(sum(eng_pcts) / len(eng_pcts)) if eng_pcts else None,
                    "due_words": due_words, "words": VocabWord.objects.filter(user=u).count()},
        "career": {"last_result": {"id": last_result.id, "top": last_result.matches[:3]} if last_result else None,
                   "saved": SavedCareer.objects.filter(user=u).count()},
        "favorites": FavoriteUniversity.objects.filter(user=u).count(),
        "deadlines": deadlines,
        "recent_results": recent,
        "recommendations": recs[:4],
        "unread": Notification.objects.filter(user=u, read=False).count(),
        "focus": {"today": act[today].focus_minutes if today in act else 0, "goal": u.daily_minutes},
        "challenge_done": DailyChallenge.objects.filter(user=u, date=today, completed=True).exists(),
        "ai": {"configured": service.is_configured(), "used_today": service.used_today(u), "limit": service.daily_limit(u)},
    })


@api_view(["GET"])
def notifications(request):
    qs = Notification.objects.filter(user=request.user)[:50]
    return Response([{"id": n.id, "title": n.title, "body": n.body, "link": n.link, "kind": n.kind, "read": n.read, "created": n.created} for n in qs])


@api_view(["POST"])
def notifications_read(request):
    ids = request.data.get("ids")
    qs = Notification.objects.filter(user=request.user, read=False)
    if isinstance(ids, list):
        qs = qs.filter(pk__in=[i for i in ids if isinstance(i, int)])
    return Response({"updated": qs.update(read=True)})


def deadline_reminders():
    """Saqlangan grantlar muddati yaqinlashganda bildirishnoma (management command orqali kuniga bir marta)."""
    from catalog.models import SavedGrant

    today = timezone.localdate()
    n = 0
    for s in SavedGrant.objects.filter(grant__deadline__in=[today + timedelta(days=d) for d in (30, 7, 1)]).select_related("grant", "user"):
        days = (s.grant.deadline - today).days
        title = f"«{s.grant.name}» muddatiga {days} kun qoldi"
        if not Notification.objects.filter(user=s.user, title=title).exists():
            Notification.objects.create(user=s.user, title=title, body="Rasmiy saytda muddatni tasdiqlang va hujjatlarni tekshiring.", link=f"/grants/{s.grant.id}", kind="deadline")
            n += 1
    return n


@api_view(["GET"])
def search(request):
    from career.models import Career
    from catalog.models import Grant, University
    from learning.models import Lesson, Quiz

    q = request.query_params.get("q", "").strip()[:80]
    if len(q) < 2:
        return Response({"q": q, "results": []})
    out = []
    for c in Career.objects.filter(is_published=True).filter(Q(title__icontains=q) | Q(summary__icontains=q))[:5]:
        out.append({"type": "career", "title": c.title, "subtitle": c.summary[:90], "link": f"/career/{c.slug}"})
    for u in University.objects.filter(is_published=True).filter(Q(name__icontains=q) | Q(short_name__icontains=q) | Q(city__icontains=q) | Q(programs__name__icontains=q)).distinct()[:5]:
        out.append({"type": "university", "title": u.name, "subtitle": f"{u.city}, {u.country}", "link": f"/universities/{u.id}"})
    for g in Grant.objects.filter(is_published=True).filter(Q(name__icontains=q) | Q(provider__icontains=q) | Q(country__icontains=q))[:5]:
        out.append({"type": "grant", "title": g.name, "subtitle": f"{g.provider} · {g.country}", "link": f"/grants/{g.id}"})
    for l in Lesson.objects.filter(is_published=True).filter(Q(title__icontains=q) | Q(summary__icontains=q))[:5]:
        out.append({"type": "lesson", "title": l.title, "subtitle": f"{l.get_skill_display()} · {l.level}", "link": f"/english/lessons/{l.id}"})
    for z in Quiz.objects.filter(is_published=True).filter(Q(owner__isnull=True) | Q(owner=request.user)).filter(Q(title__icontains=q) | Q(topic__icontains=q))[:5]:
        out.append({"type": "quiz", "title": z.title, "subtitle": z.get_subject_display(), "link": f"/practice/quiz/{z.id}"})
    return Response({"q": q, "results": out})


# --- Web Push obunasi ---

@api_view(["GET"])
def push_key(request):
    from .push import keys

    return Response({"public_key": keys()[0], "subscribed": request.user.push_subscriptions.exists(), "reminders": request.user.push_reminders})


@api_view(["POST"])
def push_subscribe(request):
    from .models import PushSubscription
    from .push import endpoint_allowed

    sub = request.data.get("subscription") or {}
    endpoint = str(sub.get("endpoint", ""))
    k = sub.get("keys") or {}
    if not endpoint_allowed(endpoint) or not k.get("p256dh") or not k.get("auth"):
        return Response({"detail": "Obuna ma'lumotlari noto'g'ri."}, status=400)
    if request.user.push_subscriptions.count() >= 10:
        request.user.push_subscriptions.order_by("created").first().delete()
    PushSubscription.objects.update_or_create(endpoint=endpoint, defaults={
        "user": request.user, "p256dh": str(k["p256dh"])[:200], "auth": str(k["auth"])[:100],
        "user_agent": request.META.get("HTTP_USER_AGENT", "")[:200], "failures": 0})
    return Response({"subscribed": True}, status=201)


@api_view(["POST"])
def push_unsubscribe(request):
    from .models import PushSubscription

    PushSubscription.objects.filter(user=request.user, endpoint=str(request.data.get("endpoint", ""))).delete()
    return Response({"subscribed": request.user.push_subscriptions.exists()})


@api_view(["POST"])
def push_test(request):
    from .models import PushSubscription
    from .push import send_to

    subs = list(PushSubscription.objects.filter(user=request.user))
    if not subs:
        return Response({"detail": "Bu akkauntda bildirishnoma yoqilgan qurilma yo'q."}, status=400)
    ok = sum(send_to(s, {"title": "EduWay AI", "body": "Bildirishnomalar ishlayapti ✅", "url": "/home", "tag": "test"}) for s in subs)
    return Response({"sent": ok, "devices": len(subs)})
