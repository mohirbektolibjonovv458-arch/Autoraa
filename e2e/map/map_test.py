"""Xarita sinovi: tungi uslub, belgilar, boshqaruv tugmalari, responsive. Plitalar — OSM ranglaridagi sinov plitalari (faketiles.py)."""
import json
from playwright.sync_api import sync_playwright
import os
S=os.environ.get("MAP_DIR", "/tmp/avtora-map-test")
B="http://localhost:8700"; IDS=json.load(open(S+"/ids.json")); R=[]
def check(n, ok, info=""): R.append(ok); print(("OK  " if ok else "FAIL"), n, info, flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"], executable_path=os.getenv("CHROMIUM_PATH") or None); errs=[]
    def ctx(who, w=390, h=844):
        c=b.new_context(viewport={"width":w,"height":h}, is_mobile=w<600, has_touch=w<600, geolocation={"latitude":41.3115,"longitude":69.2795,"accuracy":12}, permissions=["geolocation"])
        a,r=IDS[who]; c.add_init_script(f"localStorage.setItem('ah_access','{a}');localStorage.setItem('ah_refresh','{r}');localStorage.setItem('ah_intro_off','1');localStorage.setItem('ah_push_prompt_hidden_at','9999999999999');localStorage.setItem('ah_install_dismissed_at','9999999999999')")
        pg=c.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:200])); return c, pg
    for w,h in ((360,740),(390,844),(412,915)):
        c,pg=ctx("client",w,h); pg.goto(B+"/app/map"); pg.locator(".map-chip").wait_for(); pg.wait_for_timeout(1500)
        nav=pg.locator(".bottom-nav").bounding_box(); chip=pg.locator(".map-chip").bounding_box(); minus=pg.locator(".map-ctls .map-ctl").last.bounding_box()
        ok = chip["y"]+chip["height"] <= nav["y"] and minus["y"]+minus["height"] <= nav["y"]
        check(f"{w}x{h}: xarita tugmalari pastki menyu ustida", ok, f"chip_bottom={chip['y']+chip['height']:.0f} nav_top={nav['y']:.0f}")
        if w==390: pg.screenshot(path=S+"/map-mobile-final.png")
        c.close()
    # zoom va qatlam tugmalari ishlaydi
    c,pg=ctx("client"); pg.goto(B+"/app/map"); pg.locator(".map-ctls").wait_for(); pg.wait_for_timeout(1500)
    pg.get_by_role("button", name="Yaqinlashtirish").click(); pg.wait_for_timeout(600)
    pg.get_by_role("button", name="Xarita ko'rinishi").click(); pg.get_by_role("menuitemradio", name="Kunduzgi").click(); pg.wait_for_timeout(400)
    check("Qatlam: Kunduzgi tanlandi va eslab qolindi", pg.evaluate("localStorage.getItem('ah_map_layer')")=="std" and "night" not in pg.locator(".leaflet-container").get_attribute("class"))
    pg.get_by_role("button", name="Xarita ko'rinishi").click(); pg.get_by_role("menuitemradio", name="Tungi").click(); pg.wait_for_timeout(300)
    check("Qatlam: Tungi qaytdi", "night" in pg.locator(".leaflet-container").get_attribute("class"))
    pg.get_by_role("button", name="Hozirgi joy").click(); pg.wait_for_timeout(1500)
    check("«Hozirgi joy» ishlaydi (xatosiz)", pg.locator(".toast").count()==0)
    pg.locator(".mk-person").first.click(); pg.wait_for_timeout(500)
    check("Usta belgisini bosganda kartochka ochiladi", pg.get_by_role("link", name="Profil").count()>0)
    pg.get_by_role("link", name="Benzin, propan, metan zapravkalar").click(); pg.wait_for_url("**/app/fuel"); check("Zapravka tugmasi yoqilg'i xaritasini ochadi", True)
    c.close()
    # boshqa xaritalar: SOS, Safar sahifasi xatosiz ochiladi
    for path in ("/app/sos", "/app/fuel"):
        c,pg=ctx("client"); pg.goto(B+path); pg.locator(".leaflet-container").first.wait_for(); pg.wait_for_timeout(1500)
        check(f"{path}: yangi boshqaruv (Hozirgi joy, +/−)", pg.locator(".map-here").count()>=1 and pg.locator(".map-ctls").count()>=1)
        pg.screenshot(path=S+f"/{path.split('/')[-1]}-final.png"); c.close()
    check("Sahifa xatolari yo'q", not errs, str(errs[:3]))
    b.close()
print(f"=== NATIJA: {sum(R)} / {len(R)} ===")
