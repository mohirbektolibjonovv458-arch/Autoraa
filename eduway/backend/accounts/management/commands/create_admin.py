import getpass
import os

from django.core.management.base import BaseCommand, CommandError

from accounts.models import User


class Command(BaseCommand):
    help = "Administrator (superuser) yaratadi yoki mavjud foydalanuvchini admin qiladi. ADMIN_EMAIL / ADMIN_PASSWORD muhit o'zgaruvchilari ham qabul qilinadi."

    def add_arguments(self, parser):
        parser.add_argument("--email")

    def handle(self, *args, **opts):
        email = (opts.get("email") or os.getenv("ADMIN_EMAIL") or input("Admin email: ")).strip().lower()
        if not email or "@" not in email:
            raise CommandError("Email noto'g'ri.")
        password = os.getenv("ADMIN_PASSWORD") or getpass.getpass("Parol (kamida 10 belgi): ")
        if len(password) < 10:
            raise CommandError("Parol kamida 10 belgidan iborat bo'lsin.")
        user, created = User.objects.get_or_create(email=email, defaults={"first_name": "Admin"})
        user.is_staff = user.is_superuser = True
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(("Yaratildi" if created else "Yangilandi") + f": {email} (administrator)"))
