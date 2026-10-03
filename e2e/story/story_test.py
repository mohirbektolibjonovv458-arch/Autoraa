"""Ustalar hikoyalari sinovi: joylash, ko'rish (progress, tap, orqaga), ko'rildi belgisi, tahrirlash, o'chirish."""
import json, os, re
from playwright.sync_api import sync_playwright
S=os.environ.get("STORY_DIR", "/tmp/avtora-story-test")
B="http://localhost:8800"; IDS=json.load(open(S+"/ids.json")); R=[]
def check(n, ok, info=""): R.append(ok); print(("OK  " if ok else "FAIL"), n, info, flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"], executable_path=os.getenv("CHROMIUM_PATH") or None); errs=[]
    def ctx(who, w=390, h=844):
        c=b.new_context(viewport={"width":w,"height":h}, is_mobile=w<600, has_touch=w<600)
        a,r=IDS[who]; c.add_init_script(f"localStorage.setItem('ah_access','{a}');localStorage.setItem('ah_refresh','{r}');localStorage.setItem('ah_intro_off','1');localStorage.setItem('ah_push_prompt_hidden_at','9999999999999');localStorage.setItem('ah_install_dismissed_at','9999999999999')")
        pg=c.new_page(); pg.set_default_timeout(10000); pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        pg.on("dialog", lambda d: d.accept()); return c, pg
    uc, U = ctx("usta"); cc, C = ctx("client")
    # mijoz: hikoya yo'q — qator ko'rinmaydi (joy egallamaydi)
    C.goto(B+"/app"); C.wait_for_timeout(2500)
    check("Hikoya yo'q bo'lsa mijozda qator ko'rinmaydi", C.locator(".stories").count()==0)
    # usta: joylash (2 ta)
    U.goto(B+"/app/usta"); U.get_by_role("button", name="Hikoya qo'shish").click()
    U.locator(".modal input[type=file]:not([capture])").set_input_files(S+"/story1.jpg")
    U.locator(".modal textarea").fill("Bugun motor diagnostikasi 20% chegirma"); U.get_by_role("button", name="Joylash").click()
    U.get_by_text("Hikoya joylandi").wait_for()
    U.get_by_role("button", name="Hikoya qo'shish").click(); U.locator(".modal input[type=file]:not([capture])").set_input_files(S+"/story2.jpg"); U.get_by_role("button", name="Joylash").click()
    U.locator(".story-tile", has_text="Sizning hikoyangiz").wait_for()
    check("Usta 2 ta hikoya joyladi, qatorda «Sizning hikoyangiz»", True)
    U.screenshot(path=S+"/usta-bar.png")
    # mijoz: rangli halqa → ko'rish
    C.reload(); C.locator(".story-tile", has_text="Rustam").wait_for()
    check("Mijozda rangli halqa (ko'rilmagan)", "seen" not in C.locator(".story-tile", has_text="Rustam").locator(".story-ring").get_attribute("class"))
    C.locator(".story-tile", has_text="Rustam").click(); C.locator(".story-viewer").wait_for()
    C.get_by_text("20% chegirma").wait_for()
    C.wait_for_timeout(1500); C.screenshot(path=S+"/viewer.png")
    w=C.evaluate("()=>document.querySelector('.sv-bars span i').style.width")
    check("Ko'rish oynasi: matn, progress chizig'i harakatda", w not in ("0%",""), w)
    C.locator(".sv-media").click(position={"x":330,"y":300}); C.wait_for_timeout(400)
    check("O'ngga bosish — keyingi hikoya", C.evaluate("()=>document.querySelectorAll('.sv-bars span i')[1].style.width")!="0%" and C.get_by_text("20% chegirma").count()==0)
    C.locator(".sv-media").click(position={"x":40,"y":300}); C.wait_for_timeout(400)
    check("Chapga bosish — oldingi hikoya", C.get_by_text("20% chegirma").count()==1)
    C.go_back(); C.wait_for_timeout(500)
    check("Telefonning «orqaga» tugmasi oynani yopadi, sahifada qoladi", C.locator(".story-viewer").count()==0 and C.url.endswith("/app"))
    C.wait_for_timeout(500)
    check("Ko'rilgandan keyin halqa kulrang", "seen" in (C.locator(".story-tile", has_text="Rustam").locator(".story-ring").get_attribute("class") or ""))
    # avtomatik o'tish va yopilish
    C.locator(".story-tile", has_text="Rustam").click(); C.locator(".story-viewer").wait_for(); C.wait_for_timeout(13500)
    check("Avtomatik o'tib, oxirida o'zi yopiladi", C.locator(".story-viewer").count()==0)
    # usta: ko'rishlar soni, tahrirlash
    U.reload(); U.locator(".story-tile", has_text="Sizning hikoyangiz").click(); U.locator(".story-viewer").wait_for()
    check("Usta ko'rishlar sonini ko'radi", U.locator(".sv-meta").first.inner_text().strip()=="1", U.locator(".sv-meta").first.inner_text())
    check("Qolgan vaqt ko'rsatiladi (~23 soat)", "soat qoldi" in U.locator(".sv-meta").nth(1).inner_text())
    U.get_by_role("button", name="Tahrirlash").click(); U.locator(".modal textarea").fill("Bugun motor diagnostikasi 30% chegirma!"); U.get_by_role("button", name="Saqlash").click()
    U.get_by_text("Hikoya yangilandi").wait_for()
    C.reload(); C.locator(".story-tile", has_text="Rustam").click(); C.get_by_text("30% chegirma!").wait_for()
    check("Tahrir mijozda ko'rinadi + «tahrirlangan»", "tahrirlangan" in C.locator(".sv-head").inner_text())
    C.keyboard.press("Escape")
    # o'chirish
    U.locator(".story-tile", has_text="Sizning hikoyangiz").click(); U.locator(".story-viewer").wait_for(); U.get_by_role("button", name="O'chirish").click()
    U.get_by_text("Hikoya o'chirildi").wait_for()
    U.locator(".story-tile", has_text="Sizning hikoyangiz").click(); U.locator(".story-viewer").wait_for(); U.get_by_role("button", name="O'chirish").click(); U.get_by_text("Hikoya o'chirildi").first.wait_for()
    U.wait_for_timeout(800)
    C.reload(); C.wait_for_timeout(2500)
    check("O'chirilgach mijozda hikoya yo'q", C.locator(".story-tile", has_text="Rustam").count()==0)
    # desktop ko'rinish
    dc, D = ctx("usta", 1280, 800); D.goto(B+"/app/usta"); D.locator(".stories").wait_for(); D.wait_for_timeout(600); D.screenshot(path=S+"/usta-desktop.png"); dc.close()
    check("Sahifa xatolari yo'q", not errs, str(errs[:3]))
    b.close()
print(f"=== NATIJA: {sum(R)} / {len(R)} ===")
