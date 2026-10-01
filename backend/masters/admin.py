from django.contrib import admin

from .models import Booking, FavoriteMaster, MasterProfile, Review, Service

admin.site.register(MasterProfile)
admin.site.register(Service)
admin.site.register(Booking)
admin.site.register(Review)
admin.site.register(FavoriteMaster)
