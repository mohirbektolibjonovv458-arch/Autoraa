"""Administrator API. Har bir endpoint IsAdmin bilan himoyalangan — oddiy foydalanuvchi kira olmaydi."""
from datetime import timedelta

from django.conf import settings
from django.db import connection, transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import User
from ai.models import Message, UsageDay
from billing.models import PremiumRequest
from career.models import Career
from catalog.models import Grant, Program, University
from catalog.serializers import GrantAdminSerializer, ProgramSerializer, UniversityAdminSerializer
from learning.models import Lesson, Question, Quiz
from learning.serializers import LessonAdminSerializer, QuestionFullSerializer, QuizSerializer

from .models import ErrorLog
from .paginate import Pager
from .permissions import IsAdmin
from .progress import notify


class AdminViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    pagination_class = Pager
    search_fields = ()

    def get_queryset(self):
        qs = self.queryset.all()
        q = self.request.query_params.get("q", "").strip()[:100]
        if q and self.search_fields:
            cond = Q()
            for f in self.search_fields:
                cond |= Q(**{f"{f}__icontains": q})
            qs = qs.filter(cond)
        return qs


class UniversityAdmin(AdminViewSet):
    queryset = University.objects.prefetch_related("programs")
    serializer_class = UniversityAdminSerializer
    search_fields = ("name", "city", "country")


class ProgramAdmin(AdminViewSet):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if u := self.request.query_params.get("university"):
            qs = qs.filter(university_id=u)
        return qs


class GrantAdmin(AdminViewSet):
    queryset = Grant.objects.all()
    serializer_class = GrantAdminSerializer
    search_fields = ("name", "provider", "country")


class CareerAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Career
        fields = "__all__"

    def validate_riasec(self, v):
        v = v.upper()
        if not v or any(c not in "RIASEC" for c in v) or len(set(v)) != len(v):
            raise serializers.ValidationError("RIASEC kodi faqat R, I, A, S, E, C harflaridan (takrorlanmasdan).")
        return v


class CareerAdmin(AdminViewSet):
    queryset = Career.objects.all()
    serializer_class = CareerAdminSerializer
    search_fields = ("title", "slug")


class QuizAdmin(AdminViewSet):
    queryset = Quiz.objects.filter(owner__isnull=True).annotate(question_count=Count("questions"))
    serializer_class = QuizSerializer
    search_fields = ("title", "topic")


class QuestionAdmin(AdminViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionFullSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if q := self.request.query_params.get("quiz"):
            qs = qs.filter(quiz_id=q)
        return qs


class LessonAdmin(AdminViewSet):
    queryset = Lesson.objects.all()
    serializer_class = LessonAdminSerializer
    search_fields = ("title",)


class UserAdminSerializer(serializers.ModelSerializer):
    plan = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "phone", "first_name", "last_name", "education_stage", "grade", "is_active", "is_staff", "premium_until",
                  "plan", "xp", "streak", "date_joined", "last_login", "onboarded"]
        read_only_fields = ["id", "email", "phone", "xp", "streak", "date_joined", "last_login", "onboarded", "education_stage", "grade"]


class UserAdmin(AdminViewSet):
    queryset = User.objects.all()
    serializer_class = UserAdminSerializer
    search_fields = ("email", "phone", "first_name", "last_name")
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("plan") == "premium":
            qs = qs.filter(premium_until__gt=timezone.now())
        elif p.get("plan") == "free":
            qs = qs.filter(Q(premium_until__isnull=True) | Q(premium_until__lte=timezone.now()))
        if p.get("staff") == "1":
            qs = qs.filter(is_staff=True)
        return qs

    def perform_update(self, serializer):
        target = serializer.instance
        me = self.request.user
        # Admin o'zini bloklay olmaydi va o'z admin huquqini olib tashlay olmaydi; admin rolini faqat superuser beradi
        if target.pk == me.pk and (serializer.validated_data.get("is_active") is False or serializer.validated_data.get("is_staff") is False):
            raise serializers.ValidationError({"detail": "O'zingizni bloklay yoki admin huquqidan mahrum qila olmaysiz."})
        if "is_staff" in serializer.validated_data and serializer.validated_data["is_staff"] != target.is_staff and not me.is_superuser:
            raise serializers.ValidationError({"detail": "Admin rolini faqat bosh administrator (superuser) o'zgartira oladi."})
        serializer.save()


def _tg_status():
    from accounts import telegram

    if not telegram.configured():
        return "missing"
    return "ok" if telegram.bot_username() else "invalid"


