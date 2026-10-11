"""Yangi funksiyalar sinovi: PWA (service worker, manifest), qidiruv, kunlik challenge, fokus taymer, daraja testi.
Server ishlab turgan bo'lishi kerak:  python e2e/features.py [--shots DIR]"""
import argparse
import os
import random
import sys

from playwright.sync_api import expect, sync_playwright

BASE = os.getenv("EDUWAY_URL", "http://127.0.0.1:8000")
ap = argparse.ArgumentParser()
ap.add_argument("--shots", default="e2e/shots")
args = ap.parse_args()
os.makedirs(args.shots, exist_ok=True)
errors = []


def shot(page, name):
    page.wait_for_timeout(450)
    page.screenshot(path=f"{args.shots}/{name}.png")


with sync_playwright() as pw:
    exe = "/opt/pw-browsers/chromium"
    b = pw.chromium.launch(executable_path=exe if os.path.isfile(exe) else None)
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_default_timeout(15000)

    page.goto(BASE + "/welcome")
    expect(page.get_by_role("button", name="Yuklab olish", exact=True)).to_be_visible()
    # service worker ro'yxatdan o'tadi (o'rnatish uchun shart)
    page.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller !== undefined")
    ok = page.evaluate("navigator.serviceWorker.ready.then(r => !!r.active)")
    assert ok, "service worker faol emas"
    manifest = page.evaluate("fetch('/manifest.webmanifest').then(r => r.json())")
    assert any(i["sizes"] == "512x512" for i in manifest["icons"]), manifest
    page.get_by_role("button", name="Yuklab olish", exact=True).click()
    expect(page.get_by_role("dialog").get_by_text("Telefonga o'rnatish")).to_be_visible()
    shot(page, "40-install-guide")
    page.get_by_role("button", name="Tushunarli").click()

    email = f"f{random.randint(1000, 99999)}@example.com"
    page.goto(BASE + "/register")
    page.get_by_label("Ism").fill("Sardor")
    page.get_by_label("Email").fill(email)
    page.locator("input[autocomplete=new-password]").fill("Xavfsiz-parol-2026")
    page.get_by_role("checkbox").check()
    page.get_by_role("button", name="Akkaunt yaratish").click()
    page.wait_for_url("**/onboarding")
    page.goto(BASE + "/home")
    expect(page.get_by_text("Kunlik challenge").first).to_be_visible()
    expect(page.get_by_text("Eslatmalarni yoqing")).to_be_visible()
    shot(page, "41-home")

    # Qidiruv
    page.get_by_label("Qidirish").click()
    page.get_by_placeholder("Kasb, universitet, grant, dars yoki test...").fill("Toshkent")
    expect(page.get_by_text("Universitet ·").first).to_be_visible()
    shot(page, "42-search")
    page.keyboard.press("Enter")
    page.wait_for_url("**/universities/**")

    # Kunlik challenge
    page.goto(BASE + "/challenge")
    for i in range(5):
        page.locator("main button.rounded-2xl").first.click()
        page.wait_for_timeout(350)
    shot(page, "43-challenge")
    page.get_by_role("button", name="Yakunlash (5/5)").click()
    expect(page.get_by_text("XP").first).to_be_visible()
    shot(page, "44-challenge-done")

    # Fokus taymer
    page.goto(BASE + "/focus")
    page.get_by_role("button", name="15 daq").click()
    page.get_by_role("button", name="Boshlash").click()
    expect(page.get_by_role("button", name="To'xtatish")).to_be_visible()
    page.wait_for_timeout(1500)
    shot(page, "45-focus-running")
    page.get_by_role("button", name="To'xtatish").click()
    expect(page.get_by_role("button", name="Boshlash")).to_be_visible()

    # Daraja aniqlash
    page.goto(BASE + "/english/placement")
    page.get_by_role("button", name="Boshlash").click()
    for _ in range(25):
        page.get_by_role("button", name="Bilmayman — o'tkazib yuborish").click()
        page.wait_for_timeout(60)
    expect(page.get_by_text("Taxminiy darajangiz")).to_be_visible()
    shot(page, "46-placement")

    page.goto(BASE + "/settings")
    expect(page.get_by_text("Ilova va bildirishnomalar")).to_be_visible()
    shot(page, "47-settings")
    page.goto(BASE + "/learn")
    shot(page, "48-learn")
    b.close()

if errors:
    print("XATOLAR:", errors)
    sys.exit(1)
print("OK — yangi funksiyalar ishlaydi")
