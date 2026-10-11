"""Kasb tanlash testi. Holland (RIASEC) modeliga asoslangan — kasbiy qiziqishlarni o'rganishda keng qo'llanadigan yondashuv.
Natija o'quvchiga yo'nalish beradi, qat'iy hukm emas."""

DIMENSIONS = {
    "R": {"name": "Amaliy", "desc": "Qo'l bilan ishlash, texnika, qurilmalar va aniq natija"},
    "I": {"name": "Tadqiqotchi", "desc": "Tahlil, savol berish, muammolarni mantiqan yechish"},
    "A": {"name": "Ijodkor", "desc": "G'oya yaratish, dizayn, so'z va tasvir bilan ifodalash"},
    "S": {"name": "Ijtimoiy", "desc": "Odamlarga yordam berish, o'rgatish, muloqot"},
    "E": {"name": "Tashabbuskor", "desc": "Yetakchilik, ishontirish, loyiha va biznes boshqarish"},
    "C": {"name": "Tartibli", "desc": "Aniqlik, tizim, raqamlar va ma'lumotlar bilan ishlash"},
}

# 1-bo'lim: qiziqishlar (1–5 shkala)
STATEMENTS = [
    ("R", "Qurilmalarni yig'ish yoki ta'mirlash menga yoqadi"),
    ("I", "Hodisalarning sababini tushunmagunimcha tinchimayman"),
    ("A", "Rasm chizish, dizayn yoki video yaratish menga zavq beradi"),
    ("S", "Do'stlarim tushunmagan mavzuni ularga tushuntirishni yoqtiraman"),
    ("E", "Guruhda tashabbusni o'z qo'limga olaman"),
    ("C", "Ishlarimni reja va jadval asosida tartibli bajaraman"),
    ("R", "Laboratoriya, ustaxona yoki ochiq havoda ishlash qiziq"),
    ("I", "Murakkab masala yoki jumboqni yechish menga zavq beradi"),
    ("A", "Hikoya, she'r yoki maqola yozishni yoqtiraman"),
    ("S", "Odamlarning muammosini tinglab, yordam berishni xohlayman"),
    ("E", "O'z biznesimni yoki loyihamni boshlashni orzu qilaman"),
    ("C", "Raqamlar, jadvallar va hisob-kitob bilan ishlash menga oson"),
    ("R", "Robotlar, mashinalar yoki qurilish meni qiziqtiradi"),
    ("I", "Ilmiy maqola yoki tajribalar haqida o'qish menga qiziq"),
    ("A", "Narsalarni o'zgacha, odatiy bo'lmagan tarzda qilishni yoqtiraman"),
    ("S", "Jamoada ishlash yolg'iz ishlashdan ko'ra yoqimliroq"),
    ("E", "Boshqalarni o'z fikrimga ishontira olaman"),
    ("C", "Xatolarni topish va hujjatlarni tekshirishda e'tiborliman"),
]

# 2-bo'lim: ish uslubi (bitta tanlov)
STYLE_QUESTIONS = [
    {
        "id": "workplace",
        "text": "Kelajakda qayerda ishlashni afzal ko'rasiz?",
        "options": [
            {"label": "Ofis yoki kompyuter oldida", "w": {"C": 2, "I": 1}},
            {"label": "Laboratoriya, klinika yoki ustaxonada", "w": {"R": 2, "I": 1}},
            {"label": "Odamlar orasida: maktab, shifoxona, jamoa", "w": {"S": 3}},
            {"label": "Studiya yoki erkin grafikda", "w": {"A": 3}},
            {"label": "Uchrashuvlar, safarlar va muzokaralarda", "w": {"E": 3}},
        ],
    },
    {
        "id": "problem",
        "text": "Qiyin vazifaga duch kelsangiz, odatda nima qilasiz?",
        "options": [
            {"label": "Ma'lumot to'plab, chuqur tahlil qilaman", "w": {"I": 3}},
            {"label": "Darhol amalda sinab ko'raman", "w": {"R": 3}},
            {"label": "Boshqalar bilan maslahatlashaman", "w": {"S": 2, "E": 1}},
            {"label": "Noodatiy yechim o'ylab topaman", "w": {"A": 3}},
            {"label": "Bosqichma-bosqich reja tuzaman", "w": {"C": 3}},
        ],
    },
    {
        "id": "project",
        "text": "Maktab loyihasida qaysi rolni tanlaysiz?",
        "options": [
            {"label": "Jamoa sardori", "w": {"E": 3}},
            {"label": "Dizayn va taqdimot", "w": {"A": 3}},
            {"label": "Tadqiqot va ma'lumot yig'ish", "w": {"I": 3}},
            {"label": "Hisob-kitob va hujjatlar", "w": {"C": 3}},
            {"label": "Modelni yasash yoki texnik qism", "w": {"R": 3}},
            {"label": "Jamoani birlashtirish, hammaga yordam", "w": {"S": 3}},
        ],
    },
]

# 3-bo'lim: maqsadlar (bir nechta tanlov)
GOALS = [
    {"id": "income", "label": "Yuqori daromad", "w": {"E": 1, "C": 1}},
    {"id": "help", "label": "Odamlarga foyda keltirish", "w": {"S": 2}},
    {"id": "create", "label": "Yangi narsa yaratish", "w": {"A": 1, "I": 1}},
    {"id": "stable", "label": "Barqaror ish", "w": {"C": 2}},
    {"id": "discover", "label": "Ilmiy kashfiyot", "w": {"I": 2}},
    {"id": "lead", "label": "Yetakchi bo'lish", "w": {"E": 2}},
    {"id": "abroad", "label": "Xorijda o'qish/ishlash", "w": {}},
    {"id": "hands", "label": "Qo'l bilan aniq natija ko'rish", "w": {"R": 2}},
]


def public_test():
    return {
        "dimensions": DIMENSIONS,
        "statements": [{"index": i, "text": t} for i, (_, t) in enumerate(STATEMENTS)],
        "style": [{"id": q["id"], "text": q["text"], "options": [o["label"] for o in q["options"]]} for q in STYLE_QUESTIONS],
        "goals": [{"id": g["id"], "label": g["label"]} for g in GOALS],
    }
