"""Test «raund»i: savollar tanlovi, tartibi va variantlari har urinishda tasodifiy.
Reja (plan) urinish bilan birga bazada saqlanadi — tekshirish faqat server tomonida, to'g'ri javoblar mijozga oldindan berilmaydi."""
import random

from .generators import generate
from .models import Mistake


def _entry(rnd, qid, text, options, correct, explanation, topic):
    perm = list(range(len(options)))
    rnd.shuffle(perm)
    return {"qid": qid, "text": text, "options": list(options), "correct_index": correct, "explanation": explanation, "topic": topic, "perm": perm}


def from_questions(rnd, questions):
    return [_entry(rnd, q.id, q.text, q.options, q.correct_index, q.explanation, q.topic) for q in questions]


def from_generator(rnd, name, n):
    # generator variantlarni o'zi aralashtiradi; perm baribir qo'llanadi (bir xillik uchun)
    return [_entry(rnd, None, q["text"], q["options"], q["correct_index"], q["explanation"], q["topic"]) for q in generate(name, rnd, n)]


def build_for_quiz(quiz, rnd=None):
    rnd = rnd or random.SystemRandom()
    n = max(3, quiz.questions_per_attempt or 10)
    if quiz.generator:
        return from_generator(rnd, quiz.generator, n)
    pool = list(quiz.questions.all())
    return from_questions(rnd, rnd.sample(pool, min(n, len(pool))))


def public(plan):
    return [{"id": str(i), "text": e["text"], "options": [e["options"][p] for p in e["perm"]], "topic": e["topic"]} for i, e in enumerate(plan)]


def grade(plan, answers, user=None):
    """answers: {"<pozitsiya>": ko'rsatilgan variant indeksi}. Qaytaradi: (items, score)."""
    items, score = [], 0
    for i, e in enumerate(plan):
        perm = e["perm"]
        raw = answers.get(str(i))
        chosen = raw if isinstance(raw, int) and 0 <= raw < len(perm) else None
        correct = chosen is not None and perm[chosen] == e["correct_index"]
        score += correct
        items.append({"question": i, "qid": e["qid"], "text": e["text"], "options": [e["options"][p] for p in perm], "chosen": chosen,
                      "correct_index": perm.index(e["correct_index"]), "correct": correct, "explanation": e["explanation"], "topic": e["topic"]})
        if user is not None and e["qid"]:
            if not correct:
                m, created = Mistake.objects.get_or_create(user=user, question_id=e["qid"])
                if not created:
                    Mistake.objects.filter(pk=m.pk).update(times=m.times + 1, resolved=False)
            else:
                Mistake.objects.filter(user=user, question_id=e["qid"], resolved=False).update(resolved=True)
    return items, score
