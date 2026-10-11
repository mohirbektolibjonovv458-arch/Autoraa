"""Ingliz tili darajasini aniqlash testi (A1–C1). Har darajada 5 ta savol.
Natija — taxminiy CEFR darajasi, rasmiy sertifikat emas."""
import random

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
]

_rnd = random.Random(2026)
QUESTIONS = []
for i, (level, text, opts) in enumerate(_BANK):
    order = list(range(len(opts)))
    _rnd.shuffle(order)
    QUESTIONS.append({"id": i, "level": level, "text": text, "options": [opts[j] for j in order], "correct": order.index(0)})


def public_questions():
    return [{"id": q["id"], "level": q["level"], "text": q["text"], "options": q["options"]} for q in QUESTIONS]


def evaluate(answers):
    """answers: {"<id>": index}. Daraja — pastdan boshlab 60%+ natija ketma-ket saqlangan eng yuqori bosqich."""
    per = {l: [0, 0] for l in LEVELS}
    for q in QUESTIONS:
        per[q["level"]][1] += 1
        if answers.get(str(q["id"])) == q["correct"]:
            per[q["level"]][0] += 1
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
