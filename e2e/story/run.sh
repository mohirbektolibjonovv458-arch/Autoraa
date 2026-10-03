S="${STORY_DIR:-/tmp/avtora-story-test}"; mkdir -p "$S"; HERE="$(cd "$(dirname "$0")" && pwd)"
pgrep -af "port 8800" | grep -v pgrep | awk '{print $1}' | xargs -r kill
rm -rf $S/backend && cp -r "$HERE/../../backend" $S/backend && cd $S/backend && rm -f db.sqlite3 .env
P="${PYTHON:-python}"
export TELEGRAM_API_BASE=http://127.0.0.1:9 AUTH_BOT_TOKEN= PREMIUM_BOT_TOKEN= ADMIN_PHONE=+998900000000 ADMIN_PASSWORD=secret12345
$P manage.py migrate -v0
$P manage.py shell -c "
import io, json
from PIL import Image, ImageDraw
from django.core.files.uploadedfile import SimpleUploadedFile
from accounts.models import User
from masters.models import MasterProfile
from rest_framework_simplejwt.tokens import RefreshToken
def tok(u): r=RefreshToken.for_user(u); return [str(r.access_token), str(r)]
def img(c, w=160, h=160, text=''):
    im=Image.new('RGB',(w,h),c); d=ImageDraw.Draw(im); d.ellipse([w*.3,h*.15,w*.7,h*.55],fill='#f1c7a0')
    b=io.BytesIO(); im.save(b,'JPEG'); return b.getvalue()
u=User.objects.create_user(phone='+998901112001', first_name='Rustam', last_name='Usta', role='usta'); u.avatar=SimpleUploadedFile('a.jpg', img('#7a4b2a'), 'image/jpeg'); u.save()
MasterProfile.objects.create(user=u, is_verified=True)
c=User.objects.create_user(phone='+998901112002', first_name='Ali', role='user')
open('$S/story1.jpg','wb').write(img('#1f4f8a', 720, 1280)); open('$S/story2.jpg','wb').write(img('#2f6b3a', 1280, 720))
json.dump({'usta':tok(u),'client':tok(c)}, open('$S/ids.json','w'))" >/dev/null 2>&1
nohup $P manage.py start --port 8800 > $S/server.log 2>&1 &
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:8800/api/health/ && break; sleep 1; done
$P -u "$HERE/story_test.py"; pgrep -af "port 8800" | grep -v pgrep | awk '{print $1}' | xargs -r kill
