from rest_framework import serializers

from .models import PremiumPayment


class PremiumPaymentSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    user_phone = serializers.CharField(source="user.phone", read_only=True)
    receipt = serializers.SerializerMethodField()

    def get_receipt(self, o):
        """Chek rasmi faqat vaqtinchalik imzoli havola orqali ochiladi (1 soat)."""
        if not o.receipt:
            return None
        from django.core import signing
        return f"/api/premium/receipt/{o.id}/?s={signing.dumps(o.id, salt='receipt')}"

    class Meta:
        model = PremiumPayment
        fields = ["id", "user", "user_name", "user_phone", "months", "amount", "card_number", "payer_card_last4",
                  "receipt", "note", "source", "status", "status_label", "reviewed_by", "reviewed_at",
                  "reject_reason", "created_at"]
        read_only_fields = fields
