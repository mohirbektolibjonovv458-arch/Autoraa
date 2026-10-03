import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "")
if len(SECRET_KEY) < 40 or "bu-yerga" in SECRET_KEY:
    # Kuchsiz yoki bo'sh kalit bilan ishlamaymiz: .env ga avtomatik yangi tasodifiy kalit yoziladi
    import secrets as _secrets
    SECRET_KEY = _secrets.token_urlsafe(50)
    _env = BASE_DIR / ".env"
    try:
        _txt = _env.read_text(encoding="utf-8") if _env.exists() else ""
        _lines = [l for l in _txt.splitlines() if not l.startswith("SECRET_KEY=")]
        _env.write_text("SECRET_KEY=" + SECRET_KEY + "\n" + "\n".join(_lines) + "\n", encoding="utf-8")
    except OSError:
        pass
DEBUG = os.getenv("DEBUG", "0") == "1"
# Domen ko'rsatilsa (masalan avtora.uz), xavfsizlik sozlamalari avtomatik moslanadi
DOMAIN = (os.getenv("DOMAIN") or os.getenv("RAILWAY_PUBLIC_DOMAIN") or "").strip().lower().replace("https://", "").replace("http://", "").strip("/")
if DOMAIN:
    # healthcheck.railway.app — Railway deploy vaqtida /api/health/ ni shu nom bilan tekshiradi
    ALLOWED_HOSTS = [DOMAIN, f"www.{DOMAIN}", "localhost", "127.0.0.1", "healthcheck.railway.app"]
    if os.getenv("RAILWAY_PUBLIC_DOMAIN"):
        ALLOWED_HOSTS.append(os.getenv("RAILWAY_PUBLIC_DOMAIN"))
    if os.getenv("RAILWAY_PRIVATE_DOMAIN"):
        ALLOWED_HOSTS.append(os.getenv("RAILWAY_PRIVATE_DOMAIN"))
    ALLOWED_HOSTS += [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip() and h.strip() != "*"]
else:
    ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "*").split(",")]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "accounts",
    "garage",
    "masters",
    "evacuator",
    "market",
    "premium",
    "chat",
    "core",
    "fuel",
    "trips",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "core.security_middleware.SecurityHeadersMiddleware",  # WhiteNoise'dan oldin: statik fayllarga ham sarlavha qo'yiladi
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
LOGGING = {
    "version": 1, "disable_existing_loggers": False,
    "formatters": {"std": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"}},
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "std"},
        "file": {"class": "logging.handlers.RotatingFileHandler", "filename": str(BASE_DIR / "logs" / "avtora.log"),
                 "maxBytes": 5 * 1024 * 1024, "backupCount": 5, "encoding": "utf-8", "formatter": "std"},
    },
    "root": {"handlers": ["console", "file"], "level": "WARNING"},
    "loggers": {"avtora": {"handlers": ["console", "file"], "level": "INFO", "propagate": False},
                "avtora.security": {"handlers": ["console", "file"], "level": "INFO", "propagate": False}},
}

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"

def _database_url():
    """Railway / Heroku uslubidagi DATABASE_URL (postgresql://user:pass@host:port/db) ni o'qiydi."""
    from urllib.parse import unquote, urlparse
    u = urlparse(os.getenv("DATABASE_URL", ""))
    if u.scheme not in ("postgres", "postgresql"):
        return None
    return {"ENGINE": "django.db.backends.postgresql", "NAME": u.path.lstrip("/"), "USER": unquote(u.username or ""),
            "PASSWORD": unquote(u.password or ""), "HOST": u.hostname, "PORT": str(u.port or 5432), "CONN_MAX_AGE": 60,
            "CONN_HEALTH_CHECKS": True}


if _database_url():
    DATABASES = {"default": _database_url()}
elif os.getenv("POSTGRES_DB"):
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB"),
        "USER": os.getenv("POSTGRES_USER", "postgres"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }}
else:
    # Fon jarayonlari (push, SOS takroriy ogohlantirish, eslatmalar) va so'rovlar bir vaqtda yozadi:
    # IMMEDIATE — tranzaksiya boshidayoq yozish qulfini kutadi («database is locked» xatosi o'rniga navbat),
    # WAL — o'qish yozishni to'smaydi.
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": os.getenv("SQLITE_PATH") or BASE_DIR / "db.sqlite3",
                             "OPTIONS": {"timeout": 20, "transaction_mode": "IMMEDIATE",
                                         "init_command": "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;"}}}

