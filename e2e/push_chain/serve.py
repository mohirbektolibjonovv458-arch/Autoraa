"""Haqiqiy Avtora serveri; faqat Google FCM o'rniga «soxta push provayder»: shifrlangan paketni faylga yozadi (201 qaytaradi)."""
import base64, json, os, sys, threading
import requests
OUT = os.environ["CAPTURE"]
_real_post = requests.post
_lock = threading.Lock()
def fake_post(url, *a, **kw):
    if str(url).startswith("https://fcm.googleapis.com/fcm/send/e2e-"):
        with _lock, open(OUT, "a") as f:
            f.write(json.dumps({"endpoint": url, "body": base64.b64encode(kw.get("data") or b"").decode(), "headers": dict(kw.get("headers") or {})}) + "\n")
        r = requests.Response(); r.status_code = 201; r._content = b""; return r
    return _real_post(url, *a, **kw)
requests.post = fake_post
sys.path.insert(0, os.getcwd())
sys.argv = ["manage.py", "start", "--port", "8400"]
import django; os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings"); django.setup()
from django.core.management import execute_from_command_line
execute_from_command_line(sys.argv)
