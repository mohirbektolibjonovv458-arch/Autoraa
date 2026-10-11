from django.conf import settings
from django.db import models


class PremiumRequest(models.Model):
    """Premium so'rovi. Onlayn to'lov tizimi ulanmagan: administrator to'lovni o'zi tekshirib, qo'lda tasdiqlaydi."""

    STATUSES = [("pending", "Kutilmoqda"), ("approved", "Tasdiqlandi"), ("rejected", "Rad etildi"), ("cancelled", "Bekor qilindi")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="premium_requests")
    months = models.PositiveSmallIntegerField(default=1)
    amount = models.PositiveIntegerField()
    payment_reference = models.CharField(max_length=200, blank=True)
    note = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="pending")
    admin_note = models.CharField(max_length=500, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created"]
