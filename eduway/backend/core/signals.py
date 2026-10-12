from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification


@receiver(post_save, sender=Notification)
def send_push(sender, instance, created, **kwargs):
    if created:
        from .push import notify_push

        transaction.on_commit(lambda: notify_push(instance))
        transaction.on_commit(lambda: notify_telegram(instance))


def notify_telegram(n):
    """Bildirishnomani foydalanuvchining Telegram chatiga ham yuboradi (fon oqimida, so'rovni sekinlashtirmaydi)."""
    import threading

    from accounts import telegram

    u = n.user
    if not (u.telegram_chat_id and u.telegram_notify and telegram.configured()):
        return
    url = telegram.public_url()
    link = f'\n\n<a href="{url}{n.link}">Ilovada ochish →</a>' if url and n.link and n.link.startswith("/") else ""
    msg = f"<b>{telegram.esc(n.title)}</b>\n{telegram.esc(n.body)}{link}"
    threading.Thread(target=telegram.send, args=(u.telegram_chat_id, msg), daemon=True).start()
