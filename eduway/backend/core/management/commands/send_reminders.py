from django.core.management.base import BaseCommand

from core.views import deadline_reminders


class Command(BaseCommand):
    help = "Saqlangan grantlar muddati (30/7/1 kun) haqida bildirishnoma yaratadi. Kuniga bir marta cron orqali ishga tushiring."

    def handle(self, *args, **opts):
        self.stdout.write(f"Yaratildi: {deadline_reminders()}")
