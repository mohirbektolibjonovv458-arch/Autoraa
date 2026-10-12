"""Speaking partner API: juftlashtirish, WebRTC signallari (polling), baho, shikoyat va bloklash."""
import json
import os
from datetime import timedelta

from django.db import connection, transaction
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.progress import award, notify, record

from .models import LEVELS, SpeakBlock, SpeakProfile, SpeakRating, SpeakReport, SpeakSession, SpeakSignal
from .topics import random_topic

MIN_AGE = 16
STALE = timedelta(seconds=20)      # shu vaqtdan beri so'rov yubormagan foydalanuvchi "chiqib ketgan" hisoblanadi
MIN_SECONDS_FOR_XP = 120
SESSION_XP = 25
AUTO_SUSPEND_REPORTS = 3


def age_of(u):
    return timezone.localdate().year - u.birth_year if u.birth_year else None


def profile(u):
    return SpeakProfile.objects.get_or_create(user=u)[0]


def eligibility(u):
    p = profile(u)
    age = age_of(u)
    if p.suspended:
        return {"ok": False, "reason": "suspended", "detail": "Speaking partner sizga vaqtincha yopilgan (shikoyatlar sababli). Savollar bo'lsa, administratorga murojaat qiling."}
    if age is None:
        return {"ok": False, "reason": "birth_year", "detail": "Avval tug'ilgan yilingizni kiriting — sheriklar yosh guruhi bo'yicha tanlanadi."}
    if age < MIN_AGE:
        return {"ok": False, "reason": "age", "detail": f"Jonli suhbat {MIN_AGE} yoshdan boshlab ochiladi. Hozircha AI Speaking bilan mashq qiling — u ham talaffuz va javoblaringizni tahlil qiladi."}
    if not p.rules_accepted_at:
        return {"ok": False, "reason": "rules", "detail": "Qoidalarni o'qib, rozilik bering."}
    return {"ok": True, "adult": age >= 18}


def ice_servers():
    servers = [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}]
    if url := os.getenv("TURN_URL", "").strip():
        servers.append({"urls": [u.strip() for u in url.split(",") if u.strip()],
                        "username": os.getenv("TURN_USERNAME", ""), "credential": os.getenv("TURN_CREDENTIAL", "")})
    return servers


def blocked_ids(u):
    a = SpeakBlock.objects.filter(user=u).values_list("blocked_id", flat=True)
    b = SpeakBlock.objects.filter(blocked=u).values_list("user_id", flat=True)
    return set(a) | set(b)


def rating_of(u):
    r = SpeakRating.objects.filter(rated=u).aggregate(avg=Avg("stars"), n=Count("id"))
    return {"avg": round(r["avg"], 1) if r["avg"] else None, "count": r["n"]}


