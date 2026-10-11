"""Grantlar uchun taxminiy moslik tekshiruvi. Natija — yo'l-yo'riq, rasmiy qaror emas."""
from django.utils import timezone

STAGE_LEVELS = {
    "school": {"bachelor"},
    "lyceum": {"bachelor"},
    "university": {"master", "bachelor"},
    "graduate": {"master", "phd"},
}

INTEREST_FIELDS = {
    "texnologiya": "it", "dasturlash": "it", "tibbiyot": "medicine", "biznes": "business", "moliya": "business",
    "dizayn": "arts", "san'at": "arts", "fan va tadqiqot": "science", "muhandislik": "engineering",
    "ta'lim": "education", "huquq": "law", "media": "media", "ekologiya": "science", "psixologiya": "social",
    "til o'rganish": "languages", "sport": "education",
}


def grant_match(grant, user):
    checks = []
    score = 0
    total = 0

    def add(ok, label, detail):
        nonlocal score, total
        checks.append({"ok": ok, "label": label, "detail": detail})
        if ok is not None:
            total += 1
            score += 1 if ok else 0

    levels = set(grant.levels or [])
    if user.education_stage:
        wanted = STAGE_LEVELS.get(user.education_stage, set())
        ok = "any" in levels or bool(levels & wanted)
        add(ok, "Ta'lim bosqichi", "Bosqichingizga mos" if ok else "Bu grant boshqa ta'lim bosqichi uchun")
    else:
        add(None, "Ta'lim bosqichi", "Profilda ta'lim bosqichingizni kiriting")

    if grant.ielts_min:
        if user.ielts_score is None:
            add(None, "Til sertifikati", f"IELTS {grant.ielts_min} yoki ekvivalenti talab qilinishi mumkin — natijangizni profilga kiriting")
        else:
            ok = user.ielts_score >= grant.ielts_min
            add(ok, "Til sertifikati", f"Sizda {user.ielts_score}, talab: {grant.ielts_min}" + ("" if ok else " — tayyorgarlik kerak"))
    elif grant.language_note:
        add(None, "Til talabi", grant.language_note)

    if (grant.min_age or grant.max_age) and user.birth_year:
        age = timezone.localdate().year - user.birth_year
        ok = (not grant.min_age or age >= grant.min_age) and (not grant.max_age or age <= grant.max_age)
        add(ok, "Yosh", f"Taxminiy yoshingiz {age}" + ("" if ok else " — yosh chegarasiga to'g'ri kelmaydi"))

    if grant.fields:
        user_fields = {INTEREST_FIELDS.get(i) for i in user.interests or []} - {None}
        if user_fields:
            ok = bool(user_fields & set(grant.fields))
            add(ok, "Yo'nalish", "Qiziqishlaringizga mos yo'nalishlar bor" if ok else "Yo'nalishlar qiziqishlaringizdan farq qiladi")

    if grant.deadline:
        ok = grant.deadline >= timezone.localdate()
        add(ok, "Muddat", f"Muddat: {grant.deadline:%d.%m.%Y}" if ok else "Ko'rsatilgan muddat o'tgan — keyingi qabulni rasmiy saytdan tekshiring")

    if total == 0:
        level = "unknown"
    elif score == total:
        level = "good"
    elif score >= total / 2:
        level = "partial"
    else:
        level = "low"
    return {"level": level, "score": score, "total": total, "checks": checks}
