from rest_framework import serializers

from .models import BlogPost, Notification, SiteSettings


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "body", "link", "is_read", "created_at"]


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        exclude = ["id"]


class BlogPostSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = BlogPost
        fields = ["id", "title", "category", "category_label", "excerpt", "body", "image", "is_published", "created_at"]
