"""Savol generatorlari: har urinishda yangi raqamlar bilan savol yaratiladi — testlar hech qachon bir xil takrorlanmaydi.
Har bir generator: f(rnd) -> {"text", "options", "correct_index", "explanation", "topic"}.
To'g'ri javob har doim matematik jihatdan hisoblanadi; chalg'ituvchi variantlar tipik xatolardan yasaladi."""
import math
from fractions import Fraction

WEEKDAYS = ["dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"]


def _fmt(x):
    if isinstance(x, Fraction):
        return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"
    if isinstance(x, float):
        return f"{x:g}".replace(".", ",")
    return str(x)


def _q(rnd, text, correct, wrong, explanation, topic):
    """Variantlarni yig'adi: takrorlanmaydigan 4 ta variant, to'g'risi tasodifiy joyda."""
    opts, seen = [_fmt(correct)], {_fmt(correct)}
    for w in wrong:
        s = _fmt(w)
        if s not in seen:
            opts.append(s)
            seen.add(s)
        if len(opts) == 4:
            break
    k = 1
    while len(opts) < 4:  # zaxira chalg'ituvchilar
        base = correct if not isinstance(correct, str) else 0
        try:
            s = _fmt(base + k * (1 if k % 2 else -1) * 2)
        except TypeError:
            s = f"{correct} ({k})"
        if s not in seen:
            opts.append(s)
            seen.add(s)
        k += 1
    rnd.shuffle(opts)
    return {"text": text, "options": opts, "correct_index": opts.index(_fmt(correct)), "explanation": explanation, "topic": topic}


# --- Matematika ---

