from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
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
        if not request.user.check_password(str(request.data.get("password", ""))):
            return Response({"detail": "Parol noto'g'ri."}, status=status.HTTP_400_BAD_REQUEST)
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
