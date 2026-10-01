#!/usr/bin/env bash
# Push zanjiri sinovi: haqiqiy server + soxta push provayder + haqiqiy Chromium service worker. README.md ga qarang.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
export CHAIN_DIR="${CHAIN_DIR:-/tmp/avtora-push-chain}"
P="${PYTHON:-python}"
rm -rf "$CHAIN_DIR" && mkdir -p "$CHAIN_DIR" && cp -r "$HERE/../../backend" "$CHAIN_DIR/backend"
cd "$CHAIN_DIR/backend" && rm -f db.sqlite3 .env
export TELEGRAM_API_BASE=http://127.0.0.1:9 AUTH_BOT_TOKEN= PREMIUM_BOT_TOKEN= ADMIN_PHONE=+998900000000 ADMIN_PASSWORD=secret12345 CAPTURE="$CHAIN_DIR/capture.jsonl"
touch "$CAPTURE"
$P manage.py migrate -v0
$P manage.py shell -c "
import json
from accounts.models import User
from masters.models import MasterProfile, Service
from evacuator.models import EvacuatorProfile
from rest_framework_simplejwt.tokens import RefreshToken
def tok(u): r=RefreshToken.for_user(u); return [str(r.access_token), str(r)]
c=User.objects.create_user(phone='+998901110001', first_name='Ali', last_name='Valiyev', role='user')
u=User.objects.create_user(phone='+998901110002', first_name='Aziz', last_name='Usta', role='usta')
m=MasterProfile.objects.create(user=u, work_hours='00:00 - 23:59'); s=Service.objects.create(master=m, name='Diagnostika', category='motor', price=1000)
e=User.objects.create_user(phone='+998901110003', first_name='Bobur', role='evakuator', is_online=True, lat=41.30, lng=69.20)
EvacuatorProfile.objects.create(user=e)
json.dump({'client':tok(c),'usta':tok(u),'evak':tok(e),'master_id':m.id,'service_id':s.id}, open('$CHAIN_DIR/ids.json','w'))
" >/dev/null 2>&1
$P "$HERE/serve.py" > "$CHAIN_DIR/server.log" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:8400/api/health/ && break; sleep 1; done
$P -u "$HERE/chain_test.py"
