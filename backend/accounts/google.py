"""Google bilan kirish / ro'yxatdan o'tish (Google Identity Services).

Oqim: brauzer Google'dan ID token (JWT) oladi → /api/auth/google/ → server tokenni Google'ning ochiq
kalitlari bilan tekshiradi (imzo, aud = bizning Client ID, iss, muddati, email tasdiqlangan).
- Google hisobi Avtora hisobiga ulangan bo'lsa → darhol kiradi (Telegram kod shart emas).
- Ulanmagan bo'lsa → qisqa muddatli imzolangan «ticket» qaytariladi: ro'yxatdan o'tishda ism/email
  avtomatik to'ldiriladi, telefon bir marta tasdiqlanadi va Google hisob shu akkauntga ulanadi.
Client secret kerak emas; GOOGLE_CLIENT_ID faqat .env / Railway Variables'da.
"""
import logging

import jwt
from django.conf import settings
from django.core import signing

log = logging.getLogger("avtora")

CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ISSUERS = ["accounts.google.com", "https://accounts.google.com"]
TICKET_SALT = "google-ticket"
TICKET_MAX_AGE = 30 * 60  # 30 daqiqa ichida ro'yxatdan o'tishni tugatish kerak

_jwks = [None]


class GoogleAuthError(Exception):
    pass


def enabled():
    return bool(settings.GOOGLE_CLIENT_IDS)


def _signing_key(token):
    if _jwks[0] is None:
        _jwks[0] = jwt.PyJWKClient(CERTS_URL, cache_keys=True, lifespan=3600, timeout=10)
    return _jwks[0].get_signing_key_from_jwt(token).key


def verify_id_token(token):
    """Google ID tokenini tekshiradi. Qaytaradi: {sub, email, first_name, last_name}."""
    if not enabled():
        raise GoogleAuthError("Google orqali kirish hali sozlanmagan.")
    if not isinstance(token, str) or len(token) > 4096 or token.count(".") != 2:
        raise GoogleAuthError("Google javobi noto'g'ri.")
    try:
        claims = jwt.decode(token, _signing_key(token), algorithms=["RS256"], audience=settings.GOOGLE_CLIENT_IDS,
                            issuer=ISSUERS, leeway=30, options={"require": ["exp", "iat", "sub", "aud", "iss"]})
    except jwt.PyJWKClientError as exc:
        log.warning("Google kalitlarini olib bo'lmadi: %s", exc)
        raise GoogleAuthError("Google bilan bog'lanib bo'lmadi. Birozdan keyin qayta urinib ko'ring.")
    except jwt.InvalidTokenError as exc:
        log.warning("Google token rad etildi: %s", exc.__class__.__name__)
        raise GoogleAuthError("Google hisobini tasdiqlab bo'lmadi. Qayta urinib ko'ring.")
    if not claims.get("email") or not claims.get("email_verified"):
        raise GoogleAuthError("Google hisobingizdagi email tasdiqlanmagan.")
    return {"sub": str(claims["sub"])[:64], "email": str(claims["email"])[:254],
            "first_name": str(claims.get("given_name") or "")[:60], "last_name": str(claims.get("family_name") or "")[:60]}


def make_ticket(info):
    return signing.dumps(info, salt=TICKET_SALT, compress=True)


def read_ticket(ticket):
    if not ticket or not isinstance(ticket, str):
        return None
    try:
        return signing.loads(ticket, salt=TICKET_SALT, max_age=TICKET_MAX_AGE)
    except signing.BadSignature:
        return None


def attach_google(user, ticket):
    """Telefon tasdiqlangandan keyin (ro'yxat yoki kirish) — Google hisobni shu akkauntga ulaydi.
    Boshqa akkauntga ulangan Google hisob ko'chirilmaydi. Qaytaradi: ulandimi."""
    from .models import User
    info = read_ticket(ticket)
    if not info or user.google_sub == info["sub"]:
        return bool(info)
    if User.objects.filter(google_sub=info["sub"]).exclude(pk=user.pk).exists():
        return False
    user.google_sub = info["sub"]
    fields = ["google_sub"]
    if not user.email:
        user.email = info["email"]
        fields.append("email")
    user.save(update_fields=fields)
    return True
