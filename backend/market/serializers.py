from rest_framework import serializers

from accounts.serializers import UserShortSerializer

from .models import PartOrder, Product, Shop


class ShopSerializer(serializers.ModelSerializer):
    is_open = serializers.BooleanField(read_only=True)
    products_count = serializers.SerializerMethodField()
    owner_name = serializers.CharField(source="owner.full_name", read_only=True)
    premium_until = serializers.DateTimeField(source="owner.premium_until", read_only=True)

    class Meta:
        model = Shop
        fields = ["id", "name", "description", "address", "phone", "logo", "is_active", "is_open",
                  "products_count", "owner_name", "premium_until", "created_at"]
        read_only_fields = ["is_active"]

    def get_products_count(self, o):
        return o.products.count()


class ProductSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    shop_owner_id = serializers.IntegerField(source="shop.owner_id", read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = Product
        fields = ["id", "shop", "shop_name", "shop_owner_id", "name", "brand", "sku", "category", "category_label",
                  "compatible", "condition", "price", "old_price", "stock", "image", "description", "rating",
                  "reviews", "sold", "is_active", "created_at"]
        read_only_fields = ["shop", "rating", "reviews", "sold"]


class PartOrderSerializer(serializers.ModelSerializer):
    client = UserShortSerializer(source="user", read_only=True)
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = PartOrder
        fields = ["id", "client", "shop", "shop_name", "product", "product_name", "image", "quantity", "price",
                  "total", "address", "phone", "status", "status_label", "created_at"]

    def get_image(self, o):
        req = self.context.get("request")
        if o.product and o.product.image:
            return req.build_absolute_uri(o.product.image.url) if req else o.product.image.url
        return None
