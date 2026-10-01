import secrets

from core.params import str_in
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.cache import cache
from datetime import timedelta
from django.db.models import Sum

from .models import AuthCode, TelegramLink, User
from .serializers import UserSerializer
from .utils import auth_bot_url, normalize_phone, send_auth_message

BOT_URL = auth_bot_url


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh), "user": UserSerializer(user).data}


MAX_FAILS_PER_HOUR = 10
MAX_CODES_PER_DAY = 10


def revoke_user_tokens(user):
    """Foydalanuvchining barcha sessiyalarini bekor qiladi (bloklash, hisobni o'chirish)."""
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
    for t in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=t)


def phone_locked(phone):
    fails = AuthCode.objects.filter(phone=phone, created_at__gte=timezone.now() - timedelta(hours=1)).aggregate(s=Sum("attempts"))["s"] or 0
    return fails >= MAX_FAILS_PER_HOUR


def check_code(phone, code, purpose):
    """Kodni tekshiradi. Xato bo'lsa matn qaytaradi, to'g'ri bo'lsa None."""
    if phone_locked(phone):
        return "Juda ko'p noto'g'ri urinish. Xavfsizlik uchun 1 soatdan so'ng qayta urinib ko'ring."
    obj = AuthCode.objects.filter(phone=phone, purpose=purpose, is_used=False).order_by("-created_at").first()
    if not obj:
        return "Avval kod oling."
    if obj.is_expired:
        return "Kod muddati tugagan. Yangi kod oling."
    if obj.attempts >= 5:
        return "Urinishlar soni tugadi. Yangi kod oling."
    if not secrets.compare_digest(obj.code, str(code or "").strip()):
        obj.attempts += 1
        obj.save(update_fields=["attempts"])
        return f"Kod noto'g'ri. Yana {5 - obj.attempts} ta urinish qoldi."
    obj.is_used = True
    obj.save(update_fields=["is_used"])
    return None


class SendCodeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_code"

    def post(self, request):
        phone = normalize_phone(request.data.get("phone"))
        purpose = request.data.get("purpose", "login")
        if not phone:
            return Response({"detail": "Telefon raqamni +998 XX XXX XX XX ko'rinishida kiriting."}, status=400)
        if purpose not in ("register", "login"):
            return Response({"detail": "Noto'g'ri so'rov."}, status=400)

        exists = User.objects.filter(phone=phone).exists()
        if purpose == "register" and exists:
            return Response({"detail": "Bu raqam ro'yxatdan o'tgan. Kirish sahifasidan foydalaning."}, status=400)
        if purpose == "login" and not exists:
            return Response({"detail": "Bu raqam ro'yxatdan o'tmagan. Avval ro'yxatdan o'ting."}, status=400)

        if phone_locked(phone):
            return Response({"detail": "Juda ko'p noto'g'ri urinish. Xavfsizlik uchun 1 soatdan so'ng qayta urinib ko'ring."}, status=429)
        if AuthCode.objects.filter(phone=phone, created_at__gte=timezone.now() - timedelta(days=1)).count() >= MAX_CODES_PER_DAY:
            return Response({"detail": "Bugun uchun kod so'rash limiti tugadi. Ertaga qayta urinib ko'ring."}, status=429)
        # qayta yuborish oralig'i faqat hali ishlatilmagan kodga qo'llanadi (ro'yxatdan o'tgach darhol kirish mumkin)
        last = AuthCode.objects.filter(phone=phone, is_used=False).order_by("-created_at").first()
        if last and (timezone.now() - last.created_at).total_seconds() < 60:
            wait = 60 - int((timezone.now() - last.created_at).total_seconds())
            return Response({"detail": f"Yangi kodni {wait} soniyadan keyin olishingiz mumkin.", "wait": wait}, status=429)

        link = TelegramLink.objects.filter(phone=phone).first()
        code = f"{secrets.randbelow(10000):04d}"

        if not link:
            # bu xato emas, oddiy qadam: foydalanuvchi avval botga raqamini ulaydi (200 — brauzer konsolida xato ko'rinmaydi)
            return Response({
                "code": "telegram_not_linked", "sent": False,
                "detail": "Raqamingiz Telegram botga ulanmagan. Botni oching, «Raqamni ulashish» tugmasini bosing va qaytib keling.",
                "bot_url": BOT_URL(),
            })

        AuthCode.objects.create(phone=phone, code=code, purpose=purpose)
        action = "ro'yxatdan o'tish" if purpose == "register" else "kirish"
        sent = send_auth_message(
            link.chat_id,
            f"🔐 <b>Avtora</b>\n\nSaytga {action} uchun kodingiz: <code>{code}</code>\n\nKod 3 daqiqa amal qiladi. Kodni hech kimga bermang.",
        )
        if not sent:
            return Response({"detail": "Kodni Telegramga yuborib bo'lmadi. Botda /start bosilganini tekshiring.", "bot_url": BOT_URL()}, status=502)
        return Response({"detail": "Kod Telegram botga yuborildi.", "bot_url": BOT_URL()})


