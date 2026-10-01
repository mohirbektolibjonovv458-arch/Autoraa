from datetime import date

from core.params import str_in
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsUsta
from accounts.utils import haversine_km
from core.models import notify
from core.params import float_param, int_param, text_param
from garage.models import ServiceRecord, Vehicle

from .models import ReviewPhoto, SPECIALTIES, Booking, FavoriteMaster, MasterPhoto, MasterProfile, Review, Service
from .serializers import MasterPhotoSerializer, BookingSerializer, MasterDetailSerializer, MasterSerializer, ReviewSerializer, ServiceSerializer

TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]


def work_slots(master):
    """Ustaning ish vaqtiga qarab soatbay bo'sh vaqtlar (masalan «08:00 - 20:00» -> 08:00 ... 19:00)."""
    import re
    if master.is_24_7:
        return [f"{h:02d}:00" for h in range(0, 24)]
    m = re.findall(r"(\d{1,2})[:.](\d{2})", master.work_hours or "")
    if len(m) >= 2:
        start, end = int(m[0][0]), int(m[1][0])
        if end <= start:
            end += 24
        hours = [h % 24 for h in range(start, end)]
        if hours:
            return [f"{h:02d}:00" for h in sorted(set(hours))]
    return TIME_SLOTS


def fav_ids(request):
    if request.user.is_authenticated:
        return set(FavoriteMaster.objects.filter(user=request.user).values_list("master_id", flat=True))
    return set()


class CategoriesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response([{"key": k, "label": v} for k, v in SPECIALTIES])


class MasterListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        p = request.query_params
        qs = MasterProfile.objects.filter(user__is_active=True).select_related("user").prefetch_related("services")
        if p.get("q"):
            q = text_param(p["q"], 100)
            qs = qs.filter(Q(user__first_name__icontains=q) | Q(user__last_name__icontains=q) | Q(title__icontains=q)
                           | Q(services__name__icontains=q) | Q(address__icontains=q)).distinct()
        if p.get("online") == "1":
            from datetime import timedelta
            qs = qs.filter(user__is_online=True, user__last_seen__gte=timezone.now() - timedelta(minutes=10))
        if p.get("verified") == "1":
            qs = qs.filter(is_verified=True)
        items = list(qs)
        if p.get("category"):
            items = [m for m in items if p["category"] in (m.specialties or [])]
        lat, lng = float_param(p.get("lat"), None, -90, 90), float_param(p.get("lng"), None, -180, 180)
        for m in items:
            m._distance = haversine_km(lat, lng, m.user.lat, m.user.lng) if lat is not None and lng is not None else None
        sort = p.get("sort", "distance")
        if sort == "rating":
            items.sort(key=lambda m: -m.rating)
        elif sort == "price":
            items.sort(key=lambda m: min([s.price for s in m.services.all()] or [10**9]))
        else:
            # Premium ustalar qidiruvda ~3 km "yaqinroq" hisoblanadi (Premium afzalligi)
            items.sort(key=lambda m: (m._distance is None, (m._distance or 0) - (3 if m.user.is_premium else 0), -m.rating))
        if p.get("radius") and lat is not None:
            r = float_param(p["radius"], 50, 0, 500)
            items = [m for m in items if m._distance is not None and m._distance <= r]
        if p.get("open_now") in ("1", "true"):
            from .serializers import master_open_now
            items = [m for m in items if master_open_now(m) is True]
        limit = int_param(p.get("limit"), 100, 1, 200)
        data = MasterSerializer(items[:limit], many=True, context={"favorites": fav_ids(request), "request": request}).data
        return Response({"count": len(items), "results": data})


class MasterDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        m = get_object_or_404(MasterProfile.objects.select_related("user"), pk=pk)
        lat = float_param(request.query_params.get("lat"), None, -90, 90)
        lng = float_param(request.query_params.get("lng"), None, -180, 180)
        m._distance = haversine_km(lat, lng, m.user.lat, m.user.lng) if lat is not None and lng is not None else None
        return Response(MasterDetailSerializer(m, context={"favorites": fav_ids(request), "request": request}).data)


class SlotsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        d = request.query_params.get("date") or date.today().isoformat()
        master = get_object_or_404(MasterProfile, pk=pk)
        try:
            day = date.fromisoformat(str(d))
        except ValueError:
            return Response({"detail": "Sana noto'g'ri."}, status=400)
        if master.work_days and day.weekday() not in master.work_days:
            return Response([])  # dam olish kuni
        busy = set(Booking.objects.filter(master_id=pk, date=d).exclude(status="cancelled").values_list("time", flat=True))
        now = timezone.localtime()
        out = []
        for t in work_slots(master):
            past = d == now.date().isoformat() and t <= now.strftime("%H:%M")
            out.append({"time": t, "available": t not in busy and not past})
        return Response(out)


class FavoriteToggleView(APIView):
    def post(self, request, pk):
        m = get_object_or_404(MasterProfile, pk=pk)
        obj, created = FavoriteMaster.objects.get_or_create(user=request.user, master=m)
        if not created:
            obj.delete()
        return Response({"is_favorite": created})


class FavoritesView(APIView):
    def get(self, request):
        ids = fav_ids(request)
        qs = MasterProfile.objects.filter(id__in=ids).select_related("user").prefetch_related("services")
        return Response(MasterSerializer(qs, many=True, context={"favorites": ids}).data)


GENERAL_SERVICE = "Ko'rik va maslahat"


def parse_slot(master, date_raw, time_raw, exclude_id=None):
    """Sana/vaqtni tekshiradi: format, o'tgan vaqt, 60 kun, ish vaqti, bandlik. Qaytaradi: (sana, vaqt, xato)."""
    from datetime import datetime
    try:
        day = datetime.strptime(str(date_raw), "%Y-%m-%d").date()
        t = str(time_raw)
        datetime.strptime(t, "%H:%M")
    except (TypeError, ValueError):
        return None, None, "Sana va vaqtni tanlang."
    now = timezone.localtime()
    if day < now.date() or (day == now.date() and t <= now.strftime("%H:%M")):
        return None, None, "O'tib ketgan vaqtga bron qilib bo'lmaydi."
    if (day - now.date()).days > 60:
        return None, None, "Ko'pi bilan 60 kun oldinga bron qilish mumkin."
    if master.work_days and day.weekday() not in master.work_days:
        return None, None, "Usta bu kuni ishlamaydi. Boshqa kunni tanlang."
    if t not in work_slots(master):
        return None, None, "Usta bu vaqtda ishlamaydi. Boshqa vaqtni tanlang."
    busy = Booking.objects.filter(master=master, date=day, time=t).exclude(status="cancelled")
    if exclude_id:
        busy = busy.exclude(pk=exclude_id)
    if busy.exists():
        return None, None, "Bu vaqt band. Boshqa vaqtni tanlang."
    return day, t, None


