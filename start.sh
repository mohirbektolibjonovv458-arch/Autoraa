#!/usr/bin/env bash
# Avtora — Linux / macOS / server uchun ishga tushirish
set -e
cd "$(dirname "$0")/backend"
if [ ! -d venv ]; then
  echo "Birinchi ishga tushirish: kerakli kutubxonalar o'rnatilmoqda..."
  python3 -m venv venv
fi
source venv/bin/activate
pip install -q --upgrade pip >/dev/null
pip install -q -r requirements.txt
exec python manage.py start "$@"
