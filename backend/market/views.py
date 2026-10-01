from django.db import transaction
from core.params import int_param, str_in
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsUsta
from core.models import notify

from .models import CATEGORIES, PartOrder, Product, Shop
from .serializers import PartOrderSerializer, ProductSerializer, ShopSerializer

PREMIUM_REQUIRED = {"code": "premium_required",
                    "detail": "Zapchast do'konini ochish uchun Premium obuna kerak (oyiga 40 000 so'm)."}


class PartCategoriesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response([{"key": k, "label": v} for k, v in CATEGORIES])


class ProductListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        p = request.query_params
        qs = Product.objects.visible().select_related("shop")
        if p.get("q"):
            q = p["q"]
            qs = qs.filter(Q(name__icontains=q) | Q(brand__icontains=q) | Q(sku__icontains=q) | Q(compatible__icontains=q))
        if p.get("category"):
            qs = qs.filter(category=p["category"])
        if p.get("car"):
            qs = qs.filter(compatible__icontains=p["car"])
        if p.get("in_stock") == "1":
            qs = qs.filter(stock__gt=0)
        if p.get("shop"):
            qs = qs.filter(shop_id=p["shop"])
        order = {"price": "price", "-price": "-price", "popular": "-sold", "rating": "-rating"}.get(p.get("sort"), "-created_at")
        return Response(ProductSerializer(qs.order_by(order)[:200], many=True, context={"request": request}).data)


class ProductDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        return Response(ProductSerializer(get_object_or_404(Product.objects.visible(), pk=pk), context={"request": request}).data)


class PartOrderView(APIView):
    def get(self, request):
        qs = PartOrder.objects.filter(user=request.user).select_related("shop", "product")
        return Response(PartOrderSerializer(qs, many=True, context={"request": request}).data)

    @transaction.atomic
    def post(self, request):
        items = request.data.get("items") or [{"product": request.data.get("product"), "quantity": request.data.get("quantity", 1)}]
        if not isinstance(items, list) or not 1 <= len(items) <= 30:
            return Response({"detail": "Savat ma'lumotlari noto'g'ri."}, status=400)
        address, phone = str_in(request.data.get("address"))[:250], (str_in(request.data.get("phone")) or request.user.phone)[:30]
        if not address:
            return Response({"detail": "Yetkazib berish manzilini kiriting."}, status=400)
        created = []
        for it in items:
            if not isinstance(it, dict):
                return Response({"detail": "Savat ma'lumotlari noto'g'ri."}, status=400)
            prod = Product.objects.visible().select_for_update().filter(pk=int_param(it.get("product"), 0)).first()
            qty = int_param(it.get("quantity"), 1, 1, 100)
            if not prod:
                return Response({"detail": "Mahsulot topilmadi yoki sotuvdan olingan."}, status=400)
            if prod.shop.owner_id == request.user.id:
                return Response({"detail": "O'z do'koningizdan xarid qila olmaysiz."}, status=400)
            if prod.stock < qty:
                return Response({"detail": f"«{prod.name}» omborda {prod.stock} dona qoldi."}, status=400)
            prod.stock -= qty
            prod.sold += qty
            prod.save(update_fields=["stock", "sold"])
            o = PartOrder.objects.create(user=request.user, shop=prod.shop, product=prod, product_name=prod.name,
                                         quantity=qty, price=prod.price, total=prod.price * qty, address=address, phone=phone)
            notify(prod.shop.owner, "📦 Yangi zapchast buyurtmasi", f"{prod.name} × {qty} — {o.total:,} so'm".replace(",", " "),
                   "order", "/app/usta/shop?tab=orders", telegram=True, dedup=f"po-{o.id}-new")
            created.append(o)
        return Response(PartOrderSerializer(created, many=True, context={"request": request}).data, status=201)


class PartOrderCancelView(APIView):
    def post(self, request, pk):
        o = get_object_or_404(PartOrder, pk=pk, user=request.user)
        if o.status != "new":
            return Response({"detail": "Faqat yangi buyurtmani bekor qilish mumkin."}, status=400)
        o.status = "cancelled"
        o.save(update_fields=["status"])
        if o.product:
            o.product.stock += o.quantity
            o.product.save(update_fields=["stock"])
        notify(o.shop.owner, "Mijoz buyurtmani bekor qildi", o.product_name, "order", "/app/usta/shop?tab=orders", dedup=f"po-{o.id}-cancel")
        return Response(PartOrderSerializer(o, context={"request": request}).data)


