"""SAFAR — aqlli yo'l yordamchisi.
Maxfiylik: foydalanuvchining GPS izi (trek) saqlanmaydi — faqat marshrut (yo'l chizig'i) va oxirgi nuqta;
oxirgi nuqta safar yakunlanishi bilan o'chiriladi."""
from django.conf import settings
from django.db import models


class TripSettings(models.Model):
    """SAFAR eslatmalari — umumiy bildirishnomalardan mustaqil, foydalanuvchi bo'yicha saqlanadi."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trip_settings")
    enabled = models.BooleanField(default=True)          # Safar eslatmalari
    voice = models.BooleanField(default=True)            # AI ovozli yordamchi
    fuel_alerts = models.BooleanField(default=True)      # Yoqilg'i AI
    safety_alerts = models.BooleanField(default=True)    # Xavfsizlik AI
    periodic = models.BooleanField(default=True)         # davriy eslatma
    interval_min = models.PositiveSmallIntegerField(default=20)


class Trip(models.Model):
    STATUSES = [("active", "Davom etmoqda"), ("finished", "Yakunlangan"), ("cancelled", "Bekor qilingan")]
    FUELS = [("metan", "Metan"), ("propan", "Propan"), ("benzin", "Benzin"), ("dizel", "Dizel"), ("elektr", "Elektr")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trips")
    vehicle = models.ForeignKey("garage.Vehicle", null=True, blank=True, on_delete=models.SET_NULL, related_name="trips")
    fuel = models.CharField(max_length=10, choices=FUELS, default="metan")
    start_name = models.CharField(max_length=120)
    start_lat = models.FloatField()
    start_lng = models.FloatField()
    dest_name = models.CharField(max_length=120)
    dest_lat = models.FloatField()
    dest_lng = models.FloatField()
    route = models.JSONField(default=list)          # [[lat, lng], ...] — yo'l chizig'i (≤ 600 nuqta)
    stations = models.JSONField(default=list)       # yo'l bo'yidagi shoxobchalar (safar boshlanganda olingan)
    services = models.JSONField(default=list)       # yo'l bo'yidagi ustalar va evakuatorlar
    distance_km = models.FloatField(default=0)
    duration_min = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=10, choices=STATUSES, default="active", db_index=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    progress_km = models.FloatField(default=0)      # yo'l boshidan bosib o'tilgan eng uzoq nuqta
    fuel_stops = models.PositiveSmallIntegerField(default=0)
    last_lat = models.FloatField(null=True, blank=True)
    last_lng = models.FloatField(null=True, blank=True)
    last_seen = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]


class TripNotification(models.Model):
    """AI yordamchi xabarlari tarixi. dedup_key — bitta hodisa bitta safarda faqat bir marta."""
    KINDS = [("start", "Boshlanish"), ("fuel", "Yoqilg'i"), ("gap", "Yoqilg'i ogohlantirishi"), ("safety", "Xavfsizlik"),
             ("service", "Servis"), ("arrive", "Manzil"), ("finish", "Yakun")]
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=10, choices=KINDS)
    message = models.CharField(max_length=240)
    trigger_km = models.FloatField(null=True, blank=True)      # masofa sababi (qaysi km da)
    trigger_min = models.PositiveIntegerField(null=True, blank=True)  # vaqt sababi (safarning nechanchi daqiqasi)
    station_id = models.IntegerField(null=True, blank=True)
    dedup_key = models.CharField(max_length=80)
    spoken = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [models.UniqueConstraint(fields=["trip", "dedup_key"], name="trip_notification_once")]
