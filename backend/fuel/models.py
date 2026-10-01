from django.conf import settings
from django.db import models

FUELS = [("metan", "Metan"), ("propan", "Propan"), ("benzin", "Benzin"), ("dizel", "Dizel"), ("elektr", "Elektr quvvatlash")]
FUEL_UNITS = {"metan": "m³", "propan": "l", "benzin": "l", "dizel": "l", "elektr": "kVt·s"}
STATUSES = [
    ("bor", "Bor, navbatsiz"),
    ("navbat_kichik", "Bor, navbat kichik"),
    ("navbat_katta", "Bor, navbat katta"),
    ("yoq", "Yo'q"),
    ("yopiq", "Yopiq"),
]
STATUS_LABELS = dict(STATUSES)
AVAILABLE = {"bor", "navbat_kichik", "navbat_katta"}


class FuelStation(models.Model):
    name = models.CharField(max_length=150)
    brand = models.CharField(max_length=80, blank=True)
    address = models.CharField(max_length=250, blank=True)
    lat = models.FloatField(db_index=True)
    lng = models.FloatField(db_index=True)
    fuels = models.JSONField(default=list)  # ["metan", "benzin", ...]
    is_24_7 = models.BooleanField(default=False)
    opening_hours = models.CharField(max_length=120, blank=True)  # OSM formati, masalan "Mo-Su 07:00-23:00"
    phone = models.CharField(max_length=30, blank=True)
    # yoqilg'i turi OSM teglari (fuel:cng, fuel:lpg ...) yoki foydalanuvchi/admin tomonidan tasdiqlanganmi;
    # False — turi faqat nomidan taxmin qilingan
    fuels_confirmed = models.BooleanField(default=False)
    region = models.CharField(max_length=40, blank=True, db_index=True)
    source = models.CharField(max_length=10, default="user")  # osm | user | admin
    external_id = models.CharField(max_length=40, blank=True, db_index=True)
    added_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class FuelReport(models.Model):
    """Foydalanuvchi belgisi: shu shoxobchada shu yoqilg'i hozir bormi, navbat qanday, narx qancha."""
    station = models.ForeignKey(FuelStation, on_delete=models.CASCADE, related_name="reports")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="fuel_reports")
    fuel = models.CharField(max_length=10, choices=FUELS)
    status = models.CharField(max_length=15, choices=STATUSES)
    price = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["station", "fuel", "-created_at"])]


class FuelSubscription(models.Model):
    """«Gaz kelsa xabar bering» — sevimli shoxobcha."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="fuel_subs")
    station = models.ForeignKey(FuelStation, on_delete=models.CASCADE, related_name="subs")
    fuel = models.CharField(max_length=10, choices=FUELS, default="metan")
    last_notified = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "station", "fuel")


class FuelImport(models.Model):
    """OpenStreetMap'dan import tarixi (haftalik avtomatik yangilanish uchun)."""
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    ok = models.BooleanField(default=False)
    total = models.PositiveIntegerField(default=0)
    added = models.PositiveIntegerField(default=0)
    updated = models.PositiveIntegerField(default=0)
    deactivated = models.PositiveIntegerField(default=0)
    source = models.CharField(max_length=20, default="overpass")
    error = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-started_at"]
