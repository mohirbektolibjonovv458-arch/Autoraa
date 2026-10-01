from datetime import timedelta

from core.params import str_in
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsAdmin
from accounts.serializers import UserSerializer
from evacuator.models import SOSRequest
from market.models import PartOrder, Shop
from market.serializers import ShopSerializer
from masters.models import Booking, MasterProfile
from masters.serializers import MasterSerializer
from premium.models import PremiumPayment
from premium.serializers import PremiumPaymentSerializer
from accounts.utils import premium_bot_username
from premium.services import admin_chat_ids, approve_payment, reject_payment

from .models import BlogPost, SiteSettings, notify
from .serializers import BlogPostSerializer, SiteSettingsSerializer
from .views import unified_orders


class AdminBase(APIView):
    permission_classes = [IsAdmin]


def revenue_total():
    return {
        "bookings": Booking.objects.filter(status="completed").aggregate(s=Sum("price"))["s"] or 0,
        "sos": SOSRequest.objects.filter(status="completed").aggregate(s=Sum("price"))["s"] or 0,
        "parts": PartOrder.objects.filter(status="delivered").aggregate(s=Sum("total"))["s"] or 0,
        "premium": PremiumPayment.objects.filter(status="approved").aggregate(s=Sum("amount"))["s"] or 0,
    }


class DashboardView(AdminBase):
    def get(self, request):
        from core.params import int_param
        days = int_param(request.query_params.get("days"), 14, 1, 365)
        since = timezone.now() - timedelta(days=days)
        rev = revenue_total()
        series = {}
        for model, field, amount in ((Booking, "created_at", "price"), (PartOrder, "created_at", "total"), (PremiumPayment, "created_at", "amount")):
            qs = model.objects.filter(**{f"{field}__gte": since})
            if model is PremiumPayment:
                qs = qs.filter(status="approved")
            for row in qs.annotate(d=TruncDate(field)).values("d").annotate(s=Sum(amount), c=Count("id")):
                key = row["d"].isoformat()
                series.setdefault(key, {"date": key, "revenue": 0, "orders": 0})
                series[key]["revenue"] += row["s"] or 0
                series[key]["orders"] += row["c"]
        for i in range(days):
            k = (timezone.localdate() - timedelta(days=days - 1 - i)).isoformat()
            series.setdefault(k, {"date": k, "revenue": 0, "orders": 0})
        b_status = dict(Booking.objects.values_list("status").annotate(c=Count("id")))
        latest = unified_orders(
            Booking.objects.select_related("master__user", "user")[:8],
            SOSRequest.objects.select_related("assignee", "user")[:8],
            PartOrder.objects.select_related("shop", "user")[:8],
        )[:10]
        return Response({
            "users": User.objects.filter(role="user").count(),
            "masters": User.objects.filter(role="usta").count(),
            "evacuators": User.objects.filter(role="evakuator").count(),
            "orders": Booking.objects.count() + SOSRequest.objects.count() + PartOrder.objects.count(),
            "revenue": sum(rev.values()),
            "revenue_parts": rev,
            "pending_payments": PremiumPayment.objects.filter(status="pending").count(),
            "premium_admins": len(admin_chat_ids()),
            "support_phone_set": bool(SiteSettings.load().support_phone),
            "premium_bot": premium_bot_username(),
            "active_sos": SOSRequest.objects.filter(status__in=["searching", "accepted", "on_the_way", "arrived"]).count(),
            "premium_users": User.objects.filter(premium_until__gt=timezone.now()).count(),
            "new_users_week": User.objects.filter(date_joined__gte=timezone.now() - timedelta(days=7)).count(),
            "series": sorted(series.values(), key=lambda x: x["date"]),
            "booking_status": [{"status": k, "count": v} for k, v in b_status.items()],
            "latest": latest,
            "top_services": list(Booking.objects.values("service_name").annotate(c=Count("id")).order_by("-c")[:6]),
        })


class UsersView(AdminBase):
    def get(self, request):
        qs = User.objects.all().order_by("-date_joined")
        p = request.query_params
        if p.get("role"):
            qs = qs.filter(role=p["role"])
        if p.get("q"):
            qs = qs.filter(Q(phone__icontains=p["q"]) | Q(first_name__icontains=p["q"]) | Q(last_name__icontains=p["q"]))
        return Response(UserSerializer(qs[:300], many=True, context={"request": request}).data)


class UserUpdateView(AdminBase):
    def patch(self, request, pk):
        u = get_object_or_404(User, pk=pk)
        if u.pk == request.user.pk and ("is_active" in request.data or "role" in request.data):
            return Response({"detail": "O'z hisobingizni bloklash yoki rolini o'zgartirish mumkin emas."}, status=400)
        if "is_active" in request.data:
            u.is_active = bool(request.data["is_active"])
            if not u.is_active:
                from accounts.views import revoke_user_tokens
                revoke_user_tokens(u)
                u.is_online = False
                u.push_subs.all().delete()
        if str_in(request.data.get("role")) in dict(User.ROLE_CHOICES):
            u.role = request.data["role"]
        if "premium_days" in request.data:
            from core.params import int_param
            days = int_param(request.data.get("premium_days"), 0, 0, 3650)
            base = u.premium_until if u.is_premium else timezone.now()
            u.premium_until = base + timedelta(days=days) if days > 0 else None
            if days > 0:
                Shop.objects.get_or_create(owner=u, defaults={"name": f"{u.full_name} do'koni"})
        u.save()
        return Response(UserSerializer(u, context={"request": request}).data)


