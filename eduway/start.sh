#!/usr/bin/env sh
# EduWay AI — lokal ishga tushirish (Linux / macOS). Talab: Python 3.11+, Node.js 20+
set -e
cd "$(dirname "$0")"
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q -r backend/requirements.txt
[ -f backend/.env ] || cp backend/.env.example backend/.env
(cd frontend && npm install --no-audit --no-fund && npm run build)
cd backend
python manage.py migrate --noinput
python manage.py seed_content
echo "Admin yaratish (bir marta): python manage.py create_admin"
echo "Sayt: http://127.0.0.1:8000"
exec waitress-serve --listen=127.0.0.1:8000 config.wsgi:application
