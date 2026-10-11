from django.contrib import admin

from .models import Conversation, Message, UsageDay

admin.site.register(Conversation)
admin.site.register(Message)
admin.site.register(UsageDay)
