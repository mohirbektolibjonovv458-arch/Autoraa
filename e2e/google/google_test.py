"""«Google bilan davom etish» — brauzerda to'liq sinov (Google oynasi o'rnini bosuvchi bilan; server tekshiruvi haqiqiy)."""
import json, os, re, time, urllib.request
import jwt
from cryptography.hazmat.primitives import serialization
from playwright.sync_api import sync_playwright

B = "http://localhost:" + os.environ.get("PORT", "8500"); TG = "http://127.0.0.1:9900"
CID = os.environ["GOOGLE_CLIENT_ID"]; AUTH_TOKEN = os.environ["AUTH_BOT_TOKEN"]
KEY = serialization.load_pem_private_key(open(os.environ["GOOGLE_TEST_PRIVKEY"], "rb").read(), None)
OUT = os.environ.get("OUT_DIR", ".")
R = []

def check(name, ok, info=""):
    R.append(ok); print(("OK  " if ok else "FAIL"), name, info, flush=True)

def cred(sub, email, given="Jasur", family="Karimov"):
    now = int(time.time())
    return jwt.encode({"sub": sub, "email": email, "email_verified": True, "given_name": given, "family_name": family,
                       "aud": CID, "iss": "https://accounts.google.com", "iat": now, "exp": now + 3600}, KEY, algorithm="RS256")

def sent(): return json.loads(urllib.request.urlopen(TG + "/_sent").read())
def push(upd):
    urllib.request.urlopen(urllib.request.Request(f"{TG}/_push/{AUTH_TOKEN}", data=json.dumps(upd).encode(), headers={"Content-Type": "application/json"}, method="POST"))
def last_code(chat_id):
    for m in reversed(sent()):
        if str(m["chat_id"]) == str(chat_id) and "kod" in m["text"].lower():
            c = re.search(r"\b(\d{4})\b", m["text"])
            if c: return c.group(1)

# Google Identity Services o'rnini bosuvchi: rasmiy API (initialize/renderButton) bilan bir xil
FAKE_GSI = """window.google={accounts:{id:{initialize:function(o){window.__gsi=o},renderButton:function(el,o){
var b=document.createElement('button');b.id='gsi-btn';b.type='button';b.textContent='Google bilan davom etish';
b.style.cssText='width:'+o.width+'px;height:40px;border-radius:20px;border:1px solid #dadce0;background:#fff;color:#3c4043;font:500 14px sans-serif';
b.onclick=function(){window.__gsi.callback({credential:window.__nextCred})};el.appendChild(b);window.__gsiWidth=o.width}}}};"""

