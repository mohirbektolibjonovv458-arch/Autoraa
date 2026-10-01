"""To'liq zanjir: EVENT → BACKEND → NAVBAT → WEB PUSH (shifrlash, VAPID) → PROVAYDER → SERVICE WORKER → BILDIRISHNOMA."""
import base64, json, os, time, urllib.request
import http_ece
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from playwright.sync_api import sync_playwright

S = os.environ.get("CHAIN_DIR") or "/tmp/avtora-push-chain"
B = "http://localhost:8400"
IDS = json.load(open(S + "/ids.json"))
CAP = S + "/capture.jsonl"
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
RESULTS = []

def api(method, path, who, body=None, params=""):
    req = urllib.request.Request(B + "/api" + path + params, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + IDS[who][0]})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or b"{}")

def check(name, ok, info=""):
    RESULTS.append((ok, name, info)); print(("OK  " if ok else "FAIL"), name, info, flush=True)

class Phone:
    """Alohida telefon: o'z brauzer profili, service worker, push kaliti (p256dh/auth) va serverdagi obunasi."""
    def __init__(self, pw, name, start):
        self.name, self.seen = name, 0
        self.ctx = pw.chromium.launch_persistent_context(f"{S}/profile-{name}", headless=True,
                                                         executable_path=os.getenv("CHROMIUM_PATH") or None, args=["--no-sandbox"],
                                                         viewport={"width": 390, "height": 844})
        self.ctx.grant_permissions(["notifications", "geolocation"], origin=B)
        a, r = IDS[name]
        self.ctx.add_init_script(f"localStorage.setItem('ah_access','{a}');localStorage.setItem('ah_refresh','{r}');localStorage.setItem('ah_push_prompt_hidden_at','{int(time.time()*1000)}');")
        self.keeper = self.ctx.pages[0] if self.ctx.pages else self.ctx.new_page()  # brauzer jarayoni (telefon) — ilova sahifasi emas
        self.cdp = self.ctx.new_cdp_session(self.keeper)
        self.regs = {}
        self.cdp.on("ServiceWorker.workerRegistrationUpdated", lambda e: [self.regs.update({x["registrationId"]: x["scopeURL"]}) for x in e["registrations"]])
        self.cdp.send("ServiceWorker.enable")
        self.app = self.ctx.new_page(); self.app.goto(B + start)
        self.app.evaluate("navigator.serviceWorker.ready.then(()=>1)"); self.app.wait_for_timeout(1500)
        # qurilmaning push kaliti (haqiqiy telefonda brauzer yaratadi)
        self.key = ec.generate_private_key(ec.SECP256R1()); self.auth = os.urandom(16)
        pub = self.key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
        self.endpoint = f"https://fcm.googleapis.com/fcm/send/e2e-{name}"
        api("POST", "/push/subscribe/", name, {"endpoint": self.endpoint, "keys": {"p256dh": b64(pub), "auth": b64(self.auth)}})

    def reg_id(self):
        return next(k for k, v in self.regs.items() if v.startswith(B))

    def deliver(self, wait=8):
        """Provayderga kelgan shifrlangan paketlarni olib, shifrini ochib, telefon service worker'iga yetkazadi."""
        t0, got = time.time(), []
        while time.time() - t0 < wait:
            lines = [json.loads(l) for l in open(CAP) if l.strip()]
            mine = [l for l in lines if l["endpoint"] == self.endpoint]
            if len(mine) > self.seen:
                for l in mine[self.seen:]:
                    plain = http_ece.decrypt(base64.b64decode(l["body"]), private_key=self.key, auth_secret=self.auth, version="aes128gcm")
                    self.cdp.send("ServiceWorker.deliverPushMessage", {"origin": B, "registrationId": self.reg_id(), "data": plain.decode()})
                    got.append((json.loads(plain), l["headers"]))
                self.seen = len(mine)
                time.sleep(1.0)  # ketma-ket kelayotganlarni ham yig'amiz
                continue
            if got: break
            time.sleep(0.3)
        time.sleep(0.8)
        return got

    def shown(self):
        """Telefon ekranidagi (tizim panelidagi) Avtora bildirishnomalari."""
        pg = self.app if not self.app.is_closed() else None
        tmp = None
        if pg is None:
            tmp = pg = self.ctx.new_page(); pg.goto(B + "/offline.html")
        res = pg.evaluate("async()=>(await (await navigator.serviceWorker.ready).getNotifications()).map(n=>({title:n.title,body:n.body,tag:n.tag,url:n.data&&n.data.url,ri:n.requireInteraction}))")
        if tmp: tmp.close()
        return res

    def clear(self):
        pg = self.ctx.new_page(); pg.goto(B + "/offline.html")
        pg.evaluate("async()=>(await (await navigator.serviceWorker.ready).getNotifications()).forEach(n=>n.close())"); pg.close()

