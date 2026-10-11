from django.conf import settings
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import PremiumRequest
from .plans import plans_payload


class RequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PremiumRequest
        fields = ["id", "months", "amount", "payment_reference", "note", "status", "admin_note", "created", "reviewed_at"]
        read_only_fields = ["amount", "status", "admin_note", "created", "reviewed_at"]

    def validate_months(self, v):
        if v not in (1, 3, 6, 12):
            raise serializers.ValidationError("1, 3, 6 yoki 12 oy tanlang.")
        return v


@api_view(["GET"])
def plans(request):
    data = plans_payload(request.user)
    data["requests"] = RequestSerializer(PremiumRequest.objects.filter(user=request.user)[:10], many=True).data
    return Response(data)


@api_view(["POST"])
def create_request(request):
    if not settings.PREMIUM_PAYMENT_INSTRUCTIONS:
        return Response({"detail": "To'lov usuli hali sozlanmagan. Premium'ni hozircha faqat administrator faollashtirishi mumkin.", "code": "payment_not_configured"}, status=503)
    if PremiumRequest.objects.filter(user=request.user, status="pending").exists():
        return Response({"detail": "Sizda ko'rib chiqilayotgan so'rov bor."}, status=400)
    s = RequestSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    if not s.validated_data.get("payment_reference", "").strip():
        return Response({"payment_reference": ["To'lov ma'lumotini kiriting (masalan, chek raqami yoki vaqt)."]}, status=400)
    s.save(user=request.user, amount=settings.PREMIUM_PRICE_UZS * s.validated_data["months"])
    return Response(s.data, status=201)


@api_view(["POST"])
def cancel_request(request, pk):
    n = PremiumRequest.objects.filter(pk=pk, user=request.user, status="pending").update(status="cancelled")
    return Response({"cancelled": bool(n)})
