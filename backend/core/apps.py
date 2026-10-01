from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        from .image_security import connect
        connect()
        _harden_float_fields()
        _relative_media_urls()


def _relative_media_urls():
    """Rasm/fayl manzillari API'da nisbiy («/media/...») qaytadi: sayt qaysi domen, http/https yoki proksi
    (Vite dev, Cloudflare tunnel, Railway) orqali ochilmasin — rasm har doim o'sha manzildan yuklanadi.
    Oldin to'liq «http://…» manzil qaytgani uchun https sahifada yoki boshqa portda rasm oq bo'lib qolardi."""
    from rest_framework import fields

    def to_representation(self, value):
        if not value:
            return None
        try:
            return value.url
        except (AttributeError, ValueError):
            return None

    fields.FileField.to_representation = to_representation


def _harden_float_fields():
    """DRF FloatField «inf»/«nan» qiymatlarini qabul qilardi — bazaga yozilib, keyin API javobini buzardi.
    Endi barcha API'larda faqat chekli sonlar qabul qilinadi; koordinata maydonlari chegarasi ham tekshiriladi."""
    import math
    from rest_framework import fields, serializers

    orig = fields.FloatField.to_internal_value

    def to_internal_value(self, data):
        value = orig(self, data)
        if not math.isfinite(value):
            self.fail("invalid")
        name = getattr(self, "field_name", "") or ""
        if name in ("lat", "latitude") and not -90 <= value <= 90:
            raise serializers.ValidationError("Koordinata noto'g'ri.")
        if name in ("lng", "lon", "longitude") and not -180 <= value <= 180:
            raise serializers.ValidationError("Koordinata noto'g'ri.")
        return value

    fields.FloatField.to_internal_value = to_internal_value
