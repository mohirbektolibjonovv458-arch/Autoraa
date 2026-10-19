S="${SERVIS_DIR:-/tmp/avtora-servis-test}"; mkdir -p "$S"; HERE="$(cd "$(dirname "$0")" && pwd)"
pgrep -af "port 8810" | grep -v pgrep | awk '{print $1}' | xargs -r kill
rm -rf $S/backend && cp -r "$HERE/../../backend" $S/backend && cd $S/backend && rm -f db.sqlite3 .env && rm -rf media
P="${PYTHON:-python}"
export TELEGRAM_API_BASE=http://127.0.0.1:9 AUTH_BOT_TOKEN= PREMIUM_BOT_TOKEN= ADMIN_PHONE=+998900000000 ADMIN_PASSWORD=secret12345
$P manage.py migrate -v0
$P manage.py shell -c "
import io, json
from datetime import date
from PIL import Image, ImageDraw
from django.utils import timezone
from accounts.models import User
from masters.models import MasterProfile, Booking
from rest_framework_simplejwt.tokens import RefreshToken
def tok(u): r=RefreshToken.for_user(u); return [str(r.access_token), str(r)]
for i,c in enumerate(['#1f4f8a','#2f6b3a','#7a4b2a','#5a3d6b']):
    im=Image.new('RGB',(1200,800),c); d=ImageDraw.Draw(im); d.rectangle([200,300,1000,700],fill='#d9d9d9'); d.polygon([(150,320),(600,80),(1050,320)],fill='#b03a2e'); im.save('$S/p%d.jpg'%i,'JPEG')
u=User.objects.create_user(phone='+998901112101', first_name='Rustam', last_name='Aliyev', role='usta', lat=41.31, lng=69.28)
m=MasterProfile.objects.create(user=u, is_verified=True, specialties=['motor'])
c=User.objects.create_user(phone='+998901112102', first_name='Ali', last_name='Valiyev', role='user')
now=timezone.now()
b1=Booking.objects.create(user=c, master=m, service_name='Motor diagnostikasi', date=date.today(), time='10:00', price=150000, status='completed', completed_at=now)
b2=Booking.objects.create(user=c, master=m, service_name='Moy almashtirish', date=date.today(), time='12:00', price=80000, status='completed', completed_at=now-timezone.timedelta(minutes=5))
json.dump({'usta':tok(u),'client':tok(c),'master':m.id,'b1':b1.id,'b2':b2.id}, open('$S/ids.json','w'))" >/dev/null 2>&1
nohup $P manage.py start --port 8810 > $S/server.log 2>&1 &
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:8810/api/health/ && break; sleep 1; done
$P -u "$HERE/servis_test.py"; pgrep -af "port 8810" | grep -v pgrep | awk '{print $1}' | xargs -r kill
