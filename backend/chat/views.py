from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.serializers import UserShortSerializer
from core.models import notify

from .models import Conversation, Message


EDIT_WINDOW_HOURS = 48  # o'z xabarini shu muddat ichida tahrirlash mumkin (o'chirish — istalgan vaqtda)


class MessageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    audio = serializers.SerializerMethodField()
    edited = serializers.SerializerMethodField()
    deleted = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "sender", "text", "image", "audio", "audio_duration", "lat", "lng", "is_read", "created_at", "edited", "deleted"]

    def to_representation(self, m):
        d = super().to_representation(m)
        if m.deleted_at:  # o'chirilgan xabar mazmuni hech kimga qaytarilmaydi
            d.update(text="", image=None, audio=None, audio_duration=None, lat=None, lng=None)
        return d

    def get_image(self, m):
        """Chat rasmlari shaxsiy: faqat suhbat ishtirokchisiga beriladigan 6 soatlik imzoli havola."""
        if not m.image or m.deleted_at:
            return None
        from django.core import signing
        return f"/api/chat/file/{m.id}/?s={signing.dumps(m.id, salt='chat-file')}"

    def get_audio(self, m):
        if not m.audio or m.deleted_at:
            return None
        from django.core import signing
        return f"/api/chat/audio/{m.id}/?s={signing.dumps(m.id, salt='chat-audio')}"

    def get_edited(self, m):
        return bool(m.edited_at)

    def get_deleted(self, m):
        return bool(m.deleted_at)


def preview_of(m):
    if m.deleted_at:
        return "🚫 Xabar o'chirildi"
    return m.text or ("🎤 Ovozli xabar" if m.audio else "📷 Rasm" if m.image else "📍 Manzil")


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
                "last_message": preview_of(last) if last else "",
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


VIEWING_TTL = 12  # soniya


def viewing_key(user_id, conv_id):
    return f"chat-viewing:{user_id}:{conv_id}"


class MessagesView(APIView):
    def get_conv(self, request, pk):
        return get_object_or_404(my_conversations(request.user), pk=pk)

    def get(self, request, pk):
        server_time = timezone.now().timestamp()  # so'rov boshidagi vaqt — keyingi «since» uchun (hech narsa tushib qolmasin)
        c = self.get_conv(request, pk)
        qs = c.messages.all()
        after = request.query_params.get("after")
        if after and str(after).isdigit():
            qs = qs.filter(id__gt=int(after))
        else:
            after = None
            qs = list(qs.order_by("-id")[:300])[::-1]  # oxirgi 300 ta xabar
        if request.query_params.get("active") == "1":
            # foydalanuvchi aynan shu suhbatni ekranda ko'rib turibdi (sahifa ko'rinib turganda har 3 soniyada so'raydi) —
            # yangi xabar kelsa push yuborilmaydi, faqat chat oynasi yangilanadi
            from django.core.cache import cache
            cache.set(viewing_key(request.user.id, c.id), 1, VIEWING_TTL)
        # o'qildi — vaqt belgisi ham yangilanadi, shunda yuboruvchi ✓✓ ni ko'radi
        c.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True, updated_at=timezone.now())
        # suhbat ochildi — shu suhbat haqidagi bildirishnoma ham o'qilgan (keyingi xabar yana Telegramga keladi)
        request.user.notifications.filter(kind="chat", is_read=False, link=f"/app/chat/{c.id}").update(is_read=True)
        other = c.other(request.user)
        # since — oxirgi so'rov vaqti: shundan beri tahrirlangan / o'chirilgan / o'qilgan (avval yuklangan) xabarlar
        changed = []
        since = parse_since(request.query_params.get("since"))
        if after and since:
            changed = MessageSerializer(c.messages.filter(id__lte=int(after), updated_at__gte=since)[:300], many=True,
                                        context={"request": request}).data
        return Response({
            "other": UserShortSerializer(other, context={"request": request}).data,
            "messages": MessageSerializer(qs if not after else qs[:500], many=True, context={"request": request}).data,
            "changed": changed,
            "server_time": server_time,
        })

    def post(self, request, pk):
        c = self.get_conv(request, pk)
        text = (request.data.get("text") or "").strip()
        image = request.FILES.get("image")
        audio = request.FILES.get("audio")
        lat, lng = request.data.get("lat"), request.data.get("lng")
        if not text and not image and not audio and not lat:
            return Response({"detail": "Bo'sh xabar."}, status=400)
        duration = None
        if audio:
            from core.uploads import MAX_AUDIO_SECONDS, check_audio
            ext, aerr = check_audio(audio)
            if aerr:
                return Response({"detail": aerr}, status=400)
            audio.name = "voice" + ext  # kengaytma — faylning haqiqiy formati bo'yicha
            try:
                duration = max(1, min(MAX_AUDIO_SECONDS, int(float(request.data.get("duration") or 1))))
            except (TypeError, ValueError):
                duration = 1
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
        m = Message.objects.create(conversation=c, sender=request.user, text=text, image=image, lat=lat, lng=lng,
                                   audio=audio, audio_duration=duration)
        c.save()
        other = c.other(request.user)
        from django.core.cache import cache
        if cache.get(viewing_key(other.id, c.id)):
            # qabul qiluvchi aynan shu chatni ochib turibdi — chat oynasi o'zi yangilanadi, push/Telegram shart emas
            return Response(MessageSerializer(m, context={"request": request}).data, status=201)
        # HAR bir xabar haqida xabar beriladi (oldin: birinchi bildirishnoma o'qilmaguncha keyingilari jim qolardi).
        # Ro'yxat to'lib ketmasligi uchun shu suhbatning o'qilmagan bildirishnomasi bittaga yig'iladi,
        # telefonda esa bitta bildirishnoma yangilanib, har safar qayta jiringlaydi (tag + urgent).
        link = f"/app/chat/{c.id}"
        other.notifications.filter(kind="chat", is_read=False, link=link).delete()
        unread = Message.objects.filter(conversation=c, sender=request.user, is_read=False).count()
        preview = text[:100] or ("🎤 Ovozli xabar" if audio else "📎 Rasm yoki joylashuv")
        # qulf ekranida faqat umumiy matn — ism va xabar matni ko'rinmaydi (ilova ichidagi ro'yxatda ko'rinadi)
        lock = "Sizga yangi xabar keldi" if unread <= 1 else f"Sizga {unread} ta yangi xabar keldi"
        # Telegram — zaxira kanal: bitta suhbatdan daqiqasiga ko'pi bilan bitta (spam bo'lmasin); push esa har xabarda
        tg = cache.add(f"tg-chat:{other.id}:{c.id}", 1, 60)
        notify(other, "🔔 Avtora", f"{request.user.full_name}: {preview}" + (f"\n({unread} ta yangi xabar)" if unread > 1 else ""),
               "chat", link, telegram=tg, urgent=True, tag=f"chat-{c.id}", push_body=lock, event="new_message", object_id=c.id)
        return Response(MessageSerializer(m, context={"request": request}).data, status=201)


