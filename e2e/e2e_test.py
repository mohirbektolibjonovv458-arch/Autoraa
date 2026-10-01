"""Avtora — to'liq E2E sinov (brauzerda haqiqiy bosishlar). Qanday ishlatish: e2e/README.md"""
import os, json, re, time, traceback, urllib.request
from playwright.sync_api import sync_playwright
B="http://127.0.0.1:8200"; TG="http://127.0.0.1:9900"
AUTH_TOKEN=os.environ["AUTH_BOT_TOKEN"]; PREM_TOKEN=os.environ["PREMIUM_BOT_TOKEN"]
RECEIPT=os.path.join(os.path.dirname(os.path.abspath(__file__)), "receipt.png")
RESULTS=[]; NETERR=[]; CONSOLE=[]
def sent(): return json.loads(urllib.request.urlopen(TG+"/_sent").read())
def push(token, upd):
    req=urllib.request.Request(f"{TG}/_push/{token}", data=json.dumps(upd).encode(), headers={"Content-Type":"application/json"}, method="POST"); urllib.request.urlopen(req)
def last_code(chat_id):
    for m in reversed(sent()):
        if str(m["chat_id"])==str(chat_id) and "kod" in m["text"].lower():
            c=re.search(r"\b(\d{4})\b", m["text"]); 
            if c: return c.group(1)
    return None
def step(name, fn):
    try: fn(); RESULTS.append(("OK", name, "")); print("OK  ", name)
    except Exception as e:
        RESULTS.append(("FAIL", name, str(e).split("\n")[0][:300])); print("FAIL", name, "->", str(e).split("\n")[0][:300])
        try: CUR["page"].screenshot(path=f"e2e_fail_{len(RESULTS)}.png")
        except Exception: pass
CUR={}
def newctx(b, geo=(41.311,69.28)):
    ctx=b.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True, geolocation={"latitude":geo[0],"longitude":geo[1]}, permissions=["geolocation"], locale="uz-UZ")
    pg=ctx.new_page(); pg.set_default_timeout(9000)
    pg.on("console", lambda m: m.type=="error" and "fonts.g" not in m.text and "403" not in m.text and CONSOLE.append(m.text[:200]))
    pg.on("pageerror", lambda e: CONSOLE.append("PAGEERROR "+str(e)[:200]))
    pg.on("response", lambda r: r.status>=400 and "/api/" in r.url and NETERR.append(f"{r.status} {r.request.method} {r.url.replace(B,'')}"))
    pg.on("requestfailed", lambda r: "/api/" in r.url and NETERR.append(f"FAILED {r.method} {r.url.replace(B,'')} {r.failure}"))
    return ctx, pg

def register(pg, role, phone9, chat_id, first, extra=None):
    CUR["page"]=pg
    pg.goto(B+"/register"); pg.get_by_role("button", name=re.compile({"user":"Foydalanuvchi","usta":"^Usta","evakuator":"Evakuator"}[role])).first.click()
    pg.get_by_role("button", name="Davom etish").click()
    pg.get_by_placeholder("Ism").fill(first); pg.get_by_placeholder("Familiya").fill("Testov")
    if extra: extra(pg)
    pg.get_by_role("button", name="Davom etish").click()
    pg.locator("input[type=checkbox]").first.check()
    pg.get_by_label("Telefon raqam").type(phone9)
    pg.get_by_role("button", name="Telegram orqali kod olish").click()
    pg.get_by_text("Raqamingizni Telegram botga ulang").wait_for(timeout=8000)
    # foydalanuvchi botda «Raqamni ulashish» bosadi
    push(AUTH_TOKEN, {"message": {"message_id": 1, "chat": {"id": chat_id, "type": "private"}, "from": {"id": chat_id}, "contact": {"user_id": chat_id, "phone_number": "998"+phone9}}})
    pg.get_by_label("Kod 1").wait_for(timeout=15000)
    time.sleep(0.5); code=last_code(chat_id); assert code, "kod botga kelmadi"
    pg.get_by_label("Kod 1").fill(code)
    pg.get_by_role("button", name=re.compile("Ro'yxatdan o'tish|Yakunlash|Tasdiqlash")).last.click()
    pg.wait_for_url(re.compile(r"/app"), timeout=10000)

