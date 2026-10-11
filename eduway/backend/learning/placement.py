"""Ingliz tili darajasini aniqlash testi (A1–C1). Har darajada 5 ta savol.
Natija — taxminiy CEFR darajasi, rasmiy sertifikat emas."""
LEVELS = ["A1", "A2", "B1", "B2", "C1"]

# (daraja, savol, [to'g'ri javob birinchi, ...boshqalar])
_BANK = [
    ("A1", "I ___ a student.", ["am", "is", "are", "be"]),
    ("A1", "She ___ two brothers.", ["has", "have", "is", "having"]),
    ("A1", "___ is your name?", ["What", "Who", "Where", "How"]),
    ("A1", "They ___ from Uzbekistan.", ["are", "is", "am", "be"]),
    ("A1", "There ___ three apples on the table.", ["are", "is", "be", "am"]),
    ("A2", "I ___ to the cinema yesterday.", ["went", "go", "have gone", "going"]),
    ("A2", "This book is ___ than that one.", ["more interesting", "interestinger", "most interesting", "much interesting"]),
    ("A2", "We ___ dinner when the phone rang.", ["were having", "had", "have", "are having"]),
    ("A2", "How ___ water do you drink every day?", ["much", "many", "lot", "few"]),
    ("A2", "You ___ smoke here. It's not allowed.", ["mustn't", "don't have to", "needn't", "can"]),
    ("B1", "I have lived here ___ 2019.", ["since", "for", "from", "during"]),
    ("B1", "If it rains tomorrow, we ___ at home.", ["will stay", "would stay", "stayed", "stay"]),
    ("B1", "The letter ___ yesterday.", ["was sent", "sent", "has sent", "is sending"]),
    ("B1", "She asked me where ___.", ["I lived", "did I live", "do I live", "I live?"]),
    ("B1", "I'm not used to ___ up so early.", ["getting", "get", "got", "be getting"]),
    ("B2", "If I ___ harder, I would have passed the exam.", ["had studied", "studied", "would study", "have studied"]),
    ("B2", "By the time we arrived, the film ___.", ["had already started", "already started", "has already started", "was already starting"]),
    ("B2", "Choose the closest meaning of «reluctant».", ["unwilling", "eager", "careless", "confident"]),
    ("B2", "He denied ___ the window.", ["breaking", "to break", "break", "to have break"]),
    ("B2", "The government is trying to ___ unemployment.", ["tackle", "tick", "tackle with", "deal"]),
    ("C1", "___ had I left the house than it started to rain.", ["No sooner", "Hardly", "As soon as", "Barely"]),
    ("C1", "Choose the closest meaning of «meticulous».", ["extremely careful about details", "very fast", "easily annoyed", "generous"]),
    ("C1", "It's high time we ___ a decision.", ["made", "make", "will make", "have made"]),
    ("C1", "The findings ___ doubt on the earlier theory.", ["cast", "threw", "put", "made"]),
    ("C1", "Were the company ___ its prices, sales would fall.", ["to raise", "raising", "raise", "raised"]),
    # qo'shimcha savollar — har testda har darajadan 5 tasi tasodifiy tanlanadi
    ("A1", "My sister ___ coffee every morning.", ["drinks", "drink", "drinking", "is drink"]),
    ("A1", "We ___ at home now.", ["are", "is", "be", "am"]),
    ("A1", "This is ___ apple.", ["an", "a", "the two", "some a"]),
    ("A1", "I can't find ___ keys.", ["my", "me", "I", "mine the"]),
    ("A1", "The opposite of «big» is ___.", ["small", "tall", "long", "fast"]),
    ("A2", "She has never ___ to London.", ["been", "go", "went", "going"]),
    ("A2", "I'm going ___ my grandparents this weekend.", ["to visit", "visit", "visiting", "visited"]),
    ("A2", "There isn't ___ milk in the fridge.", ["any", "some", "many", "a"]),
    ("A2", "He is the ___ student in our class.", ["tallest", "taller", "most tall", "tall"]),
    ("A2", "We usually go to school ___ bus.", ["by", "on the", "with", "in"]),
    ("B1", "I wish I ___ more free time.", ["had", "have", "will have", "having"]),
    ("B1", "She's been learning English ___ three years.", ["for", "since", "during", "from"]),
    ("B1", "The book ___ I bought yesterday is great.", ["that", "who", "what", "whose"]),
    ("B1", "You ___ wear a uniform — it's optional.", ["don't have to", "mustn't", "can't", "shouldn't to"]),
    ("B1", "He suggested ___ to the museum.", ["going", "to go", "go", "we going"]),
    ("B2", "The project ___ by the end of next month.", ["will have been completed", "will complete", "is completing", "has completed"]),
    ("B2", "Choose the closest meaning of «ambiguous».", ["having more than one possible meaning", "very important", "clearly stated", "easy to do"]),
    ("B2", "She apologised ___ late.", ["for being", "to be", "for be", "of being"]),
    ("B2", "Hardly anyone came, ___?", ["did they", "didn't they", "did anyone not", "came they"]),
    ("B2", "If he hadn't missed the train, he ___ here now.", ["would be", "will be", "would have been", "is"]),
    ("C1", "Little ___ that the decision would change everything.", ["did they realise", "they realised", "they did realise", "realised they"]),
    ("C1", "Choose the closest meaning of «ubiquitous».", ["found everywhere", "very rare", "extremely old", "difficult to understand"]),
    ("C1", "The report was ___ criticised for its lack of evidence.", ["widely", "largely of", "broad", "wide"]),
    ("C1", "Not until the results were published ___ the scale of the problem.", ["did we understand", "we understood", "we did understand", "understood we"]),
    ("C1", "She is ___ to succeed, given her talent and work ethic.", ["bound", "doomed for", "likely of", "sure of"]),
]
PER_LEVEL = 5

QUESTIONS = [{"id": i, "level": level, "text": text, "options": opts, "answer": opts[0]} for i, (level, text, opts) in enumerate(_BANK)]


def public_questions(rnd):
    """Har safar: daraja ichida savollar tartibi va variantlar aralashtiriladi (darajalar pastdan yuqoriga)."""
    out = []
    for level in LEVELS:
        qs = [q for q in QUESTIONS if q["level"] == level]
        for q in rnd.sample(qs, min(PER_LEVEL, len(qs))):
            opts = list(q["options"])
            rnd.shuffle(opts)
            out.append({"id": q["id"], "level": level, "text": q["text"], "options": opts})
    return out


def evaluate(answers):
    """answers: {"<id>": tanlangan variant matni} — faqat foydalanuvchiga ko'rsatilgan savollar (o'tkazilganlari bo'sh qiymat bilan).
    Daraja — pastdan boshlab 60%+ natija ketma-ket saqlangan eng yuqori bosqich."""
    per = {l: [0, 0] for l in LEVELS}
    by_id = {q["id"]: q for q in QUESTIONS}
    for key, value in answers.items():
        q = by_id.get(int(key)) if str(key).isdigit() else None
        if not q:
            continue
        per[q["level"]][1] += 1
        if value == q["answer"]:
            per[q["level"]][0] += 1
    for l in LEVELS:  # ko'rsatilmagan daraja — 0% (bo'sh javoblar yuborilmagan bo'lsa)
        if per[l][1] == 0:
            per[l][1] = PER_LEVEL
    level = None
    for l in LEVELS:
        ok, total = per[l]
        if ok / total >= 0.6:
            level = l
        else:
            break
    if level is None:
        level = "A1"
    return level, {l: round(100 * ok / total) for l, (ok, total) in per.items()}
