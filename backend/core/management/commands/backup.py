from django.core.management.base import BaseCommand

from core.backup import backup_sqlite


class Command(BaseCommand):
    help = "Bazaning zaxira nusxasini backend/backups/ ga saqlaydi"

    def handle(self, *args, **opts):
        p = backup_sqlite()
        self.stdout.write(self.style.SUCCESS(f"✅ Zaxira: {p}") if p else "PostgreSQL uchun pg_dump ishlating (README).")