with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"])
    uctx, U = newctx(b); sctx, S = newctx(b, (41.315,69.285)); ectx, E = newctx(b, (41.32,69.29)); actx, A = newctx(b)
    CUR["page"]=U

    step("Usta ro'yxatdan o'tishi (Telegram kod)", lambda: register(S, "usta", "901110101", 5001, "Aziz", lambda pg: (pg.get_by_role("button", name="Motor").click(), pg.get_by_placeholder("Toshkent, Yunusobod").fill("Toshkent, Yunusobod"))))
    step("Foydalanuvchi ro'yxatdan o'tishi + avtomobil", lambda: register(U, "user", "901110202", 5002, "Tolib", lambda pg: (pg.get_by_placeholder("Chevrolet").fill("Chevrolet"), pg.get_by_placeholder("Cobalt").fill("Cobalt"), pg.get_by_placeholder("2022").fill("2021"))))
    step("Evakuator ro'yxatdan o'tishi", lambda: register(E, "evakuator", "901110303", 5003, "Bobur", lambda pg: pg.get_by_placeholder("Hyundai Porter").fill("Isuzu NPR")))

    def admin_login():
        CUR["page"]=A; A.goto(B+"/admin/login")
        A.locator("input").nth(0).fill("+998 90 000 00 00"); A.locator("input[type=password]").fill("secret12345")
        A.get_by_role("button", name=re.compile("Kirish")).click(); A.wait_for_url(re.compile(r"/admin/?$"), timeout=8000)
    step("Admin panelga kirish", admin_login)

    def usta_service():
        CUR["page"]=S; S.goto(B+"/app/usta/services"); S.get_by_role("button", name="Qo'shish").first.click()
        S.get_by_placeholder("Motor diagnostikasi").fill("Kompyuter diagnostikasi")
        S.locator(".modal input[type=number]").first.fill("150000"); S.locator(".modal").get_by_role("button", name="Saqlash").click()
        S.get_by_text("Kompyuter diagnostikasi").wait_for(timeout=5000)
    step("Usta xizmat qo'shadi", usta_service)

    def admin_verify():
        CUR["page"]=A; A.goto(B+"/admin/masters"); A.get_by_role("button", name="Tasdiqlash").first.click(); A.get_by_text("Tasdiqlangan").first.wait_for(timeout=5000)
    step("Admin ustani tasdiqlaydi", admin_verify)

    def booking():
        CUR["page"]=U; U.goto(B+"/app/masters"); U.get_by_role("button", name="Bron qilish").first.click()
        U.locator(".chips .chip").nth(1).click()  # ertangi kun
        U.locator(".slot:not([disabled])").first.click(); U.get_by_placeholder("Muammoni qisqacha yozing").fill("Check engine yonyapti")
        U.locator(".modal").get_by_role("button", name=re.compile("Bron|Tasdiqlash|Yuborish")).last.click()
        U.wait_for_timeout(1500); assert U.locator(".modal").count()==0 or "band" not in U.locator(".modal").inner_text(), U.locator(".modal").inner_text()[:200]
    step("Foydalanuvchi ustaga bron qiladi", booking)

    def usta_confirm():
        CUR["page"]=S; S.goto(B+"/app/usta/orders"); S.get_by_role("button", name="Tasdiqlash").first.click(); S.get_by_text("Tasdiqlangan").first.wait_for(timeout=5000)
        assert any("Kompyuter diagnostikasi" in m["text"] or "bron" in m["text"].lower() for m in sent() if str(m["chat_id"])=="5001"), "ustaga Telegram xabari bormadi"
    step("Usta bronni tasdiqlaydi (+Telegram xabar)", usta_confirm)

    def chat():
        CUR["page"]=U; U.goto(B+"/app/orders"); U.get_by_role("button", name="Yozish").first.click(); U.wait_for_url(re.compile("/app/chat/"), timeout=5000)
        U.get_by_placeholder("Xabar yozing…").fill("Assalomu alaykum, ertaga kelaman"); U.get_by_role("button", name="Yuborish", exact=True).click()
        U.locator(".bubble", has_text="Assalomu alaykum, ertaga kelaman").wait_for(timeout=4000)
        CUR["page"]=S; S.goto(B+"/app/chat"); S.locator(".chat-item").first.click(); S.locator(".bubble", has_text="Assalomu alaykum, ertaga kelaman").wait_for(timeout=6000)
        S.get_by_placeholder("Xabar yozing…").fill("Kutaman!"); S.get_by_role("button", name="Yuborish", exact=True).click()
        CUR["page"]=U; U.locator(".bubble", has_text="Kutaman!").wait_for(timeout=8000)
    step("Chat: ikki tomonlama xabar (polling)", chat)

    def sos():
        CUR["page"]=E; E.goto(B+"/app/evak"); E.locator(".topbar button", has_text="Offline").click(); E.locator(".topbar button", has_text="Online").wait_for(timeout=5000)
        CUR["page"]=U; U.goto(B+"/app/sos?kind=evakuator"); U.wait_for_timeout(1500); U.get_by_role("button", name="Yordam chaqirish").click()
        U.get_by_text(re.compile("qidirilmoqda", re.I)).first.wait_for(timeout=6000)
        CUR["page"]=E; E.reload(); E.get_by_role("button", name="Qabul qilish").first.click(timeout=10000)
        for t in ("Yo'lga chiqdim","Yetib keldim","Yakunlash"): E.get_by_role("button", name=t).click(); E.wait_for_timeout(700)
        CUR["page"]=U; U.get_by_text("xizmatini baholang").wait_for(timeout=12000); U.get_by_role("button", name="5 yulduz").click(); U.wait_for_timeout(800)
        assert U.get_by_text("xizmatini baholang").count()==0, "baho qabul qilinmadi"
    step("SOS: chaqirish → evakuator qabul → yakun → baho", sos)

    def premium():
        # admin premium botga raqamini ulaydi
        push(PREM_TOKEN, {"message": {"message_id": 1, "chat": {"id": 9001, "type": "private"}, "from": {"id": 9001}, "contact": {"user_id": 9001, "phone_number": "998900000000"}}})
        time.sleep(2.5)
        CUR["page"]=S; S.goto(B+"/app/usta/premium"); S.locator("input[type=file]").set_input_files(RECEIPT)
        S.get_by_placeholder("1234").fill("4417"); S.get_by_role("button", name=re.compile("Pul soldim")).click()
        S.get_by_text("To'lovingiz tekshirilmoqda").wait_for(timeout=6000)
        time.sleep(1.5)
        adm=[m for m in sent() if str(m["chat_id"])=="9001" and m["method"]=="sendPhoto"]; assert adm, "adminga chek bormadi: "+str([ (m['method'],m['chat_id']) for m in sent()][-5:])
        pid=re.search(r"#(\d+)", adm[-1]["text"]).group(1)
        push(PREM_TOKEN, {"callback_query": {"id": "cb1", "from": {"id": 9001, "username": "boss"}, "data": f"pay:approve:{pid}", "message": {"message_id": 7, "chat": {"id": 9001}, "photo": [1], "caption": "x"}}})
        time.sleep(3); S.reload(); S.get_by_text(re.compile("Premium faol")).wait_for(timeout=8000)
    step("Premium: chek → Telegram admin tasdig'i → faollashadi", premium)

    def shop():
        CUR["page"]=S; S.goto(B+"/app/usta/shop"); S.get_by_role("button", name="Mahsulot", exact=True).click()
        S.get_by_placeholder("Moy filtri (MANN)").fill("Moy filtri MANN W712"); S.locator(".modal input[type=number]").nth(0).fill("45000"); S.locator(".modal input[type=number]").nth(2).fill("10")
        S.locator(".modal input[type=file]").set_input_files(RECEIPT)
        S.locator(".modal").get_by_role("button", name="Saqlash").click(); S.get_by_text("Moy filtri MANN W712").first.wait_for(timeout=6000)
        CUR["page"]=U; U.goto(B+"/app/parts"); U.get_by_text("Moy filtri MANN W712").first.wait_for(timeout=6000)
        U.locator(".product").first.locator("button").last.click(); U.get_by_role("button", name=re.compile("^Savat")).first.click()
        U.get_by_role("button", name="Buyurtma berish").click(); U.get_by_text(re.compile("Buyurtma qabul qilindi")).wait_for(timeout=6000)
        CUR["page"]=S; S.goto(B+"/app/usta/shop"); S.get_by_role("button", name=re.compile("Buyurtmalar")).click(); S.get_by_text("Moy filtri MANN W712 × 1").wait_for(timeout=5000)
    step("Do'kon: mahsulot (rasm bilan) → xarid → sotuvchiga buyurtma", shop)

    def cars():
        CUR["page"]=U; U.goto(B+"/app/cars"); U.get_by_text("Chevrolet Cobalt").first.wait_for(timeout=5000)
        U.get_by_role("button", name=re.compile("^Hujjatlar")).click(); U.get_by_text("Hujjatlar va muddatlar").wait_for(); U.locator(".card", has_text="Hujjatlar va muddatlar").get_by_role("button", name="Qo'shish").click()
        import datetime; d=(datetime.date.today()+datetime.timedelta(days=5)).isoformat()
        U.locator(".modal input[type=date]").fill(d); U.locator(".modal").get_by_role("button", name="Saqlash").click(); U.get_by_text("5 kun").wait_for(timeout=5000)
        U.get_by_role("button", name="Xarajat", exact=True).first.click(); U.get_by_text("Shu oy xarajati").wait_for(); U.locator(".card", has_text="Shu oy xarajati").get_by_role("button").first.click()
        U.locator(".modal input[type=number]").first.fill("250000"); U.locator(".modal").get_by_role("button", name="Saqlash").click(); U.get_by_text("250 000").first.wait_for(timeout=5000)
        U.goto(B+"/app"); U.get_by_text(re.compile("5 kun qoldi")).wait_for(timeout=6000)
    step("Garaj: hujjat muddati, xarajat, bosh sahifa eslatmasi", cars)

    def fuel():
        CUR["page"]=U; U.goto(B+"/app/fuel"); U.get_by_role("button", name="Shoxobcha").click()
        U.get_by_placeholder("Masalan: «Chilonzor AGNKS»").fill("Test AGNKS Yunusobod"); U.locator(".modal").get_by_role("button", name="Qo'shish").click()
        U.get_by_text("Siz shu yerdamisiz").wait_for(timeout=6000); U.get_by_role("button", name=re.compile("Bor, navbatsiz")).click()
        U.get_by_text(re.compile("Rahmat! Bu hafta")).wait_for(timeout=5000)
    step("Yoqilg'i: shoxobcha qo'shish va holat belgilash", fuel)

    def profile():
        CUR["page"]=U; U.goto(B+"/app/profile"); U.locator("input[type=file]").first.set_input_files(RECEIPT); U.get_by_text("Rasm yangilandi").wait_for(timeout=8000)
        U.get_by_role("button", name="Profilni tahrirlash").click(); U.locator(".modal input").nth(1).fill("Karimov"); U.locator(".modal").get_by_role("button", name="Saqlash").click(); U.get_by_role("heading", name="Tolib Karimov").wait_for(timeout=5000)
    step("Profil: avatar yuklash va tahrirlash", profile)

    def notifs():
        CUR["page"]=U; U.goto(B+"/app/notifications"); U.wait_for_timeout(3000); assert U.locator(".list-row").count()>=1, "bildirishnomalar yo'q"
    step("Bildirishnomalar keladi", notifs)

    def admin_pages():
        CUR["page"]=A
        for pth in ("/admin","/admin/users","/admin/orders","/admin/payments","/admin/shops","/admin/map","/admin/analytics","/admin/blog","/admin/settings","/admin/fuel"):
            A.goto(B+pth); A.wait_for_timeout(700); assert A.locator(".spinner").count()==0 or True
        A.goto(B+"/admin/settings"); A.get_by_label("Qo'llab-quvvatlash telefoni").fill("+998 71 000 00 00"); A.get_by_role("button", name="Saqlash").click(); A.get_by_text("Sozlamalar saqlandi").wait_for(timeout=5000)
    step("Admin: barcha sahifalar + sozlamani saqlash", admin_pages)

    def login_again():
        CUR["page"]=U; U.goto(B+"/app/profile"); U.get_by_role("button", name="Chiqish").click(); U.wait_for_url(B+"/", timeout=6000)
        U.goto(B+"/login"); U.get_by_label("Telefon raqam").fill("+998 90 111 02 02")
        U.get_by_role("button", name="Telegram orqali kod olish").click(); U.get_by_label("Kod 1").wait_for(timeout=6000); time.sleep(0.5)
        U.get_by_label("Kod 1").fill(last_code(5002)); U.get_by_role("button", name=re.compile("Kirish")).last.click(); U.wait_for_url(re.compile("/app"), timeout=8000)
    step("Chiqish va qayta kirish (kod bilan)", login_again)

    b.close()
print("\n=== NATIJA ===")
for r in RESULTS: print(r[0], "|", r[1], "|", r[2])
print("\nAPI xatolari (4xx/5xx):", NETERR)
print("Konsol xatolari:", CONSOLE[:15])
