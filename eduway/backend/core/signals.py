from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification


@receiver(post_save, sender=Notification)
def send_push(sender, instance, created, **kwargs):
    if created:
        from .push import notify_push

        transaction.on_commit(lambda: notify_push(instance))
