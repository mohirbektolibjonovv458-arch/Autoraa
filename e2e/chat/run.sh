S="${CHAT_DIR:-/tmp/avtora-chat-test}"; mkdir -p "$S/chat"; HERE="$(cd "$(dirname "$0")" && pwd)"
pgrep -af "port 8600" | grep -v pgrep | awk '{print $1}' | xargs -r kill
rm -rf $S/backend && cp -r "$HERE/../../backend" $S/backend && cd $S/backend && rm -f db.sqlite3 .env
P="${PYTHON:-python}"
export TELEGRAM_API_BASE=http://127.0.0.1:9 AUTH_BOT_TOKEN= PREMIUM_BOT_TOKEN= ADMIN_PHONE=+998900000000 ADMIN_PASSWORD=secret12345
$P manage.py migrate -v0
$P manage.py shell -c "
import json
from accounts.models import User
from masters.models import MasterProfile
from rest_framework_simplejwt.tokens import RefreshToken
def tok(u): r=RefreshToken.for_user(u); return [str(r.access_token), str(r)]
c=User.objects.create_user(phone='+998901110011', first_name='Ali', role='user')
u=User.objects.create_user(phone='+998901110012', first_name='Aziz', last_name='Usta', role='usta'); MasterProfile.objects.create(user=u)
json.dump({'client':tok(c),'usta':tok(u),'usta_id':u.id}, open('$S/ids.json','w'))" >/dev/null 2>&1
nohup $P manage.py start --port 8600 > $S/server.log 2>&1 &
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:8600/api/health/ && break; sleep 1; done
$P -u "$HERE/chat_test.py"; pgrep -af "port 8600" | grep -v pgrep | awk '{print $1}' | xargs -r kill
