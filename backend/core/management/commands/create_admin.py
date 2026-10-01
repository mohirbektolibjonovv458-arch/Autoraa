"""Admin akkaunt yaratish yoki parolini almashtirish.
python manage.py create_admin                   — so'raydi
python manage.py create_admin +998901234567 Parol123"""
import getpass

from django.core.management.base import BaseCommand

from accounts.models import User
from accounts.utils import normalize_phone


class Command(BaseCommand):
    help = "Admin akkaunt yaratish / parolni yangilash"

    def add_arguments(self, parser):
        parser.add_argument("phone", nargs="?")
        parser.add_argument("password", nargs="?")

    def handle(self, *args, phone=None, password=None, **opts):
        while not normalize_phone(phone or ""):
            phone = input("Admin telefon raqami (+998...): ").strip()
        phone = normalize_phone(phone)
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError
        interactive = password is None
        while True:
            if not password:
                password = getpass.getpass("Admin paroli (kamida 10 belgi, harf+raqam; yozganda ko'rinmaydi): ").strip()
            try:
                validate_password(password, User(phone=phone, first_name="Admin"))
                break
            except ValidationError as e:
                uz = {"password_too_short": "kamida 10 belgi bo'lsin", "password_too_common": "juda oddiy parol",
                      "password_entirely_numeric": "faqat raqamdan iborat bo'lmasin", "password_too_similar": "telefon/ismga o'xshamasin"}
                msg = "Parol kuchsiz: " + "; ".join(uz.get(x.code, x.messages[0]) for x in e.error_list)
                if not interactive:
                    raise SystemExit(self.style.ERROR(msg + " (.env dagi ADMIN_PASSWORD ni o'zgartiring)"))
                self.stdout.write(self.style.WARNING(msg))
                password = None
        user = User.objects.filter(phone=phone).first()
        if user:
            user.role, user.is_staff, user.is_superuser, user.is_active = "admin", True, True, True
            user.set_password(password)
            user.save()
        else:
            user = User.objects.create_superuser(phone, password, first_name="Admin")
        self.stdout.write(self.style.SUCCESS(f"✅ Admin tayyor: {phone}"))
