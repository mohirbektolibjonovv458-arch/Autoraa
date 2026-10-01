"""Yuklanadigan fayllar: tasodifiy nom (URL'ni taxmin qilib bo'lmaydi) va hajm/tur tekshiruvi."""
import os
import uuid

from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.deconstruct import deconstructible

MAX_IMAGE_MB = 10
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}


@deconstructible
class UploadTo:
    def __init__(self, folder):
        self.folder = folder

    def __call__(self, instance, filename):
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXT:
            ext = ".jpg"
        return f"{self.folder}/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{ext}"

    def __eq__(self, other):
        return isinstance(other, UploadTo) and other.folder == self.folder


def validate_image(f):
    if f.size > MAX_IMAGE_MB * 1024 * 1024:
        raise ValidationError(f"Rasm hajmi {MAX_IMAGE_MB} MB dan oshmasligi kerak.")
    ext = os.path.splitext(getattr(f, "name", ""))[1].lower()
    if ext and ext not in ALLOWED_EXT:
        raise ValidationError("Faqat rasm fayllari (JPG, PNG, WEBP) qabul qilinadi.")


def check_image(f):
    """View ichida to'g'ridan-to'g'ri saqlanadigan rasmlar uchun: hajm, kengaytma va haqiqiy rasm ekanini tekshiradi.
    Xato bo'lsa matn, bo'lmasa None qaytaradi."""
    if not f:
        return None
    try:
        validate_image(f)
    except ValidationError as e:
        return e.messages[0]
    try:
        from PIL import Image
        img = Image.open(f)
        img.verify()
    except Exception:
        return "Fayl rasm emas yoki buzilgan."
    finally:
        f.seek(0)
    return None
