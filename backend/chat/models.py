from django.conf import settings
from django.db import models

from core.uploads import AudioUploadTo, UploadTo, validate_image


class Conversation(models.Model):
    user1 = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    user2 = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user1", "user2")
        ordering = ["-updated_at"]

    def other(self, user):
        return self.user2 if self.user1_id == user.id else self.user1


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField(max_length=2000, blank=True)
    image = models.ImageField(upload_to=UploadTo("chat"), validators=[validate_image], blank=True, null=True)
    audio = models.FileField(upload_to=AudioUploadTo("chat-audio"), blank=True, null=True)  # ovozli xabar
    audio_duration = models.PositiveSmallIntegerField(null=True, blank=True)  # soniya
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)  # «o'chirildi» — mazmun va fayllar o'chiriladi, joyi qoladi
    # har qanday o'zgarish (tahrir, o'chirish, o'qildi) — ikkinchi tomon chat oynasini shu bo'yicha yangilaydi
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        ordering = ["id"]