AUTH_USER_MODEL = "accounts.User"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# React build (frontend/ -> npm run build) shu papkaga tushadi va Django o'zi beradi
FRONTEND_DIR = BASE_DIR / "frontend_build"
WHITENOISE_ROOT = FRONTEND_DIR if FRONTEND_DIR.exists() else None
from core.static_headers import add_headers as WHITENOISE_ADD_HEADERS_FUNCTION  # noqa: E402
DATA_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()] + ([f"https://{DOMAIN}", f"https://www.{DOMAIN}"] if DOMAIN else [])
MEDIA_URL = "/media/"
# Railway'da yuklangan rasmlar yo'qolmasligi uchun Volume ulanadi va MEDIA_ROOT=/data/media qilinadi
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT") or (BASE_DIR / "media"))
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("accounts.authentication.JWTAuthWithLastSeen",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "EXCEPTION_HANDLER": "core.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": ("rest_framework.throttling.AnonRateThrottle", "rest_framework.throttling.UserRateThrottle", "core.throttles.WriteThrottle"),
    "DEFAULT_THROTTLE_RATES": {
        # O'zbekistonda mobil operatorlar ko'p foydalanuvchini bitta IP orqali chiqaradi (CGNAT),
        # shuning uchun IP bo'yicha limitlar keng; asosiy himoya — telefon raqami bo'yicha limitlar (accounts/views.py)
        "anon": "1500/min", "user": "600/min",
        "auth_code": "40/min",      # kod so'rash (IP bo'yicha); raqam bo'yicha: 60 soniyada 1 ta, kuniga 10 ta
        "auth_verify": "60/min",    # kodni tekshirish (IP bo'yicha); raqam bo'yicha: soatiga 10 ta xato
        "admin_login": "10/min",
        "tg_status": "120/min",
        "routing": "30/min",        # marshrut so'rovlari
        "geocode": "30/min",        # joy qidirish
        "trip_progress": "40/min",  # SAFAR joylashuv yangilanishi
        "tiles": "3000/min",        # provayderdan yangi plita olish (IP bo'yicha; keshdagilar cheklanmaydi)
        "writes": "60/min",         # barcha yozish so'rovlari (foydalanuvchi bo'yicha)
        "push_resub": "20/min",     # service worker'dan push token yangilash (login'siz, IP bo'yicha)
    },
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=60),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "avtora"}}

# --- Xavfsizlik ---
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
# «Google bilan kirish» oynasi (popup) natijani sahifaga qaytara olishi uchun
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin-allow-popups"
if os.getenv("HTTPS", "0") == "1":  # sayt HTTPS (domen + sertifikat) orqali ishlaganda
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
    SECURE_SSL_REDIRECT = True  # http -> https
    SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]  # platforma health-check'i ichki http orqali keladi
    # Subdomenlar va HSTS preload — domen egasi ongli ravishda yoqadi (boshqa subdomenlarga ta'sir qiladi)
    SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W021"]
DJANGO_ADMIN_ENABLED = os.getenv("DJANGO_ADMIN", "0") == "1"
# Admin panel: Telegram orqali ikki bosqichli tasdiqlash (o'chirish tavsiya etilmaydi)
ADMIN_2FA = os.getenv("ADMIN_2FA", "1") == "1"
# Admin faqat shu IP lardan kira olsin (vergul bilan). Bo'sh — cheklovsiz
ADMIN_ALLOWED_IPS = [x.strip() for x in os.getenv("ADMIN_ALLOWED_IPS", "").split(",") if x.strip()]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",   # eng kuchli (argon2-cffi)
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",   # eski parollar ham ishlayveradi va kirishda Argon2 ga o'tadi
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]

# --- Loglar (backend/logs/avtora.log, 5 MB x 5 fayl) ---
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

# CORS: API ni faqat o'z saytimiz (va dev rejimda Vite) chaqira oladi. Frontend Django bilan bir domenda bo'lgani uchun
# productionda CORS kerak ham emas — begona saytlar brauzer orqali API ga so'rov yubora olmaydi.
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()] + \
    ([f"https://{DOMAIN}", f"https://www.{DOMAIN}"] if DOMAIN else [])
CORS_ALLOW_CREDENTIALS = False

# Content-Security-Policy: sahifaga begona skript kiritilsa ham ishlamaydi (XSS himoyasi)
# Google bilan kirish (Google Identity Services): skript, tugma (iframe) va oyna faqat accounts.google.com dan
CSP_HEADER = "; ".join([
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com/gsi/client",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",  # xarita plitalari ham o'z serverimiz orqali (/api/map/tiles/)
    "connect-src 'self' https://accounts.google.com/gsi/",
    "frame-src https://accounts.google.com/gsi/",
    "media-src 'self' blob:",  # ovozli xabarlarni ijro etish (yozib olingan audio — blob:)
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
])
# microphone=(self) — chatda ovozli xabar yozish uchun (faqat o'z saytimizda)
PERMISSIONS_POLICY = ("geolocation=(self), camera=(), microphone=(self), payment=(), usb=(), interest-cohort=(), "
                      'identity-credentials-get=(self "https://accounts.google.com")')  # Google bilan kirish (FedCM)