with sync_playwright() as pw:
    usta = Phone(pw, "usta", "/app/usta/orders")
    client = Phone(pw, "client", "/app")
    evak = Phone(pw, "evak", "/app/evak")

    day = time.strftime("%Y-%m-%d", time.localtime(time.time() + 86400))
    # --- Test 3: User → Bron → Usta (usta ilovasi YOPIQ)
    usta.app.close()
    bk = api("POST", "/masters/bookings/", "client", {"master": IDS["master_id"], "service": IDS["service_id"], "date": day, "time": "10:00"})
    got = usta.deliver()
    sh = usta.shown()
    check("Test 3: bron → ustaga push (ilova yopiq)", any(n["body"] == "Yangi bron so'rovi keldi. Ko'rish uchun bosing." and n["url"] == f"/app/usta/orders?focus={bk['id']}" for n in sh),
          f"push={len(got)} ekranda={[(n['title'], n['body']) for n in sh]}")
    check("    Urgency: high (qulflangan/uxlayotgan telefonda kechikmaydi)", bool(got) and {k.lower(): v for k, v in got[0][1].items()}.get("urgency") == "high", str(got[0][1].get("urgency") if got else ""))
    usta.clear()

    # --- Test 1: User → Usta chat (usta ilovasi YOPIQ / boshqa ilovada)
    uid = api("GET", "/auth/me/", "usta")["id"]
    cid = api("POST", "/chat/start/", "client", {"user_id": uid})["id"]
    api("POST", f"/chat/{cid}/messages/", "client", {"text": "Salom, mashinam raqami 01A777AA"})
    got = usta.deliver(); sh = usta.shown()
    check("Test 1: mijoz → usta chat push", any(n["body"] == "Mijoz sizga yangi xabar yubordi" and n["url"] == f"/app/chat/{cid}" for n in sh),
          f"ekranda={[(n['title'], n['body']) for n in sh]}")
    check("    qulf ekranida maxfiy matn yo'q", not any("01A777AA" in json.dumps(n, ensure_ascii=False) or "Ali" in json.dumps(n, ensure_ascii=False) for n in sh))

    # --- Test 7: ketma-ket 4 ta xabar — hammasi yetadi (birinchisida to'xtamaydi)
    for i in range(4):
        api("POST", f"/chat/{cid}/messages/", "client", {"text": f"xabar {i}"}); time.sleep(0.3)
    got = usta.deliver(10); sh = usta.shown()
    check("Test 7: ketma-ket xabarlar hammasi telefonga yetdi", len(got) == 4, f"yetkazildi={len(got)}/4; oxirgisi={got[-1][0]['body'] if got else None}")
    check("    telefonda bitta suhbat bildirishnomasi, oxirgi holat bilan", len([n for n in sh if n["tag"] == f"chat-{cid}"]) == 1 and any("5 ta" in n["body"] for n in sh),
          f"{[(n['tag'], n['body']) for n in sh]}")
    usta.clear()

    # --- Test 2: Usta → User (mijoz ilovasi boshqa sahifada)
    client.app.goto(B + "/app/profile"); client.app.wait_for_timeout(800)
    api("POST", f"/chat/{cid}/messages/", "usta", {"text": "Ertaga soat 10 da keling"})
    got = client.deliver(); sh = client.shown()
    check("Test 2: usta → mijoz chat push (mijoz boshqa sahifada)", any(n["body"] == "Usta sizga yangi xabar yubordi" and n["url"] == f"/app/chat/{cid}" for n in sh),
          f"ekranda={[(n['title'], n['body']) for n in sh]}")
    client.clear()

    # --- 9-talab: mijoz aynan shu chatni ochib turibdi → push yo'q, faqat chat yangilanadi
    client.app.goto(B + f"/app/chat/{cid}"); client.app.wait_for_timeout(4000)
    api("POST", f"/chat/{cid}/messages/", "usta", {"text": "Manzil: Chilonzor"})
    got = client.deliver(5); sh = client.shown()
    client.app.locator(".bubble", has_text="Manzil: Chilonzor").wait_for(timeout=8000)
    check("Talab 9: shu chat ochiq bo'lsa push yo'q, chat oynasi yangilanadi", not got and not sh, f"push={len(got)} ekranda={len(sh)}")
    client.app.goto(B + "/app/profile"); client.app.wait_for_timeout(13000)  # chatdan chiqdi (12 s)
    api("POST", f"/chat/{cid}/messages/", "usta", {"text": "Kutaman"})
    got = client.deliver(); sh = client.shown()
    check("    chatdan chiqqach push yana keladi", any(n["url"] == f"/app/chat/{cid}" for n in sh))
    client.clear()

    # --- Test 4: User → SOS → Evakuator (evakuator ilovasi boshqa sahifada)
    evak.app.goto(B + "/app/profile"); evak.app.wait_for_timeout(500)
    api("POST", "/sos/", "client", {"kind": "evakuator", "lat": 41.31, "lng": 69.21})
    got = evak.deliver(); sh = evak.shown()
    check("Test 4: SOS → evakuatorga push", any(n["title"].startswith("🚨 Avtora SOS") and "Yaqin atrofda yordam so'rovi mavjud" in n["body"] and n["url"] == "/app/evak" for n in sh),
          f"ekranda={[(n['title'], n['body']) for n in sh]}")
    check("    SOS ekrandan o'zi yo'qolmaydi (requireInteraction)", any(n["ri"] for n in sh))
    evak.clear()
    evak.app.close()
    got = evak.deliver(60)  # hech kim qabul qilmadi — 40 s da takror (ilova yopiq)
    sh = evak.shown()
    check("    SOS hech kim qabul qilmasa takror jiringlaydi (ilova yopiq)", any("hali kutyapti" in n["title"] for n in sh), f"{[n['title'] for n in sh]}")

    # --- Test 8: logout → login
    api("POST", "/push/unsubscribe/", "usta", {"endpoint": usta.endpoint})  # logout (disablePush)
    api("POST", f"/chat/{cid}/messages/", "client", {"text": "logout paytida"})
    got = usta.deliver(4)
    check("Test 8a: logout qilingan qurilmaga xabar bormaydi", not got)
    pub = usta.key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    api("POST", "/push/subscribe/", "usta", {"endpoint": usta.endpoint, "keys": {"p256dh": b64(pub), "auth": b64(usta.auth)}})  # login → syncPush
    api("POST", f"/chat/{cid}/messages/", "client", {"text": "login'dan keyin"})
    got = usta.deliver(); sh = usta.shown()
    check("Test 8b: qayta login'dan keyin push davom etadi", any(n["url"] == f"/app/chat/{cid}" for n in sh))

    for p in (usta, client, evak): p.ctx.close()

print("\n=== NATIJA:", sum(1 for r in RESULTS if r[0]), "/", len(RESULTS), "===")
for ok, n, i in RESULTS:
    if not ok: print("FAIL", n, i)
