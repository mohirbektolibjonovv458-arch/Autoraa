from django.contrib import admin

from .models import BlogPost, Notification, PushSubscription, SiteSettings

admin.site.register(SiteSettings)
admin.site.register(BlogPost)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "kind", "event", "title", "push_state", "urgent", "is_read", "created_at")
    list_filter = ("kind", "event", "push_state", "urgent")
    search_fields = ("user__phone", "title")


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    """Qurilmalar push holati: qaysi telefon ulangan, oxirgi muvaffaqiyatli yetkazish va push xizmati xatosi."""
    list_display = ("id", "user", "is_active", "failures", "last_success", "last_error", "last_error_at", "user_agent", "created_at")
    list_filter = ("is_active",)
    search_fields = ("user__phone",)
    exclude = ("endpoint", "p256dh", "auth")  # maxfiy kalitlar admin sahifasida ham ko'rsatilmaydi
    readonly_fields = ("user", "is_active", "failures", "last_success", "last_error", "last_error_at", "user_agent", "created_at")

    def has_add_permission(self, request):
        return False