class TelegramStatusView(APIView):
    """Frontend raqam botga ulanganini tekshirib turadi."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "tg_status"  # raqamlarni ommaviy tekshirib chiqishga yo'l qo'ymaslik uchun

    def get(self, request):
        phone = normalize_phone(request.query_params.get("phone"))
        linked = bool(phone and TelegramLink.objects.filter(phone=phone).exists())
        return Response({"linked": linked, "bot_url": BOT_URL()})


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_verify"

    @transaction.atomic
    def post(self, request):
        from evacuator.models import EvacuatorProfile
        from garage.models import Vehicle
        from masters.models import MasterProfile

        d = request.data
        phone = normalize_phone(d.get("phone"))
        role = str_in(d.get("role")) or "user"
        first_name = str_in(d.get("first_name"))
        if not phone:
            return Response({"detail": "Telefon raqam noto'g'ri."}, status=400)
        if role not in ("user", "usta", "evakuator"):
            return Response({"detail": "Rolni tanlang."}, status=400)
        if not first_name:
            return Response({"detail": "Ismingizni kiriting."}, status=400)
        if User.objects.filter(phone=phone).exists():
            return Response({"detail": "Bu raqam ro'yxatdan o'tgan."}, status=400)
        err = check_code(phone, d.get("code"), "register")
        if err:
            return Response({"detail": err}, status=400)

        link = TelegramLink.objects.filter(phone=phone).first()
        user = User.objects.create_user(
            phone=phone, first_name=first_name, last_name=str_in(d.get("last_name")), role=role,
            city=d.get("city") or "Toshkent", telegram_chat_id=link.chat_id if link else None,
        )
        if role == "usta":
            specs = d.get("specialties") or []
            if isinstance(specs, str):
                specs = [s.strip() for s in specs.split(",") if s.strip()]
            MasterProfile.objects.create(
                user=user, specialties=specs, experience_years=int(d.get("experience_years") or 0),
                address=d.get("address") or "",
            )
        elif role == "evakuator":
            EvacuatorProfile.objects.create(
                user=user, truck_model=d.get("truck_model") or "", plate=d.get("plate") or "",
            )
        car = d.get("vehicle") or {}
        if role == "user" and car.get("brand"):
            try:
                year = int(car.get("year")) if car.get("year") else None
            except (TypeError, ValueError):
                year = None
            if year and not (1950 <= year <= timezone.now().year + 1):
                year = None
            Vehicle.objects.create(owner=user, brand=str(car.get("brand"))[:40], model=str(car.get("model") or "")[:60],
                                   year=year, plate=str(car.get("plate") or "")[:15], is_primary=True)
        if link:
            send_auth_message(link.chat_id, f"✅ Tabriklaymiz, {first_name}! Siz Avtora'da ro'yxatdan o'tdingiz.")
        return Response(tokens_for(user), status=201)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_verify"

    def post(self, request):
        phone = normalize_phone(request.data.get("phone"))
        user = User.objects.filter(phone=phone).first() if phone else None
        if not user:
            return Response({"detail": "Foydalanuvchi topilmadi."}, status=400)
        if not user.is_active:
            return Response({"detail": "Hisobingiz bloklangan. Qo'llab-quvvatlash xizmatiga yozing."}, status=403)
        if user.role == "admin" or user.is_staff or user.is_superuser:
            # admin faqat /admin/login orqali (parol + Telegram kod) kiradi
            return Response({"detail": "Bu hisob uchun admin panel orqali kiring."}, status=403)
        err = check_code(phone, request.data.get("code"), "login")
        if err:
            return Response({"detail": err}, status=400)
        if not user.telegram_chat_id:
            link = TelegramLink.objects.filter(phone=phone).first()
            if link:
                user.telegram_chat_id = link.chat_id
                user.save(update_fields=["telegram_chat_id"])
        return Response(tokens_for(user))


def client_ip(request):
    return request.META.get("REMOTE_ADDR", "")


def admin_ip_allowed(request):
    """ADMIN_ALLOWED_IPS bo'sh bo'lsa — cheklov yo'q; to'ldirilgan bo'lsa admin faqat shu IP lardan kira oladi."""
    allowed = settings.ADMIN_ALLOWED_IPS
    return not allowed or client_ip(request) in allowed


