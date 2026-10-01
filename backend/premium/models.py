from django.conf import settings
from django.db import models

from core.uploads import UploadTo, validate_image


class PremiumPayment(models.Model):
    """Karta orqali o'tkazma. Admin pul tushganini tekshirib, Telegram botda tasdiqlaydi."""
    STATUSES = [("pending", "Tekshirilmoqda"), ("approved", "Tasdiqlandi"), ("rejected", "Rad etildi")]
    SOURCES = [("web", "Sayt"), ("telegram", "Telegram bot")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="premium_payments")
    months = models.PositiveSmallIntegerField(default=1)
    amount = models.PositiveIntegerField()
    card_number = models.CharField(max_length=19, help_text="Pul o'tkazilgan karta")
    payer_card_last4 = models.CharField(max_length=4, blank=True)
    receipt = models.ImageField(upload_to=UploadTo("receipts"), validators=[validate_image], blank=True, null=True)
    note = models.CharField(max_length=200, blank=True)
    source = models.CharField(max_length=10, choices=SOURCES, default="web")
    status = models.CharField(max_length=10, choices=STATUSES, default="pending")
    reviewed_by = models.CharField(max_length=100, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reject_reason = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class PremiumBotChat(models.Model):
    """Premium botga kontakt ulashgan foydalanuvchilar."""
    phone = models.CharField(max_length=20, unique=True)
    chat_id = models.BigIntegerField()
    is_admin = models.BooleanField(default=False, help_text="To'lovlarni tasdiqlaydigan admin")
    created_at = models.DateTimeField(auto_now=True)
