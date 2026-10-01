from django.conf import settings
from django.db import models

from core.uploads import UploadTo, validate_image


class Vehicle(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vehicles")
    brand = models.CharField(max_length=40)
    model = models.CharField(max_length=60, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    engine = models.CharField(max_length=20, blank=True, default="")
    FUEL_TYPES = [("metan", "Metan"), ("propan", "Propan"), ("benzin", "Benzin"), ("dizel", "Dizel"), ("elektr", "Elektr")]
    fuel_type = models.CharField(max_length=10, choices=FUEL_TYPES, blank=True, default="")  # SAFAR shu turni ustuvor ko'rsatadi
    transmission = models.CharField(max_length=20, blank=True, default="")
    color = models.CharField(max_length=30, blank=True)
    plate = models.CharField(max_length=15, blank=True)
    vin = models.CharField(max_length=20, blank=True)
    mileage = models.PositiveIntegerField(default=0)
    # Qolgan km lar faqat egasi kiritganda to'ldiriladi — bo'sh (null) = «ma'lumot kiritilmagan», 0%
    next_service_km = models.PositiveIntegerField(null=True, blank=True)
    oil_change_km = models.PositiveIntegerField(null=True, blank=True)
    tire_km = models.PositiveIntegerField(null=True, blank=True)
    inspection_km = models.PositiveIntegerField(null=True, blank=True)
    image = models.ImageField(upload_to=UploadTo("cars"), validators=[validate_image], blank=True, null=True)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_primary", "-created_at"]

    def __str__(self):
        return " ".join(str(x) for x in (self.brand, self.model, self.year) if x)


class ServiceRecord(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="records")
    title = models.CharField(max_length=120)
    date = models.DateField()
    mileage = models.PositiveIntegerField(default=0)
    cost = models.PositiveIntegerField(default=0)
    master_name = models.CharField(max_length=100, blank=True)
    note = models.TextField(max_length=1000, blank=True)

    class Meta:
        ordering = ["-date"]


class CarDocument(models.Model):
    """Avtomobil hujjatlari — muddati tugashidan oldin eslatma yuboriladi."""
    KINDS = [
        ("osago", "Sug'urta (OSAGO)"), ("kasko", "KASKO"), ("texosmotr", "Texnik ko'rik"),
        ("ishonchnoma", "Ishonchnoma"), ("tonirovka", "Tonirovka ruxsatnomasi"),
        ("gaz", "Gaz ballon guvohnomasi"), ("prava", "Haydovchilik guvohnomasi"), ("boshqa", "Boshqa"),
    ]
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="documents")
    kind = models.CharField(max_length=12, choices=KINDS, default="osago")
    title = models.CharField(max_length=100, blank=True)
    number = models.CharField(max_length=50, blank=True)
    expires_on = models.DateField()
    note = models.CharField(max_length=200, blank=True)
    last_reminded = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["expires_on"]


class Expense(models.Model):
    """Avtomobil xarajatlari: yoqilg'i, servis, jarima..."""
    CATS = [
        ("yoqilgi", "Yoqilg'i"), ("servis", "Servis va ta'mir"), ("zapchast", "Ehtiyot qism"),
        ("yuvish", "Yuvish"), ("parkovka", "Parkovka"), ("jarima", "Jarima"),
        ("sugurta", "Sug'urta va hujjat"), ("boshqa", "Boshqa"),
    ]
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="expenses")
    category = models.CharField(max_length=10, choices=CATS, default="yoqilgi")
    amount = models.PositiveIntegerField()
    date = models.DateField()
    mileage = models.PositiveIntegerField(null=True, blank=True)
    liters = models.FloatField(null=True, blank=True)
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]
