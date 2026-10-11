from datetime import date as date_cls, timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.progress import award, record

from .models import StudyGoal, StudyTask
from .plan_templates import build_week
from .serializers import GoalSerializer, TaskSerializer

GOAL_LIMIT = {"free": 1, "premium": 5}
TASKS_PER_DAY_LIMIT = 20


def goal_limit(user):
    return GOAL_LIMIT["premium"] if (user.is_premium or user.is_staff) else GOAL_LIMIT["free"]


def _date(v):
    try:
        return date_cls.fromisoformat(v)
    except (TypeError, ValueError):
        return None


@api_view(["GET", "POST"])
def goals(request):
    u = request.user
    if request.method == "GET":
        qs = StudyGoal.objects.filter(user=u).prefetch_related("tasks")
        return Response({"results": GoalSerializer(qs, many=True).data, "limit": goal_limit(u)})
    if StudyGoal.objects.filter(user=u, status="active").count() >= goal_limit(u):
        return Response({"detail": f"Tarifingizda bir vaqtda {goal_limit(u)} ta faol maqsad bo'lishi mumkin. Premium bilan 5 tagacha.", "code": "premium_required"}, status=403)
    s = GoalSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    s.save(user=u)
    award(u, "goal_setter")
    return Response(s.data, status=201)


@api_view(["PATCH", "DELETE"])
def goal_item(request, pk):
    g = get_object_or_404(StudyGoal, pk=pk, user=request.user)
    if request.method == "DELETE":
        g.delete()
        return Response(status=204)
    if request.data.get("status") == "active" and g.status != "active" and \
            StudyGoal.objects.filter(user=request.user, status="active").count() >= goal_limit(request.user):
        return Response({"detail": "Faol maqsadlar limiti to'lgan."}, status=403)
    was_active = g.status == "active"
    s = GoalSerializer(g, data=request.data, partial=True)
    s.is_valid(raise_exception=True)
    g = s.save()
    if was_active and g.status != "active":
        # yakunlangan/arxivlangan maqsadning bajarilmagan kelgusi avtomatik vazifalari rejadan olib tashlanadi
        StudyTask.objects.filter(goal=g, done=False, source__in=["template", "ai"], date__gte=timezone.localdate()).delete()
    return Response(s.data)


@api_view(["POST"])
def goal_generate(request, pk):
    """Shablon asosida 7 kunlik reja. Mavjud bajarilmagan shablon vazifalari yangilanadi."""
    g = get_object_or_404(StudyGoal, pk=pk, user=request.user, status="active")
    start = timezone.localdate()
    StudyTask.objects.filter(goal=g, done=False, source__in=["template", "ai"], date__gte=start).delete()
    rows = build_week(g.kind, g.minutes_per_day, start)
    StudyTask.objects.bulk_create([StudyTask(user=request.user, goal=g, source="template", **r) for r in rows])
    return Response({"created": len(rows)}, status=201)


@api_view(["GET", "POST"])
def tasks(request):
    u = request.user
    if request.method == "GET":
        qs = StudyTask.objects.filter(user=u).select_related("goal")
        p = request.query_params
        if d := _date(p.get("date")):
            qs = qs.filter(date=d)
        elif d := _date(p.get("from")):
            to = _date(p.get("to")) or d + timedelta(days=6)
            qs = qs.filter(date__range=(d, to))
        else:
            today = timezone.localdate()
            qs = qs.filter(date__range=(today - timedelta(days=1), today + timedelta(days=6)))
        return Response(TaskSerializer(qs[:300], many=True).data)
    s = TaskSerializer(data=request.data, context={"request": request})
    s.is_valid(raise_exception=True)
    if StudyTask.objects.filter(user=u, date=s.validated_data["date"]).count() >= TASKS_PER_DAY_LIMIT:
        return Response({"detail": "Bir kunga 20 tadan ortiq vazifa qo'shib bo'lmaydi."}, status=400)
    s.save(user=u, source="manual")
    return Response(s.data, status=201)


@api_view(["PATCH", "DELETE"])
def task_item(request, pk):
    t = get_object_or_404(StudyTask, pk=pk, user=request.user)
    if request.method == "DELETE":
        t.delete()
        return Response(status=204)
    was_done = t.done
    s = TaskSerializer(t, data=request.data, partial=True, context={"request": request})
    s.is_valid(raise_exception=True)
    t = s.save()
    if t.done and not was_done:
        t.done_at = timezone.now()
        t.save(update_fields=["done_at"])
        record(request.user, "task")
        if StudyTask.objects.filter(user=request.user, done=True).count() >= 10:
            award(request.user, "tasks_10")
    elif was_done and not t.done:
        t.done_at = None
        t.save(update_fields=["done_at"])
    return Response(TaskSerializer(t).data)
