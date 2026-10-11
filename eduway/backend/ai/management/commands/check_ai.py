from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ai import service


class Command(BaseCommand):
    help = "AI ulanishini haqiqiy so'rov bilan tekshiradi (ANTHROPIC_API_KEY kerak)."

    def handle(self, *args, **opts):
        if not service.is_configured():
            raise CommandError("ANTHROPIC_API_KEY sozlanmagan. backend/.env fayliga kalitni yozing va qayta ishga tushiring.")
        self.stdout.write(f"Model: {settings.AI_MODEL} — so'rov yuborilmoqda...")
        try:
            text, usage = service.ask("Reply with exactly: OK", [{"role": "user", "content": "Ping"}], max_tokens=1000, effort="low")
        except service.AIError as e:
            raise CommandError(f"Xato [{e.code}]: {e.message}")
        self.stdout.write(self.style.SUCCESS(f"AI ishlayapti. Javob: {text!r}; tokenlar: {usage}"))
