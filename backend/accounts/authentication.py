from datetime import timedelta

from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication


class JWTAuthWithLastSeen(JWTAuthentication):
    """JWT + foydalanuvchining oxirgi faolligini (last_seen) daqiqada ko'pi bilan bir marta yangilaydi."""

    def authenticate(self, request):
        res = super().authenticate(request)
        if res:
            user = res[0]
            now = timezone.now()
            if not user.last_seen or now - user.last_seen > timedelta(seconds=60):
                type(user).objects.filter(pk=user.pk).update(last_seen=now)
                user.last_seen = now
        return res
