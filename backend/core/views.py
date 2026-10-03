from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from evacuator.models import SOSRequest
from market.models import PartOrder, Product
from masters.models import Booking

from .models import BlogPost, SiteSettings
from .serializers import BlogPostSerializer, NotificationSerializer


class PublicSettingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        s = SiteSettings.load()
        return Response({"site_name": s.site_name, "tagline": s.tagline, "currency": s.currency,
                         "support_phone": s.support_phone, "premium_price": s.premium_price, "maintenance": s.maintenance,
                         "map_attribution": settings.MAP_ATTRIBUTION,
                         # Android ilova fayli (frontend/public/avtora.apk yoki APK_URL) — bo'lsa «O'rnatish» darhol shuni yuklaydi
                         "apk_url": settings.APK_URL or ("/avtora.apk" if (settings.FRONTEND_DIR / "avtora.apk").exists() else ""),
                         "sat_enabled": settings.SAT_ENABLED, "sat_attribution": settings.SAT_ATTRIBUTION,
                         # «Google bilan kirish» — ochiq Client ID (maxfiy emas); bo'sh bo'lsa tugma ko'rinmaydi
                         "google_client_id": settings.GOOGLE_CLIENT_IDS[0] if settings.GOOGLE_CLIENT_IDS else ""})


class PublicStatsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "users": User.objects.filter(role="user").count(),
            "masters": User.objects.filter(role="usta").count(),
            "evacuators": User.objects.filter(role="evakuator").count(),
            "parts": Product.objects.visible().count(),
        })


class NotificationListView(APIView):
    def get(self, request):
        qs = request.user.notifications.all()
        if request.query_params.get("unread") == "1":
            qs = qs.filter(is_read=False)
        return Response({"unread": request.user.notifications.filter(is_read=False).count(),
                         "results": NotificationSerializer(qs[:100], many=True).data})


class NotificationReadView(APIView):
    def post(self, request, pk=None):
        qs = request.user.notifications.all()
        if pk:
            qs = qs.filter(pk=pk)
        qs.update(is_read=True)
        return Response({"ok": True})


class BlogListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = BlogPost.objects.filter(is_published=True)
        if request.query_params.get("category"):
            qs = qs.filter(category=request.query_params["category"])
        return Response(BlogPostSerializer(qs, many=True, context={"request": request}).data)


class BlogDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        return Response(BlogPostSerializer(get_object_or_404(BlogPost, pk=pk, is_published=True), context={"request": request}).data)


def unified_orders(bookings, sos_list, part_orders, perspective="client"):
    items = []
    for b in bookings:
        items.append({"uid": f"b{b.id}", "id": b.id, "code": f"#AH{100000 + b.id}", "type": "booking", "type_label": "Usta xizmati",
                      "title": b.service_name, "master_id": b.master_id, "b_date": str(b.date), "b_time": b.time,
                      "address": b.master.address if perspective == "client" else "",
                      "phone": b.master.user.phone if perspective == "client" else b.user.phone, "party": (b.master.title or b.master.user.full_name) if perspective == "client" else b.user.full_name,
                      "party_user_id": b.master.user_id if perspective == "client" else b.user_id,
                      "date": f"{b.date} {b.time}", "price": b.price, "status": b.status, "status_label": b.get_status_display(),
                      "rated": hasattr(b, "review"),
                      "created_at": b.created_at})
    for s in sos_list:
        items.append({"uid": f"s{s.id}", "id": s.id, "code": f"#AS{100000 + s.id}", "type": "sos", "type_label": s.get_kind_display(),
                      "title": f"SOS: {s.get_kind_display()}", "party": s.assignee.full_name if s.assignee else "Qidirilmoqda...",
                      "party_user_id": s.assignee_id, "date": s.created_at.strftime("%Y-%m-%d %H:%M"), "price": s.price or 0,
                      "status": s.status, "status_label": s.get_status_display(), "rated": bool(s.rating), "created_at": s.created_at})
    for o in part_orders:
        items.append({"uid": f"p{o.id}", "id": o.id, "code": f"#AP{100000 + o.id}", "type": "part", "type_label": "Ehtiyot qism",
                      "title": f"{o.product_name} × {o.quantity}", "party": o.shop.name, "party_user_id": o.shop.owner_id,
                      "date": o.created_at.strftime("%Y-%m-%d %H:%M"), "price": o.total, "status": o.status,
                      "status_label": o.get_status_display(), "rated": bool(o.rating), "created_at": o.created_at})
    items.sort(key=lambda x: x["created_at"], reverse=True)
    return items


class MyOrdersView(APIView):
    def get(self, request):
        u = request.user
        return Response(unified_orders(
            Booking.objects.filter(user=u).select_related("master__user"),
            SOSRequest.objects.filter(user=u).select_related("assignee"),
            PartOrder.objects.filter(user=u).select_related("shop"),
        ))


class SearchView(APIView):
    """Umumiy qidiruv: ustalar, xizmatlar va ehtiyot qismlar."""
    permission_classes = [AllowAny]

    def get(self, request):
        from django.db.models import Q
        from market.serializers import ProductSerializer
        from masters.models import MasterProfile
        from masters.serializers import MasterSerializer
        q = (request.query_params.get("q") or "").strip()[:100]
        if len(q) < 2:
            return Response({"masters": [], "parts": []})
        masters = MasterProfile.objects.filter(user__is_active=True).filter(
            Q(title__icontains=q) | Q(user__first_name__icontains=q) | Q(user__last_name__icontains=q)
            | Q(services__name__icontains=q) | Q(address__icontains=q) | Q(bio__icontains=q)
        ).select_related("user").prefetch_related("services").distinct()[:12]
        parts = Product.objects.visible().select_related("shop").filter(
            Q(name__icontains=q) | Q(brand__icontains=q) | Q(sku__icontains=q) | Q(compatible__icontains=q)
        )[:12]
        return Response({"masters": MasterSerializer(masters, many=True, context={"request": request}).data,
                         "parts": ProductSerializer(parts, many=True, context={"request": request}).data})
