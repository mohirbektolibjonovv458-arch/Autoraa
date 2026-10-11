from django.contrib import admin

from .models import ActivityDay, Achievement, ErrorLog, Notification

for m in (Notification, ActivityDay, Achievement):
    admin.site.register(m)


@admin.register(ErrorLog)
class ErrorLogAdmin(admin.ModelAdmin):
    list_display = ("created", "source", "code", "user")
    list_filter = ("source",)