# --- Google bilan kirish: Google Cloud Console → Credentials → OAuth client ID (Web application).
# Bir nechta bo'lsa vergul bilan. Client secret KERAK EMAS. Bo'sh bo'lsa — tugma ko'rinmaydi.
GOOGLE_CLIENT_IDS = [x.strip() for x in os.getenv("GOOGLE_CLIENT_ID", "").split(",") if x.strip()]

# Saytning ochiq manzili (Telegram xabarlaridagi havolalar uchun), masalan https://avtora.uz
SITE_URL = os.getenv("SITE_URL", "") or (f"https://{DOMAIN}" if DOMAIN else "")

# --- Xarita plitalari (core/tiles.py) — kalit faqat serverda ---
MAP_TILE_URL = os.getenv("MAP_TILE_URL") or "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
MAP_TILE_KEY = os.getenv("MAP_TILE_KEY", "")
MAP_ATTRIBUTION = os.getenv("MAP_ATTRIBUTION") or "© OpenStreetMap contributors"
TILE_CACHE_DIR = os.getenv("TILE_CACHE_DIR") or str(BASE_DIR / "tilecache")
# Sun'iy yo'ldosh qatlami (uylar, ko'chalar, dalalar ko'rinadi). Sukut: Esri World Imagery + ko'cha nomlari.
# Tijoriy foydalanishda provayder shartlariga ko'ra kalit oling (masalan MapTiler satellite yoki Esri Location Platform)
SAT_TILE_URL = os.getenv("SAT_TILE_URL") or "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
SAT_LABELS_URL = os.getenv("SAT_LABELS_URL") or "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
SAT_TILE_KEY = os.getenv("SAT_TILE_KEY", "")
SAT_ATTRIBUTION = os.getenv("SAT_ATTRIBUTION") or "Tiles © Esri — Maxar, Earthstar Geographics"
SAT_ENABLED = os.getenv("SAT_ENABLED", "1") == "1"

# --- Web Push (VAPID). Kalitlar birinchi ishga tushishda avtomatik yaratiladi va .env ga yoziladi ---
# nusxalashda qo'shilib qolgan bo'shliq va qo'shtirnoqlar olib tashlanadi
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "").strip().strip("'\"").strip()
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "").strip().strip("'\"").strip()
# Push xizmatlari (Google, Apple, Mozilla) muammo bo'lsa shu manzilga murojaat qiladi. VAPID_EMAIL=siz@domen.uz ham yetadi.
VAPID_SUBJECT = (os.getenv("VAPID_SUBJECT") or (f"mailto:{os.getenv('VAPID_EMAIL').strip()}" if os.getenv("VAPID_EMAIL") else "")
                 or f"mailto:admin@{DOMAIN or 'avtora.uz'}")

# --- Marshrut (core/routing.py) ---
ROUTING_URL = os.getenv("ROUTING_URL") or "https://router.project-osrm.org/route/v1/{profile}/{coords}?overview=full&geometries=geojson&steps=true"
ROUTING_KEY = os.getenv("ROUTING_KEY", "")
import mimetypes as _mt
_mt.add_type("application/vnd.android.package-archive", ".apk")  # Android ilova fayli to'g'ri turda beriladi
WHITENOISE_MIMETYPES = {".apk": "application/vnd.android.package-archive", ".webmanifest": "application/manifest+json"}
APK_URL = os.getenv("APK_URL", "")  # Android ilova (TWA) fayli manzili; bo'sh — frontend/public/avtora.apk bo'lsa o'sha
GEOCODE_URL = os.getenv("GEOCODE_URL") or "https://nominatim.openstreetmap.org/search"
ROUTING_ATTRIBUTION = os.getenv("ROUTING_ATTRIBUTION") or "OSRM · © OpenStreetMap contributors"

# --- Telegram ---
# O'z Bot API serveringiz bo'lsa (telegram-bot-api) — shu yerda manzilini bering
TELEGRAM_API_BASE = os.getenv("TELEGRAM_API_BASE", "https://api.telegram.org").rstrip("/")
AUTH_BOT_TOKEN = os.getenv("AUTH_BOT_TOKEN", "")
AUTH_BOT_USERNAME = os.getenv("AUTH_BOT_USERNAME", "avtora_code_bot")
PREMIUM_BOT_TOKEN = os.getenv("PREMIUM_BOT_TOKEN", "")
PREMIUM_BOT_USERNAME = os.getenv("PREMIUM_BOT_USERNAME", "avtora_premium_bot")
PREMIUM_ADMIN_CHAT_IDS = [int(x) for x in os.getenv("PREMIUM_ADMIN_CHAT_IDS", "").replace(" ", "").split(",") if x.strip().lstrip("-").isdigit()]
PREMIUM_CARD_NUMBER = os.getenv("PREMIUM_CARD_NUMBER", "4073420079545178")
PREMIUM_CARD_HOLDER = os.getenv("PREMIUM_CARD_HOLDER", "Avtora")
PREMIUM_PRICE = int(os.getenv("PREMIUM_PRICE", "40000"))