class MastersView(AdminBase):
    def get(self, request):
        qs = MasterProfile.objects.select_related("user").prefetch_related("services")
        st = request.query_params.get("status")
        if st == "pending":
            qs = qs.filter(is_verified=False)
        elif st == "verified":
            qs = qs.filter(is_verified=True)
        return Response(MasterSerializer(qs, many=True, context={"request": request}).data)


class MasterVerifyView(AdminBase):
    def post(self, request, pk):
        m = get_object_or_404(MasterProfile, pk=pk)
        m.is_verified = bool(request.data.get("verified", True))
        m.save(update_fields=["is_verified"])
        if m.is_verified:
            notify(m.user, "Profilingiz tasdiqlandi", "Endi mijozlar sizni «Verified» belgisi bilan ko'radi.", "system", telegram=True)
        return Response({"is_verified": m.is_verified})


class OrdersView(AdminBase):
    def get(self, request):
        t = request.query_params.get("type")
        return Response(unified_orders(
            Booking.objects.select_related("master__user", "user")[:200] if t in (None, "", "booking") else [],
            SOSRequest.objects.select_related("assignee", "user")[:200] if t in (None, "", "sos") else [],
            PartOrder.objects.select_related("shop", "user")[:200] if t in (None, "", "part") else [],
        ))


class PaymentsView(AdminBase):
    def get(self, request):
        qs = PremiumPayment.objects.select_related("user")
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        return Response(PremiumPaymentSerializer(qs[:300], many=True, context={"request": request}).data)


class PaymentActionView(AdminBase):
    def post(self, request, pk, action):
        p = get_object_or_404(PremiumPayment, pk=pk)
        by = f"panel:{request.user.full_name}"
        ok = approve_payment(p, by) if action == "approve" else reject_payment(p, by, request.data.get("reason", ""))
        if not ok:
            return Response({"detail": "To'lov allaqachon ko'rib chiqilgan."}, status=400)
        p.refresh_from_db()  # tasdiqlash qulf ostida boshqa nusxada bajarilgan — yangi holatni qaytaramiz
        return Response(PremiumPaymentSerializer(p, context={"request": request}).data)


class ShopsView(AdminBase):
    def get(self, request):
        return Response(ShopSerializer(Shop.objects.select_related("owner"), many=True, context={"request": request}).data)

    def patch(self, request):
        s = get_object_or_404(Shop, pk=request.data.get("id"))
        s.is_active = bool(request.data.get("is_active"))
        s.save(update_fields=["is_active"])
        return Response(ShopSerializer(s, context={"request": request}).data)


class LiveMapView(AdminBase):
    def get(self, request):
        providers = User.objects.filter(role__in=["usta", "evakuator"], lat__isnull=False)
        sos = SOSRequest.objects.filter(status__in=["searching", "accepted", "on_the_way", "arrived"]).select_related("user", "assignee")
        return Response({
            "providers": [{"id": u.id, "name": u.full_name, "role": u.role, "lat": u.lat, "lng": u.lng, "online": u.online_now} for u in providers],
            "sos": [{"id": s.id, "kind": s.get_kind_display(), "status": s.status, "status_label": s.get_status_display(),
                     "lat": s.lat, "lng": s.lng, "address": s.address, "client": s.user.full_name,
                     "assignee": s.assignee.full_name if s.assignee else None,
                     "assignee_lat": s.assignee.lat if s.assignee else None, "assignee_lng": s.assignee.lng if s.assignee else None,
                     "created_at": s.created_at} for s in sos],
        })


class SettingsView(AdminBase):
    def get(self, request):
        return Response(SiteSettingsSerializer(SiteSettings.load()).data)

    def patch(self, request):
        s = SiteSettingsSerializer(SiteSettings.load(), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class BlogAdminView(AdminBase):
    def get(self, request):
        return Response(BlogPostSerializer(BlogPost.objects.all(), many=True, context={"request": request}).data)

    def post(self, request):
        s = BlogPostSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data, status=201)


class BlogAdminDetailView(AdminBase):
    def patch(self, request, pk):
        s = BlogPostSerializer(get_object_or_404(BlogPost, pk=pk), data=request.data, partial=True, context={"request": request})
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)

    def delete(self, request, pk):
        get_object_or_404(BlogPost, pk=pk).delete()
        return Response(status=204)


class BroadcastView(AdminBase):
    def post(self, request):
        title, body, role = str_in(request.data.get("title"))[:150], str_in(request.data.get("body"))[:1000], str_in(request.data.get("role"))
        if not title:
            return Response({"detail": "Sarlavha kiriting."}, status=400)
        qs = User.objects.filter(is_active=True)
        if role:
            qs = qs.filter(role=role)
        import uuid
        key = f"bc-{uuid.uuid4().hex[:12]}"
        for u in qs.iterator():
            notify(u, f"📢 {title}", body, "system", "/app/notifications", dedup=key)
        return Response({"sent": qs.count()})
