"""Servis ochish (tur, qulayliklar, servis rasmlari, xizmat tavsifi) va ishdan keyin baho (mezonlar, teglar, usta javobi)."""
import json, os
from playwright.sync_api import sync_playwright
S = os.environ.get("SERVIS_DIR", "/tmp/avtora-servis-test")
B = "http://localhost:8810"; IDS = json.load(open(S + "/ids.json")); R = []
def check(n, ok, info=""): R.append(ok); print(("OK  " if ok else "FAIL"), n, info, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"], executable_path=os.getenv("CHROMIUM_PATH") or None); errs = []
    def ctx(who, w=390, h=844):
        c = b.new_context(viewport={"width": w, "height": h}, is_mobile=w < 600, has_touch=w < 600)
        a, r = IDS[who]
        c.add_init_script(f"localStorage.setItem('ah_access','{a}');localStorage.setItem('ah_refresh','{r}');localStorage.setItem('ah_intro_off','1');localStorage.setItem('ah_push_prompt_hidden_at','9999999999999');localStorage.setItem('ah_install_dismissed_at','9999999999999')")
        pg = c.new_page(); pg.set_default_timeout(10000); pg.on("pageerror", lambda e: errs.append(str(e)[:200])); pg.on("dialog", lambda d: d.accept())
        return c, pg
    uc, U = ctx("usta")
    # ---- usta: servis ochish
    U.goto(B + "/app/usta/services"); U.get_by_text("Servisingizni oching").wait_for()
    pct0 = U.locator(".ready b.small").inner_text()
    U.get_by_role("radio", name="Avtoservis").click()
    U.get_by_label("Servis nomi").fill("Rustam Auto Service")
    U.get_by_label("Manzil").fill("Chilonzor, 9-kvartal")
    U.get_by_label("Ustalar soni").fill("5")
    U.locator("textarea.textarea").first.fill("Chevrolet va Kia motorlarini ta'mirlaymiz. Kompyuter diagnostika, moy almashtirish. Ishga 3 oy kafolat.")
    for a in ["Wi-Fi", "Ish uchun kafolat", "Kutish zali"]: U.get_by_role("button", name=a).click()
    U.get_by_role("button", name="Profilni saqlash").click(); U.get_by_text("Profil saqlandi").wait_for()
    U.locator(".card:not(.ready)", has_text="Servis rasmlari").locator("input[type=file]").set_input_files([S + "/p0.jpg", S + "/p1.jpg", S + "/p2.jpg"])
    U.get_by_text("Rasmlar yuklandi").wait_for(); U.wait_for_timeout(600)
    check("Servis rasmlari yuklandi (3/15)", "3/15" in U.locator(".card:not(.ready)", has_text="Servis rasmlari").locator("h3").inner_text())
    for i, (n, pr) in enumerate([("Motor kapital ta'mir", "3000000"), ("Kompyuter diagnostika", "120000"), ("Moy almashtirish", "80000")]):
        U.get_by_role("button", name="Qo'shish").click()
        U.locator(".modal").get_by_label("Nomi").fill(n); U.locator(".modal").get_by_label("Narx (so'm)").fill(pr)
        if i == 0:
            U.locator(".modal").get_by_label("Nimalar kiradi (ixtiyoriy)").fill("Porshen, halqa, vkladish almashtirish. Kafolat 6 oy.")
            U.locator(".modal").get_by_text("Narx «...dan»").click()
            U.locator(".modal input[type=file]").set_input_files(S + "/p3.jpg")
        U.locator(".modal").get_by_role("button", name="Saqlash").click(); U.locator(".modal").wait_for(state="detached")
    U.locator(".card:not(.ready)", has_text="Ishlardan namunalar").locator("input[type=file]").set_input_files(S + "/p3.jpg"); U.get_by_text("Rasmlar yuklandi").first.wait_for(); U.wait_for_timeout(800)
    pct = U.locator(".ready b.small").inner_text()
    check("Tayyorlik foizi oshdi → 100%", pct == "100%", f"{pct0} → {pct}")
    U.screenshot(path=S + "/usta-servis.png", full_page=True)
    # ---- mijoz: ish tugagan — ilova o'zi baho so'raydi
    cc, C = ctx("client")
    C.goto(B + "/app"); C.get_by_text("Ishni baholang").wait_for()
    check("Ish tugagach ilova o'zi «Ishni baholang» deb so'raydi", C.locator(".rate-head").inner_text().find("Rustam Auto Service") >= 0)
    C.screenshot(path=S + "/rate-empty.png")
    C.get_by_role("radio", name="Umumiy baho: 5").click()
    check("Yulduz tanlanganda so'z: «A'lo!»", C.locator(".rate-word").inner_text() == "A'lo!")
    for k in ["Ish sifati", "Narx", "Vaqtida", "Muomala"]: C.get_by_role("radio", name=f"{k}: {5 if k != 'Narx' else 4}").click()
    for t in ["Sifatli ish", "Halol narx"]: C.locator(".modal").get_by_role("button", name=t).click()
    C.locator(".modal textarea").fill("Juda tez va sifatli ishladi, rahmat!")
    C.screenshot(path=S + "/rate-filled.png")
    C.get_by_role("button", name="Bahoni yuborish").click(); C.get_by_text("Bahoingiz qabul qilindi").wait_for()
    # ikkinchi ish: «Keyinroq» — qayta so'ramaydi
    C.reload(); C.get_by_text("Ishni baholang").wait_for()
    check("Keyingi baholanmagan ish ham so'raladi", "Moy almashtirish" in C.locator(".rate-head").inner_text())
    C.keyboard.press("Escape"); C.wait_for_timeout(300); C.reload(); C.wait_for_timeout(3000)
    check("«Keyinroq» (yopish) — qayta chiqmaydi", C.get_by_text("Ishni baholang").count() == 0)
    # bildirishnomadagi havola — buyurtmalarda baho oynasi o'zi ochiladi
    C.goto(B + f"/app/orders?review=booking-{IDS['b2']}"); C.get_by_text("Ishni baholang").wait_for()
    check("«?review=» havolasi baho oynasini ochadi", "Moy almashtirish" in C.locator(".rate-head").inner_text())
    C.keyboard.press("Escape")
    # ---- mijoz: servis sahifasi
    C.goto(B + "/app/masters"); C.get_by_role("button", name="Avtoservislar").click(); C.wait_for_timeout(800)
    check("«Avtoservislar» filtri va belgisi", C.locator(".master-card").count() == 1 and C.locator(".master-card .badge.blue").inner_text() == "Avtoservis")
    C.goto(B + f"/app/masters/{IDS['master']}"); C.locator(".place-track img").first.wait_for(); C.wait_for_timeout(800)
    check("Servis rasmlari galereyasi (3 ta, 1/3)", C.locator(".place-track img").count() == 3 and C.locator(".place-count").inner_text() == "1 / 3")
    check("Qulayliklar ko'rinadi", all(C.locator(".amen", has_text=t).count() == 1 for t in ["Wi-Fi", "Ish uchun kafolat", "Kutish zali"]))
    check("Avtoservis belgisi va ustalar soni", C.get_by_text("5 ta usta").count() == 1 and C.locator(".card .badge.blue", has_text="Avtoservis").count() == 1)
    svc = C.locator(".svc-line", has_text="Motor kapital")
    check("Xizmat: rasm, tavsif, «dan»", svc.locator(".svc-img img").count() == 1 and "Porshen" in svc.inner_text() and "dan" in svc.locator(".price").inner_text())
    check("Reyting statistikasi: 5★ — 1, Narx 4.0, teglar", C.locator(".rs-main b").first.inner_text() == "5.0" and "4.0" in C.locator(".rs-crit").inner_text() and C.locator(".rs-tags .tag-pill", has_text="Halol narx").count() == 1)
    C.locator(".place-track").evaluate("e => e.scrollTo({left: e.clientWidth})"); C.wait_for_timeout(500)
    check("Galereya suriladi (2/3)", C.locator(".place-count").inner_text() == "2 / 3")
    C.locator(".place-track").evaluate("e => e.scrollTo({left: 0})"); C.wait_for_timeout(400)
    C.screenshot(path=S + "/servis-page.png", full_page=True)
    # ---- usta javob yozadi
    U.goto(B + f"/app/masters/{IDS['master']}#reviews"); U.get_by_role("button", name="Javob yozish").click()
    U.locator("#reviews textarea").fill("Rahmat, Ali aka! Yana kutib qolamiz."); U.get_by_role("button", name="Saqlash").click(); U.get_by_text("Javob joylandi").wait_for()
    C.reload(); C.locator(".rev-reply").wait_for()
    check("Mijoz ustaning javobini ko'radi", "Yana kutib qolamiz" in C.locator(".rev-reply").inner_text() and C.get_by_role("button", name="Javob yozish").count() == 0)
    check("Sahifa xatolari yo'q", not errs, str(errs[:3]))
    b.close()
print(f"=== NATIJA: {sum(R)} / {len(R)} ===")