def percent(rnd):
    kind = rnd.choice(["of", "increase", "whole", "share"])
    if kind == "of":
        p, n = rnd.choice([5, 10, 15, 20, 25, 30, 40, 60, 75]), rnd.randrange(20, 400, 20)
        ans = n * p // 100
        return _q(rnd, f"{n} ning {p}% i nechaga teng?", ans, [n * p // 10, ans + p, n - ans, p],
                  f"{n} × {p}/100 = {ans}.", "Foiz topish")
    if kind == "increase":
        p, n = rnd.choice([10, 20, 25, 50]), rnd.randrange(20, 200, 10) * 1000
        ans = n * (100 + p) // 100
        return _q(rnd, f"Narx {n:,} so'm edi va {p}% ga oshdi. Yangi narx qancha?".replace(",", " "),
                  ans, [n * p // 100, n * (100 - p) // 100, n + p],
                  f"{n} × (1 + {p}/100) = {ans}. Oshgan qism ({n * p // 100}) — javob emas.", "Foizga oshirish")
    if kind == "whole":
        p = rnd.choice([10, 20, 25, 40, 50])
        ans = rnd.randrange(40, 500, 20)
        part = ans * p // 100
        return _q(rnd, f"Qaysi sonning {p}% i {part} ga teng?", ans, [part * p // 10, part + p, part * 100 // max(1, 100 - p)],
                  f"x × {p}/100 = {part} → x = {part} × 100 / {p} = {ans}.", "Sonni foizi bo'yicha topish")
    total = rnd.choice([20, 25, 40, 50])
    part = rnd.randrange(1, total)
    ans = Fraction(part * 100, total)
    return _q(rnd, f"Sinfda {total} o'quvchi bor, ulardan {part} tasi olimpiadaga qatnashdi. Bu necha foiz?",
              ans, [part, Fraction(total * 100, part) if part else 1, 100 - ans],
              f"{part} / {total} × 100 = {_fmt(ans)}%.", "Ulushni foizda ifodalash")


def linear(rnd):
    a = rnd.choice([2, 3, 4, 5, 6, 7, -2, -3])
    x = rnd.randint(-9, 12)
    b = rnd.randint(-15, 15)
    c = a * x + b
    sb = f"+ {b}" if b >= 0 else f"− {-b}"
    return _q(rnd, f"{a}x {sb} = {c} tenglamani yeching.", x,
              [x + 1, -x, Fraction(c + b, a) if (c + b) % a == 0 else x - 2, c - b],
              f"{a}x = {c} {'−' if b >= 0 else '+'} {abs(b)} = {c - b} → x = {c - b} / {a} = {x}.", "Chiziqli tenglamalar")


def quadratic(rnd):
    r1, r2 = rnd.sample([i for i in range(-7, 9) if i != 0], 2)
    s, p = r1 + r2, r1 * r2
    coef = lambda k: "" if k == 1 else str(k)
    b_txt = "" if s == 0 else (f" − {coef(s)}x" if s > 0 else f" + {coef(-s)}x")
    c_txt = f" + {p}" if p > 0 else f" − {-p}"
    kind = rnd.choice(["roots", "sum", "product"])
    eq = f"x²{b_txt}{c_txt} = 0"
    if kind == "roots":
        ans = f"{min(r1, r2)} va {max(r1, r2)}"
        lo, hi = min(r1, r2), max(r1, r2)
        wrong = [f"{-hi} va {-lo}", f"{lo + 1} va {hi + 1}", f"{lo} va {hi + 2}", f"{lo - 1} va {hi}", f"{lo - 2} va {hi - 1}", f"{p} va 1"]
        q = _q(rnd, f"{eq} tenglamaning ildizlarini toping.", ans, wrong,
               f"Viyet teoremasi: x₁ + x₂ = {s}, x₁·x₂ = {p} → x₁ = {r1}, x₂ = {r2}.", "Kvadrat tenglamalar")
        return q
    if kind == "sum":
        return _q(rnd, f"{eq} tenglama ildizlari yig'indisi nechaga teng?", s, [-s, p, -p, s + 1],
                  f"Viyet: x₁ + x₂ = −b/a = {s}.", "Viyet teoremasi")
    return _q(rnd, f"{eq} tenglama ildizlari ko'paytmasi nechaga teng?", p, [-p, s, -s, p + 1],
              f"Viyet: x₁·x₂ = c/a = {p}.", "Viyet teoremasi")


def fractions(rnd):
    a, b = Fraction(rnd.randint(1, 5), rnd.choice([2, 3, 4, 5, 6])), Fraction(rnd.randint(1, 5), rnd.choice([2, 3, 4, 6, 8]))
    op = rnd.choice(["+", "−", "×"])
    ans = a + b if op == "+" else a - b if op == "−" else a * b
    naive = Fraction(a.numerator + b.numerator, a.denominator + b.denominator) if op != "×" else Fraction(a.numerator * b.numerator, a.denominator + b.denominator)
    return _q(rnd, f"Hisoblang: {_fmt(a)} {op} {_fmt(b)}", ans, [naive, ans + Fraction(1, 2), -ans if ans else Fraction(1, 3), a * b if op != "×" else a + b],
              f"Umumiy maxrajga keltiramiz va soddalashtiramiz: natija {_fmt(ans)}." if op != "×" else f"Suratlar va maxrajlar ko'paytiriladi: {_fmt(ans)}.",
              "Kasrlar")


def sequence(rnd):
    kind = rnd.choice(["arith", "geom", "square"])
    if kind == "arith":
        a, d = rnd.randint(-5, 20), rnd.choice([2, 3, 4, 5, 7, -3])
        seq = [a + i * d for i in range(5)]
        ans = a + 5 * d
        exp = f"Har bir had oldingisidan {d} ga farq qiladi: {seq[-1]} {'+' if d > 0 else '−'} {abs(d)} = {ans}."
    elif kind == "geom":
        a, r = rnd.randint(1, 4), rnd.choice([2, 3])
        seq = [a * r ** i for i in range(5)]
        ans = a * r ** 5
        exp = f"Har bir had oldingisidan {r} marta katta: {seq[-1]} × {r} = {ans}."
    else:
        k = rnd.randint(1, 4)
        seq = [(k + i) ** 2 for i in range(5)]
        ans = (k + 5) ** 2
        exp = f"Ketma-ket sonlarning kvadratlari: {k + 5}² = {ans}."
    return _q(rnd, f"Ketma-ketlikni davom ettiring: {', '.join(map(str, seq))}, ...", ans,
              [ans + 1, seq[-1] + (seq[-1] - seq[-2]) + 2, ans - 2, seq[-1] * 2], exp, "Ketma-ketliklar")


# --- Fizika ---

def physics(rnd):
    kind = rnd.choice(["speed", "time", "newton_a", "newton_f", "density"])
    if kind == "speed":
        t, v = rnd.randint(2, 6), rnd.randrange(30, 100, 5)
        return _q(rnd, f"Avtomobil {t} soatda {v * t} km yo'l bosdi. O'rtacha tezligi qancha?", f"{v} km/soat",
                  [f"{v * t * t} km/soat", f"{v + t} km/soat", f"{v * 2} km/soat"], f"v = s / t = {v * t} / {t} = {v} km/soat.", "Tezlik")
    if kind == "time":
        v, t = rnd.choice([4, 5, 10, 12, 15, 20]), rnd.randint(2, 9)
        return _q(rnd, f"Velosipedchi {v} m/s tezlikda {v * t} m masofani necha soniyada bosib o'tadi?", f"{t} s",
                  [f"{v * t * v} s", f"{t + v} s", f"{t * 2} s"], f"t = s / v = {v * t} / {v} = {t} s.", "Tezlik")
    if kind == "newton_a":
        m, a = rnd.randint(2, 10), rnd.randint(1, 6)
        return _q(rnd, f"{m} kg massali jismga {m * a} N kuch ta'sir qilmoqda. Tezlanish (ishqalanishsiz)?", f"{a} m/s²",
                  [f"{m * a * m} m/s²", f"{m + a} m/s²", f"{a + 2} m/s²"], f"a = F / m = {m * a} / {m} = {a} m/s².", "Nyuton qonunlari")
    if kind == "newton_f":
        m, a = rnd.randint(2, 12), rnd.randint(2, 5)
        return _q(rnd, f"{m} kg massali aravachaga {a} m/s² tezlanish berish uchun qancha kuch kerak?", f"{m * a} N",
                  [f"{m + a} N", f"{m * a * 2} N", f"{Fraction(m, a)} N".replace("/", "/")], f"F = m·a = {m} × {a} = {m * a} N.", "Nyuton qonunlari")
    rho, v = rnd.choice([(1000, "suv"), (2700, "alyuminiy"), (7800, "temir")]), rnd.choice([2, 3, 4, 5])
    return _q(rnd, f"Hajmi {v} m³ bo'lgan {rho[1]}ning massasi qancha? (zichlik {rho[0]} kg/m³)", f"{rho[0] * v} kg",
              [f"{rho[0] // v} kg", f"{rho[0] + v} kg", f"{rho[0] * v * 10} kg"], f"m = ρ·V = {rho[0]} × {v} = {rho[0] * v} kg.", "Zichlik")


# --- Informatika ---

def informatics(rnd):
    kind = rnd.choice(["bin2dec", "dec2bin", "floordiv", "mod", "bytes"])
    if kind == "bin2dec":
        n = rnd.randint(5, 63)
        return _q(rnd, f"Ikkilik sanoq sistemasidagi {n:b} soni o'nlikda nechaga teng?", n, [n + 1, n - 2, int(f"{n:b}") % 100, n * 2],
                  " + ".join(f"{d}·{2 ** i}" for i, d in enumerate(reversed(f"{n:b}")) if d == "1") + f" = {n}.", "Sanoq sistemalari")
    if kind == "dec2bin":
        n = rnd.randint(5, 40)
        return _q(rnd, f"{n} sonini ikkilik sanoq sistemasiga o'tkazing.", f"{n:b}", [f"{n + 1:b}", f"{n - 1:b}", f"{n:b}"[::-1] + "0"],
                  f"{n} ni ketma-ket 2 ga bo'lib, qoldiqlarni teskari tartibda yozamiz: {n:b}.", "Sanoq sistemalari")
    if kind == "floordiv":
        a, b = rnd.randint(10, 60), rnd.randint(3, 9)
        return _q(rnd, f"Python'da print({a} // {b}) nimani chiqaradi?", a // b, [round(a / b, 2), a % b, a // b + 1],
                  f"// — butun bo'lish: {a} = {a // b}·{b} + {a % b}, qoldiq tashlab yuboriladi.", "Python operatorlari")
    if kind == "mod":
        a, b = rnd.randint(10, 60), rnd.randint(3, 9)
        return _q(rnd, f"Python'da print({a} % {b}) nimani chiqaradi?", a % b, [a // b, b - a % b if a % b else b, a % b + 1],
                  f"% — qoldiq: {a} = {a // b}·{b} + {a % b}.", "Python operatorlari")
    kb = rnd.choice([2, 4, 8, 16])
    return _q(rnd, f"{kb} KB necha baytga teng? (1 KB = 1024 bayt)", kb * 1024, [kb * 1000, kb * 8, kb * 1024 * 8],
              f"{kb} × 1024 = {kb * 1024} bayt.", "Axborot o'lchovi")


# --- Mantiq ---

def logic(rnd):
    kind = rnd.choice(["weekday", "workers", "sequence"])
    if kind == "weekday":
        start, n = rnd.randrange(7), rnd.choice([10, 15, 23, 30, 45, 50, 100])
        ans = WEEKDAYS[(start + n) % 7]
        wrong = [WEEKDAYS[(start + n + 1) % 7], WEEKDAYS[(start + n - 1) % 7], WEEKDAYS[start]]
        return _q(rnd, f"Bugun {WEEKDAYS[start]}. {n} kundan keyin haftaning qaysi kuni bo'ladi?", ans, wrong,
                  f"{n} = {n // 7}·7 + {n % 7}. {WEEKDAYS[start].capitalize()}dan {n % 7} kun keyin — {ans}.", "Qoldiqli bo'lish")
    if kind == "workers":
        w, d = rnd.choice([2, 3, 4, 6]), rnd.choice([6, 8, 12])
        w2 = rnd.choice([x for x in (1, 2, 3, 4, 6, 8, 12) if x != w and (w * d) % x == 0])
        ans = w * d // w2
        return _q(rnd, f"{w} ta usta ishni {d} kunda tugatadi. {w2} ta usta xuddi shunday tezlikda shu ishni necha kunda tugatadi?",
                  ans, [d * w2 // w if (d * w2) % w == 0 else d + 1, d, ans + 2],
                  f"Jami ish: {w}×{d} = {w * d} usta-kun. {w * d} / {w2} = {ans} kun.", "Ish unumdorligi")
    return sequence(rnd)


GENERATORS = {
    "percent": ("math", percent), "linear": ("math", linear), "quadratic": ("math", quadratic), "fractions": ("math", fractions),
    "sequence": ("logic", sequence), "physics": ("physics", physics), "informatics": ("informatics", informatics), "logic": ("logic", logic),
}
GENERATOR_CHOICES = [(k, k) for k in GENERATORS]


def generate(name, rnd, n):
    """n ta savol; bir urinish ichida bir xil matnli savollar takrorlanmaydi."""
    fn = GENERATORS[name][1]
    out, seen = [], set()
    for _ in range(n * 6):
        q = fn(rnd)
        if q["text"] not in seen:
            seen.add(q["text"])
            out.append(q)
        if len(out) == n:
            break
    return out
