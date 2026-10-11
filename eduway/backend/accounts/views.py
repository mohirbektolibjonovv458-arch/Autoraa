from django.contrib.auth import authenticate
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from core.progress import award

from .serializers import SUBJECTS, PasswordChangeSerializer, ProfileSerializer, RegisterSerializer


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class AuthThrottled(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class RegisterView(AuthThrottled):
    def post(self, request):
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()
        return Response({"user": ProfileSerializer(user).data, **tokens_for(user)}, status=status.HTTP_201_CREATED)


class LoginView(AuthThrottled):
    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        password = str(request.data.get("password", ""))
        user = authenticate(request, email=email, password=password) if email and password else None
        if not user:
            return Response({"detail": "Email yoki parol noto'g'ri."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"user": ProfileSerializer(user).data, **tokens_for(user)})


class LogoutView(APIView):
    def post(self, request):
        try:
            RefreshToken(request.data.get("refresh", "")).blacklist()
        except TokenError:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(ProfileSerializer(request.user).data)

    def patch(self, request):
        s = ProfileSerializer(request.user, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        user = s.save()
        if user.onboarded:
            award(user, "first_step")
        return Response(ProfileSerializer(user).data)

    def delete(self, request):
        # Akkauntni o'chirish: barcha shaxsiy ma'lumotlar CASCADE bilan o'chadi
        u = request.user
        if u.has_usable_password():
            if not u.check_password(str(request.data.get("password", ""))):
                return Response({"detail": "Parol noto'g'ri."}, status=status.HTTP_400_BAD_REQUEST)
        elif str(request.data.get("confirm", "")).strip().upper() not in ("O'CHIRISH", "OCHIRISH"):
            return Response({"detail": "Tasdiqlash uchun O'CHIRISH deb yozing."}, status=status.HTTP_400_BAD_REQUEST)
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordView(APIView):
    def post(self, request):
        s = PasswordChangeSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        request.user.set_password(s.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response(tokens_for(request.user))


class OptionsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "subjects": SUBJECTS,
            "interests": ["texnologiya", "dasturlash", "tibbiyot", "biznes", "dizayn", "san'at", "fan va tadqiqot", "muhandislik", "ta'lim", "huquq", "media", "sport", "ekologiya", "til o'rganish", "psixologiya", "moliya"],
            "countries": ["O'zbekiston", "AQSh", "Buyuk Britaniya", "Germaniya", "Janubiy Koreya", "Turkiya", "Vengriya", "Italiya", "Yaponiya", "Xitoy", "Kanada", "Malayziya"],
            "stages": [{"value": v, "label": l} for v, l in [("school", "Maktab"), ("lyceum", "Litsey / kollej"), ("university", "Universitet"), ("graduate", "Bitiruvchi")]],
        })


# --- Telefon raqam + Telegram kod orqali kirish / ro'yxatdan o'tish ---

import hmac as _hmac  # noqa: E402
import secrets as _secrets  # noqa: E402
from datetime import timedelta as _td  # noqa: E402

from django.utils import timezone as _tz  # noqa: E402
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes  # noqa: E402

from . import telegram as tg  # noqa: E402
from .models import LoginRequest, TelegramLink, User  # noqa: E402

RESEND_SECONDS = 60
MAX_ATTEMPTS = 5


class PhoneThrottle(AnonRateThrottle):
    """IP bo'yicha: daqiqasiga 10 ta (kod terish va yuborishni ko'p urinib topishdan himoya)."""

    scope = "auth"


def _bot_url(req):
    name = tg.bot_username()
    return f"https://t.me/{name}?start={req.token}" if name else None


def _req_payload(req, linked):
    wait = 0
    if req.code_sent_at:
        wait = max(0, RESEND_SECONDS - int((_tz.now() - req.code_sent_at).total_seconds()))
    return {"token": req.token, "phone": req.phone, "status": "code_sent" if req.code_sent_at else "need_bot",
            "linked": linked, "bot_url": _bot_url(req), "resend_in": wait}


@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])
def phone_config(request):
    name = tg.bot_username() if tg.configured() else ""
    # configured — token bor; ok — token Telegram tomonidan qabul qilindi (getMe ishladi)
    return Response({"configured": tg.configured(), "ok": bool(name), "bot_username": name})


