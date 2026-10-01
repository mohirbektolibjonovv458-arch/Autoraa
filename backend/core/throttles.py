from rest_framework.permissions import SAFE_METHODS
from rest_framework.throttling import SimpleRateThrottle


class WriteThrottle(SimpleRateThrottle):
    """Spamdan himoya: bitta foydalanuvchi (yoki IP) uchun daqiqasiga cheklangan miqdorda yozish so'rovlari."""
    scope = "writes"

    def get_cache_key(self, request, view):
        if request.method in SAFE_METHODS:
            return None
        ident = request.user.pk if request.user and request.user.is_authenticated else self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
