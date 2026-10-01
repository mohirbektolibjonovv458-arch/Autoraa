from django.conf import settings
from django.db import models

from core.uploads import UploadTo, validate_image


class Notification(models.Model):
    KINDS = [("order", "Buyurtma"), ("sos", "SOS"), ("chat", "Xabar"), ("premium", "Premium"), ("system", "Tizim"), ("review", "Reyting")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=10, choices=KINDS, default="system")
    title = models.CharField(max_length=150)
    body = models.TextField(max_length=1000, blank=True)
    link = models.CharField(max_length=200, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    # Push (Web Push) yetkazish holati — fon worker yuboradi (outbox), server qayta ishga tushsa ham yo'qolmaydi
    PUSH = [("pending", "Navbatda"), ("sent", "Yuborildi"), ("none", "Qurilma yo'q"), ("failed", "Xato"), ("off", "Yuborilmaydi")]
    push_state = models.CharField(max_length=8, choices=PUSH, default="off", db_index=True)
    push_body = models.CharField(max_length=200, blank=True)  # qulf ekranida ko'rinadigan (maxfiy bo'lmagan) matn
    dedup_key = models.CharField(max_length=80, blank=True, db_index=True)
    urgent = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]


class PushSubscription(models.Model):
    """Foydalanuvchi qurilmasi (brauzer/PWA) Web Push obunasi. Bir foydalanuvchida bir nechta qurilma bo'lishi mumkin.
    Endpoint va kalitlar hech qaysi API orqali qaytarilmaydi."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subs")
    endpoint = models.URLField(max_length=700, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    user_agent = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)
    failures = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    last_success = models.DateTimeField(null=True, blank=True)


class SiteSettings(models.Model):
    site_name = models.CharField(max_length=60, default="Avtora")
    tagline = models.CharField(max_length=160, default="Avtomobilingiz uchun barcha xizmatlar — bir joyda")
    currency = models.CharField(max_length=10, default="so'm")
    support_phone = models.CharField(max_length=20, blank=True, default="")
    premium_price = models.PositiveIntegerField(default=40000)
    card_number = models.CharField(max_length=19, default="4073420079545178")
    card_holder = models.CharField(max_length=60, default="Avtora")
    sos_radius_km = models.PositiveIntegerField(default=30)
    maintenance = models.BooleanField(default=False)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        if created:
            obj.premium_price = settings.PREMIUM_PRICE
            obj.card_number = settings.PREMIUM_CARD_NUMBER
            obj.card_holder = settings.PREMIUM_CARD_HOLDER
            obj.save()
        return obj


class BlogPost(models.Model):
    CATS = [("maslahat", "Maslahat"), ("yangilik", "Yangiliklar"), ("texnik", "Texnik xizmat"), ("qonun", "Qonunlar")]
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=12, choices=CATS, default="maslahat")
    excerpt = models.CharField(max_length=300, blank=True)
    body = models.TextField(max_length=50000)
    image = models.ImageField(upload_to=UploadTo("blog"), validators=[validate_image], blank=True, null=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


def notify(user, title, body="", kind="system", link="", telegram=False, push=True, push_body=None, dedup=None, urgent=False):
    """Bitta joydan: ilova ichidagi bildirishnoma + telefon/brauzerga Web Push (+ ixtiyoriy Telegram).
    dedup — bir xil hodisa qisqa vaqtda qayta kelsa, takroriy bildirishnoma yaratilmaydi."""
    from datetime import timedelta
    from django.utils import timezone
    if dedup and Notification.objects.filter(user=user, dedup_key=dedup[:80], created_at__gte=timezone.now() - timedelta(minutes=10)).exists():
        return None
    has_device = push and user.push_subs.filter(is_active=True).exists()
    n = Notification.objects.create(user=user, title=title[:150], body=body[:1000], kind=kind, link=link[:200],
                                    dedup_key=(dedup or "")[:80], urgent=urgent,
                                    push_body=(body if push_body is None else push_body)[:200],
                                    push_state="pending" if has_device else ("none" if push else "off"))
    if has_device:
        from core.push import wake_worker
        wake_worker()
    if telegram and user.telegram_chat_id:
        import threading

        from django.conf import settings
        from accounts.utils import notify_user_telegram
        from html import escape
        text = f"🔔 <b>{escape(title)}</b>\n{escape(body)}"
        if settings.SITE_URL and link:
            text += f"\n\n👉 {settings.SITE_URL.rstrip('/')}{link.split('#')[0]}"
        # Telegram sekin javob bersa ham sayt kutib qolmasligi uchun fonda yuboriladi
        threading.Thread(target=notify_user_telegram, args=(user, text), daemon=True).start()
    return n
