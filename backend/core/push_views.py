from django.conf import settings
import logging

from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
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
            from urllib.parse import urlparse
            host = (urlparse(endpoint).hostname or "?")[:60] if endpoint else "-"
            logging.getLogger("avtora").warning("Push obunasi rad etildi: push xizmati %s (qo'llab-quvvatlanmaydi yoki ma'lumot noto'g'ri)", host)
            return Response({"detail": "Bu brauzerning push xizmati qo'llab-quvvatlanmaydi. Chrome, Edge, Firefox yoki Safari'da oching."}, status=400)
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
        """Diagnostika: xabar qayerda to'xtayotganini foydalanuvchining o'zi ko'radi (endpoint/kalitlar qaytarilmaydi)."""
        u = request.user
        subs = list(u.push_subs.all())
        active = [x for x in subs if x.is_active]
        last_ok = max((x.last_success for x in subs if x.last_success), default=None)
        recent = [{"title": n.title, "kind": n.kind, "push": n.push_state, "at": n.created_at}
                  for n in u.notifications.exclude(push_state="off").order_by("-id")[:6]]
        errs = sorted((x for x in subs if x.last_error), key=lambda x: x.last_error_at or x.created_at, reverse=True)
        return Response({"enabled": enabled(), "devices": len(active), "broken_devices": len(subs) - len(active),
                         "failures": sum(x.failures for x in active), "last_success": last_ok,
                         "last_error": errs[0].last_error if errs else "", "last_error_at": errs[0].last_error_at if errs else None,
                         "telegram": bool(u.telegram_chat_id), "recent": recent})


class PushResubscribeView(APIView):
    """Brauzer obunani o'zi almashtirganda (service worker «pushsubscriptionchange»).
    Service worker'da login tokeni yo'q, shuning uchun egasi ESKI endpoint orqali aniqlanadi —
    u faqat shu qurilmaga ma'lum bo'lgan tasodifiy manzil. Obuna o'sha foydalanuvchida qoladi,
    ilova ochilmasa ham usta yangi bron haqidagi xabarni olishda davom etadi."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "push_resub"

    def post(self, request):
        if not enabled():
            return Response({"detail": "Push bildirishnomalar serverda sozlanmagan."}, status=503)
        d = request.data
        old = str(d.get("old_endpoint") or "")[:700]
        endpoint = str(d.get("endpoint") or "")[:700]
        keys = d.get("keys") if isinstance(d.get("keys"), dict) else {}
        p256dh, auth = str(keys.get("p256dh") or "")[:200], str(keys.get("auth") or "")[:100]
        if not old or not endpoint_allowed(endpoint) or not p256dh or not auth:
            return Response({"detail": "Obuna ma'lumotlari noto'g'ri."}, status=400)
        prev = PushSubscription.objects.filter(endpoint=old).select_related("user").first()
        if not prev or not prev.user.is_active:
            return Response({"detail": "Eski obuna topilmadi."}, status=404)
        user = prev.user
        if old != endpoint:
            prev.delete()
        PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={"user": user, "p256dh": p256dh, "auth": auth, "is_active": True, "failures": 0,
                      "user_agent": request.META.get("HTTP_USER_AGENT", "")[:200]})
        return Response({"ok": True})


class PushTestView(APIView):
    """«Sinov xabari»: foydalanuvchi tugmani bosadi, ilovadan chiqadi (masalan, Instagram'ga o'tadi) —
    bir necha soniyadan keyin telefoniga xabar kelishi kerak. Kelmasa — muammo telefon sozlamalarida
    (batareya tejash, avtoishga tushirish), server yoki ilovada emas."""
    DELAY = 10

    def post(self, request):
        from django.core.cache import cache
        if not enabled():
            return Response({"detail": "Push bildirishnomalar serverda sozlanmagan."}, status=503)
        devices = request.user.push_subs.filter(is_active=True).count()
        if not devices:
            return Response({"detail": "Bu hisobda bildirishnoma yoqilgan qurilma yo'q. Avval «Yoqish» tugmasini bosing."}, status=409)
        if not cache.add(f"push-test:{request.user.id}", 1, 30):
            return Response({"detail": "Sinov xabari yaqinda yuborildi. 30 soniyadan keyin qayta urinib ko'ring."}, status=429)
        import threading
        from django.db import close_old_connections
        from .models import notify
        user = request.user

        def later():
            try:
                close_old_connections()
                notify(user, "🔔 Sinov xabari", "Bildirishnomalar ishlayapti! Mijoz bron qilsa, xuddi shunday xabar keladi.",
                       "system", "/app/notifications", urgent=True)
            finally:
                close_old_connections()
        threading.Timer(self.DELAY, later).start()
        return Response({"ok": True, "devices": devices, "delay": self.DELAY})