class BookingListCreateView(APIView):
    def get(self, request):
        u = request.user
        if u.role == "usta" and hasattr(u, "master") and request.query_params.get("as") != "client":
            qs = Booking.objects.filter(master=u.master)
        else:
            qs = Booking.objects.filter(user=u)
        st = request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        return Response(BookingSerializer(qs.select_related("master__user", "user", "vehicle"), many=True).data)

    def post(self, request):
        d = request.data
        master = get_object_or_404(MasterProfile, pk=int_param(d.get("master"), 0))
        if master.user_id == request.user.id:
            return Response({"detail": "O'zingizga bron qila olmaysiz."}, status=400)
        # xizmat tanlanmasa (yoki usta hali narx qo'ymagan bo'lsa) — «Ko'rik va maslahat», narx joyida kelishiladi
        sid = int_param(d.get("service"), 0)
        service = Service.objects.filter(pk=sid, master=master).first() if sid else None
        if sid and not service:
            return Response({"detail": "Bu xizmat topilmadi. Ro'yxatdan tanlang."}, status=400)
        day, t, err = parse_slot(master, d.get("date"), d.get("time"))
        if err:
            return Response({"detail": err}, status=400)
        active = Booking.objects.filter(user=request.user, status__in=["pending", "confirmed"])
        if active.filter(master=master).count() >= 2:
            return Response({"detail": "Bu ustada sizning 2 ta faol broningiz bor. Buyurtmalarim bo'limida vaqtini o'zgartirishingiz mumkin."}, status=400)
        if active.count() >= 10:
            return Response({"detail": "Sizda 10 ta faol bron bor. Avvalgilarini yakunlang yoki bekor qiling."}, status=400)
        vehicle = Vehicle.objects.filter(pk=d.get("vehicle"), owner=request.user).first() if d.get("vehicle") else None
        from django.db import transaction
        with transaction.atomic():
            MasterProfile.objects.select_for_update().filter(pk=master.pk).first()
            if Booking.objects.filter(master=master, date=day, time=t).exclude(status="cancelled").exists():
                return Response({"detail": "Bu vaqt band. Boshqa vaqtni tanlang."}, status=400)
            b = Booking.objects.create(
                user=request.user, master=master, service=service, service_name=service.name if service else GENERAL_SERVICE,
                vehicle=vehicle, date=day, time=t, price=service.price if service else 0, note=str_in(d.get("note"))[:500],
            )
        car = f" · {vehicle.brand} {vehicle.model}".rstrip() if vehicle else ""
        notify(master.user, "📅 Yangi bron", f"{request.user.full_name}: {b.service_name}, {b.date:%d.%m} soat {b.time}{car}", "order",
               f"/app/usta/orders?focus={b.id}", telegram=True, dedup=f"bk-{b.id}-new", urgent=True)
        notify(request.user, "Bron yuborildi", f"{b.service_name}, {b.date:%d.%m} soat {b.time}. Usta tasdiqlashini kuting.", "order",
               f"/app/orders?focus=booking-{b.id}", push=False)
        return Response(BookingSerializer(b).data, status=201)


class BookingStatusView(APIView):
    """Usta: confirmed / in_progress / completed / cancelled. Mijoz: faqat cancelled."""

    def post(self, request, pk):
        b = get_object_or_404(Booking.objects.select_related("master__user", "user"), pk=pk)
        new = str_in(request.data.get("status"))
        is_master = b.master.user_id == request.user.id
        is_client = b.user_id == request.user.id
        if not (is_master or is_client):
            return Response({"detail": "Ruxsat yo'q."}, status=403)
        if b.status in ("completed", "cancelled"):
            return Response({"detail": "Buyurtma allaqachon yopilgan."}, status=400)
        # qat'iy holatlar ketma-ketligi: bosqichni sakrab o'tib bo'lmaydi
        master_flow = {"pending": {"confirmed", "cancelled"}, "confirmed": {"in_progress", "cancelled"}, "in_progress": {"completed"}}
        client_flow = {"pending": {"cancelled"}, "confirmed": {"cancelled"}}  # ish boshlangach mijoz bekor qila olmaydi
        allowed = (master_flow if is_master else client_flow).get(b.status, set())
        if new not in allowed:
            return Response({"detail": "Bu holatga o'tkazib bo'lmaydi."}, status=400)
        old = b.status
        b.status = new
        b.save(update_fields=["status"])
        if is_master:
            master_name = b.master.title or b.master.user.full_name
            titles = {"confirmed": "✅ Bron tasdiqlandi", "in_progress": "🔧 Usta ishni boshladi", "completed": "🏁 Xizmat yakunlandi — baho bering",
                      "cancelled": "❌ Bron rad etildi" if old == "pending" else "❌ Bron bekor qilindi"}
            reason = str_in(request.data.get("reason"))[:200]
            body = f"{master_name}: {b.service_name}, {b.date:%d.%m} soat {b.time}" + (f". Sabab: {reason}" if new == "cancelled" and reason else "")
            notify(b.user, titles.get(new, "Bron yangilandi"), body, "order",
                   f"/app/orders?focus=booking-{b.id}", telegram=True, dedup=f"bk-{b.id}-{new}")
        else:
            notify(b.master.user, "❌ Mijoz bronni bekor qildi", f"{b.user.full_name}: {b.service_name}, {b.date:%d.%m} soat {b.time}", "order",
                   f"/app/usta/orders?focus={b.id}", telegram=True, dedup=f"bk-{b.id}-cancel", urgent=True)
        if new == "completed":
            b.master.completed_jobs += 1
            b.master.save(update_fields=["completed_jobs"])
            if b.vehicle:
                ServiceRecord.objects.create(vehicle=b.vehicle, title=b.service_name, date=b.date,
                                             mileage=b.vehicle.mileage, cost=b.price, master_name=str(b.master))
        return Response(BookingSerializer(b).data)


