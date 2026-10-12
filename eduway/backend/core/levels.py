"""Daraja (level) tizimi: XP ortgan sari o'quvchi yangi darajaga ko'tariladi. Raqobatsiz — faqat shaxsiy o'sish."""

LEVELS = [
    (0, "Yangi boshlovchi", "🌱"),
    (100, "Izlanuvchi", "🔎"),
    (250, "Bilimga chanqoq", "📘"),
    (500, "Faol o'quvchi", "⚡"),
    (900, "Tirishqoq", "🎯"),
    (1400, "Bilimdon", "🧠"),
    (2000, "Tadqiqotchi", "🔬"),
    (2800, "Bilim ustasi", "🏅"),
    (3800, "Akademik", "🎓"),
    (5000, "Professor", "👑"),
    (7000, "Afsona", "🌟"),
]


def level_for(xp):
    xp = xp or 0
    idx = max(i for i, (need, _, _) in enumerate(LEVELS) if xp >= need)
    need, title, icon = LEVELS[idx]
    nxt = LEVELS[idx + 1] if idx + 1 < len(LEVELS) else None
    progress = 100 if not nxt else round(100 * (xp - need) / (nxt[0] - need))
    return {"level": idx + 1, "title": title, "icon": icon, "xp": xp, "current_min": need,
            "next_min": nxt[0] if nxt else None, "next_title": nxt[1] if nxt else None, "progress": progress,
            "to_next": (nxt[0] - xp) if nxt else 0}
