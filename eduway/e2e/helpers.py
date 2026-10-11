"""E2E yordamchilari: telefon raqam + soxta Telegram bot orqali kirish."""
import json
import re
import time
import urllib.request

TG = "http://127.0.0.1:8766"


def _tg(path, body=None):
    req = urllib.request.Request(TG + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"}, method="POST" if body is not None else "GET")
    return json.loads(urllib.request.urlopen(req, timeout=5).read() or b"null")


def last_code(after=0, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        msgs = _tg("/__messages")[after:]
        for m in reversed(msgs):
            found = re.search(r"<code>(\d{4})</code>", m.get("text", ""))
            if found:
                return found.group(1)
        time.sleep(0.3)
    raise AssertionError("Bot kod yubormadi")


def phone_login(page, base, phone9, name="Test", shot=None):
    """Kirish ekrani orqali to'liq oqim: raqam -> bot (start + kontakt) -> kod. Qaytaradi: True agar yangi akkaunt."""
    before = len(_tg("/__messages"))
    page.goto(base + "/welcome")
    page.get_by_label("Telefon raqam").fill(phone9)
    page.get_by_role("button", name="Davom etish").click()
    page.wait_for_selector("text=/Kodni Telegram'dan oling|Kod Telegram'ga yuborildi/")
    if page.get_by_text("Kodni Telegram'dan oling").count():
        href = page.get_by_role("link", name="Telegram botni ochish").get_attribute("href")
        token = href.split("start=")[1]
        chat_id = int(phone9[-7:])
        if shot:
            shot(page)
        _tg("/__push", {"message": {"chat": {"id": chat_id, "type": "private"}, "from": {"id": chat_id, "first_name": name}, "text": f"/start {token}"}})
        _tg("/__push", {"message": {"chat": {"id": chat_id, "type": "private"}, "from": {"id": chat_id, "first_name": name},
                                    "contact": {"user_id": chat_id, "phone_number": "998" + phone9}}})
        page.wait_for_selector("text=Kod Telegram'ga yuborildi", timeout=15000)
    code = last_code(before)
    page.get_by_label("1-raqam").fill(code)
    page.wait_for_url(re.compile(r".*/(onboarding|home).*"), timeout=15000)
    return "/onboarding" in page.url
