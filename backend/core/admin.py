from django.contrib import admin

from .models import BlogPost, Notification, SiteSettings

admin.site.register(Notification)
admin.site.register(SiteSettings)
admin.site.register(BlogPost)
