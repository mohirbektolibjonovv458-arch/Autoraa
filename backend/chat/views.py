from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.serializers import UserShortSerializer
from core.models import notify

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "sender", "text", "image", "lat", "lng", "is_read", "created_at"]

    def get_image(self, m):
        """Chat rasmlari shaxsiy: faqat suhbat ishtirokchisiga beriladigan 6 soatlik imzoli havola."""
        if not m.image:
            return None
        from django.core import signing
        return f"/api/chat/file/{m.id}/?s={signing.dumps(m.id, salt='chat-file')}"


def my_conversations(user):
    return Conversation.objects.filter(Q(user1=user) | Q(user2=user))


class ConversationListView(APIView):
    def get(self, request):
        out = []
        for c in my_conversations(request.user).select_related("user1", "user2"):
            last = c.messages.last()
            out.append({
                "id": c.id,
                "other": UserShortSerializer(c.other(request.user), context={"request": request}).data,
                "last_message": (last.text or ("📷 Rasm" if last.image else "📍 Manzil")) if last else "",
                "last_at": last.created_at if last else c.updated_at,
                "unread": c.messages.filter(is_read=False).exclude(sender=request.user).count(),
            })
        return Response(out)


def can_contact(me, other):
    """Kim kimga yoza oladi:
    - istalgan foydalanuvchi — usta/evakuatorga (xizmat ko'rsatuvchi, ochiq profil);
    - usta/evakuator — faqat o'zi bilan bog'liq mijozga (bron, SOS, zapchast buyurtmasi) yoki avval yozishgan kishiga;
    - admin — hammaga; hammaga — adminga (qo'llab-quvvatlash)."""
    from django.db.models import Q
    from evacuator.models import SOSRequest
    from market.models import PartOrder
    from masters.models import Booking
    if me.role == "admin" or other.role == "admin" or other.role in ("usta", "evakuator"):
        return True
    a, b = sorted([me.id, other.id])
    if Conversation.objects.filter(user1_id=a, user2_id=b).exists():
        return True
    return (Booking.objects.filter(Q(master__user=me, user=other) | Q(master__user=other, user=me)).exists()
            or SOSRequest.objects.filter(Q(assignee=me, user=other) | Q(assignee=other, user=me)).exists()
            or PartOrder.objects.filter(Q(shop__owner=me, user=other) | Q(shop__owner=other, user=me)).exists())


class StartConversationView(APIView):
    def post(self, request):
        try:
            uid = int(request.data.get("user_id"))
        except (TypeError, ValueError):
            return Response({"detail": "Foydalanuvchi topilmadi."}, status=404)
        other = get_object_or_404(User, pk=uid, is_active=True)
        if other.id == request.user.id:
            return Response({"detail": "O'zingizga yozib bo'lmaydi."}, status=400)
        if not can_contact(request.user, other):
            return Response({"detail": "Bu foydalanuvchiga yozish uchun avval u bilan buyurtma bo'lishi kerak."}, status=403)
        a, b = sorted([request.user.id, other.id])
        c, _ = Conversation.objects.get_or_create(user1_id=a, user2_id=b)
        return Response({"id": c.id})


class MessagesView(APIView):
    def get_conv(self, request, pk):
        return get_object_or_404(my_conversations(request.user), pk=pk)

    def get(self, request, pk):
        c = self.get_conv(request, pk)
        qs = c.messages.all()
        after = request.query_params.get("after")
        if after and str(after).isdigit():
            qs = qs.filter(id__gt=int(after))
        else:
            after = None
            qs = list(qs.order_by("-id")[:300])[::-1]  # oxirgi 300 ta xabar
        c.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)
        # suhbat ochildi — shu suhbat haqidagi bildirishnoma ham o'qilgan (keyingi xabar yana Telegramga keladi)
        request.user.notifications.filter(kind="chat", is_read=False, link=f"/app/chat/{c.id}").update(is_read=True)
        other = c.other(request.user)
        return Response({
            "other": UserShortSerializer(other, context={"request": request}).data,
            "messages": MessageSerializer(qs if not after else qs[:500], many=True, context={"request": request}).data,
        })

    def post(self, request, pk):
        c = self.get_conv(request, pk)
        text = (request.data.get("text") or "").strip()
        image = request.FILES.get("image")
        lat, lng = request.data.get("lat"), request.data.get("lng")
        if not text and not image and not lat:
            return Response({"detail": "Bo'sh xabar."}, status=400)
        if len(text) > 2000:
            return Response({"detail": "Xabar juda uzun (2000 belgigacha)."}, status=400)
        from core.uploads import check_image
        err = check_image(image)
        if err:
            return Response({"detail": err}, status=400)
        try:
            lat = float(lat) if lat else None
            lng = float(lng) if lng else None
        except (TypeError, ValueError):
            return Response({"detail": "Joylashuv noto'g'ri."}, status=400)
        if (lat is not None and not -90 <= lat <= 90) or (lng is not None and not -180 <= lng <= 180):
            return Response({"detail": "Joylashuv noto'g'ri."}, status=400)
        m = Message.objects.create(conversation=c, sender=request.user, text=text, image=image, lat=lat, lng=lng)
        c.save()
        other = c.other(request.user)
        # HAR bir xabar haqida xabar beriladi (oldin: birinchi bildirishnoma o'qilmaguncha keyingilari jim qolardi).
        # Ro'yxat to'lib ketmasligi uchun shu suhbatning o'qilmagan bildirishnomasi bittaga yig'iladi,
        # telefonda esa bitta bildirishnoma yangilanib, har safar qayta jiringlaydi (tag + urgent).
        link = f"/app/chat/{c.id}"
        other.notifications.filter(kind="chat", is_read=False, link=link).delete()
        unread = Message.objects.filter(conversation=c, sender=request.user, is_read=False).count()
        preview = text[:100] or "📎 Rasm yoki joylashuv"
        notify(other, f"💬 {request.user.full_name}", preview if unread <= 1 else f"{preview}\n({unread} ta yangi xabar)", "chat", link,
               telegram=True, urgent=True, tag=f"chat-{c.id}",
               push_body="Sizga yangi xabar keldi" if unread <= 1 else f"Sizga {unread} ta yangi xabar keldi")
        return Response(MessageSerializer(m, context={"request": request}).data, status=201)


class UnreadView(APIView):
    def get(self, request):
        n = Message.objects.filter(Q(conversation__user1=request.user) | Q(conversation__user2=request.user), is_read=False).exclude(sender=request.user).count()
        return Response({"unread": n})


class ChatFileView(APIView):
    """Chat rasmini imzoli havola orqali beradi (/media/chat/ ochiq emas)."""
    permission_classes = []
    authentication_classes = []

    def get(self, request, pk):
        from django.core import signing
        from django.http import FileResponse, Http404
        try:
            if signing.loads(request.query_params.get("s", ""), salt="chat-file", max_age=6 * 3600) != pk:
                raise Http404
        except signing.BadSignature:
            raise Http404
        m = Message.objects.filter(pk=pk).first()
        if not m or not m.image:
            raise Http404
        try:
            fh = m.image.open("rb")
        except FileNotFoundError:
            # fayl diskda yo'q (masalan, Railway'da Volume ulanmagan va deploy'da o'chib ketgan) — 500 emas, 404
            raise Http404
        resp = FileResponse(fh)
        resp["Cache-Control"] = "private, max-age=3600"
        resp["X-Content-Type-Options"] = "nosniff"
        return resp
