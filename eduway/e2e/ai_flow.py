"""AI oqimi sinovi: backend ANTHROPIC_API_KEY va ANTHROPIC_BASE_URL=fake_anthropic bilan ishga tushirilgan bo'lishi kerak."""
import os
import sys

from playwright.sync_api import expect, sync_playwright

BASE = os.getenv("EDUWAY_URL", "http://127.0.0.1:8001")
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "e2e/shots"
os.makedirs(SHOTS, exist_ok=True)
errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium" if os.path.isfile("/opt/pw-browsers/chromium") else None)
    page = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2).new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_default_timeout(20000)
    page.goto(BASE + "/admin-login?next=/ai")
    page.get_by_label("Email").fill("admin@eduway.uz")
    page.locator("input[type=password]").fill(os.getenv("ADMIN_PASSWORD", "Admin-parol-2026"))
    page.get_by_role("button", name="Kirish").click()
    page.wait_for_url("**/ai")
    expect(page.get_by_text("AI xizmati hali ulanmagan")).to_have_count(0)
    page.get_by_placeholder("Savolingizni yozing...").fill("x² − 5x + 6 = 0 ni yech")
    page.get_by_label("Yuborish").click()
    expect(page.get_by_role("heading", name="Yechim")).to_be_visible()
    expect(page.locator("table")).to_be_visible()
    page.get_by_label("Xato yoki foydasiz").click()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{SHOTS}/30-ai-chat.png")
    # davomiy suhbat — tarix yuboriladi
    page.get_by_placeholder("Savolingizni yozing...").fill("Tushunmadim, boshqacha tushuntir")
    page.get_by_label("Yuborish").click()
    expect(page.get_by_role("heading", name="Yechim")).to_have_count(2)
    page.goto(BASE + "/english/writing")
    page.locator("textarea").nth(1).fill(("Some peoples thinks that university education should be free. " * 12).strip())
    page.get_by_role("button", name="AI tahlilini olish").click()
    expect(page.get_by_text("Taxminiy band")).to_be_visible()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{SHOTS}/31-writing-result.png", full_page=True)
    page.goto(BASE + "/admin/moderation")
    expect(page.get_by_text("x² − 5x + 6 = 0 ni yech")).to_be_visible()
    b.close()
if errors:
    print("XATOLAR:", errors)
    sys.exit(1)
print("OK — AI oqimi ishlaydi")