def my_stats(u):
    done = SpeakSession.objects.filter(Q(a=u) | Q(b=u), status="ended", xp_given=True)
    secs = sum(int((s.ended_at - s.matched_at).total_seconds()) for s in done.only("ended_at", "matched_at") if s.ended_at and s.matched_at)
    return {"sessions": done.count(), "minutes": secs // 60, "rating": rating_of(u)}


def _close(s, now=None):
    """Suhbatni tugatadi; yetarlicha davom etgan bo'lsa ikkala tomonga XP beradi."""
    now = now or timezone.now()
    if s.status == "waiting":
        s.status = "cancelled"
    elif s.status == "matched":
        s.status = "ended"
        s.ended_at = now
        if not s.xp_given and s.matched_at and (now - s.matched_at).total_seconds() >= MIN_SECONDS_FOR_XP:
            s.xp_given = True
            for u in (s.a, s.b):
                record(u, "speak", xp=SESSION_XP)
            s.save()
            for u in (s.a, s.b):
                n = SpeakSession.objects.filter(Q(a=u) | Q(b=u), xp_given=True).count()
                award(u, "speak_1")
                if n >= 10:
                    award(u, "speak_10")
    s.save()
    SpeakSignal.objects.filter(session=s).delete()


@api_view(["GET"])
def config(request):
    u = request.user
    el = eligibility(u)
    now = timezone.now()
    waiting = {}
    if el["ok"]:
        qs = SpeakSession.objects.filter(status="waiting", adult=el["adult"], a_seen__gte=now - STALE).exclude(a=u)
        waiting = {lv: qs.filter(level=lv).count() for lv in LEVELS}
    return Response({"eligibility": el, "min_age": MIN_AGE, "levels": LEVELS, "waiting": waiting, "ice_servers": ice_servers() if el["ok"] else [],
                     "turn": bool(os.getenv("TURN_URL")), "stats": my_stats(u), "reasons": SpeakReport.REASONS,
                     "online": SpeakSession.objects.filter(Q(a_seen__gte=now - STALE) | Q(b_seen__gte=now - STALE), status__in=["waiting", "matched"]).count()})


@api_view(["POST"])
def accept_rules(request):
    p = profile(request.user)
    p.rules_accepted_at = timezone.now()
    p.save(update_fields=["rules_accepted_at"])
    return Response({"eligibility": eligibility(request.user)})


def _session_data(s, u, after=0):
    partner = s.partner_of(u) if s.b_id else None
    out = {"id": str(s.id), "status": s.status, "level": s.level, "role": "caller" if u.pk == s.a_id else "callee",
           "topic": s.topic if s.status != "waiting" else None, "matched_at": s.matched_at, "ended_at": s.ended_at, "server_time": timezone.now(),
           "partner": {"id": partner.pk, "name": partner.first_name or "Sherik", "level": partner.english_level or s.level, "rating": rating_of(partner)} if partner else None,
           "rated": SpeakRating.objects.filter(session=s, rater=u).exists(), "xp": SESSION_XP if s.xp_given else 0}
    if s.status == "matched":
        out["signals"] = [{"id": g.id, "kind": g.kind, "payload": g.payload} for g in s.signals.filter(id__gt=after).exclude(sender=u)[:100]]
    return out


@api_view(["POST"])
def find(request):
    u = request.user
    el = eligibility(u)
    if not el["ok"]:
        return Response({"detail": el["detail"], "code": el["reason"]}, status=403)
    level = str(request.data.get("level", "B1")).upper()
    if level not in LEVELS:
        return Response({"detail": "Daraja: " + ", ".join(LEVELS)}, status=400)
    idx = LEVELS.index(level)
    near = LEVELS[max(0, idx - 1): idx + 2]
    now = timezone.now()
    with transaction.atomic():
        for old in SpeakSession.objects.select_for_update().filter(Q(a=u) | Q(b=u), status__in=["waiting", "matched"]).select_related("a", "b"):
            _close(old, now)
        SpeakSession.objects.filter(status="waiting", a_seen__lt=now - STALE).update(status="cancelled")
        # ikkala tomon ham ilovani yopib qo'ygan suhbatlar — oxirgi ko'rilgan vaqt bo'yicha yopiladi
        for old in SpeakSession.objects.filter(status="matched", a_seen__lt=now - STALE * 3, b_seen__lt=now - STALE * 3).select_related("a", "b")[:20]:
            _close(old, max(old.a_seen, old.b_seen))
        qs = SpeakSession.objects.filter(status="waiting", adult=el["adult"], level__in=near, a_seen__gte=now - STALE,
                                         a__is_active=True).exclude(a=u).exclude(a_id__in=blocked_ids(u)).exclude(a__speak_profile__suspended=True)
        qs = qs.order_by("created")
        lock = {"skip_locked": True} if connection.features.has_select_for_update_skip_locked else {}
        cand = qs.select_for_update(**lock).first()
        if cand:
            cand.b, cand.status, cand.matched_at, cand.b_seen = u, "matched", now, now
            cand.topic = random_topic()
            cand.save()
            s = cand
        else:
            s = SpeakSession.objects.create(a=u, level=level, adult=el["adult"], a_seen=now)
    return Response(_session_data(s, u), status=201)


def _mine(request, pk):
    s = get_object_or_404(SpeakSession.objects.select_related("a", "b"), pk=pk)
    if not s.has(request.user):
        from django.http import Http404
        raise Http404
    return s


@api_view(["GET"])
def poll(request, pk):
    u = request.user
    s = _mine(request, pk)
    now = timezone.now()
    try:
        after = int(request.query_params.get("after", 0))
    except ValueError:
        after = 0
    if s.status in ("waiting", "matched"):
        field = "a_seen" if u.pk == s.a_id else "b_seen"
        SpeakSession.objects.filter(pk=s.pk).update(**{field: now})
        setattr(s, field, now)
        other_seen = s.b_seen if field == "a_seen" else s.a_seen
        if s.status == "matched" and other_seen and other_seen < now - STALE:
            with transaction.atomic():
                s = SpeakSession.objects.select_for_update().select_related("a", "b").get(pk=s.pk)
                if s.status == "matched":
                    _close(s, now)
    return Response(_session_data(s, u, after))


@api_view(["POST"])
def signal(request, pk):
    u = request.user
    s = _mine(request, pk)
    if s.status != "matched":
        return Response({"detail": "Suhbat faol emas."}, status=409)
    items = request.data.get("signals")
    if not isinstance(items, list) or not 0 < len(items) <= 50 or len(json.dumps(items)) > 64_000:
        return Response({"detail": "Noto'g'ri signal."}, status=400)
    objs = []
    for it in items:
        if not isinstance(it, dict) or it.get("kind") not in ("offer", "answer", "ice") or not isinstance(it.get("payload"), dict):
            return Response({"detail": "Noto'g'ri signal."}, status=400)
        objs.append(SpeakSignal(session=s, sender=u, kind=it["kind"], payload=it["payload"]))
    SpeakSignal.objects.bulk_create(objs)
    return Response({"ok": True})


@api_view(["POST"])
def end(request, pk):
    with transaction.atomic():
        s = _mine(request, pk)
        s = SpeakSession.objects.select_for_update().select_related("a", "b").get(pk=s.pk)
        if s.status in ("waiting", "matched"):
            _close(s)
    return Response(_session_data(s, request.user))


@api_view(["POST"])
def rate(request, pk):
    u = request.user
    s = _mine(request, pk)
    if not s.b_id or s.status not in ("matched", "ended"):
        return Response({"detail": "Bu suhbatga baho berib bo'lmaydi."}, status=400)
    try:
        stars = int(request.data.get("stars"))
    except (TypeError, ValueError):
        stars = 0
    if not 1 <= stars <= 5:
        return Response({"detail": "Baho 1–5 yulduz."}, status=400)
    SpeakRating.objects.get_or_create(session=s, rater=u, defaults={"rated": s.partner_of(u), "stars": stars})
    return Response({"ok": True})


@api_view(["POST"])
def report(request, pk):
    u = request.user
    s = _mine(request, pk)
    if not s.b_id:
        return Response({"detail": "Sherik yo'q."}, status=400)
    reason = request.data.get("reason")
    if reason not in dict(SpeakReport.REASONS):
        return Response({"detail": "Sababni tanlang."}, status=400)
    other = s.partner_of(u)
    with transaction.atomic():
        if not SpeakReport.objects.filter(session=s, reporter=u).exists():
            SpeakReport.objects.create(session=s, reporter=u, reported=other, reason=reason, note=str(request.data.get("note", ""))[:500])
        SpeakBlock.objects.get_or_create(user=u, blocked=other)
        s = SpeakSession.objects.select_for_update().select_related("a", "b").get(pk=s.pk)
        if s.status in ("waiting", "matched"):
            _close(s)
        distinct = SpeakReport.objects.filter(reported=other, created__gte=timezone.now() - timedelta(days=30)).values("reporter").distinct().count()
        p = profile(other)
        if distinct >= AUTO_SUSPEND_REPORTS and not p.suspended:
            p.suspended, p.suspended_reason = True, f"{distinct} ta foydalanuvchi shikoyati (avtomatik)"
            p.save()
            notify(other, "Speaking partner vaqtincha yopildi", "Sizga nisbatan bir nechta shikoyat tushdi. Administrator ko'rib chiqadi.", "/english/partner", "warning")
        from accounts.models import User

        for admin in User.objects.filter(is_staff=True, is_active=True):
            notify(admin, "Speaking: yangi shikoyat", f"{other.full_name or other.pk} — {dict(SpeakReport.REASONS)[reason]}", "/admin/speaking", "warning")
    return Response({"ok": True, "blocked": True})


@api_view(["POST"])
def block(request, pk):
    u = request.user
    s = _mine(request, pk)
    if s.b_id:
        SpeakBlock.objects.get_or_create(user=u, blocked=s.partner_of(u))
    return Response({"ok": True})
