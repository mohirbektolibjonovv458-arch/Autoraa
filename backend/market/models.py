from django.conf import settings
from django.db import models

from core.uploads import UploadTo, validate_image
from django.utils import timezone

CATEGORIES = [
    ("motor", "Motor"), ("filtr", "Filtrlar"), ("tormoz", "Tormoz"), ("hodovoy", "Hodovoy"),
    ("elektr", "Elektrika"), ("kuzov", "Kuzov"), ("moy", "Moylar"), ("shina", "Shina va disk"), ("boshqa", "Boshqa"),
]


class Shop(models.Model):
    """Usta zapchast do'koni. Faqat premium faol bo'lganda ochiq."""
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shop")
    name = models.CharField(max_length=100)
    description = models.TextField(max_length=2000, blank=True)
    address = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    logo = models.ImageField(upload_to=UploadTo("shops"), validators=[validate_image], blank=True, null=True)
    is_active = models.BooleanField(default=True, help_text="Admin tomonidan bloklash uchun")
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_open(self):
        return self.is_active and self.owner.is_premium

    def __str__(self):
        return self.name


class ProductQuerySet(models.QuerySet):
    def visible(self):
        return self.filter(is_active=True, shop__is_active=True, shop__owner__premium_until__gt=timezone.now())


class Product(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=150)
    brand = models.CharField(max_length=60, blank=True)
    sku = models.CharField(max_length=60, blank=True)
    category = models.CharField(max_length=10, choices=CATEGORIES, default="boshqa")
    compatible = models.CharField(max_length=200, blank=True, help_text="Mos avtomobillar, masalan: Chevrolet Cobalt 2022")
    condition = models.CharField(max_length=10, choices=[("new", "Yangi"), ("used", "Ishlatilgan")], default="new")
    price = models.PositiveIntegerField()
    old_price = models.PositiveIntegerField(null=True, blank=True)
    stock = models.PositiveIntegerField(default=1)
    image = models.ImageField(upload_to=UploadTo("products"), validators=[validate_image], blank=True, null=True)
    description = models.TextField(max_length=3000, blank=True)
    rating = models.FloatField(default=0)
    reviews = models.PositiveIntegerField(default=0)
    sold = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]


class PartOrder(models.Model):
    STATUSES = [("new", "Yangi"), ("confirmed", "Tasdiqlangan"), ("shipped", "Yetkazilmoqda"),
                ("delivered", "Yetkazildi"), ("cancelled", "Bekor qilindi")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="part_orders")
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="orders")
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=150)
    quantity = models.PositiveIntegerField(default=1)
    price = models.PositiveIntegerField()
    total = models.PositiveIntegerField()
    address = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="new")
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
