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


# --- Ovozli xabarlar (chat) ---
MAX_AUDIO_MB = 5
MAX_AUDIO_SECONDS = 180
# fayl boshidagi «sehrli baytlar» bo'yicha haqiqiy format (kengaytma yoki brauzer aytgan turga ishonilmaydi)
AUDIO_FORMATS = {".webm": "audio/webm", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".aac": "audio/aac"}


def sniff_audio(head):
    if head[:4] == b"\x1aE\xdf\xa3":
        return ".webm"
    if head[:4] == b"OggS":
        return ".ogg"
    if head[4:8] == b"ftyp":
        return ".m4a"
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return ".wav"
    if head[:3] == b"ID3" or head[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return ".mp3"
    if head[:2] in (b"\xff\xf1", b"\xff\xf9"):
        return ".aac"
    return None


def check_audio(f):
    """Ovozli xabar: hajm va haqiqiy audio format. Qaytaradi: (kengaytma, None) yoki (None, xato matni)."""
    if not f:
        return None, None
    if f.size > MAX_AUDIO_MB * 1024 * 1024:
        return None, f"Ovozli xabar {MAX_AUDIO_MB} MB dan oshmasligi kerak."
    head = f.read(16)
    f.seek(0)
    ext = sniff_audio(head)
    if not ext:
        return None, "Fayl ovozli xabar emas yoki format qo'llab-quvvatlanmaydi."
    return ext, None


@deconstructible
class AudioUploadTo:
    """Ovozli xabarlar: tasodifiy nom, kengaytma — faylning haqiqiy formati bo'yicha."""
    def __init__(self, folder):
        self.folder = folder

    def __call__(self, instance, filename):
        ext = os.path.splitext(filename)[1].lower()
        if ext not in AUDIO_FORMATS:
            ext = ".webm"
        return f"{self.folder}/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{ext}"

    def __eq__(self, other):
        return isinstance(other, AudioUploadTo) and other.folder == self.folder
