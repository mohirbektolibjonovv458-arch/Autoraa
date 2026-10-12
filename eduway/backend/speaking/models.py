"""Speaking partner: ro'yxatdan o'tgan foydalanuvchilar bir-biri bilan ingliz tilida ovozli suhbat qiladi.
Ovoz WebRTC orqali to'g'ridan-to'g'ri foydalanuvchilar o'rtasida o'tadi — server faqat juftlashtiradi va ulanish signallarini uzatadi.
Ovoz yozib olinmaydi."""
import uuid

from django.conf import settings
from django.db import models

LEVELS = ["A2", "B1", "B2", "C1"]


class SpeakSession(models.Model):
    STATUS = [("waiting", "Kutmoqda"), ("matched", "Juftlashdi"), ("ended", "Tugadi"), ("cancelled", "Bekor qilindi")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    a = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="speak_as_a")
    b = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="speak_as_b", null=True, blank=True)
    level = models.CharField(max_length=2, default="B1")
    adult = models.BooleanField(default=True)  # yosh guruhi: 18+ yoki 16–17
    topic = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default="waiting", db_index=True)
    a_seen = models.DateTimeField(null=True, blank=True)
    b_seen = models.DateTimeField(null=True, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    matched_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    xp_given = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created"]

    def partner_of(self, user):
        return self.b if user.pk == self.a_id else self.a

    def has(self, user):
        return user.pk in (self.a_id, self.b_id)


class SpeakSignal(models.Model):
    """WebRTC signallari (offer/answer/ICE). Suhbat tugagach ahamiyatsiz bo'ladi va tozalanadi."""

    session = models.ForeignKey(SpeakSession, on_delete=models.CASCADE, related_name="signals")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=10)
    payload = models.JSONField(default=dict)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]


class SpeakRating(models.Model):
    session = models.ForeignKey(SpeakSession, on_delete=models.CASCADE, related_name="ratings")
    rater = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    rated = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="speak_ratings")
    stars = models.PositiveSmallIntegerField()
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("session", "rater")


class SpeakReport(models.Model):
    REASONS = [("inappropriate", "Odobsiz gap yoki xatti-harakat"), ("harassment", "Haqorat yoki bezovta qilish"),
               ("personal", "Shaxsiy ma'lumot / kontakt so'radi"), ("age", "Yoshi mos emas ko'rinadi"),
               ("spam", "Reklama yoki spam"), ("other", "Boshqa")]

    session = models.ForeignKey(SpeakSession, on_delete=models.SET_NULL, null=True, blank=True)
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="speak_reports_sent")
    reported = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="speak_reports")
    reason = models.CharField(max_length=20, choices=REASONS)
    note = models.CharField(max_length=500, blank=True)
    reviewed = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created"]


class SpeakBlock(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="speak_blocks")
    blocked = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "blocked")


class SpeakProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="speak_profile")
    rules_accepted_at = models.DateTimeField(null=True, blank=True)
    suspended = models.BooleanField(default=False)
    suspended_reason = models.CharField(max_length=200, blank=True)
