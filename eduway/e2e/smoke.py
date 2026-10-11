"""EduWay AI — brauzerdagi to'liq oqim sinovi (Playwright).
Ishga tushirish: server http://127.0.0.1:8000 da ishlab turgan bo'lishi kerak.
    python e2e/smoke.py [--shots DIR] [--desktop]
"""
import argparse
import os
import random
import sys

from playwright.sync_api import expect, sync_playwright

BASE = os.getenv("EDUWAY_URL", "http://127.0.0.1:8000")
p = argparse.ArgumentParser()
p.add_argument("--shots", default="e2e/shots")
p.add_argument("--desktop", action="store_true")
args = p.parse_args()
os.makedirs(args.shots, exist_ok=True)
errors = []


def shot(page, name):
    page.screenshot(path=f"{args.shots}/{name}.png", full_page=False)


with sync_playwright() as pw:
    exe = "/opt/pw-browsers/chromium" if os.path.exists("/opt/pw-browsers/chromium") else None
    browser = pw.chromium.launch(executable_path=exe if exe and os.path.isfile(exe) else None)
    vp = {"width": 1366, "height": 860} if args.desktop else {"width": 390, "height": 844}
    ctx = browser.new_context(viewport=vp, device_scale_factor=2 if not args.desktop else 1, locale="uz-UZ")
    page = ctx.new_page()
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_default_timeout(15000)

    email = f"test{random.randint(1000, 99999)}@example.com"
    page.goto(BASE + "/")
    page.wait_for_timeout(400)
    shot(page, "01-splash")
    page.wait_for_url("**/welcome")
    shot(page, "02-welcome")
    expect(page.get_by_text("EduWay AI nima qiladi?")).to_be_visible()
    page.get_by_role("link", name="Bepul boshlash").first.click()
    page.get_by_label("Ism").fill("Malika")
    page.get_by_label("Familiya").fill("Karimova")
    page.get_by_label("Email").fill(email)
    page.locator("input[autocomplete=new-password]").fill("Xavfsiz-parol-2026")
    page.get_by_role("checkbox").check()
    shot(page, "03-register")
    page.get_by_role("button", name="Akkaunt yaratish").click()
    page.wait_for_url("**/onboarding")
    page.get_by_role("button", name="Maktab").click()
    page.get_by_role("button", name="10", exact=True).click()
    shot(page, "04-onboarding")
    page.get_by_role("button", name="Davom etish").click()
    page.get_by_role("button", name="dasturlash").click()
    page.get_by_role("button", name="texnologiya").click()
    page.get_by_role("button", name="Davom etish").click()
    page.get_by_role("button", name="matematika").click()
    page.get_by_role("button", name="informatika").click()
    page.get_by_role("button", name="Davom etish").click()
    page.locator("textarea").fill("IELTS 7.0 olib, Koreyada kompyuter injiniringi bo'yicha o'qimoqchiman")
    page.get_by_role("button", name="B1 — o'rta").click()
    page.get_by_role("button", name="Janubiy Koreya").click()
    page.get_by_role("button", name="Tayyor").click()
    page.wait_for_url("**/home")
    expect(page.get_by_text("Malika 👋")).to_be_visible()
    shot(page, "05-home-empty")

    # Kasb testi
    page.goto(BASE + "/career/test")
    for i in range(18):
        page.get_by_role("button", name="Juda ham" if i % 6 == 1 else "Bilmadim").click()
        page.wait_for_timeout(260)
    for _ in range(3):
        page.locator("main button.w-full").first.click()
        page.wait_for_timeout(260)
    page.get_by_role("button", name="Ilmiy kashfiyot").click()
    shot(page, "06-career-test")
    page.get_by_role("button", name="Natijani ko'rish").click()
    page.wait_for_url("**/career/result/**")
    expect(page.get_by_text("Sizga mos kelishi mumkin")).to_be_visible()
    page.wait_for_timeout(600)
    shot(page, "07-career-result")
    page.locator("a[href^='/career/']").filter(has_text="%").first.click()
    page.wait_for_timeout(300)
    shot(page, "08-career-detail")

    # Universitetlar
    page.goto(BASE + "/universities")
    expect(page.get_by_text("Toshkent axborot texnologiyalari").first).to_be_visible()
    shot(page, "09-universities")
    page.get_by_label("Sevimlilarga qo'shish").first.click()
    page.get_by_label("Filtrlar").click()
    page.get_by_role("button", name="IT va kompyuter fanlari").click()
    shot(page, "10-uni-filters")
    page.get_by_role("button", name="Ko'rsatish").click()
    page.locator("main a[href^='/universities/']").first.click()
    expect(page.get_by_text("Tekshirilmagan").first).to_be_visible()
    shot(page, "11-uni-detail")

    # Grantlar
    page.goto(BASE + "/grants")
    expect(page.get_by_text("Global Korea Scholarship")).to_be_visible()
    shot(page, "12-grants")
    page.get_by_text("Global Korea Scholarship").click()
    page.get_by_role("button", name="Grantlarimga qo'shish + checklist").click()
    expect(page.get_by_text("Hujjatlar checklisti")).to_be_visible()
    page.get_by_label("Belgilash", exact=True).first.click()
    shot(page, "13-grant-detail")

    # Reja
    page.goto(BASE + "/plan")
    page.get_by_role("button", name="Maqsad qo'shish").click()
    page.get_by_role("button", name="IELTS", exact=True).click()
    page.get_by_role("button", name="Saqlash va reja tuzish").click()
    expect(page.get_by_text("IELTS 7.0 olish").first).to_be_visible()
    page.wait_for_timeout(400)
    shot(page, "14-plan")
    page.get_by_label("Belgilash", exact=True).first.click()
    expect(page.get_by_text("Bajarildi! +10 XP")).to_be_visible()

    # Test
    page.goto(BASE + "/practice?subject=math")
    page.get_by_text("Foizlar va nisbatlar").click()
    page.wait_for_url("**/practice/quiz/**")
    shot(page, "15-quiz")
    for i in range(6):
        page.locator("main button.w-full.rounded-2xl").first.click()
        if i < 5:
            page.get_by_role("button", name="Keyingi").click()
    page.get_by_role("button", name="Yakunlash").click()
    expect(page.get_by_text("Javoblar tahlili")).to_be_visible()
    page.wait_for_timeout(600)
    shot(page, "16-quiz-result")

    # Ingliz tili
    page.goto(BASE + "/english")
    expect(page.get_by_text("Ko'nikmalar")).to_be_visible()
    shot(page, "17-english")
    page.goto(BASE + "/english/vocab")
    page.get_by_role("button", name="So'z").click()
    page.get_by_label("So'z yoki ibora").fill("scholarship")
    page.get_by_label("Tarjimasi").fill("stipendiya")
    page.get_by_role("button", name="Saqlash").click()
    page.goto(BASE + "/english/vocab/review")
    page.get_by_label("Kartani aylantirish").click()
    shot(page, "18-vocab-review")
    page.get_by_role("button", name="Yaxshi").click()
    expect(page.get_by_text("Barakalla!")).to_be_visible()

    # AI (kalitsiz — «ulanmagan» holati ko'rsatilishi kerak)
    page.goto(BASE + "/ai")
    expect(page.get_by_text("AI xizmati hali ulanmagan")).to_be_visible()
    shot(page, "19-ai")
    page.goto(BASE + "/english/writing")
    shot(page, "20-writing")
    page.goto(BASE + "/premium")
    expect(page.get_by_text("Onlayn to'lov tizimi")).to_be_visible()
    shot(page, "21-premium")

    page.goto(BASE + "/home")
    expect(page.get_by_text("Bugungi reja")).to_be_visible()
    page.wait_for_timeout(500)
    shot(page, "22-home")
    page.goto(BASE + "/progress")
    page.wait_for_timeout(800)
    shot(page, "23-progress")
    page.goto(BASE + "/settings")
    page.get_by_role("button", name="Qorong'i").click()
    page.goto(BASE + "/home")
    page.wait_for_timeout(500)
    shot(page, "24-home-dark")

    # Oddiy foydalanuvchi admin API'ga kira olmaydi
    page.goto(BASE + "/admin")
    page.wait_for_url("**/home")

    # Admin
    ctx2 = browser.new_context(viewport=vp)
    a = ctx2.new_page()
    a.on("pageerror", lambda e: errors.append(str(e)))
    a.goto(BASE + "/login?next=/admin")
    a.get_by_label("Email").fill("admin@eduway.uz")
    a.locator("input[type=password]").fill(os.getenv("ADMIN_PASSWORD", "Admin-parol-2026"))
    a.get_by_role("button", name="Kirish").click()
    a.wait_for_url("**/admin")
    expect(a.get_by_text("Umumiy holat").first).to_be_visible()
    a.wait_for_timeout(400)
    shot(a, "25-admin")
    a.get_by_role("link", name="Universitetlar").click()
    expect(a.get_by_text("Samarqand davlat universiteti")).to_be_visible()
    shot(a, "26-admin-unis")
    a.get_by_role("link", name="Foydalanuvchilar").click()
    expect(a.get_by_text(email)).to_be_visible()
    a.locator("tr", has_text=email).get_by_role("button", name="+30 kun").click()
    a.wait_for_timeout(500)
    shot(a, "27-admin-users")

    # Endi foydalanuvchi premium — Writing qulfi ochilgan bo'lishi kerak
    page.reload()
    page.goto(BASE + "/english/writing")
    expect(page.get_by_text("Premium imkoniyat")).to_have_count(0)

    browser.close()

real_errors = [e for e in errors if "Failed to load resource" not in e]
if real_errors:
    print("KONSOL XATOLARI:\n" + "\n".join(real_errors))
    sys.exit(1)
print("OK — barcha qadamlar muvaffaqiyatli")
