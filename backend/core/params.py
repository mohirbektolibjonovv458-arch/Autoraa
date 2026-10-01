"""Foydalanuvchi yuborgan son parametrlarini xavfsiz o'qish (noto'g'ri qiymat — standart qiymat, 500 xato emas)."""
import math


def int_param(value, default, lo=None, hi=None):
    try:
        v = int(str(value).strip())
    except (TypeError, ValueError):
        return default
    if lo is not None:
        v = max(lo, v)
    if hi is not None:
        v = min(hi, v)
    return v


def float_param(value, default=None, lo=None, hi=None):
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(v):
        return default
    if (lo is not None and v < lo) or (hi is not None and v > hi):
        return default
    return v


def text_param(value, max_len=100):
    return str(value or "").strip()[:max_len]


def str_in(value):
    """Foydalanuvchi matn o'rniga ro'yxat/obyekt yuborsa — bo'sh satr (TypeError/500 emas)."""
    return value.strip() if isinstance(value, str) else ""
