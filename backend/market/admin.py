from django.contrib import admin

from .models import PartOrder, Product, Shop

admin.site.register(Shop)
admin.site.register(Product)
admin.site.register(PartOrder)
