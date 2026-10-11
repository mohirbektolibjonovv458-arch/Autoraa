from django.conf import settings
from django.db import models


class VerifiedMixin(models.Model):
    """Ma'lumot ishonchliligi: manba havolasi va oxirgi tekshiruv sanasi.
    verified=False bo'lsa, interfeysda «tekshirilmagan» belgisi chiqadi."""

    source_url = models.URLField(blank=True)
    verified = models.BooleanField(default=False)
    last_verified = models.DateField(null=True, blank=True)
    is_published = models.BooleanField(default=True)
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class University(VerifiedMixin):
    TYPES = [("state", "Davlat"), ("private", "Xususiy"), ("branch", "Xorijiy filial"), ("foreign", "Xorijiy")]
    name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=40, blank=True)
    country = models.CharField(max_length=60, default="O'zbekiston")
    city = models.CharField(max_length=80)
    kind = models.CharField(max_length=10, choices=TYPES, default="state")
    website = models.URLField()
    description = models.TextField(blank=True)
    languages = models.JSONField(default=list, blank=True)  # ["o'zbek", "rus", "ingliz"]
    tuition_min = models.PositiveIntegerField(null=True, blank=True)
    tuition_max = models.PositiveIntegerField(null=True, blank=True)
    tuition_currency = models.CharField(max_length=5, default="UZS")
    tuition_note = models.CharField(max_length=300, blank=True)
    ielts_min = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    admission_requirements = models.TextField(blank=True)
    application_start = models.DateField(null=True, blank=True)
    application_end = models.DateField(null=True, blank=True)
    deadline_note = models.CharField(max_length=300, blank=True)
    has_grants = models.BooleanField(null=True)
    grant_note = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["country", "name"]

    def __str__(self):
        return self.name


class Program(models.Model):
    DEGREES = [("bachelor", "Bakalavr"), ("master", "Magistratura"), ("phd", "Doktorantura")]
    university = models.ForeignKey(University, on_delete=models.CASCADE, related_name="programs")
    name = models.CharField(max_length=200)
    field = models.CharField(max_length=40)  # it, medicine, engineering, business, ...
    degree = models.CharField(max_length=10, choices=DEGREES, default="bachelor")
    language = models.CharField(max_length=30, blank=True)
    duration_years = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    tuition = models.PositiveIntegerField(null=True, blank=True)
    note = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["name"]


class FavoriteUniversity(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorite_universities")
    university = models.ForeignKey(University, on_delete=models.CASCADE)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "university")


class Grant(VerifiedMixin):
    LEVELS = [("bachelor", "Bakalavr"), ("master", "Magistratura"), ("phd", "Doktorantura"), ("any", "Turli bosqichlar")]
    FUNDING = [("full", "To'liq moliyalashtirish"), ("partial", "Qisman"), ("tuition", "Faqat o'qish to'lovi"), ("stipend", "Stipendiya")]
    name = models.CharField(max_length=200)
    provider = models.CharField(max_length=200)
    country = models.CharField(max_length=60)
    levels = models.JSONField(default=list)  # ["bachelor", "master"]
    funding = models.CharField(max_length=10, choices=FUNDING, default="full")
    funding_note = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)
    eligibility = models.TextField(blank=True)
    min_age = models.PositiveSmallIntegerField(null=True, blank=True)
    max_age = models.PositiveSmallIntegerField(null=True, blank=True)
    ielts_min = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    language_note = models.CharField(max_length=300, blank=True)
    documents = models.JSONField(default=list, blank=True)
    fields = models.JSONField(default=list, blank=True)  # bo'sh = barcha yo'nalishlar
    deadline = models.DateField(null=True, blank=True)
    deadline_note = models.CharField(max_length=300, blank=True)
    official_url = models.URLField()

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SavedGrant(models.Model):
    STATUSES = [("interested", "Qiziqaman"), ("preparing", "Tayyorlanmoqda"), ("submitted", "Topshirildi"), ("result", "Natija kutilmoqda")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_grants")
    grant = models.ForeignKey(Grant, on_delete=models.CASCADE)
    status = models.CharField(max_length=12, choices=STATUSES, default="interested")
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "grant")
        ordering = ["-created"]


class ChecklistItem(models.Model):
    saved = models.ForeignKey(SavedGrant, on_delete=models.CASCADE, related_name="checklist")
    title = models.CharField(max_length=200)
    done = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