class AdminLoginView(APIView):
    """Admin panelga kirish: 1) telefon + parol, 2) Telegram'ga kelgan 4 xonali kod (ikki bosqichli himoya)."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_login"
    FAIL = "Telefon yoki parol noto'g'ri."

    def post(self, request):
        import logging
        log = logging.getLogger("avtora.security")
        if not admin_ip_allowed(request):
            log.warning("Admin kirish rad etildi (IP ruxsat ro'yxatida emas): %s", client_ip(request))
            return Response({"detail": "Ruxsat yo'q."}, status=403)
        phone = normalize_phone(request.data.get("phone"))
        password = str_in(request.data.get("password"))
        key = f"admin-fail:{phone}"
        if phone and cache.get(key, 0) >= 5:
            return Response({"detail": "Ko'p marta noto'g'ri parol kiritildi. 15 daqiqadan so'ng urinib ko'ring."}, status=429)
        user = User.objects.filter(phone=phone, is_active=True).first() if phone else None
        if user is None:
            User().set_password(password)  # vaqt bo'yicha farq bo'lmasin (hisob borligini bilib bo'lmasin)
        if not user or not user.check_password(password) or not (user.is_staff or user.role == "admin"):
            if phone:
                cache.set(key, cache.get(key, 0) + 1, 15 * 60)
            log.warning("Admin kirish: noto'g'ri parol (%s, IP %s)", phone, client_ip(request))
            return Response({"detail": self.FAIL}, status=400)

        if settings.ADMIN_2FA:
            chat_id = user.telegram_chat_id or getattr(TelegramLink.objects.filter(phone=phone).first(), "chat_id", None)
            if not chat_id:
                return Response({"detail": "Xavfsizlik uchun admin raqami Telegram kod botiga ulangan bo'lishi kerak: botda /start → «Raqamni ulashish», so'ng qayta kiring.",
                                 "bot_url": BOT_URL()}, status=403)
            code = request.data.get("code")
            if not code:
                if phone_locked(phone):
                    return Response({"detail": "Juda ko'p noto'g'ri urinish. 1 soatdan so'ng qayta urinib ko'ring."}, status=429)
                last = AuthCode.objects.filter(phone=phone, purpose="admin", is_used=False).order_by("-created_at").first()
                if not last or (timezone.now() - last.created_at).total_seconds() >= 60:
                    new_code = f"{secrets.randbelow(10000):04d}"
                    AuthCode.objects.create(phone=phone, code=new_code, purpose="admin")
                    if not send_auth_message(chat_id, f"🛡 <b>Avtora admin panel</b>\n\nKirish kodi: <code>{new_code}</code>\nIP: {client_ip(request)}\n\nSiz bo'lmasangiz — parolingizni darhol almashtiring: python manage.py create_admin"):
                        return Response({"detail": "Kodni Telegramga yuborib bo'lmadi. Keyinroq urinib ko'ring."}, status=502)
                return Response({"two_factor": True, "detail": "Tasdiqlash kodi Telegram'ga yuborildi."})
            err = check_code(phone, code, "admin")
            if err:
                log.warning("Admin 2FA: noto'g'ri kod (%s, IP %s)", phone, client_ip(request))
                return Response({"detail": err}, status=400)

        cache.delete(key)
        log.warning("Admin panelga kirildi: %s (IP %s)", phone, client_ip(request))
        return Response(tokens_for(user))


class LogoutView(APIView):
    """Chiqish: refresh tokenni bekor qiladi (boshqa qurilmada ishlatib bo'lmaydi)."""
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            RefreshToken(request.data.get("refresh")).blacklist()
        except Exception:
            pass
        return Response(status=204)


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        s = UserSerializer(request.user, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)

    def delete(self, request):
        """Hisobni o'chirish: shaxsiy ma'lumotlar o'chiriladi, buyurtmalar tarixi anonim holda qoladi."""
        import uuid
        u = request.user
        if u.role == "admin":
            return Response({"detail": "Admin hisobini bu yerdan o'chirib bo'lmaydi."}, status=400)
        from accounts.models import TelegramLink
        TelegramLink.objects.filter(phone=u.phone).delete()
        try:
            from premium.models import PremiumBotChat
            PremiumBotChat.objects.filter(phone=u.phone).delete()
        except Exception:
            pass
        if hasattr(u, "shop"):
            u.shop.is_active = False
            u.shop.save(update_fields=["is_active"])
        u.vehicles.all().delete()
        u.push_subs.all().delete()
        u.phone = f"deleted-{uuid.uuid4().hex[:12]}"
        u.first_name, u.last_name, u.email = "O'chirilgan", "foydalanuvchi", ""
        u.avatar = None
        u.telegram_chat_id = None
        u.lat = u.lng = None
        u.is_online = False
        u.is_active = False
        u.set_unusable_password()
        u.save()
        revoke_user_tokens(u)
        return Response(status=204)


class LocationView(APIView):
    def post(self, request):
        try:
            lat, lng = float(request.data.get("lat")), float(request.data.get("lng"))
        except (TypeError, ValueError):
            return Response({"detail": "Koordinatalar noto'g'ri."}, status=400)
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):  # inf/nan ham shu yerda rad etiladi
            return Response({"detail": "Koordinatalar noto'g'ri."}, status=400)
        u = request.user
        u.lat, u.lng, u.location_updated = lat, lng, timezone.now()
        fields = ["lat", "lng", "location_updated"]
        if "is_online" in request.data:
            u.is_online = str(request.data.get("is_online")).lower() in ("1", "true")
            fields.append("is_online")
        u.save(update_fields=fields)
        return Response({"ok": True})


class SafeRefreshView(APIView):
    """Token yangilash: bloklangan yoki o'chirilgan foydalanuvchi yangi token ololmaydi."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.serializers import TokenRefreshSerializer
        try:
            uid = RefreshToken(request.data.get("refresh"))["user_id"]
        except (TokenError, KeyError):
            return Response({"detail": "Sessiya muddati tugadi. Qayta kiring.", "code": "token_not_valid"}, status=401)
        if not User.objects.filter(pk=uid, is_active=True).exists():
            return Response({"detail": "Hisob faol emas. Qayta kiring.", "code": "token_not_valid"}, status=401)
        s = TokenRefreshSerializer(data=request.data)
        try:
            s.is_valid(raise_exception=True)
        except TokenError:
            return Response({"detail": "Sessiya muddati tugadi. Qayta kiring.", "code": "token_not_valid"}, status=401)
        return Response(s.validated_data)