@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
@throttle_classes([PhoneThrottle])
def phone_start(request):
    if not tg.configured():
        return Response({"detail": "Telegram bot hali sozlanmagan. Administrator TELEGRAM_BOT_TOKEN ni kiritishi kerak.", "code": "bot_not_configured"}, status=503)
    phone = tg.normalize_phone(request.data.get("phone"))
    if not phone:
        return Response({"detail": "Telefon raqamni to'g'ri kiriting: +998 XX XXX XX XX"}, status=400)
    mode = "register" if request.data.get("mode") == "register" else "login"
    first_name = str(request.data.get("first_name", "")).strip()[:60]
    u = User.objects.filter(phone=phone).first()
    if u and not u.is_active:
        return Response({"detail": "Bu akkaunt bloklangan. Administratorga murojaat qiling."}, status=403)
    if mode == "login" and not u:
        return Response({"detail": "Bu raqam hali ro'yxatdan o'tmagan. «Ro'yxatdan o'tish» bo'limini tanlang.", "code": "not_registered"}, status=404)
    if mode == "register" and u:
        return Response({"detail": "Bu raqam allaqachon ro'yxatdan o'tgan. «Kirish» bo'limidan kiring.", "code": "already_registered"}, status=409)
    if mode == "register" and not first_name:
        return Response({"detail": "Ismingizni kiriting."}, status=400)
    # so'nggi 10 daqiqadagi faol so'rov qayta ishlatiladi (bot havolasi o'zgarmasin)
    req = LoginRequest.objects.filter(phone=phone, mode=mode, used=False, created__gte=_tz.now() - _td(minutes=10)).order_by("-created").first()
    if LoginRequest.objects.filter(phone=phone, created__gte=_tz.now() - _td(hours=1)).count() >= 10:
        return Response({"detail": "Juda ko'p urinish. Bir soatdan so'ng qayta urinib ko'ring."}, status=429)
    if not req:
        req = LoginRequest.objects.create(phone=phone, token=_secrets.token_urlsafe(12), mode=mode, first_name=first_name)
    elif first_name and req.first_name != first_name:
        req.first_name = first_name
        req.save(update_fields=["first_name"])
    link = TelegramLink.objects.filter(phone=phone).first()
    if link and (not req.code_sent_at or (_tz.now() - req.code_sent_at).total_seconds() >= RESEND_SECONDS):
        if not tg.send_code(req, link.chat_id):
            # foydalanuvchi botni bloklagan bo'lishi mumkin — botni qayta ochib, raqamni ulashsin
            req.code_sent_at = None
            req.save(update_fields=["code_sent_at"])
            return Response({**_req_payload(req, False), "status": "need_bot"})
    return Response(_req_payload(req, bool(link)))


@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])
def phone_status(request):
    req = LoginRequest.objects.filter(token=str(request.query_params.get("token", ""))[:32], used=False).first()
    if not req:
        return Response({"detail": "So'rov topilmadi yoki eskirgan. Qaytadan boshlang."}, status=404)
    return Response(_req_payload(req, TelegramLink.objects.filter(phone=req.phone).exists()))


@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
@throttle_classes([PhoneThrottle])
def phone_resend(request):
    req = LoginRequest.objects.filter(token=str(request.data.get("token", ""))[:32], used=False).first()
    if not req:
        return Response({"detail": "So'rov eskirgan. Qaytadan boshlang."}, status=404)
    link = TelegramLink.objects.filter(phone=req.phone).first()
    if not link:
        return Response(_req_payload(req, False))
    if req.code_sent_at and (_tz.now() - req.code_sent_at).total_seconds() < RESEND_SECONDS:
        return Response(_req_payload(req, True))
    tg.send_code(req, link.chat_id)
    return Response(_req_payload(req, True))


@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
@throttle_classes([PhoneThrottle])
def phone_verify(request):
    code = str(request.data.get("code", "")).strip()
    with transaction.atomic():
        req = LoginRequest.objects.select_for_update().filter(token=str(request.data.get("token", ""))[:32], used=False).first()
        if not req or not req.code_sent_at:
            return Response({"detail": "Avval kod oling."}, status=400)
        if (_tz.now() - req.code_sent_at).total_seconds() > LoginRequest.LIFETIME:
            return Response({"detail": "Kod muddati tugadi. «Kodni qayta yuborish»ni bosing.", "code": "expired"}, status=400)
        if req.attempts >= MAX_ATTEMPTS:
            return Response({"detail": "Urinishlar tugadi. Yangi kod oling.", "code": "too_many"}, status=400)
        if not (len(code) == 4 and code.isdigit() and _hmac.compare_digest(req.code_hash, tg.code_hash(req.phone, code))):
            req.attempts += 1
            req.save(update_fields=["attempts"])
            left = MAX_ATTEMPTS - req.attempts
            return Response({"detail": f"Kod noto'g'ri. Yana {left} ta urinish qoldi." if left else "Kod noto'g'ri. Yangi kod oling.", "code": "wrong_code"}, status=400)
        req.used = True
        req.save(update_fields=["used"])
        link = TelegramLink.objects.filter(phone=req.phone).first()
        user = User.objects.filter(phone=req.phone).first()
        is_new = user is None
        if is_new and req.mode != "register":
            return Response({"detail": "Bu raqam ro'yxatdan o'tmagan. «Ro'yxatdan o'tish» bo'limini tanlang.", "code": "not_registered"}, status=404)
        if is_new:
            user = User.objects.create_user(phone=req.phone, first_name=(req.first_name or (link.first_name if link else ""))[:60])
        if not user.is_active:
            return Response({"detail": "Bu akkaunt bloklangan."}, status=403)
        if link and user.telegram_chat_id != link.chat_id:
            user.telegram_chat_id = link.chat_id
            user.save(update_fields=["telegram_chat_id"])
    return Response({"user": ProfileSerializer(user).data, "is_new": is_new, **tokens_for(user)})


@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
def telegram_webhook(request):
    if not _hmac.compare_digest(request.headers.get("X-Telegram-Bot-Api-Secret-Token", ""), tg.webhook_secret()):
        return Response(status=403)
    try:
        tg.handle_update(request.data if isinstance(request.data, dict) else {})
    except Exception:  # noqa: BLE001 — Telegram qayta-qayta yubormasligi uchun 200 qaytaramiz
        import logging

        logging.getLogger("eduway").exception("Telegram webhook xatosi")
    return Response({"ok": True})
