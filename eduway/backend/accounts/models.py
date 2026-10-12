from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email=None, password=None, **extra):
        if not email and not extra.get("phone"):
            raise ValueError("Email yoki telefon raqam kiritilishi shart")
        user = self.model(email=self.normalize_email(email).lower() if email else None, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()  # telefon orqali kiradigan foydalanuvchilarda parol yo'q
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    STAGES = [
        ("school", "Maktab"),
        ("lyceum", "Litsey / kollej"),
        ("university", "Universitet"),
        ("graduate", "Bitiruvchi"),
    ]
    LEVELS = [(l, l) for l in ("A1", "A2", "B1", "B2", "C1", "C2")] + [("", "Noma'lum")]

    email = models.EmailField(unique=True, null=True, blank=True)  # administratorlar email bilan kiradi
    phone = models.CharField(max_length=16, unique=True, null=True, blank=True)  # +998XXXXXXXXX — o'quvchilar shu bilan kiradi
    telegram_chat_id = models.BigIntegerField(null=True, blank=True)
    first_name = models.CharField(max_length=60, blank=True)
    last_name = models.CharField(max_length=60, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    # Ta'lim profili
    education_stage = models.CharField(max_length=20, choices=STAGES, blank=True)
    grade = models.PositiveSmallIntegerField(null=True, blank=True)
    region = models.CharField(max_length=80, blank=True)
    interests = models.JSONField(default=list, blank=True)
    favorite_subjects = models.JSONField(default=list, blank=True)
    future_goals = models.TextField(blank=True, max_length=1000)
    target_countries = models.JSONField(default=list, blank=True)
    english_level = models.CharField(max_length=2, choices=LEVELS, blank=True)
    ielts_score = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    birth_year = models.PositiveSmallIntegerField(null=True, blank=True)
    daily_minutes = models.PositiveSmallIntegerField(default=30)
    onboarded = models.BooleanField(default=False)
    push_reminders = models.BooleanField(default=True)
    telegram_notify = models.BooleanField(default=True)  # bildirishnomalar Telegram botga ham yuborilsinmi  # kunlik eslatmalar (seriya, challenge, muddatlar)

    # Tarif
    premium_until = models.DateTimeField(null=True, blank=True)

    # Rag'batlantirish
    xp = models.PositiveIntegerField(default=0)
    streak = models.PositiveIntegerField(default=0)
    best_streak = models.PositiveIntegerField(default=0)
    last_active = models.DateField(null=True, blank=True)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email or self.phone or f"user-{self.pk}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or (self.email.split("@")[0] if self.email else self.phone or "Foydalanuvchi")

    @property
    def is_premium(self):
        return bool(self.premium_until and self.premium_until > timezone.now())

    @property
    def plan(self):
        return "premium" if self.is_premium else "free"


class TelegramLink(models.Model):
    """Botga kontakt ulashgan raqam: phone -> chat_id. Raqam egasi Telegram tomonidan tasdiqlangan."""

    phone = models.CharField(max_length=16, unique=True)
    chat_id = models.BigIntegerField()
    first_name = models.CharField(max_length=64, blank=True)
    username = models.CharField(max_length=64, blank=True)
    updated = models.DateTimeField(auto_now=True)


class LoginRequest(models.Model):
    """Telefon orqali kirish urinishi: deep-link tokeni (botni ilova bilan bog'laydi) va 4 xonali kod (xeshlangan)."""

    LIFETIME = 300  # kod 5 daqiqa amal qiladi
    token = models.CharField(max_length=32, unique=True)
    phone = models.CharField(max_length=16, db_index=True)
    mode = models.CharField(max_length=10, default="login")  # login / register
    first_name = models.CharField(max_length=60, blank=True)  # ro'yxatdan o'tishda kiritilgan ism
    code_hash = models.CharField(max_length=64, blank=True)
    code_sent_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    used = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)
