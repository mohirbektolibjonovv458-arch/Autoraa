"""Yuklangan barcha rasmlarni saqlashdan oldin xavfsiz holatga keltirish:
- Pillow orqali qayta kodlash (rasm ichiga yashirilgan skript/fayl — «polyglot» — yo'qoladi);
- EXIF metama'lumot, jumladan GPS koordinatalar, olib tashlanadi (foydalanuvchi uyi joylashuvi oshkor bo'lmasin);
- juda katta o'lchamli «decompression bomb» rasmlar rad etiladi;
- orientatsiya saqlanadi, 2560 px dan kattalari kichraytiriladi (disk va trafik tejaladi)."""
import io
import os

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db.models import ImageField
from django.db.models.signals import pre_save
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 40_000_000  # ~40 MP dan kattasi — rad etiladi
try:  # iPhone HEIC/HEIF rasmlari — JPEG ga aylantiriladi
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:  # paket o'rnatilmagan bo'lsa ham qolgan formatlar ishlayveradi
    pass
MAX_SIDE = 2560


def sanitize_image(f):
    f.seek(0)
    try:
        img = Image.open(f)
        img.load()
    except Image.DecompressionBombError:
        raise ValidationError("Rasm o'lchami juda katta.")
    except Exception:
        raise ValidationError("Fayl rasm emas yoki buzilgan.")
    fmt = "PNG" if (img.format or "").upper() == "PNG" and img.mode in ("RGBA", "LA", "P") else "JPEG"
    img = ImageOps.exif_transpose(img)  # telefondagi burilishni saqlab, EXIF ni olib tashlaymiz
    if max(img.size) > MAX_SIDE:
        img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    if fmt == "JPEG":
        img.convert("RGB").save(out, "JPEG", quality=86, optimize=True, progressive=True)
        ext = ".jpg"
    else:
        img.save(out, "PNG", optimize=True)
        ext = ".png"
    name = os.path.splitext(os.path.basename(getattr(f, "name", "image")))[0] + ext
    return ContentFile(out.getvalue(), name=name)


def _sanitize_uploads(sender, instance, **kwargs):
    for field in instance._meta.fields:
        if not isinstance(field, ImageField):
            continue
        file = getattr(instance, field.name)
        if not file or getattr(file, "_committed", True):
            continue  # faqat yangi yuklangan fayl
        # tozalangan nusxa saqlanadi (UploadTo tasodifiy nom beradi)
        setattr(instance, field.name, sanitize_image(file.file if hasattr(file, "file") else file))


def connect():
    pre_save.connect(_sanitize_uploads, dispatch_uid="avtora-image-sanitize")
