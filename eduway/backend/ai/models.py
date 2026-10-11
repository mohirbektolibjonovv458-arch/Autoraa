from django.conf import settings
from django.db import models

MODES = [("tutor", "AI Tutor"), ("english", "English Coach"), ("career", "Career Advisor"), ("planner", "Study Planner"), ("speaking", "Speaking")]


class Conversation(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations")
    mode = models.CharField(max_length=10, choices=MODES, default="tutor")
    title = models.CharField(max_length=120, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated"]


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=10, choices=[("user", "user"), ("assistant", "assistant")])
    content = models.TextField()
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    feedback = models.CharField(max_length=4, blank=True)  # good / bad
    feedback_note = models.CharField(max_length=300, blank=True)
    reviewed = models.BooleanField(default=False)  # admin ko'rib chiqdi
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created", "id"]


class UsageDay(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_usage")
    date = models.DateField()
    count = models.PositiveIntegerField(default=0)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("user", "date")


class WritingReview(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="writing_reviews")
    task_type = models.CharField(max_length=10)
    prompt = models.TextField(blank=True)
    text = models.TextField()
    result = models.JSONField()
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created"]
