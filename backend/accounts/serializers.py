from rest_framework import serializers

from .models import TelegramLink, User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    is_premium = serializers.BooleanField(read_only=True)
    telegram_linked = serializers.SerializerMethodField()
    has_shop = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "phone", "first_name", "last_name", "full_name", "email", "role", "avatar", "city",
            "lat", "lng", "is_online", "is_premium", "premium_until", "telegram_linked", "has_shop",
            "date_joined", "is_active", "lang",
        ]
        read_only_fields = ["phone", "role", "premium_until", "date_joined", "is_active"]

    def get_telegram_linked(self, obj):
        return bool(obj.telegram_chat_id) or TelegramLink.objects.filter(phone=obj.phone).exists()

    def get_has_shop(self, obj):
        return hasattr(obj, "shop")


class UserShortSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    is_premium = serializers.BooleanField(read_only=True)
    is_online = serializers.BooleanField(source="online_now", read_only=True)

    class Meta:
        model = User
        fields = ["id", "full_name", "phone", "avatar", "role", "is_online", "is_premium", "lat", "lng"]

    def to_representation(self, obj):
        data = super().to_representation(obj)
        request = self.context.get("request")
        viewer = getattr(request, "user", None)
        if obj.role not in ("usta", "evakuator"):
            data["lat"] = data["lng"] = None  # oddiy foydalanuvchi joylashuvi maxfiy
        elif data.get("lat") is not None and not (viewer and viewer.is_authenticated and viewer.id == obj.id):
            # ochiq ro'yxatlarda usta/evakuator aniq GPS nuqtasi emas, ~100 m aniqlikda ko'rsatiladi
            data["lat"], data["lng"] = round(data["lat"], 3), round(data["lng"], 3)
        if request is not None and not (viewer and viewer.is_authenticated):
            data["phone"] = ""  # ro'yxatdan o'tmaganlar telefon raqamlarini yig'ib ololmaydi
        return data
