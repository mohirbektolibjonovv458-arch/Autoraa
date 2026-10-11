"""Shablon asosidagi o'quv rejasi (AI ulanmagan bo'lsa ham ishlaydi).
Har bir maqsad turi uchun haftalik aylanma vazifalar: (sarlavha, tafsilot, ulush, ilova ichidagi havola)."""

TEMPLATES = {
    "ielts": [
        ("IELTS Reading mashqi", "Bitta matn: skimming va scanning usullari bilan", 1.0, "/english/lessons?skill=reading"),
        ("Yangi so'zlarni takrorlash", "Lug'atdagi muddati kelgan so'zlar", 0.4, "/english/vocab/review"),
        ("IELTS Listening", "Audio matnni tinglab, savollarga javob bering", 1.0, "/english/lessons?skill=listening"),
        ("Writing Task 2 rejasi", "Bitta mavzu bo'yicha reja va kirish qismini yozing", 1.0, "/english/writing"),
        ("Grammar testi", "Bir grammatika mavzusi bo'yicha test", 0.6, "/practice?subject=english"),
        ("Speaking mashqi", "Part 2 mavzusida 2 daqiqa gapiring", 0.6, "/ai?mode=speaking"),
        ("Haftalik tahlil", "Xatolar ro'yxatini ko'rib chiqing", 0.5, "/practice/mistakes"),
    ],
    "english": [
        ("Grammar darsi", "Darajangizga mos bitta dars", 1.0, "/english/lessons?skill=grammar"),
        ("5 ta yangi so'z", "Lug'atga misollar bilan qo'shing", 0.5, "/english/vocab"),
        ("Reading", "Qisqa matn o'qing va tushunganingizni tekshiring", 1.0, "/english/lessons?skill=reading"),
        ("So'zlarni takrorlash", "Muddati kelgan so'zlar", 0.4, "/english/vocab/review"),
        ("AI bilan suhbat", "Ingliz tilida 10 daqiqa yozishma", 0.6, "/ai?mode=english"),
        ("Ingliz tili testi", "Darajangizdagi test", 0.6, "/practice?subject=english"),
        ("Listening", "Audio matnni tinglang", 0.8, "/english/lessons?skill=listening"),
    ],
    "math": [
        ("Mavzuni takrorlash", "Bitta mavzuni AI tutor bilan qayta ko'rib chiqing", 1.0, "/ai?mode=tutor"),
        ("Matematika testi", "Vaqt bilan test ishlang", 0.8, "/practice?subject=math"),
        ("Masalalar yechish", "5 ta masala: oson → qiyin", 1.0, "/ai?mode=tutor"),
        ("Xatolar ustida ishlash", "Oldingi xatolarni qayta yeching", 0.6, "/practice/mistakes"),
        ("Mantiq testi", "Mantiqiy fikrlash mashqi", 0.6, "/practice?subject=logic"),
        ("Formulalar kartochkasi", "Asosiy formulalarni yozib chiqing", 0.5, ""),
        ("Haftalik nazorat", "Aralash test", 0.8, "/practice?subject=math"),
    ],
    "programming": [
        ("Nazariya", "Bitta mavzuni o'rganing (masalan, sikllar)", 1.0, "/ai?mode=tutor"),
        ("Amaliy mashq", "2–3 ta kichik dastur yozing", 1.2, ""),
        ("Informatika testi", "Asosiy tushunchalar bo'yicha test", 0.6, "/practice?subject=informatics"),
        ("Kodni tushuntirish", "Yozgan kodingizni AI'dan tekshirtiring", 0.6, "/ai?mode=tutor"),
        ("Mini-loyiha", "Kichik loyiha ustida ishlang", 1.4, ""),
        ("Ingliz tilidagi texnik so'zlar", "5 ta atama lug'atga", 0.4, "/english/vocab"),
        ("Haftalik takrorlash", "O'tilgan mavzular bo'yicha savollar", 0.6, "/ai?mode=tutor"),
    ],
    "university": [
        ("Universitetlarni o'rganish", "2 ta universitet sahifasini ko'rib chiqing", 0.6, "/universities"),
        ("Asosiy fan testi", "Kirish imtihoni faniga test", 1.0, "/practice"),
        ("Ingliz tili", "Darajangizga mos dars", 0.8, "/english"),
        ("Qabul talablarini tekshirish", "Tanlangan universitet rasmiy saytida talablarni tekshiring", 0.4, "/universities?favorites=1"),
        ("Xatolar ustida ishlash", "Oldingi xatolar", 0.6, "/practice/mistakes"),
        ("Kasb yo'nalishini aniqlash", "Kasblar ro'yxatini ko'rib chiqing", 0.4, "/career"),
        ("Haftalik reja tahlili", "Bajarilganlarni belgilang", 0.3, "/plan"),
    ],
    "grant": [
        ("Grantlarni ko'rib chiqish", "Profilingizga mos grantlar", 0.5, "/grants"),
        ("Hujjatlar ro'yxati", "Checklistdagi bitta bandni bajaring", 0.8, "/grants/saved"),
        ("Motivatsion xat qoralamasi", "Bitta paragraf yozing", 1.0, "/ai?mode=tutor"),
        ("IELTS tayyorgarligi", "Reading yoki Listening", 1.0, "/english"),
        ("Muddatlarni tekshirish", "Rasmiy saytda muddatni tasdiqlang", 0.3, "/grants/saved"),
        ("Writing mashqi", "Writing Task 2", 1.0, "/english/writing"),
        ("Tavsiya xati", "O'qituvchingiz bilan kelishib oling", 0.3, ""),
    ],
}
TEMPLATES["custom"] = [
    ("Asosiy mashg'ulot", "Maqsadingiz bo'yicha asosiy ish", 1.0, ""),
    ("Takrorlash", "O'tilganlarni qisqa takrorlash", 0.5, ""),
    ("AI bilan savol-javob", "Tushunmagan joylarni so'rang", 0.5, "/ai?mode=tutor"),
] * 3


def build_week(kind, minutes_per_day, start, days=7):
    rows = TEMPLATES.get(kind) or TEMPLATES["custom"]
    from datetime import timedelta

    out = []
    i = 0
    for d in range(days):
        date = start + timedelta(days=d)
        left = minutes_per_day
        # har kuni 1–3 ta vazifa, umumiy vaqt maqsadga mos
        for _ in range(3):
            title, details, share, link = rows[i % len(rows)]
            mins = max(10, min(left, round(minutes_per_day * share / 1.6 / 5) * 5))
            if left < 10:
                break
            out.append({"title": title, "details": details, "minutes": mins, "date": date, "link": link})
            left -= mins
            i += 1
    return out
