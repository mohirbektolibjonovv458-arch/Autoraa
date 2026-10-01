from django.conf import settings
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PushSubscription
from .push import enabled, endpoint_allowed

MAX_DEVICES = 10


class PushKeyView(APIView):
    """Brauzer obuna bo'lishi uchun faqat OCHIQ (public) VAPID kalit."""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"enabled": enabled(), "public_key": settings.VAPID_PUBLIC_KEY if enabled() else ""})


class PushSubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not enabled():
            return Response({"detail": "Push bildirishnomalar serverda sozlanmagan."}, status=503)
        d = request.data
        endpoint = str(d.get("endpoint") or "")[:700]
        keys = d.get("keys") if isinstance(d.get("keys"), dict) else {}
        p256dh, auth = str(keys.get("p256dh") or "")[:200], str(keys.get("auth") or "")[:100]
        if not endpoint_allowed(endpoint) or not p256dh or not auth:
            return Response({"detail": "Obuna ma'lumotlari noto'g'ri."}, status=400)
        # qurilma boshqa hisobga o'tgan bo'lsa (logout → boshqa login) — obuna yangi egaga o'tadi, eskisiga xabar bormaydi
        sub, created = PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={"user": request.user, "p256dh": p256dh, "auth": auth, "is_active": True, "failures": 0,
                      "user_agent": request.META.get("HTTP_USER_AGENT", "")[:200]})
        # qurilmalar soni cheklangan: eng eskisi o'chiriladi
        extra = list(request.user.push_subs.order_by("-created_at").values_list("id", flat=True)[MAX_DEVICES:])
        if extra:
            PushSubscription.objects.filter(id__in=extra).delete()
        return Response({"ok": True, "devices": request.user.push_subs.filter(is_active=True).count()}, status=201 if created else 200)


class PushUnsubscribeView(APIView):
    """Logout yoki foydalanuvchi o'chirganda. Faqat o'z obunasini o'chira oladi."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = str(request.data.get("endpoint") or "")
        if endpoint:
            n = PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()[0]
        elif request.data.get("all"):
            n = request.user.push_subs.all().delete()[0]
        else:
            n = 0
        return Response({"removed": n})


class PushStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"enabled": enabled(), "devices": request.user.push_subs.filter(is_active=True).count()})
