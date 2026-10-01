from django.db import transaction
from core.params import str_in
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsEvakuator, IsProvider
from accounts.utils import haversine_km
from core.models import SiteSettings, notify
from garage.models import Vehicle

from .models import EvacuatorProfile, SOSRequest
from .serializers import EvacuatorProfileSerializer, SOSSerializer

ACTIVE = ["searching", "accepted", "on_the_way", "arrived"]
FLOW = {"accepted": "on_the_way", "on_the_way": "arrived", "arrived": "completed"}


# SOS'ni hech kim qabul qilmasa — yaqin yordamchilarga qayta jiringlatamiz (soniya: shu vaqtdan keyin 1-, 2-, 3-takror)
SOS_REPEAT_AFTER = (40, 90, 180)


def alert_providers(sos, round_no=0):
    """Yaqin (online) yordamchilarga SOS: push (yuqori ustuvorlik, ekranda yopilmaydi) + Telegram.
    round_no > 0 — takroriy ogohlantirish (hali hech kim qabul qilmadi)."""
    radius = SiteSettings.load().sos_radius_km
    role = sos.provider_role
    cycle = int(sos.updated_at.timestamp()) if round_no else 0  # rad etilib qayta qidirilsa — yangi tsikl
    sent = 0
    for p in User.objects.filter(role=role, is_active=True, is_online=True).exclude(pk=sos.user_id):
        dist = haversine_km(sos.lat, sos.lng, p.lat, p.lng)
        if dist is not None and dist > radius:
            continue
        dtxt = f"{dist:.1f} km" if dist is not None else "Yaqin atrofda"
        title = f"🚨 Avtora SOS: {sos.get_kind_display()}" if not round_no else f"🚨 Avtora SOS — hali kutyapti ({round_no})"
        if notify(p, title, f"{dtxt} uzoqlikda yordam kerak. {sos.address}".strip(), "sos",
                  "/app/evak" if role == "evakuator" else "/app/usta/sos", telegram=True, urgent=True,
                  dedup=f"sos-{sos.id}-new" if not round_no else f"sos-{sos.id}-r{round_no}-{cycle}",
                  push_body=f"Yaqin atrofda yordam so'rovi mavjud ({dtxt}). Qabul qilish uchun bosing.",
                  event="evacuator_request" if role == "evakuator" else "sos_request", object_id=sos.id):
            sent += 1
    return sent


def escalate_sos(now=None):
    """Fon jarayoni (har 15 soniyada): qabul qilinmagan SOS'lar uchun takroriy ogohlantirish."""
    from datetime import timedelta
    now = now or timezone.now()
    n = 0
    window = timedelta(seconds=SOS_REPEAT_AFTER[-1] + 60)
    for sos in SOSRequest.objects.filter(status="searching", updated_at__gte=now - window):
        age = (now - sos.updated_at).total_seconds()
        due = sum(1 for t in SOS_REPEAT_AFTER if age >= t)
        if due:
            n += alert_providers(sos, due)  # dedup: har bir takror bir marta
    return n


def kinds_for(user):
    return ["evakuator"] if user.role == "evakuator" else ["tezkor_usta", "diagnostika"]


class SOSCreateView(APIView):
    def get(self, request):
        qs = SOSRequest.objects.filter(user=request.user).select_related("assignee", "user")
        return Response(SOSSerializer(qs, many=True).data)

    def post(self, request):
        d = request.data
        try:
            lat, lng = float(d.get("lat")), float(d.get("lng"))
        except (TypeError, ValueError):
            return Response({"detail": "Joylashuvingizni aniqlab bo'lmadi. GPS ni yoqing yoki xaritada belgilang."}, status=400)
        if not (-90 <= lat <= 90 and -180 <= lng <= 180) or lat != lat or lng != lng:
            return Response({"detail": "Joylashuv noto'g'ri."}, status=400)
        kind = str_in(d.get("kind")) or "evakuator"
        if kind not in dict(SOSRequest.KINDS):
            return Response({"detail": "Yordam turini tanlang."}, status=400)
        if SOSRequest.objects.filter(user=request.user, status__in=ACTIVE).exists():
            return Response({"detail": "Sizda faol so'rov bor. Avval uni yakunlang yoki bekor qiling."}, status=400)
        vehicle = Vehicle.objects.filter(pk=d.get("vehicle"), owner=request.user).first() if d.get("vehicle") else None
        sos = SOSRequest.objects.create(user=request.user, kind=kind, lat=lat, lng=lng,
                                        address=(d.get("address") or "")[:200], note=(d.get("note") or "")[:500], vehicle=vehicle)
        alert_providers(sos)
        return Response(SOSSerializer(sos).data, status=201)


