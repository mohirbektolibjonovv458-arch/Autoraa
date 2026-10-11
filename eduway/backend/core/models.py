from django.conf import settings
from django.db import models


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=160)
    body = models.TextField(blank=True)
    link = models.CharField(max_length=200, blank=True)  # ilova ichidagi yo'l, masalan /grants/3
    kind = models.CharField(max_length=30, default="info")
    read = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created"]


class ActivityDay(models.Model):
    """Bir kunlik faollik — streak, grafiklar va statistika shundan hisoblanadi."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activity")
    date = models.DateField()
    xp = models.PositiveIntegerField(default=0)
    tasks_done = models.PositiveIntegerField(default=0)
    quizzes = models.PositiveIntegerField(default=0)
    ai_messages = models.PositiveIntegerField(default=0)
    words_reviewed = models.PositiveIntegerField(default=0)
    lessons = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("user", "date")
        ordering = ["-date"]


class Achievement(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="achievements")
    code = models.CharField(max_length=40)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "code")
        ordering = ["-earned_at"]


class ErrorLog(models.Model):
    source = models.CharField(max_length=40)  # ai, server, ...
    code = models.CharField(max_length=60, blank=True)
    message = models.TextField()
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created"]
