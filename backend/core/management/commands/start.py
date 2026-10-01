"""Avtora ni bitta buyruq bilan to'liq ishga tushirish:
    python manage.py start

1) bazani yangilaydi (migrate)
2) admin bo'lmasa — yaratishni so'raydi
3) ikkala Telegram botni tekshiradi va fonda ishga tushiradi
4) sayt + API ni http://0.0.0.0:8000 da ochadi (waitress)"""
import os
import socket
import threading
import time

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection

from accounts.models import User
from accounts.utils import tg_call


def local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


class Command(BaseCommand):
    help = "Sayt, API va ikkala Telegram botni birga ishga tushiradi"

    def add_arguments(self, parser):
        parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8000")))
        parser.add_argument("--no-bots", action="store_true", help="Botlarsiz (botlar boshqa serverda ishlasa)")

    def ok(self, t):
        self.stdout.write(self.style.SUCCESS(t))

    def warn(self, t):
        self.stdout.write(self.style.WARNING(t))

    def check_bot(self, name, token):
        if not token:
            self.warn(f"⚠️  {name}: token .env faylida yo'q")
            return False
        res = tg_call(token, "getMe", timeout=10)
        if res and res.get("ok"):
            self.ok(f"✅ {name}: @{res['result']['username']}  →  https://t.me/{res['result']['username']}")
            return True
        if res and res.get("error_code") == 401:
            self.warn(f"❌ {name}: token noto'g'ri yoki bekor qilingan (@BotFather → /token)")
        else:
            self.warn(f"❌ {name}: Telegramga ulanib bo'lmadi (internetni tekshiring). Bot baribir qayta urinib turadi.")
            return True
        return False

    def run_bot(self, command):
        def loop():
            while True:
                try:
                    call_command(command)
                except Exception as exc:  # bot yiqilsa — 5 soniyadan keyin qayta
                    self.warn(f"{command} to'xtadi: {exc}. Qayta ishga tushirilmoqda...")
                finally:
                    connection.close()
                time.sleep(5)
        threading.Thread(target=loop, daemon=True, name=command).start()

    def handle(self, *args, port, no_bots, **opts):
        self.stdout.write("\n🚗  Avtora ishga tushirilmoqda...\n")
        call_command("migrate", verbosity=0, interactive=False)
        call_command("collectstatic", verbosity=0, interactive=False)
        self.ok("✅ Baza tayyor")

        if not User.objects.filter(role="admin").exists():
            self.warn("\nAdmin akkaunt hali yo'q — hozir yaratamiz (faqat bir marta so'raladi):")
            import sys
            if os.getenv("ADMIN_PHONE") and os.getenv("ADMIN_PASSWORD") or sys.stdin.isatty():
                call_command("create_admin", phone=os.getenv("ADMIN_PHONE"), password=os.getenv("ADMIN_PASSWORD"))
            else:
                missing = [k for k in ("ADMIN_PHONE", "ADMIN_PASSWORD") if not os.getenv(k)]
                self.warn(f"⚠️  Admin yaratilmadi: {', '.join(missing)} bo'sh. Railway Variables (yoki .env) ga qiymat yozing.")

        if not (settings.FRONTEND_DIR / "index.html").exists():
            self.warn("⚠️  Frontend build topilmadi: frontend papkasida  npm install && npm run build")

        if not no_bots and os.getenv("RUN_BOTS", "1") == "1":
            if self.check_bot("Kod boti (kirish/ro'yxat)", settings.AUTH_BOT_TOKEN):
                self.run_bot("run_auth_bot")
            if self.check_bot("Premium bot", settings.PREMIUM_BOT_TOKEN):
                self.run_bot("run_premium_bot")

        def fuel_refresh(first=False):
            from fuel.osm import import_osm, needs_refresh
            try:
                if needs_refresh(7):
                    a, u = import_osm()
                    self.ok(f"✅ Yoqilg'i xaritasi (butun O'zbekiston): {a} ta yangi, {u} ta yangilandi — OpenStreetMap")
            except Exception as exc:
                self.warn(f"⚠️  Shoxobchalarni yuklab bo'lmadi ({exc}). Admin panel → Yoqilg'i → «Yangilash» yoki: python manage.py import_fuel_stations --file eksport.json")
            finally:
                connection.close()

        from fuel.osm import needs_refresh as _nr
        if _nr(7):
            # yuklash quyidagi fon tsiklida bajariladi (ikki marta ishga tushmasligi uchun)
            self.stdout.write("⛽ Yoqilg'i shoxobchalari OpenStreetMap'dan yangilanadi (fonda, 1–4 daqiqa)...")

        def reminders_loop():
            from core.reminders import run_all
            from core.backup import backup_sqlite, last_backup_age_hours
            while True:
                try:
                    age = last_backup_age_hours()
                    if age is None or age >= 24:
                        backup_sqlite()
                except Exception as exc:
                    self.warn(f"Zaxira nusxa xatosi: {exc}")
                try:
                    fuel_refresh()  # haftada bir marta butun O'zbekiston bo'yicha yangilanadi
                except Exception:
                    pass
                try:
                    run_all()
                except Exception as exc:
                    self.warn(f"Eslatmalar xatosi: {exc}")
                finally:
                    connection.close()
                time.sleep(30 * 60)
        threading.Thread(target=reminders_loop, daemon=True, name="reminders").start()

        def sos_escalation_loop():
            # SOS'ni hech kim qabul qilmasa — yaqin evakuator/ustalarga qayta jiringlatish (40 s, 90 s, 3 daqiqa)
            from evacuator.views import escalate_sos
            while True:
                time.sleep(15)
                try:
                    escalate_sos()
                except Exception as exc:
                    self.warn(f"SOS takroriy ogohlantirish xatosi: {exc}")
                finally:
                    connection.close()
        threading.Thread(target=sos_escalation_loop, daemon=True, name="sos-escalation").start()
        self.ok("✅ Avtomatik eslatmalar va kunlik zaxira nusxa yoqildi (backend/backups/)")

        # Web Push: kalitlar (bo'lmasa yaratiladi) va fon yuboruvchi
        from pathlib import Path
        from core.push import start_worker
        from core.vapid import ensure_keys
        if ensure_keys(Path(settings.BASE_DIR) / ".env", settings):
            self.ok("✅ Web Push kalitlari yaratildi va .env ga yozildi")
        from core.push import key_state
        ok, why = key_state()
        if not ok:
            self.warn(f"❌ Push bildirishnomalar o'chiq: {why}. VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY qatorlarini tekshiring.")
        elif start_worker():
            self.ok("✅ Push bildirishnomalar yoqildi (ilova yopiq bo'lsa ham telefonga keladi)")

        ip = local_ip()
        self.stdout.write("")
        self.ok(f"🌐 Sayt:          http://localhost:{port}")
        if ip:
            self.ok(f"📱 Telefondan:    http://{ip}:{port}  (bir Wi-Fi tarmog'ida — ko'rish uchun)")
        self.stdout.write("   ℹ️  Ilovani o'rnatish (PWA): kompyuterda http://localhost:%s dan ishlaydi;" % port)
        self.stdout.write("      telefonda esa faqat https:// manzilda (Railway domeni yoki README → «Telefonda sinash»).")
        self.ok(f"👮 Admin panel:   http://localhost:{port}/admin/login")
        self.stdout.write("\nTo'xtatish: Ctrl + C\n")

        from waitress import serve
        from config.wsgi import application
        serve(application, host="0.0.0.0", port=port, threads=24, _quiet=True,
              trusted_proxy=os.getenv("TRUSTED_PROXY", "127.0.0.1"), trusted_proxy_headers={"x-forwarded-proto", "x-forwarded-for", "x-forwarded-host"},
              clear_untrusted_proxy_headers=True)
