from django.conf import settings

FEATURES = [
    # (nomi, bepul, premium)
    ("Shaxsiy profil va kasb tanlash testi", "✓", "✓"),
    ("Universitetlar va grantlar katalogi", "✓", "✓"),
    ("AI yordamchi (Tutor, English Coach, Career Advisor, Planner)", f"Kuniga {settings.AI_DAILY_LIMIT_FREE} ta so'rov", f"Kuniga {settings.AI_DAILY_LIMIT_PREMIUM} ta so'rov"),
    ("Faol o'quv maqsadlari", "1 ta, shablon reja", "5 ta + AI shaxsiy reja"),
    ("Ingliz tili darslari va testlar", "Asosiy", "Barchasi, kengaytirilgan IELTS"),
    ("AI IELTS Writing tekshiruvi (taxminiy ball)", "—", "✓"),
    ("AI test generatori", "—", "✓"),
    ("Ovozli Speaking mashqlari", "—", "✓"),
    ("Progress tahlili", "14 kunlik, asosiy", "90 kunlik, mavzular bo'yicha batafsil"),
    ("Lug'at", "150 ta so'z", "Cheksiz"),
]


def plans_payload(user):
    return {
        "price_uzs": settings.PREMIUM_PRICE_UZS,
        "payment_configured": bool(settings.PREMIUM_PAYMENT_INSTRUCTIONS),
        "payment_instructions": settings.PREMIUM_PAYMENT_INSTRUCTIONS,
        "online_payment": False,
        "features": [{"name": n, "free": f, "premium": p} for n, f, p in FEATURES],
        "current": {"plan": user.plan, "premium_until": user.premium_until},
    }
