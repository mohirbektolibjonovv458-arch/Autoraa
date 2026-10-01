from django.contrib import admin

from .models import AuthCode, TelegramLink, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("phone", "first_name", "last_name", "role", "premium_until", "is_active")
    list_filter = ("role", "is_active")
    search_fields = ("phone", "first_name", "last_name")


admin.site.register(TelegramLink)
admin.site.register(AuthCode)