def phone_code(pg, phone9, chat_id, link=True):
    pg.get_by_label("Telefon raqam").type(phone9)
    pg.get_by_role("button", name="Telegram orqali kod olish").click()
    if link:
        pg.get_by_text("Raqamingizni Telegram botga ulang").wait_for(timeout=8000)
        push({"message": {"message_id": 1, "chat": {"id": chat_id, "type": "private"}, "from": {"id": chat_id}, "contact": {"user_id": chat_id, "phone_number": "998" + phone9}}})
    pg.get_by_label("Kod 1").wait_for(timeout=15000); time.sleep(0.6)
    pg.get_by_label("Kod 1").fill(last_code(chat_id))

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"], executable_path=os.getenv("CHROMIUM_PATH") or None)
    csp_errors = []
    def ctx(w=390, h=844):
        c = b.new_context(viewport={"width": w, "height": h}, is_mobile=w < 600, has_touch=w < 600)
        c.route("https://accounts.google.com/gsi/client", lambda r: r.fulfill(status=200, content_type="text/javascript", body=FAKE_GSI))
        c.add_init_script("try{localStorage.setItem('ah_intro_off','1')}catch(e){}")  # kirish animatsiyasi skrinshotni yopmasin
        pg = c.new_page(); pg.set_default_timeout(9000)
        pg.on("console", lambda m: m.type == "error" and ("Content Security Policy" in m.text or "Refused" in m.text) and csp_errors.append(m.text[:200]))
        return c, pg

    # 1) Yangi foydalanuvchi: Kirish → Google → ulanmagan → «Yangi hisob ochish» → ism Google'dan → telefon kodi → ichkarida
    c, pg = ctx()
    pg.goto(B + "/login"); pg.locator("#gsi-btn").wait_for()
    check("Kirish sahifasida Google tugmasi (CSP skriptni o'tkazdi)", pg.locator("#gsi-btn").is_visible())
    pg.evaluate(f"window.__nextCred={json.dumps(cred('g-new-1', 'jasur@gmail.com'))}"); pg.locator("#gsi-btn").click()
    pg.get_by_text("jasur@gmail.com").wait_for()
    check("Ulanmagan Google: email ko'rsatildi, «Yangi hisob ochish» taklifi", pg.get_by_role("button", name="Yangi hisob ochish").is_visible())
    pg.get_by_role("button", name="Yangi hisob ochish").click(); pg.wait_for_url(re.compile("/register"))
    pg.get_by_role("button", name="Davom etish").click()
    check("Ro'yxat: ism/familiya Google'dan to'ldirildi", pg.get_by_placeholder("Ism").input_value() == "Jasur" and pg.get_by_placeholder("Familiya").input_value() == "Karimov")
    pg.get_by_role("button", name="Davom etish").click()
    pg.locator("input[type=checkbox]").first.check()
    phone_code(pg, "901230001", 7001)
    pg.get_by_role("button", name=re.compile("Ro'yxatdan o'tish")).last.click(); pg.wait_for_url(re.compile(r"/app"), timeout=10000)
    check("Google bilan ro'yxatdan o'tdi va ilovaga kirdi", "/app" in pg.url, pg.url.replace(B, ""))
    c.close()

    # 2) Keyingi safar: Kirish → Google → darhol ichkarida (kodsiz)
    c, pg = ctx()
    pg.goto(B + "/login"); pg.locator("#gsi-btn").wait_for()
    pg.evaluate(f"window.__nextCred={json.dumps(cred('g-new-1', 'jasur@gmail.com'))}"); pg.locator("#gsi-btn").click()
    pg.wait_for_url(re.compile(r"/app"), timeout=10000)
    me = pg.evaluate("async()=>(await (await fetch('/api/auth/me/',{headers:{Authorization:'Bearer '+localStorage.getItem('ah_access')}})).json())")
    check("Qayta kirish: Google bilan bir bosishda (Telegram kodsiz)", me.get("phone") == "+998901230001", str(me.get("full_name")))
    c.close()

    # 3) Ro'yxat sahifasidan Google bilan (usta)
    c, pg = ctx()
    pg.goto(B + "/register"); pg.get_by_role("button", name=re.compile("^Usta")).first.click(); pg.locator("#gsi-btn").wait_for()
    pg.evaluate(f"window.__nextCred={json.dumps(cred('g-usta-1', 'usta@gmail.com', 'Bekzod', 'Usmonov'))}"); pg.locator("#gsi-btn").click()
    pg.get_by_placeholder("Ism").wait_for()
    check("Ro'yxat sahifasida Google: ma'lumotlar to'ldi, 2-qadam", pg.get_by_placeholder("Ism").input_value() == "Bekzod" and pg.get_by_text("usta@gmail.com").count() > 0)
    pg.get_by_role("button", name="Motor").click(); pg.get_by_placeholder("Toshkent, Yunusobod").fill("Toshkent")
    pg.get_by_role("button", name="Davom etish").click(); pg.locator("input[type=checkbox]").first.check()
    phone_code(pg, "901230002", 7002)
    pg.get_by_role("button", name=re.compile("Ro'yxatdan o'tish")).last.click(); pg.wait_for_url(re.compile(r"/app/usta"), timeout=10000)
    check("Usta Google bilan ro'yxatdan o'tdi", "/app/usta" in pg.url)
    pg.evaluate("localStorage.clear()"); c.close()

    # 4) Mavjud (telefon bilan ochilgan) hisobga Google'ni ulash
    c, pg = ctx()
    pg.goto(B + "/login"); pg.locator("#gsi-btn").wait_for()
    pg.evaluate(f"window.__nextCred={json.dumps(cred('g-old-1', 'eski@gmail.com'))}"); pg.locator("#gsi-btn").click()
    pg.get_by_text("eski@gmail.com").wait_for()
    phone_code(pg, "901230001", 7001, link=False)  # 1-sinovdagi hisob (Telegram'ga ulangan)
    pg.get_by_role("button", name=re.compile("^Kirish$")).last.click(); pg.wait_for_url(re.compile(r"/app"), timeout=10000)
    c.close()
    c, pg = ctx()
    pg.goto(B + "/login"); pg.locator("#gsi-btn").wait_for()
    pg.evaluate(f"window.__nextCred={json.dumps(cred('g-old-1', 'eski@gmail.com'))}"); pg.locator("#gsi-btn").click()
    pg.wait_for_url(re.compile(r"/app"), timeout=10000)
    check("Mavjud hisobga Google ulandi — endi bir bosishda kiradi", "/app" in pg.url)
    c.close()

    # 5) Soxta token — kirmaydi
    c, pg = ctx()
    pg.goto(B + "/login"); pg.locator("#gsi-btn").wait_for()
    bad = cred("g-new-1", "jasur@gmail.com")[:-6] + "AAAAAA"
    pg.evaluate(f"window.__nextCred={json.dumps(bad)}"); pg.locator("#gsi-btn").click()
    pg.locator(".toast").first.wait_for()
    check("Soxta Google token rad etildi", "/login" in pg.url and "tasdiqlab bo'lmadi" in pg.locator(".toast").first.inner_text(), pg.locator(".toast").first.inner_text())
    c.close()

    # 6) Responsive: telefon (360) va kompyuter (1280) — tugma sig'adi, gorizontal aylantirish yo'q
    for w, h in ((360, 740), (412, 915), (1280, 800)):
        c, pg = ctx(w, h)
        pg.goto(B + "/login"); pg.locator("#gsi-btn").wait_for(); pg.wait_for_timeout(300)
        bw = pg.evaluate("window.__gsiWidth"); box = pg.locator("#gsi-btn").bounding_box()
        overflow = pg.evaluate("document.documentElement.scrollWidth > window.innerWidth")
        pg.screenshot(path=f"{OUT}/google-login-{w}.png")
        check(f"Responsive {w}px: tugma {bw}px, ekranga sig'adi", not overflow and box["x"] >= 0 and box["x"] + box["width"] <= w, f"x={box['x']:.0f} w={box['width']:.0f}")
        pg.goto(B + "/register"); pg.locator("#gsi-btn").wait_for(); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/google-register-{w}.png")
        c.close()
    check("CSP xatolari yo'q", not csp_errors, str(csp_errors[:2]))
    b.close()

print(f"\n=== NATIJA: {sum(R)} / {len(R)} ===")
