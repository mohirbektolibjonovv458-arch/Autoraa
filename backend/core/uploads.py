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


# --- Video (ustalar hikoyalari) ---
MAX_VIDEO_MB = 100
MAX_VIDEO_SECONDS = 60
VIDEO_FORMATS = {".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm"}


def sniff_video(head):
    if head[4:8] == b"ftyp":
        return ".mov" if head[8:12] == b"qt  " else ".mp4"
    if head[:4] == b"\x1aE\xdf\xa3":
        return ".webm"
    return None


def mp4_duration(f):
    """MP4/MOV davomiyligi (soniya) — moov/mvhd qutisidan, faylni to'liq o'qimasdan. Topilmasa None."""
    import struct
    try:
        f.seek(0, 2)
        end = f.tell()

        def boxes(start, stop):
            pos = start
            while pos + 8 <= stop:
                f.seek(pos)
                size, kind = struct.unpack(">I4s", f.read(8))
                hdr = 8
                if size == 1:
                    size = struct.unpack(">Q", f.read(8))[0]
                    hdr = 16
                elif size == 0:
                    size = stop - pos
                if size < hdr:
                    return
                yield kind, pos + hdr, pos + size
                pos += size

        for kind, body, stop in boxes(0, end):
            if kind != b"moov":
                continue
            for k2, b2, _ in boxes(body, stop):
                if k2 == b"mvhd":
                    f.seek(b2)
                    version = f.read(1)[0]
                    f.read(3)
                    if version == 1:
                        f.read(16)
                        scale, dur = struct.unpack(">IQ", f.read(12))
                    else:
                        f.read(8)
                        scale, dur = struct.unpack(">II", f.read(8))
                    return dur / scale if scale else None
        return None
    except Exception:
        return None
    finally:
        f.seek(0)


def check_video(f):
    """Hikoya videosi: hajm, haqiqiy format (sehrli baytlar) va davomiylik. Qaytaradi: (kengaytma, None) yoki (None, xato)."""
    if not f:
        return None, None
    if f.size > MAX_VIDEO_MB * 1024 * 1024:
        return None, f"Video {MAX_VIDEO_MB} MB dan oshmasligi kerak."
    head = f.read(16)
    f.seek(0)
    ext = sniff_video(head)
    if not ext:
        return None, "Fayl video emas yoki format qo'llab-quvvatlanmaydi (MP4, MOV, WEBM)."
    if ext in (".mp4", ".mov"):
        d = mp4_duration(f)
        if d is not None and d > MAX_VIDEO_SECONDS + 1:
            return None, f"Video {MAX_VIDEO_SECONDS} soniyadan uzun bo'lmasin."
    return ext, None


@deconstructible
class VideoUploadTo:
    def __init__(self, folder):
        self.folder = folder

    def __call__(self, instance, filename):
        ext = os.path.splitext(filename)[1].lower()
        if ext not in VIDEO_FORMATS:
            ext = ".mp4"
        return f"{self.folder}/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{ext}"

    def __eq__(self, other):
        return isinstance(other, VideoUploadTo) and other.folder == self.folder
