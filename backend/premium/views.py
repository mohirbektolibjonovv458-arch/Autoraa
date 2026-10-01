from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsUsta
from core.models import SiteSettings

from .models import PremiumPayment
from .serializers import PremiumPaymentSerializer
from .services import notify_admins_new_payment, premium_info


class PremiumInfoView(APIView):
    def get(self, request):
        u = request.user
        pending = PremiumPayment.objects.filter(user=u, status="pending").first()
        data = premium_info()
        data.update({
            "is_premium": u.is_premium,
            "premium_until": u.premium_until,
            "pending": PremiumPaymentSerializer(pending, context={"request": request}).data if pending else None,
            "features": [
                "Zapchast do'konini ochish",
                "Cheksiz mahsulot joylash",
                "Buyurtmalar va savdo statistikasi",
                "Premium belgisi va qidiruvda yuqorida chiqish",
            ],
        })
        return Response(data)


class PremiumPayView(APIView):
    permission_classes = [IsUsta]

    def post(self, request):
        if PremiumPayment.objects.filter(user=request.user, status="pending").exists():
            return Response({"detail": "Oldingi to'lovingiz hali tekshirilmoqda. Tasdiqlanishini kuting."}, status=400)
        receipt = request.FILES.get("receipt")
        if not receipt:
            return Response({"detail": "To'lov chekining rasmini (skrinshot) yuklang."}, status=400)
        from core.uploads import check_image
        err = check_image(receipt)
        if err:
            return Response({"detail": err}, status=400)
        try:
            months = max(1, min(12, int(request.data.get("months") or 1)))
        except ValueError:
            months = 1
        s = SiteSettings.load()
        last4 = "".join(ch for ch in str(request.data.get("payer_card_last4", "")) if ch.isdigit())[-4:]
        p = PremiumPayment.objects.create(
            user=request.user, months=months, amount=s.premium_price * months, card_number=s.card_number,
            payer_card_last4=last4, receipt=receipt, note=(request.data.get("note") or "")[:200],
        )
        sent = notify_admins_new_payment(p)
        return Response({
            "payment": PremiumPaymentSerializer(p, context={"request": request}).data,
            "sent_to_bot": sent,
            "detail": "Chek qabul qilindi. Admin pul tushganini tekshirgach, do'koningiz avtomatik ochiladi.",
        }, status=201)


class PremiumHistoryView(APIView):
    def get(self, request):
        qs = PremiumPayment.objects.filter(user=request.user)
        return Response(PremiumPaymentSerializer(qs, many=True, context={"request": request}).data)


class ReceiptView(APIView):
    """To'lov chekini imzoli havola orqali beradi — /media/ orqali ochiq emas."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        from django.core import signing
        from django.http import FileResponse, Http404
        try:
            if signing.loads(request.query_params.get("s", ""), salt="receipt", max_age=3600) != pk:
                raise Http404
        except signing.BadSignature:
            raise Http404
        p = PremiumPayment.objects.filter(pk=pk).first()
        if not p or not p.receipt:
            raise Http404
        try:
            return FileResponse(p.receipt.open("rb"))
        except FileNotFoundError:
            raise Http404  # fayl diskda yo'q — 500 emas