class SOSDetailView(APIView):
    def get(self, request, pk):
        sos = get_object_or_404(SOSRequest.objects.select_related("assignee", "user"), pk=pk)
        if request.user.id not in (sos.user_id, sos.assignee_id) and request.user.role != "admin":
            return Response({"detail": "Ruxsat yo'q."}, status=403)
        if sos.assignee:
            sos._distance = haversine_km(sos.lat, sos.lng, sos.assignee.lat, sos.assignee.lng)
        return Response(SOSSerializer(sos).data)


class SOSCancelView(APIView):
    def post(self, request, pk):
        sos = get_object_or_404(SOSRequest, pk=pk, user=request.user)
        if sos.status not in ACTIVE:
            return Response({"detail": "So'rov allaqachon yopilgan."}, status=400)
        sos.status = "cancelled"
        sos.save(update_fields=["status"])
        if sos.assignee:
            notify(sos.assignee, "SOS bekor qilindi", f"{request.user.full_name} so'rovni bekor qildi", "sos",
                   "/app/evak" if sos.assignee.role == "evakuator" else "/app/usta/sos", telegram=True, urgent=True, dedup=f"sos-{sos.id}-cancel")
        return Response(SOSSerializer(sos).data)


class SOSAvailableView(APIView):
    permission_classes = [IsProvider]

    def get(self, request):
        u = request.user
        qs = list(SOSRequest.objects.filter(status="searching", kind__in=kinds_for(u)).exclude(user=u).select_related("user", "vehicle"))
        radius = SiteSettings.load().sos_radius_km or 30
        for s in qs:
            s._distance = haversine_km(u.lat, u.lng, s.lat, s.lng)
        # joylashuvi ma'lum bo'lsa — faqat radius ichidagi so'rovlar
        if u.lat is not None:
            qs = [s for s in qs if s._distance is not None and s._distance <= radius]
        qs.sort(key=lambda s: (s._distance is None, s._distance or 0))
        data = SOSSerializer(qs, many=True).data
        # maxfiylik: qabul qilinmaguncha mijoz telefoni va familiyasi ko'rsatilmaydi
        for d in data:
            c = d.get("client") or {}
            c["phone"] = ""
            c["full_name"] = (c.get("full_name") or "").split(" ")[0]
        return Response(data)


class SOSAssignedView(APIView):
    permission_classes = [IsProvider]

    def get(self, request):
        qs = SOSRequest.objects.filter(assignee=request.user).select_related("user", "vehicle")
        if request.query_params.get("active") == "1":
            qs = qs.filter(status__in=ACTIVE)
        items = list(qs[:50])
        for s in items:
            s._distance = haversine_km(request.user.lat, request.user.lng, s.lat, s.lng)
        return Response(SOSSerializer(items, many=True).data)


class SOSAcceptView(APIView):
    permission_classes = [IsProvider]

    @transaction.atomic
    def post(self, request, pk):
        sos = SOSRequest.objects.select_for_update().filter(pk=pk).first()
        if not sos or sos.kind not in kinds_for(request.user):
            return Response({"detail": "So'rov topilmadi."}, status=404)
        if sos.status != "searching":
            return Response({"detail": "Bu so'rovni boshqa haydovchi qabul qilib bo'ldi."}, status=400)
        if SOSRequest.objects.filter(assignee=request.user, status__in=ACTIVE).exists():
            return Response({"detail": "Avval joriy so'rovni yakunlang."}, status=400)
        price = request.data.get("price")
        if not price and hasattr(request.user, "evacuator"):
            e = request.user.evacuator
            dist = haversine_km(request.user.lat, request.user.lng, sos.lat, sos.lng) or 0
            price = e.base_price + int(dist * e.price_per_km)
        sos.assignee, sos.status, sos.price = request.user, "accepted", int(price or 0) or None
        sos.save()
        notify(sos.user, "🚚 Yordam topildi!", f"{request.user.full_name} so'rovingizni qabul qildi.", "sos", f"/app/sos?id={sos.id}",
               telegram=True, urgent=True, dedup=f"sos-{sos.id}-accepted-{request.user.id}")
        return Response(SOSSerializer(sos).data)


