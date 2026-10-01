from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

from core.uploads import UploadTo, validate_image
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, phone, password=None, **extra):
        if not phone:
            raise ValueError("Telefon raqam kerak")
        user = self.model(phone=phone, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", "admin")
        return self.create_user(phone, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_USER, ROLE_USTA, ROLE_EVAK, ROLE_ADMIN = "user", "usta", "evakuator", "admin"
    ROLE_CHOICES = [
        (ROLE_USER, "Foydalanuvchi"),
        (ROLE_USTA, "Usta"),
        (ROLE_EVAK, "Evakuator"),
        (ROLE_ADMIN, "Admin"),
    ]
    phone = models.CharField(max_length=20, unique=True)
    first_name = models.CharField(max_length=60, blank=True)
    last_name = models.CharField(max_length=60, blank=True)
    email = models.EmailField(blank=True)
    role = models.CharField(max_length=12, choices=ROLE_CHOICES, default=ROLE_USER)
    avatar = models.ImageField(upload_to=UploadTo("avatars"), validators=[validate_image], blank=True, null=True)
    city = models.CharField(max_length=80, default="Toshkent")
    lang = models.CharField(max_length=2, choices=[("uz", "O'zbekcha"), ("ru", "Русский")], default="uz")  # interfeys tili
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    location_updated = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True)

    ONLINE_WINDOW_MIN = 10

    @property
    def online_now(self):
        """«Online» — usta o'zi yoqqan VA oxirgi 10 daqiqada ilovani ochgan bo'lsa."""
        return bool(self.is_online and self.last_seen and self.last_seen > timezone.now() - timezone.timedelta(minutes=self.ONLINE_WINDOW_MIN))
    telegram_chat_id = models.BigIntegerField(null=True, blank=True)
    premium_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()
    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = []

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.phone

    @property
    def is_premium(self):
        return bool(self.premium_until and self.premium_until > timezone.now())

    def __str__(self):
        return f"{self.full_name} ({self.phone})"


class TelegramLink(models.Model):
    """Telegram botga kontakt ulashgan raqamlar: phone -> chat_id"""
    phone = models.CharField(max_length=20, unique=True)
    chat_id = models.BigIntegerField()
    username = models.CharField(max_length=64, blank=True)
    first_name = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.phone} -> {self.chat_id}"


class AuthCode(models.Model):
    PURPOSES = [("register", "Ro'yxatdan o'tish"), ("login", "Kirish"), ("admin", "Admin panel (2FA)")]
    phone = models.CharField(max_length=20, db_index=True)
    code = models.CharField(max_length=4)
    purpose = models.CharField(max_length=10, choices=PURPOSES)
    attempts = models.PositiveSmallIntegerField(default=0)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    LIFETIME_SECONDS = 180

    @property
    def is_expired(self):
        return (timezone.now() - self.created_at).total_seconds() > self.LIFETIME_SECONDS
