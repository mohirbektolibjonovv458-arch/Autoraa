import json, re
from playwright.sync_api import sync_playwright
import os
S=os.environ.get("CHAT_DIR", "/tmp/avtora-chat-test")
B="http://localhost:8600"; IDS=json.load(open(S+"/ids.json")); R=[]
def check(n, ok, info=""): R.append(ok); print(("OK  " if ok else "FAIL"), n, info, flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox","--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--autoplay-policy=no-user-gesture-required"], executable_path=os.getenv("CHROMIUM_PATH") or None)
    errs=[]
    def ctx(who, w=390, h=844):
        c=b.new_context(viewport={"width":w,"height":h}, is_mobile=w<600, has_touch=w<600, permissions=["microphone"])
        a,r=IDS[who]; c.add_init_script(f"localStorage.setItem('ah_access','{a}');localStorage.setItem('ah_refresh','{r}');localStorage.setItem('ah_intro_off','1');localStorage.setItem('ah_push_prompt_hidden_at','{9e12}')")
        pg=c.new_page(); pg.set_default_timeout(10000)
        pg.on("pageerror", lambda e: errs.append("PAGEERROR "+str(e)[:200]))
        pg.on("console", lambda m: m.type=="error" and ("Content Security Policy" in m.text or "Refused" in m.text or "Permissions policy" in m.text) and errs.append(m.text[:200]))
        return c, pg
    cc, C = ctx("client"); uc, U = ctx("usta")
    C.goto(B+"/app"); cid = C.evaluate(f"async()=>(await (await fetch('/api/chat/start/',{{method:'POST',headers:{{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('ah_access')}},body:JSON.stringify({{user_id:{IDS['usta_id']}}})}})).json()).id")
    C.goto(B+f"/app/chat/{cid}"); U.goto(B+f"/app/chat/{cid}")
    C.get_by_placeholder("Xabar yozing…").fill("Salom usta, mashinam ishlamayapti"); C.keyboard.press("Enter")
    U.locator(".bubble", has_text="Salom usta").wait_for()
    check("Matnli xabar ustaga yetdi", True)
    # ✓✓ o'qildi
    C.locator(".bubble.me .tick.read").first.wait_for(timeout=10000)
    check("Yuboruvchida ✓✓ (o'qildi) belgisi", True)
    # tahrirlash
    C.locator(".bubble.me", has_text="Salom usta").click(); C.get_by_role("button", name="Tahrirlash").click()
    check("Tahrirlash rejimi (panel + matn inputda)", C.get_by_text("Tahrirlanmoqda").is_visible() and "Salom usta" in C.locator(".chat-input input").input_value())
    C.locator(".chat-input input").fill("Salom usta, mashinam o't olmayapti"); C.keyboard.press("Enter")
    U.locator(".bubble", has_text="o't olmayapti").wait_for(timeout=10000)
    check("Tahrir ustada ham yangilandi + «tahrirlangan»", U.locator(".bubble", has_text="o't olmayapti").locator(".edited").count()==1 and U.locator(".bubble", has_text="mashinam ishlamayapti").count()==0)
    # ovozli xabar
    C.get_by_role("button", name="Ovozli xabar yozish").click()
    C.locator(".rec-bar").wait_for(); C.wait_for_timeout(2600)
    check("Yozish paneli va taymer", re.search(r"0:0[2-3]", C.locator(".rec-bar").inner_text()) is not None, C.locator(".rec-bar b").inner_text())
    C.get_by_role("button", name="Ovozli xabarni yuborish").click()
    C.locator(".bubble.me .voice").wait_for(); U.locator(".bubble .voice").wait_for(timeout=10000)
    check("Ovozli xabar yuborildi va ustaga yetdi", True, U.locator(".bubble .voice .voice-time").inner_text())
    U.locator(".bubble .voice-btn").click(); U.wait_for_timeout(1500)
    st = U.evaluate("()=>document.querySelector('.bubble .voice-btn').getAttribute('aria-label')")
    check("Usta ovozli xabarni tinglay oladi (pleyer ishladi)", st in ("Pauza","Tinglash") and U.locator(".bubble .voice").inner_text().find("ochib bo'lmadi")<0, st)
    # bekor qilish
    C.get_by_role("button", name="Ovozli xabar yozish").click(); C.locator(".rec-bar").wait_for(); C.wait_for_timeout(800)
    C.get_by_role("button", name="Bekor qilish").click(); C.wait_for_timeout(800)
    check("Yozishni bekor qilish — hech narsa yuborilmadi", C.locator(".bubble.me .voice").count()==1)
    # o'chirish
    C.on("dialog", lambda d: d.accept())
    C.locator(".bubble.me", has_text="o't olmayapti").click(); C.get_by_role("button", name="O'chirish").click()
    U.locator(".bubble.deleted").wait_for(timeout=10000)
    check("O'chirish: ikkala tomonda «Xabar o'chirildi»", C.locator(".bubble.deleted").count()==1 and U.locator(".bubble", has_text="o't olmayapti").count()==0)
    # begona xabarda tahrirlash/o'chirish yo'q
    U.locator(".bubble:not(.me):not(.deleted)").first.click()
    check("Boshqaning xabarida «Tahrirlash/O'chirish» yo'q", U.get_by_role("button", name="Tahrirlash").count()==0 and U.get_by_role("button", name="O'chirish").count()==0)
    U.keyboard.press("Escape")
    C.screenshot(path=S+"/chat-mobile.png")
    cc.close(); uc.close()
    dc, D = ctx("client", 1280, 800); D.goto(B+f"/app/chat/{cid}"); D.locator(".bubble").first.wait_for(); D.wait_for_timeout(800); D.screenshot(path=S+"/chat-desktop.png"); dc.close()
    check("Sahifa / CSP / mikrofon ruxsati xatolari yo'q", not errs, str(errs[:3]))
    b.close()
print(f"=== NATIJA: {sum(R)} / {len(R)} ===")