@api_view(["GET"])
@permission_classes([IsAdmin])
def overview(request):
    now = timezone.now()
    today = timezone.localdate()
    week = today - timedelta(days=6)
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
        db_ok = True
    except Exception:  # noqa: BLE001
        db_ok = False
    usage = UsageDay.objects.filter(date__gte=week).aggregate(n=Sum("count"), i=Sum("input_tokens"), o=Sum("output_tokens"))
    signups = User.objects.filter(date_joined__date__gte=week).annotate(d=TruncDate("date_joined")).values("d").annotate(n=Count("id")).order_by("d")
    return Response({
        "users": {"total": User.objects.count(), "premium": User.objects.filter(premium_until__gt=now).count(),
                  "new_week": User.objects.filter(date_joined__date__gte=week).count(),
                  "active_today": User.objects.filter(last_active=today).count()},
        "signups": [{"date": str(s["d"]), "count": s["n"]} for s in signups],
        "content": {"universities": University.objects.count(), "universities_unverified": University.objects.filter(verified=False).count(),
                    "grants": Grant.objects.count(), "grants_unverified": Grant.objects.filter(verified=False).count(),
                    "careers": Career.objects.count(), "quizzes": Quiz.objects.filter(owner__isnull=True).count(), "lessons": Lesson.objects.count()},
        "ai": {"configured": bool(settings.ANTHROPIC_API_KEY), "model": settings.AI_MODEL, "requests_week": usage["n"] or 0,
               "input_tokens_week": usage["i"] or 0, "output_tokens_week": usage["o"] or 0,
               "errors_24h": ErrorLog.objects.filter(source="ai", created__gte=now - timedelta(hours=24)).count(),
               "limits": {"free": settings.AI_DAILY_LIMIT_FREE, "premium": settings.AI_DAILY_LIMIT_PREMIUM}},
        "billing": {"pending": PremiumRequest.objects.filter(status="pending").count(),
                    "payment_configured": bool(settings.PREMIUM_PAYMENT_INSTRUCTIONS), "price_uzs": settings.PREMIUM_PRICE_UZS},
        "moderation": {"flagged_ai": Message.objects.filter(feedback="bad", reviewed=False).count()},
        "health": {"telegram": _tg_status(), "db": db_ok, "debug": settings.DEBUG, "server_errors_24h": ErrorLog.objects.filter(source="server", created__gte=now - timedelta(hours=24)).count()},
    })


@api_view(["GET"])
@permission_classes([IsAdmin])
def errors(request):
    qs = ErrorLog.objects.select_related("user")[:100]
    return Response([{"id": e.id, "source": e.source, "code": e.code, "message": e.message[:500], "user": str(e.user) if e.user else None, "created": e.created} for e in qs])


@api_view(["GET"])
@permission_classes([IsAdmin])
def premium_requests(request):
    qs = PremiumRequest.objects.select_related("user")
    if st := request.query_params.get("status"):
        qs = qs.filter(status=st)
    return Response([{"id": r.id, "user": {"id": r.user.id, "email": r.user.email or r.user.phone, "name": r.user.full_name}, "months": r.months, "amount": r.amount,
                      "payment_reference": r.payment_reference, "note": r.note, "status": r.status, "admin_note": r.admin_note,
                      "created": r.created, "reviewed_at": r.reviewed_at} for r in qs[:200]])


@api_view(["POST"])
@permission_classes([IsAdmin])
def premium_review(request, pk):
    action = request.data.get("action")
    if action not in ("approve", "reject"):
        return Response({"detail": "action: approve yoki reject"}, status=400)
    with transaction.atomic():
        r = get_object_or_404(PremiumRequest.objects.select_for_update().select_related("user"), pk=pk)
        if r.status != "pending":
            return Response({"detail": "So'rov allaqachon ko'rib chiqilgan."}, status=400)
        r.status = "approved" if action == "approve" else "rejected"
        r.admin_note = str(request.data.get("note", ""))[:500]
        r.reviewed_by, r.reviewed_at = request.user, timezone.now()
        r.save()
        if action == "approve":
            u = r.user
            base = u.premium_until if u.premium_until and u.premium_until > timezone.now() else timezone.now()
            u.premium_until = base + timedelta(days=30 * r.months)
            u.save(update_fields=["premium_until"])
            notify(u, "Premium faollashtirildi", f"Premium {u.premium_until:%d.%m.%Y} gacha amal qiladi.", "/premium", "premium")
        else:
            notify(r.user, "Premium so'rovi rad etildi", r.admin_note or "Batafsil ma'lumot uchun administratorga murojaat qiling.", "/premium", "premium")
    return Response({"status": r.status})


@api_view(["POST"])
@permission_classes([IsAdmin])
def grant_premium(request, pk):
    """Administrator foydalanuvchiga Premium'ni qo'lda beradi yoki olib qo'yadi (days=0)."""
    u = get_object_or_404(User, pk=pk)
    try:
        days = int(request.data.get("days", 30))
    except (TypeError, ValueError):
        return Response({"detail": "days butun son bo'lishi kerak."}, status=400)
    if not 0 <= days <= 730:
        return Response({"detail": "0–730 kun oralig'ida."}, status=400)
    if days == 0:
        u.premium_until = None
    else:
        base = u.premium_until if u.premium_until and u.premium_until > timezone.now() else timezone.now()
        u.premium_until = base + timedelta(days=days)
        notify(u, "Premium faollashtirildi", f"Premium {u.premium_until:%d.%m.%Y} gacha amal qiladi.", "/premium", "premium")
    u.save(update_fields=["premium_until"])
    return Response(UserAdminSerializer(u).data)


@api_view(["GET"])
@permission_classes([IsAdmin])
def flagged_messages(request):
    qs = Message.objects.filter(feedback="bad").select_related("conversation__user")
    if request.query_params.get("all") != "1":
        qs = qs.filter(reviewed=False)
    out = []
    for m in qs.order_by("-created")[:100]:
        q = Message.objects.filter(conversation=m.conversation, role="user", created__lte=m.created).order_by("-created", "-id").first()
        out.append({"id": m.id, "mode": m.conversation.mode, "user": str(m.conversation.user), "question": q.content if q else "",
                    "answer": m.content, "note": m.feedback_note, "reviewed": m.reviewed, "created": m.created})
    return Response(out)


@api_view(["POST"])
@permission_classes([IsAdmin])
def flagged_review(request, pk):
    n = Message.objects.filter(pk=pk, feedback="bad").update(reviewed=True)
    return Response({"reviewed": bool(n)})
