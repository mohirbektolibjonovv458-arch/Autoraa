S="${MAP_DIR:-/tmp/avtora-map-test}"; mkdir -p "$S/map"; HERE="$(cd "$(dirname "$0")" && pwd)"
pgrep -af "port 8700" | grep -v pgrep | awk '{print $1}' | xargs -r kill
rm -rf $S/backend $S/tiles && cp -r "$HERE/../../backend" $S/backend && cd $S/backend && rm -f db.sqlite3 .env
P="${PYTHON:-python}"
$P "$HERE/faketiles.py" $S/tiles >/dev/null
export TILE_CACHE_DIR=$S/tiles TELEGRAM_API_BASE=http://127.0.0.1:9 AUTH_BOT_TOKEN= PREMIUM_BOT_TOKEN= ADMIN_PHONE=+998900000000 ADMIN_PASSWORD=secret12345
$P manage.py migrate -v0
$P manage.py shell -c "
import io, json, random
from PIL import Image, ImageDraw
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from accounts.models import User
from masters.models import MasterProfile
from evacuator.models import EvacuatorProfile, SOSRequest
from fuel.models import FuelStation
from rest_framework_simplejwt.tokens import RefreshToken
def tok(u): r=RefreshToken.for_user(u); return [str(r.access_token), str(r)]
def face(c):
    im=Image.new('RGB',(160,160),c); d=ImageDraw.Draw(im); d.ellipse([45,25,115,95],fill='#f1c7a0'); d.rectangle([30,105,130,160],fill='#26324a')
    b=io.BytesIO(); im.save(b,'JPEG'); return SimpleUploadedFile('a.jpg', b.getvalue(), 'image/jpeg')
rnd=random.Random(3)
pts=[(41.326,69.245,4.9,True,'#7a4b2a'),(41.318,69.300,4.8,True,'#3b5b8a'),(41.296,69.262,4.7,False,None),(41.335,69.290,4.6,True,None),(41.302,69.312,4.9,True,'#5a3d6b'),(41.290,69.232,0,True,None),(41.340,69.255,4.3,False,'#2f5d50')]
for i,(la,ln,rt,on,col) in enumerate(pts):
    u=User.objects.create_user(phone=f'+99890111{2000+i}', first_name=f'Usta{i}', role='usta', lat=la, lng=ln, is_online=on, last_seen=timezone.now())
    if col: u.avatar=face(col); u.save()
    MasterProfile.objects.create(user=u, rating=rt, reviews_count=12 if rt else 0, is_verified=True, specialties=['motor'])
e=User.objects.create_user(phone='+998901119990', first_name='Evak', role='evakuator', lat=41.305, lng=69.285, is_online=True, last_seen=timezone.now()); EvacuatorProfile.objects.create(user=e)
c=User.objects.create_user(phone='+998901119991', first_name='Mijoz', role='user')
SOSRequest.objects.create(user=c, kind='evakuator', lat=41.312, lng=69.268)
for i,(la,ln,f) in enumerate([(41.322,69.272,'metan'),(41.308,69.248,'benzin'),(41.298,69.290,'propan'),(41.330,69.305,'metan'),(41.315,69.320,'benzin')]):
    FuelStation.objects.create(name=f'Zapravka {i}', lat=la, lng=ln, fuels=[f], is_active=True) if hasattr(FuelStation,'is_active') else FuelStation.objects.create(name=f'Zapravka {i}', lat=la, lng=ln, fuels=[f])
json.dump({'client':tok(c),'evak':tok(e)}, open('$S/ids.json','w'))
" 2>&1 | grep -v "objects imported" | tail -3
nohup $P manage.py start --port 8700 > $S/server.log 2>&1 &
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:8700/api/health/ && break; sleep 1; done
$P -u "$HERE/map_test.py"; pgrep -af "port 8700" | grep -v pgrep | awk '{print $1}' | xargs -r kill
