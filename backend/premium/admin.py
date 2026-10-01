from django.contrib import admin

from .models import PremiumBotChat, PremiumPayment


@admin.register(PremiumPayment)
class PremiumPaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "amount", "months", "status", "source", "created_at")
    list_filter = ("status", "source")


admin.site.register(PremiumBotChat)
