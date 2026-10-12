"""Speaking partner: ikki foydalanuvchi (soxta mikrofon bilan) WebRTC orqali ulanadi, suhbat, baho, shikoyat.
Server va fake_telegram ishlab turgan bo'lishi kerak:  python e2e/speaking.py [--shots DIR]"""
import argparse
import os
import random

from playwright.sync_api import expect, sync_playwright

from helpers import phone_login

BASE = os.getenv("EDUWAY_URL", "http://127.0.0.1:8000")
ap = argparse.ArgumentParser()
ap.add_argument("--shots", default="e2e/shots")
args = ap.parse_args()
os.makedirs(args.shots, exist_ok=True)
errors = []


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f"{args.shots}/{name}.png")


def user(browser, name, year, prefix):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, permissions=["microphone"])
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
    p.set_default_timeout(20000)
    phone_login(p, BASE, f"{prefix}{random.randint(1000000, 9999999)}", name)
    p.goto(BASE + "/english/partner")
    p.get_by_placeholder("Masalan: 2008").fill(str(year))
    if name == "Aziz":
        shot(p, "s1-birth-year")
    p.get_by_role("button", name="Saqlash").click()
    expect(p.get_by_text("Suhbat qoidalari")).to_be_visible()
    if name == "Aziz":
        shot(p, "s2-rules")
    p.get_by_role("checkbox").check()
    p.get_by_role("button", name="Davom etish").click()
    expect(p.get_by_role("button", name="Sherik topish")).to_be_visible()
    return p


with sync_playwright() as pw:
    exe = "/opt/pw-browsers/chromium"
    b = pw.chromium.launch(executable_path=exe if os.path.isfile(exe) else None,
                           args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"])

    # 16 yoshdan kichik — jonli suhbat yopiq, AI taklif qilinadi
    kid = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    phone_login(kid, BASE, f"97{random.randint(1000000, 9999999)}", "Kichik")
    kid.goto(BASE + "/english/partner")
    kid.get_by_placeholder("Masalan: 2008").fill("2013")
    kid.get_by_role("button", name="Saqlash").click()
    expect(kid.get_by_text("16 yoshdan boshlab")).to_be_visible()
    expect(kid.get_by_role("link", name="AI Speaking bilan mashq")).to_be_visible()

    a = user(b, "Aziz", 2002, "90")
    c = user(b, "Bekzod", 2000, "91")
    shot(a, "s3-lobby")
    a.get_by_role("button", name="Sherik topish").click()
    expect(a.get_by_text("Sherik qidirilmoqda")).to_be_visible()
    shot(a, "s4-searching")
    c.get_by_role("button", name="Sherik topish").click()

    # WebRTC ulanishi o'rnatiladi — taymer ko'rinadi (00:0x)
    for p in (a, c):
        expect(p.get_by_text("Mavzu")).to_be_visible()
        expect(p.locator("p.font-mono")).to_have_text(__import__("re").compile(r"\d\d:\d\d"), timeout=30000)
    expect(a.get_by_text("Bekzod").first).to_be_visible()
    expect(c.get_by_text("Aziz").first).to_be_visible()
    expect(a.get_by_text("Siz boshlaysiz")).to_be_visible()
    # sherik ovozi haqiqatan kelayapti
    a.wait_for_function("() => { const el = document.querySelector('audio'); return el && el.srcObject && el.srcObject.getAudioTracks().length > 0 }")
    a.wait_for_timeout(1500)
    shot(a, "s5-call")
    a.get_by_role("button", name="Part 2").click()
    shot(a, "s6-call-part2")

    # Bekzod tugatadi — Aziz'da ham suhbat tugaydi
    c.get_by_role("button", name="Tugatish").click()
    expect(c.get_by_text("Suhbat tugadi").first).to_be_visible()
    expect(a.get_by_text("Suhbat tugadi").first).to_be_visible(timeout=10000)
    a.get_by_role("button", name="5 yulduz").click()
    expect(a.get_by_text("Bahoyingiz saqlandi")).to_be_visible()
    shot(a, "s7-ended")

    # Shikoyat: qayta juftlashib, shikoyat qilinadi — keyin bular boshqa juftlashmaydi
    a.get_by_role("button", name="Yana sherik topish").click()
    c.get_by_role("button", name="Yana sherik topish").click()
    a.get_by_role("button", name="Sherik topish").click()
    expect(a.get_by_text("Sherik qidirilmoqda")).to_be_visible()
    c.get_by_role("button", name="Sherik topish").click()
    expect(a.get_by_text("Mavzu")).to_be_visible()
    a.get_by_role("button", name="Shikoyat").click()
    shot(a, "s8-report")
    a.get_by_role("button", name="Shaxsiy ma'lumot / kontakt so'radi").click()
    expect(a.get_by_text("Shikoyat yuborildi")).to_be_visible()
    expect(c.get_by_text("Suhbat tugadi").first).to_be_visible(timeout=10000)
    a.get_by_role("button", name="Yana sherik topish").click()
    c.get_by_role("button", name="Yana sherik topish").click()
    a.get_by_role("button", name="Sherik topish").click()
    c.get_by_role("button", name="Sherik topish").click()
    a.wait_for_timeout(4000)
    expect(a.get_by_text("Sherik qidirilmoqda")).to_be_visible()
    expect(c.get_by_text("Sherik qidirilmoqda")).to_be_visible()
    c.get_by_role("button", name="Bekor qilish").click()
    a.get_by_role("button", name="Bekor qilish").click()
    expect(a.get_by_role("button", name="Sherik topish")).to_be_visible()

    # Admin shikoyatni ko'radi
    ad = b.new_context(viewport={"width": 1280, "height": 800}).new_page()
    ad.goto(BASE + "/admin-login?next=/admin")
    ad.get_by_label("Email").fill("admin@eduway.uz")
    ad.locator("input[type=password]").fill(os.getenv("ADMIN_PASSWORD", "Admin-parol-2026"))
    ad.get_by_role("button", name="Kirish").click()
    expect(ad.get_by_text("Umumiy holat").first).to_be_visible()
    expect(ad.get_by_text("ko'rib chiqilmagan Speaking shikoyati")).to_be_visible()
    ad.get_by_role("link", name="Speaking shikoyatlari").first.click()
    expect(ad.get_by_text("Shaxsiy ma'lumot / kontakt so'radi").first).to_be_visible()
    shot(ad, "s9-admin")
    b.close()

real = [e for e in errors if "ResizeObserver" not in e]
assert not real, real
print("OK — Speaking partner ishlaydi")