# ---------- Usta do'koni (Premium) ----------
class MyShopView(APIView):
    permission_classes = [IsUsta]

    def get(self, request):
        shop = getattr(request.user, "shop", None)
        return Response({
            "is_premium": request.user.is_premium,
            "premium_until": request.user.premium_until,
            "shop": ShopSerializer(shop).data if shop else None,
        })

    def patch(self, request):
        if not request.user.is_premium:
            return Response(PREMIUM_REQUIRED, status=403)
        shop, _ = Shop.objects.get_or_create(owner=request.user, defaults={"name": f"{request.user.full_name} do'koni"})
        s = ShopSerializer(shop, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class MyProductsView(APIView):
    permission_classes = [IsUsta]

    def get(self, request):
        qs = Product.objects.filter(shop__owner=request.user)
        return Response(ProductSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        if not request.user.is_premium:
            return Response(PREMIUM_REQUIRED, status=403)
        shop, _ = Shop.objects.get_or_create(owner=request.user, defaults={"name": f"{request.user.full_name} do'koni"})
        s = ProductSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        s.save(shop=shop)
        return Response(s.data, status=201)


class MyProductDetailView(APIView):
    permission_classes = [IsUsta]

    def patch(self, request, pk):
        if not request.user.is_premium:
            return Response(PREMIUM_REQUIRED, status=403)
        obj = get_object_or_404(Product, pk=pk, shop__owner=request.user)
        s = ProductSerializer(obj, data=request.data, partial=True, context={"request": request})
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)

    def delete(self, request, pk):
        get_object_or_404(Product, pk=pk, shop__owner=request.user).delete()
        return Response(status=204)


class MyShopOrdersView(APIView):
    permission_classes = [IsUsta]

    def get(self, request):
        qs = PartOrder.objects.filter(shop__owner=request.user).select_related("user", "product")
        return Response(PartOrderSerializer(qs, many=True, context={"request": request}).data)


class MyShopOrderStatusView(APIView):
    permission_classes = [IsUsta]

    def post(self, request, pk):
        o = get_object_or_404(PartOrder, pk=pk, shop__owner=request.user)
        new = str_in(request.data.get("status"))
        flow = {"new": {"confirmed", "cancelled"}, "confirmed": {"shipped", "cancelled"}, "shipped": {"delivered"}}
        if new not in flow.get(o.status, set()):
            return Response({"detail": "Bu holatga o'tkazib bo'lmaydi."}, status=400)
        if new == "cancelled" and o.product:
            o.product.stock += o.quantity
            o.product.save(update_fields=["stock"])
        o.status = new
        o.save(update_fields=["status"])
        notify(o.user, f"📦 Buyurtma: {o.get_status_display()}", o.product_name, "order", f"/app/orders?focus=part-{o.id}", telegram=True,
               dedup=f"po-{o.id}-{new}")
        return Response(PartOrderSerializer(o, context={"request": request}).data)


class MyShopStatsView(APIView):
    permission_classes = [IsUsta]

    def get(self, request):
        orders = PartOrder.objects.filter(shop__owner=request.user).exclude(status="cancelled")
        return Response({
            "products": Product.objects.filter(shop__owner=request.user).count(),
            "orders": orders.count(),
            "new_orders": orders.filter(status="new").count(),
            "revenue": orders.filter(status="delivered").aggregate(s=Sum("total"))["s"] or 0,
            "is_premium": request.user.is_premium,
        })


class PublicShopView(APIView):
    """Do'kon sahifasi: ma'lumot va mahsulotlar."""
    permission_classes = [AllowAny]

    def get(self, request, pk):
        shop = get_object_or_404(Shop.objects.select_related("owner"), pk=pk)
        if not shop.is_open:
            return Response({"detail": "Do'kon hozircha yopiq."}, status=404)
        products = Product.objects.visible().filter(shop=shop)
        return Response({"shop": ShopSerializer(shop, context={"request": request}).data, "owner_id": shop.owner_id,
                         "products": ProductSerializer(products, many=True, context={"request": request}).data})


class PartOrderReviewView(APIView):
    """Yetkazilgan buyurtma bo'yicha mahsulotga baho."""

    def post(self, request, pk):
        from django.db.models import Avg, Count
        o = get_object_or_404(PartOrder, pk=pk, user=request.user)
        if o.status != "delivered":
            return Response({"detail": "Faqat yetkazilgan buyurtmaga baho qo'yiladi."}, status=400)
        if o.rating:
            return Response({"detail": "Siz allaqachon baho qo'ygansiz."}, status=400)
        try:
            o.rating = max(1, min(5, int(request.data.get("rating") or 5)))
        except ValueError:
            o.rating = 5
        o.save(update_fields=["rating"])
        if o.product:
            agg = PartOrder.objects.filter(product=o.product, rating__isnull=False).aggregate(r=Avg("rating"), c=Count("id"))
            o.product.rating, o.product.reviews = round(agg["r"] or 0, 1), agg["c"]
            o.product.save(update_fields=["rating", "reviews"])
        return Response({"ok": True})
