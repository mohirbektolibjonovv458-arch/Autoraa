from django.contrib import admin

from .models import ServiceRecord, Vehicle

admin.site.register(Vehicle)
admin.site.register(ServiceRecord)
