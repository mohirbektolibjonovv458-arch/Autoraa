"""API xatolarini bir xil formatga keltiradi: {"detail": "o'zbekcha tushunarli matn"}.
Kutilmagan xatolar logga yoziladi, foydalanuvchiga esa texnik tafsilot ko'rsatilmaydi."""
import logging
import re

from rest_framework import status
from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import exception_handler

log = logging.getLogger("avtora")

FIELDS = {
    "name": "Nomi", "title": "Sarlavha", "price": "Narx", "amount": "Summa", "date": "Sana", "time": "Vaqt",
    "phone": "Telefon", "first_name": "Ism", "last_name": "Familiya", "email": "Email", "address": "Manzil",
    "brand": "Marka", "model": "Model", "year": "Yil", "mileage": "Probeg", "plate": "Davlat raqami",
    "category": "Kategoriya", "stock": "Soni", "old_price": "Eski narx", "image": "Rasm", "avatar": "Rasm",
    "logo": "Logo", "cover": "Rasm", "receipt": "Chek", "expires_on": "Muddat", "kind": "Turi", "text": "Matn",
    "body": "Matn", "quantity": "Soni", "rating": "Baho", "service": "Xizmat", "liters": "Litr", "lat": "Joylashuv",
    "lng": "Joylashuv", "months": "Muddat", "cost": "Narx", "note": "Izoh", "duration": "Davomiyligi",
}
MESSAGES = [
    (r"This field is required", "majburiy maydon"),
    (r"This field may not be blank", "bo'sh bo'lishi mumkin emas"),
    (r"This field may not be null", "to'ldirilishi kerak"),
    (r"A valid integer is required", "butun son kiriting"),
    (r"A valid number is required", "raqam kiriting"),
    (r"Date has wrong format", "sana noto'g'ri (YYYY-MM-DD)"),
    (r"Enter a valid email address", "email noto'g'ri"),
    (r"Ensure this value is greater than or equal to (\d+)", r"kamida \1 bo'lishi kerak"),
    (r"Ensure this value is less than or equal to (\d+)", r"ko'pi bilan \1 bo'lishi kerak"),
    (r"Ensure this field has no more than (\d+) characters", r"ko'pi bilan \1 ta belgi"),
    (r"is not a valid choice", "noto'g'ri qiymat"),
    (r"Upload a valid image", "rasm fayli emas yoki buzilgan"),
    (r"The submitted data was not a file", "fayl tanlang"),
    (r"Invalid pk", "topilmadi"),
]
GENERIC = {
    "not_authenticated": "Tizimga kiring.",
    "authentication_failed": "Sessiya muddati tugadi. Qayta kiring.",
    "token_not_valid": "Sessiya muddati tugadi. Qayta kiring.",
    "permission_denied": "Bu amal uchun ruxsatingiz yo'q.",
    "not_found": "Topilmadi.",
    "method_not_allowed": "Bu amal ruxsat etilmagan.",
    "parse_error": "So'rov noto'g'ri yuborildi.",
    "unsupported_media_type": "Fayl turi qo'llab-quvvatlanmaydi.",
}


def tr(msg):
    msg = str(msg)
    for rx, uz in MESSAGES:
        if re.search(rx, msg):
            return re.sub(r".*?" + rx + r".*", uz, msg, flags=re.S) if "\\1" in uz else uz
    return msg


def first_error(data, prefix=""):
    if isinstance(data, list):
        return first_error(data[0], prefix) if data else ""
    if isinstance(data, dict):
        for k, v in data.items():
            if k in ("detail", "non_field_errors"):
                return first_error(v, prefix)
            label = FIELDS.get(k, k)
            return first_error(v, f"{label}: ")
    return prefix + tr(data)


def api_exception_handler(exc, context):
    from django.core.exceptions import ValidationError as DjangoValidationError
    if isinstance(exc, DjangoValidationError):  # masalan, rasm tekshiruvidan o'tmadi
        return Response({"detail": exc.messages[0] if exc.messages else "Ma'lumot noto'g'ri."}, status=400)
    resp = exception_handler(exc, context)
    if resp is None and isinstance(exc, (TypeError, AttributeError, ValueError)) and context.get("request") is not None \
            and context["request"].method in ("POST", "PUT", "PATCH", "DELETE"):
        # foydalanuvchi kutilmagan turdagi ma'lumot yubordi (ro'yxat/son o'rniga matn va h.k.) — 400, sabab logda
        log.warning("Noto'g'ri formatdagi so'rov: %s %s", context["request"].path, exc)
        return Response({"detail": "Ma'lumotlar noto'g'ri formatda."}, status=status.HTTP_400_BAD_REQUEST)
    if resp is None:
        log.exception("Kutilmagan xato: %s", context.get("view").__class__.__name__ if context.get("view") else "?")
        return Response({"detail": "Serverda kutilmagan xatolik. Birozdan so'ng qayta urinib ko'ring."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    if isinstance(exc, Throttled):
        wait = int(exc.wait or 60)
        resp.data = {"detail": f"Juda ko'p urinish. {wait} soniyadan so'ng qayta urinib ko'ring.", "wait": wait}
        return resp
    data = resp.data
    if isinstance(data, dict) and isinstance(data.get("detail"), str):
        codes = exc.get_codes() if hasattr(exc, "get_codes") else None
        c = data.get("code") if isinstance(data.get("code"), str) else (codes if isinstance(codes, str) else getattr(exc, "default_code", None))
        if _is_english(data["detail"]):
            data["detail"] = GENERIC.get(c) or tr(data["detail"])
        data.pop("messages", None)
        return resp
    resp.data = {"detail": first_error(data) or "Ma'lumotlar noto'g'ri.", "errors": data}
    return resp


def _is_english(s):
    return bool(re.match(r"^(Authentication|Given token|You do not|Not found|No |Method|Unsupported|JSON parse|Token|User|Invalid|Incorrect|This|A valid)", str(s)))