class ReviewCreateView(APIView):
    def post(self, request, pk):
        b = get_object_or_404(Booking, pk=pk, user=request.user)
        if b.status != "completed":
            return Response({"detail": "Faqat bajarilgan buyurtmaga baho qo'yiladi."}, status=400)
        if hasattr(b, "review"):
            return Response({"detail": "Siz allaqachon baho qo'ygansiz."}, status=400)
        try:
            rating = max(1, min(5, int(request.data.get("rating") or 5)))
        except (TypeError, ValueError):
            return Response({"detail": "Baho 1 dan 5 gacha bo'lishi kerak."}, status=400)
        files = request.FILES.getlist("photos")[:5]
        from core.uploads import check_image
        for f in files:
            err = check_image(f)
            if err:
                return Response({"detail": err}, status=400)
        r = Review.objects.create(master=b.master, user=request.user, booking=b, rating=rating, text=str_in(request.data.get("text"))[:1000])
        for f in files:
            ReviewPhoto.objects.create(review=r, image=f)
        b.master.recalc_rating()
        notify(b.master.user, "Yangi sharh", f"{request.user.full_name} {rating}★ baho qo'ydi", "review")
        return Response(ReviewSerializer(r).data, status=201)


class MyMasterProfileView(APIView):
    permission_classes = [IsUsta]

    def get_obj(self, request):
        return MasterProfile.objects.get_or_create(user=request.user)[0]

    def get(self, request):
        return Response(MasterDetailSerializer(self.get_obj(request)).data)

    def patch(self, request):
        s = MasterSerializer(self.get_obj(request), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class MyServicesView(APIView):
    permission_classes = [IsUsta]

    def get(self, request):
        return Response(ServiceSerializer(Service.objects.filter(master__user=request.user), many=True).data)

    def post(self, request):
        m = MasterProfile.objects.get_or_create(user=request.user)[0]
        s = ServiceSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save(master=m)
        return Response(s.data, status=201)


class MyServiceDetailView(APIView):
    permission_classes = [IsUsta]

    def patch(self, request, pk):
        obj = get_object_or_404(Service, pk=pk, master__user=request.user)
        s = ServiceSerializer(obj, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)

    def delete(self, request, pk):
        get_object_or_404(Service, pk=pk, master__user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MasterStatsView(APIView):
    permission_classes = [IsUsta]

    def get(self, request):
        m = MasterProfile.objects.get_or_create(user=request.user)[0]
        today = timezone.localdate()
        qs = Booking.objects.filter(master=m)
        revenue = qs.filter(status="completed").aggregate(s=Sum("price"))["s"] or 0
        month_rev = qs.filter(status="completed", date__year=today.year, date__month=today.month).aggregate(s=Sum("price"))["s"] or 0
        return Response({
            "today": qs.filter(date=today).exclude(status="cancelled").count(),
            "pending": qs.filter(status="pending").count(),
            "active": qs.filter(status__in=["confirmed", "in_progress"]).count(),
            "completed": qs.filter(status="completed").count(),
            "revenue": revenue,
            "month_revenue": month_rev,
            "rating": m.rating,
            "reviews": m.reviews_count,
            "is_premium": request.user.is_premium,
            "premium_until": request.user.premium_until,
        })


class MyPhotosView(APIView):
    permission_classes = [IsUsta]

    def get(self, request):
        return Response(MasterPhotoSerializer(MasterPhoto.objects.filter(master__user=request.user), many=True, context={"request": request}).data)

    def post(self, request):
        m = MasterProfile.objects.get_or_create(user=request.user)[0]
        if not request.FILES.get("image"):
            return Response({"detail": "Rasm tanlang."}, status=400)
        from core.uploads import check_image
        err = check_image(request.FILES["image"])
        if err:
            return Response({"detail": err}, status=400)
        before = request.FILES.get("before")  # ixtiyoriy: «oldin» rasmi — oldin/keyin juftligi bo'ladi
        if before:
            err = check_image(before)
            if err:
                return Response({"detail": err}, status=400)
        if m.photos.count() >= 30:
            return Response({"detail": "Ko'pi bilan 30 ta rasm."}, status=400)
        ph = MasterPhoto.objects.create(master=m, image=request.FILES["image"], before=before, caption=str_in(request.data.get("caption"))[:120])
        return Response(MasterPhotoSerializer(ph, context={"request": request}).data, status=201)


class MyPhotoDetailView(APIView):
    permission_classes = [IsUsta]

    def delete(self, request, pk):
        get_object_or_404(MasterPhoto, pk=pk, master__user=request.user).delete()
        return Response(status=204)


class BookingRescheduleView(APIView):
    """Vaqtni o'zgartirish: usta yoki mijoz (kutilayotgan/tasdiqlangan bron). Ikkinchi tomonga xabar boradi."""

    def post(self, request, pk):
        from django.db import transaction
        b = get_object_or_404(Booking.objects.select_related("master__user", "user"), pk=pk)
        is_master, is_client = b.master.user_id == request.user.id, b.user_id == request.user.id
        if not (is_master or is_client):
            return Response({"detail": "Ruxsat yo'q."}, status=403)
        if b.status not in ("pending", "confirmed"):
            return Response({"detail": "Bu bronning vaqtini o'zgartirib bo'lmaydi."}, status=400)
        with transaction.atomic():
            MasterProfile.objects.select_for_update().filter(pk=b.master_id).first()
            day, t, err = parse_slot(b.master, request.data.get("date"), request.data.get("time"), exclude_id=b.id)
            if err:
                return Response({"detail": err}, status=400)
            old = f"{b.date:%d.%m} {b.time}"
            b.date, b.time, b.reminded = day, t, False
            # mijoz o'zgartirsa — usta qayta tasdiqlashi kerak
            if is_client and b.status == "confirmed":
                b.status = "pending"
            b.save(update_fields=["date", "time", "reminded", "status"])
        new = f"{b.date:%d.%m} soat {b.time}"
        if is_master:
            notify(b.user, "🕒 Usta bron vaqtini o'zgartirdi", f"{b.service_name}: {old} → {new}", "order",
                   f"/app/orders?focus=booking-{b.id}", telegram=True, dedup=f"bk-{b.id}-re-{b.date}-{b.time}")
        else:
            notify(b.master.user, "🕒 Mijoz bron vaqtini o'zgartirdi", f"{b.user.full_name}, {b.service_name}: {old} → {new}", "order",
                   f"/app/usta/orders?focus={b.id}", telegram=True, dedup=f"bk-{b.id}-re-{b.date}-{b.time}", urgent=True)
        return Response(BookingSerializer(b).data)
