from .test_data import DIMENSIONS, GOALS, STATEMENTS, STYLE_QUESTIONS

CODE_WEIGHTS = (0.5, 0.3, 0.2)


class InvalidAnswers(ValueError):
    pass


def validate(answers):
    if not isinstance(answers, dict):
        raise InvalidAnswers("Javoblar formati noto'g'ri.")
    likert = answers.get("statements")
    if not isinstance(likert, list) or len(likert) != len(STATEMENTS) or not all(isinstance(x, int) and 1 <= x <= 5 for x in likert):
        raise InvalidAnswers("Barcha savollarga 1–5 oralig'ida javob bering.")
    style = answers.get("style")
    if not isinstance(style, dict):
        raise InvalidAnswers("Ish uslubi bo'limini to'ldiring.")
    for q in STYLE_QUESTIONS:
        v = style.get(q["id"])
        if not isinstance(v, int) or not 0 <= v < len(q["options"]):
            raise InvalidAnswers("Ish uslubi bo'limidagi barcha savollarga javob bering.")
    goals = answers.get("goals", [])
    valid_goals = {g["id"] for g in GOALS}
    if not isinstance(goals, list) or not set(goals) <= valid_goals:
        raise InvalidAnswers("Maqsadlar noto'g'ri tanlangan.")
    subjects = answers.get("subjects", [])
    if not isinstance(subjects, list) or len(subjects) > 15 or not all(isinstance(s, str) and len(s) <= 40 for s in subjects):
        raise InvalidAnswers("Fanlar noto'g'ri tanlangan.")
    return {"statements": likert, "style": {q["id"]: style[q["id"]] for q in STYLE_QUESTIONS}, "goals": list(dict.fromkeys(goals)), "subjects": subjects}


def dimension_scores(a):
    raw = {d: 0.0 for d in DIMENSIONS}
    maxi = {d: 0.0 for d in DIMENSIONS}
    for (dim, _), v in zip(STATEMENTS, a["statements"]):
        raw[dim] += v - 1
        maxi[dim] += 4
    for q in STYLE_QUESTIONS:
        chosen = q["options"][a["style"][q["id"]]]["w"]
        for d in DIMENSIONS:
            maxi[d] += 3
        for d, w in chosen.items():
            raw[d] += w
    goal_w = {g["id"]: g["w"] for g in GOALS}
    for g in a["goals"]:
        for d, w in goal_w[g].items():
            raw[d] += w
    for d in DIMENSIONS:
        maxi[d] += 2
    return {d: round(min(100, 100 * raw[d] / maxi[d])) for d in DIMENSIONS}


def match_careers(scores, a, careers, interests=()):
    subjects = {s.lower() for s in a.get("subjects", [])}
    interests = {i.lower() for i in interests}
    top_dims = sorted(scores, key=scores.get, reverse=True)[:2]
    out = []
    for c in careers:
        base = sum(scores.get(code, 0) * w for code, w in zip(c.riasec, CODE_WEIGHTS))
        common_subj = [s for s in c.subjects if s.lower() in subjects]
        common_int = [i for i in c.interests if i.lower() in interests]
        bonus = min(12, 5 * len(common_subj)) + min(8, 4 * len(common_int))
        match = round(min(98, base * 0.85 + bonus))
        reasons = []
        for code in c.riasec[:2]:
            if code in top_dims:
                reasons.append(f"Sizda «{DIMENSIONS[code]['name']}» yo'nalishi kuchli — {DIMENSIONS[code]['desc'].lower()} bu kasbda muhim.")
        if common_subj:
            reasons.append(f"Siz yoqtirgan fan(lar): {', '.join(common_subj)} — bu kasb uchun asosiy.")
        if common_int:
            reasons.append(f"Qiziqishlaringiz ({', '.join(common_int)}) bu soha bilan bog'liq.")
        if not reasons:
            reasons.append("Profilingizning bir qismi bu kasbga mos keladi — batafsil o'rganib ko'ring.")
        out.append({"slug": c.slug, "title": c.title, "icon": c.icon, "field": c.field, "match": match, "reasons": reasons})
    out.sort(key=lambda x: x["match"], reverse=True)
    return out[:8]
