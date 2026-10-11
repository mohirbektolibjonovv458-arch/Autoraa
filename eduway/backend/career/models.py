from django.conf import settings
from django.db import models


class Career(models.Model):
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=120)
    icon = models.CharField(max_length=30, default="briefcase")
    summary = models.TextField()
    riasec = models.CharField(max_length=3)  # Holland kodi, masalan "IRC"
    field = models.CharField(max_length=40)  # universitet yo'nalishlari bilan bog'lanadi (Program.field)
    duties = models.JSONField(default=list)
    skills = models.JSONField(default=list)
    subjects = models.JSONField(default=list)
    interests = models.JSONField(default=list)
    study_directions = models.JSONField(default=list)
    growth_path = models.JSONField(default=list)
    outlook_note = models.CharField(max_length=300, blank=True)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title


class CareerResult(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="career_results")
    answers = models.JSONField()
    scores = models.JSONField()  # {"R": 40, "I": 85, ...}
    matches = models.JSONField()  # [{"slug":..., "match": 87, "reasons": [...]}]
    ai_advice = models.TextField(blank=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created"]


class SavedCareer(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_careers")
    career = models.ForeignKey(Career, on_delete=models.CASCADE)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "career")
