from django.conf import settings
from django.db import models


class EvacuatorProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="evacuator")
    truck_model = models.CharField(max_length=60, blank=True)
    plate = models.CharField(max_length=15, blank=True)
    base_price = models.PositiveIntegerField(default=150000)
    price_per_km = models.PositiveIntegerField(default=10000)
    is_verified = models.BooleanField(default=False)
    rating = models.FloatField(default=0)
    reviews_count = models.PositiveIntegerField(default=0)
    completed = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.user.full_name} ({self.plate})"


class SOSRequest(models.Model):
    KINDS = [("evakuator", "Evakuator"), ("tezkor_usta", "Tezkor usta"), ("diagnostika", "Diagnostika")]
    STATUSES = [
        ("searching", "Qidirilmoqda"), ("accepted", "Qabul qilindi"), ("on_the_way", "Yo'lda"),
        ("arrived", "Yetib keldi"), ("completed", "Bajarildi"), ("cancelled", "Bekor qilindi"),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sos_requests")
    kind = models.CharField(max_length=12, choices=KINDS, default="evakuator")
    lat = models.FloatField()
    lng = models.FloatField()
    address = models.CharField(max_length=200, blank=True)
    note = models.TextField(max_length=500, blank=True)
    vehicle = models.ForeignKey("garage.Vehicle", on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=12, choices=STATUSES, default="searching")
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    review = models.CharField(max_length=300, blank=True)
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_sos")
    price = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def provider_role(self):
        return "evakuator" if self.kind == "evakuator" else "usta"
