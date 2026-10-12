"""XP, streak, yutuqlar va bildirishnomalar — barcha modullar faollikni shu yerdan qayd qiladi."""
from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .levels import level_for
from .models import Achievement, ActivityDay, Notification

ACHIEVEMENTS = {
    "first_step": {"title": "Birinchi qadam", "desc": "Profilni to'ldirdingiz", "icon": "sparkles"},
    "career_explorer": {"title": "Kasb izlovchi", "desc": "Kasb tanlash testini topshirdingiz", "icon": "compass"},
    "first_quiz": {"title": "Birinchi test", "desc": "Birinchi testni yakunladingiz", "icon": "check"},
    "perfect_score": {"title": "Mukammal natija", "desc": "Testda 100% natija", "icon": "trophy"},
    "streak_3": {"title": "3 kunlik seriya", "desc": "3 kun ketma-ket o'qidingiz", "icon": "flame"},
    "streak_7": {"title": "Bir hafta to'xtovsiz", "desc": "7 kun ketma-ket o'qidingiz", "icon": "flame"},
    "streak_30": {"title": "Oylik intizom", "desc": "30 kun ketma-ket o'qidingiz", "icon": "crown"},
    "words_25": {"title": "So'z boyligi", "desc": "Lug'atingizda 25 ta so'z", "icon": "book"},
    "tasks_10": {"title": "Rejaga sodiq", "desc": "10 ta vazifani bajardingiz", "icon": "target"},
    "ai_curious": {"title": "Qiziquvchan", "desc": "AI yordamchiga 10 ta savol berdingiz", "icon": "bot"},
    "goal_setter": {"title": "Maqsad qo'ydingiz", "desc": "Birinchi o'quv maqsadini yaratdingiz", "icon": "flag"},
    "focus_60": {"title": "Bir soat diqqat", "desc": "Fokus taymerda jami 60 daqiqa", "icon": "timer"},
    "focus_600": {"title": "Chuqur ish ustasi", "desc": "Fokus taymerda jami 10 soat", "icon": "timer"},
    "challenge_1": {"title": "Kun savollari", "desc": "Birinchi kunlik challenge", "icon": "zap"},
    "challenge_7": {"title": "Challenge haftasi", "desc": "7 ta kunlik challenge bajarildi", "icon": "zap"},
    "english_placed": {"title": "Darajam aniq", "desc": "Ingliz tili darajasini aniqlash testi", "icon": "book"},
}

XP = {"task": 10, "quiz": 20, "lesson": 15, "word": 2, "ai": 1, "career_test": 30}


def today():
    return timezone.localdate()


def award(user, code):
    if code not in ACHIEVEMENTS:
        return False
    _, created = Achievement.objects.get_or_create(user=user, code=code)
    if created:
        a = ACHIEVEMENTS[code]
        Notification.objects.create(user=user, title=f"Yangi yutuq: {a['title']}", body=a["desc"], link="/progress", kind="achievement")
    return created


@transaction.atomic
def record(user, kind, amount=1, xp=None):
    """Faollikni qayd qiladi: kunlik hisoblagich, XP va streak."""
    field = {"task": "tasks_done", "quiz": "quizzes", "ai": "ai_messages", "word": "words_reviewed", "lesson": "lessons", "focus": "focus_minutes"}.get(kind)
    gained = XP.get(kind, 0) * amount if xp is None else xp
    d = today()
    day, _ = ActivityDay.objects.get_or_create(user=user, date=d)
    updates = {"xp": F("xp") + gained}
    if field:
        updates[field] = F(field) + amount
    ActivityDay.objects.filter(pk=day.pk).update(**updates)

    # streak: AI suhbati o'quv faolligi hisoblanmaydi, faqat o'rganish harakatlari
    if kind != "ai":
        user.refresh_from_db(fields=["streak", "best_streak", "last_active", "xp"])
        old_level = level_for(user.xp)["level"]
        if user.last_active != d:
            user.streak = user.streak + 1 if user.last_active == d - timedelta(days=1) else 1
            user.best_streak = max(user.best_streak, user.streak)
            user.last_active = d
        user.xp += gained
        user.save(update_fields=["streak", "best_streak", "last_active", "xp"])
        lv = level_for(user.xp)
        if lv["level"] > old_level:
            Notification.objects.create(user=user, title=f"{lv['icon']} Yangi daraja: {lv['title']}!",
                                        body=f"Siz {lv['level']}-darajaga ko'tarildingiz. Shunday davom eting!", link="/progress", kind="achievement")
        for n in (3, 7, 30):
            if user.streak >= n:
                award(user, f"streak_{n}")
    elif gained:
        type(user).objects.filter(pk=user.pk).update(xp=F("xp") + gained)


def current_streak(user):
    """Kecha yoki bugun faol bo'lmagan bo'lsa, seriya uzilgan."""
    if user.last_active and user.last_active >= today() - timedelta(days=1):
        return user.streak
    return 0


def notify(user, title, body="", link="", kind="info"):
    return Notification.objects.create(user=user, title=title, body=body, link=link, kind=kind)
