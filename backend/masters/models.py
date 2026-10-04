from django.conf import settings
from django.db import models

from core.uploads import UploadTo, VideoUploadTo, validate_image
from django.db.models import Avg, Count

SPECIALTIES = [
    ("motor", "Motor"), ("elektrik", "Elektrik"), ("hodovoy", "Hodovoy"), ("diagnostika", "Diagnostika"),
    ("tormoz", "Tormoz"), ("konditsioner", "Konditsioner"), ("kuzov", "Kuzov"), ("shina", "Shina"),
]


class MasterProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="master")
    title = models.CharField(max_length=100, blank=True, help_text="Masalan: Azizbek Auto Service")
    specialties = models.JSONField(default=list, blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    address = models.CharField(max_length=200, blank=True)
    work_hours = models.CharField(max_length=40, default="08:00 - 20:00")
    is_24_7 = models.BooleanField(default=False)
    work_days = models.JSONField(default=list, blank=True)  # ish kunlari: 0=Du … 6=Ya; bo'sh — har kuni
    bio = models.TextField(max_length=2000, blank=True)
    cover = models.ImageField(upload_to=UploadTo("masters"), validators=[validate_image], blank=True, null=True)
    rating = models.FloatField(default=0)
    reviews_count = models.PositiveIntegerField(default=0)
    completed_jobs = models.PositiveIntegerField(default=0)
    is_verified = models.BooleanField(default=False)

    def recalc_rating(self):
        agg = self.reviews.aggregate(a=Avg("rating"), c=Count("id"))
        self.rating = round(agg["a"] or 0, 1)
        self.reviews_count = agg["c"]
        self.save(update_fields=["rating", "reviews_count"])

    def __str__(self):
        return self.title or self.user.full_name


class Service(models.Model):
    master = models.ForeignKey(MasterProfile, on_delete=models.CASCADE, related_name="services")
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=SPECIALTIES, default="motor")
    price = models.PositiveIntegerField()
    duration = models.CharField(max_length=20, default="1 soat")

    def __str__(self):
        return self.name


class Booking(models.Model):
    STATUSES = [
        ("pending", "Kutilmoqda"), ("confirmed", "Tasdiqlangan"), ("in_progress", "Bajarilmoqda"),
        ("completed", "Bajarildi"), ("cancelled", "Bekor qilindi"),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings")
    master = models.ForeignKey(MasterProfile, on_delete=models.CASCADE, related_name="bookings")
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True)
    service_name = models.CharField(max_length=100)
    vehicle = models.ForeignKey("garage.Vehicle", on_delete=models.SET_NULL, null=True, blank=True)
    date = models.DateField()
    time = models.CharField(max_length=5)
    price = models.PositiveIntegerField(default=0)
    note = models.TextField(max_length=500, blank=True)
    status = models.CharField(max_length=12, choices=STATUSES, default="pending")
    reminded = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Review(models.Model):
    master = models.ForeignKey(MasterProfile, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    booking = models.OneToOneField(Booking, on_delete=models.SET_NULL, null=True, blank=True, related_name="review")
    rating = models.PositiveSmallIntegerField(default=5)
    text = models.TextField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class FavoriteMaster(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    master = models.ForeignKey(MasterProfile, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("user", "master")


class MasterPhoto(models.Model):
    """Usta ishlaridan namunalar (portfolio)."""
    master = models.ForeignKey(MasterProfile, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to=UploadTo("portfolio"), validators=[validate_image])  # «keyin» (yoki yagona rasm)
    before = models.ImageField(upload_to=UploadTo("portfolio"), validators=[validate_image], null=True, blank=True)  # «oldin»
    caption = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ReviewPhoto(models.Model):
    """Mijoz sharhiga biriktirgan rasm (bajarilgan ish natijasi)."""
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to=UploadTo("reviews"), validators=[validate_image])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]


class Story(models.Model):
    """Usta hikoyasi (story): rasm yoki video (+ qisqa matn). 24 soatdan keyin ko'rinmaydi va fon jarayoni uni (fayli bilan) o'chiradi."""
    LIFETIME_HOURS = 24
    MAX_ACTIVE = 10  # bir ustada bir vaqtda ko'pi bilan
    master = models.ForeignKey(MasterProfile, on_delete=models.CASCADE, related_name="stories")
    image = models.ImageField(upload_to=UploadTo("stories"), validators=[validate_image], blank=True)  # rasm yoki video muqovasi
    video = models.FileField(upload_to=VideoUploadTo("stories-video"), blank=True, null=True)
    duration = models.PositiveSmallIntegerField(null=True, blank=True)  # video, soniya
    caption = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ["created_at"]


class StoryView(models.Model):
    """Kim ko'rgan — halqa kulrang bo'lishi va usta «N kishi ko'rdi» ni bilishi uchun (bir kishi — bir marta)."""
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name="views")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("story", "user")
