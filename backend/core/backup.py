"""Ma'lumotlar bazasining avtomatik zaxira nusxasi (SQLite). Har kuni, oxirgi 14 tasi saqlanadi."""
import sqlite3
from pathlib import Path

from django.conf import settings
from django.utils import timezone

KEEP = 14


def backup_dir():
    d = Path(settings.BASE_DIR) / "backups"
    d.mkdir(exist_ok=True)
    return d


def backup_sqlite():
    db = settings.DATABASES["default"]
    if "sqlite3" not in db["ENGINE"]:
        return None  # PostgreSQL uchun pg_dump ishlatiladi (docker-compose'da tayyor)
    target = backup_dir() / f"db-{timezone.localtime():%Y%m%d-%H%M}.sqlite3"
    src = sqlite3.connect(str(db["NAME"]))
    dst = sqlite3.connect(str(target))
    with dst:
        src.backup(dst)  # ishlab turgan bazadan xavfsiz nusxa
    src.close()
    dst.close()
    files = sorted(backup_dir().glob("db-*.sqlite3"))
    for old in files[:-KEEP]:
        old.unlink(missing_ok=True)
    return target


def last_backup_age_hours():
    files = sorted(backup_dir().glob("db-*.sqlite3"))
    if not files:
        return None
    return (timezone.now().timestamp() - files[-1].stat().st_mtime) / 3600