class MessageDetailView(APIView):
    """O'z xabarini tahrirlash (PATCH, faqat matn, 48 soat ichida) va o'chirish (DELETE — ikkala tomonda).
    Boshqa odamning xabarini o'zgartirib bo'lmaydi; suhbat ishtirokchisi bo'lmagan kishi xabarni topa olmaydi."""

    def get_msg(self, request, pk, mid):
        c = get_object_or_404(my_conversations(request.user), pk=pk)
        m = get_object_or_404(c.messages, pk=mid)
        if m.sender_id != request.user.id:
            return None, Response({"detail": "Faqat o'z xabaringizni o'zgartira olasiz."}, status=403)
        if m.deleted_at:
            return None, Response({"detail": "Xabar allaqachon o'chirilgan."}, status=400)
        return m, None

    def patch(self, request, pk, mid):
        m, err = self.get_msg(request, pk, mid)
        if err:
            return err
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"detail": "Xabar bo'sh bo'lishi mumkin emas. O'chirish uchun «O'chirish» ni bosing."}, status=400)
        if len(text) > 2000:
            return Response({"detail": "Xabar juda uzun (2000 belgigacha)."}, status=400)
        if m.audio or m.lat is not None:
            return Response({"detail": "Ovozli xabar va manzilni tahrirlab bo'lmaydi."}, status=400)
        if timezone.now() - m.created_at > timedelta(hours=EDIT_WINDOW_HOURS):
            return Response({"detail": f"Xabarni faqat {EDIT_WINDOW_HOURS} soat ichida tahrirlash mumkin."}, status=400)
        if text != m.text:
            m.text, m.edited_at = text, timezone.now()
            m.save(update_fields=["text", "edited_at", "updated_at"])
        return Response(MessageSerializer(m, context={"request": request}).data)

    def delete(self, request, pk, mid):
        m, err = self.get_msg(request, pk, mid)
        if err:
            return err
        # mazmun va fayllar butunlay o'chiriladi (maxfiylik); suhbatda «Xabar o'chirildi» yozuvi qoladi
        for f in (m.image, m.audio):
            if f:
                f.delete(save=False)
        m.text, m.image, m.audio, m.audio_duration, m.lat, m.lng = "", None, None, None, None, None
        m.deleted_at = timezone.now()
        m.save()
        return Response(MessageSerializer(m, context={"request": request}).data)


def parse_since(v):
    try:
        t = float(v)
    except (TypeError, ValueError):
        return None
    from datetime import datetime, timezone as dt_tz
    return datetime.fromtimestamp(t - 2, tz=dt_tz.utc)  # 2 s zaxira (soat farqi / bir vaqtdagi yozuvlar)


class UnreadView(APIView):
    def get(self, request):
        n = Message.objects.filter(Q(conversation__user1=request.user) | Q(conversation__user2=request.user), is_read=False).exclude(sender=request.user).count()
        return Response({"unread": n})


class ChatAudioView(APIView):
    """Ovozli xabar faylini imzoli havola orqali beradi (6 soat). Ochiq /media/ orqali berilmaydi."""
    permission_classes = []
    authentication_classes = []

    def get(self, request, pk):
        from django.core import signing
        from django.http import Http404
        from core.uploads import AUDIO_FORMATS
        import os
        try:
            if signing.loads(request.query_params.get("s", ""), salt="chat-audio", max_age=6 * 3600) != pk:
                raise Http404
        except signing.BadSignature:
            raise Http404
        m = Message.objects.filter(pk=pk, deleted_at__isnull=True).first()
        if not m or not m.audio:
            raise Http404
        try:
            fh = m.audio.open("rb")
        except FileNotFoundError:
            raise Http404
        from core.ranged import ranged_response
        ctype = AUDIO_FORMATS.get(os.path.splitext(m.audio.name)[1].lower(), "application/octet-stream")
        resp = ranged_response(request, fh, m.audio.size, ctype)  # iPhone audio'ni faqat Range bilan ijro etadi
        resp["Cache-Control"] = "private, max-age=3600"
        resp["X-Content-Type-Options"] = "nosniff"
        return resp


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