class SOSStatusView(APIView):
    permission_classes = [IsProvider]

    def post(self, request, pk):
        sos = get_object_or_404(SOSRequest, pk=pk, assignee=request.user)
        new = str_in(request.data.get("status"))
        if new == "cancelled" and sos.status in ("accepted", "on_the_way"):
            sos.status, sos.assignee = "searching", None
            sos.save()
            notify(sos.user, "Haydovchi rad etdi", "Siz uchun boshqa yordamchi qidirilmoqda.", "sos", f"/app/sos?id={sos.id}",
                   telegram=True, urgent=True, dedup=f"sos-{sos.id}-declined-{request.user.id}")
            return Response({"ok": True})
        if FLOW.get(sos.status) != new:
            return Response({"detail": "Holat ketma-ketligi noto'g'ri."}, status=400)
        sos.status = new
        sos.save(update_fields=["status", "updated_at"])
        labels = {"on_the_way": "Yordamchi yo'lga chiqdi", "arrived": "Yordamchi yetib keldi", "completed": "Xizmat yakunlandi"}
        notify(sos.user, labels[new], f"{request.user.full_name}", "sos", f"/app/sos?id={sos.id}", telegram=True,
               urgent=new != "completed", dedup=f"sos-{sos.id}-{new}")
        if new == "completed" and hasattr(request.user, "evacuator"):
            request.user.evacuator.completed += 1
            request.user.evacuator.save(update_fields=["completed"])
        return Response(SOSSerializer(sos).data)


class EvacuatorMeView(APIView):
    permission_classes = [IsEvakuator]

    def get(self, request):
        return Response(EvacuatorProfileSerializer(EvacuatorProfile.objects.get_or_create(user=request.user)[0]).data)

    def patch(self, request):
        s = EvacuatorProfileSerializer(EvacuatorProfile.objects.get_or_create(user=request.user)[0], data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class ProviderStatsView(APIView):
    permission_classes = [IsProvider]

    def get(self, request):
        qs = SOSRequest.objects.filter(assignee=request.user)
        today = timezone.localdate()
        done = qs.filter(status="completed")
        return Response({
            "today": qs.filter(created_at__date=today).count(),
            "completed": done.count(),
            "active": qs.filter(status__in=ACTIVE).count(),
            "revenue": done.aggregate(s=Sum("price"))["s"] or 0,
            "today_revenue": done.filter(updated_at__date=today).aggregate(s=Sum("price"))["s"] or 0,
            "waiting": SOSRequest.objects.filter(status="searching", kind__in=kinds_for(request.user)).count(),
        })


class SOSReviewView(APIView):
    """Mijoz yakunlangan SOS xizmatiga baho beradi (evakuator yoki usta reytingiga qo'shiladi)."""

    def post(self, request, pk):
        from django.db.models import Avg, Count
        from masters.models import Review
        sos = get_object_or_404(SOSRequest, pk=pk, user=request.user)
        if sos.status != "completed" or not sos.assignee:
            return Response({"detail": "Faqat yakunlangan xizmatga baho qo'yiladi."}, status=400)
        if sos.rating:
            return Response({"detail": "Siz allaqachon baho qo'ygansiz."}, status=400)
        try:
            rating = max(1, min(5, int(request.data.get("rating") or 5)))
        except ValueError:
            rating = 5
        sos.rating, sos.review = rating, (request.data.get("text") or "")[:300]
        sos.save(update_fields=["rating", "review"])
        a = sos.assignee
        if hasattr(a, "evacuator"):
            agg = SOSRequest.objects.filter(assignee=a, rating__isnull=False).aggregate(r=Avg("rating"), c=Count("id"))
            a.evacuator.rating, a.evacuator.reviews_count = round(agg["r"] or 0, 1), agg["c"]
            a.evacuator.save(update_fields=["rating", "reviews_count"])
        elif hasattr(a, "master"):
            Review.objects.create(master=a.master, user=request.user, rating=rating, text=sos.review or f"SOS: {sos.get_kind_display()}")
            a.master.recalc_rating()
        notify(a, "Yangi baho", f"{request.user.full_name} {rating}★ baho qo'ydi", "review")
        return Response({"ok": True, "rating": rating})
