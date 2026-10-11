from django.contrib.auth import password_validation
from rest_framework import serializers

from core.progress import ACHIEVEMENTS, current_streak

from .models import User

SUBJECTS = ["matematika", "fizika", "kimyo", "biologiya", "informatika", "ingliz tili", "ona tili", "adabiyot", "tarix", "geografiya", "iqtisodiyot", "huquq", "san'at", "musiqa", "jismoniy tarbiya"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    class Meta:
        model = User
        fields = ["email", "password", "first_name", "last_name"]
        extra_kwargs = {"first_name": {"required": True, "allow_blank": False}}

    def validate_email(self, v):
        v = v.strip().lower()
        if User.objects.filter(email=v).exists():
            raise serializers.ValidationError("Bu email bilan akkaunt allaqachon mavjud.")
        return v

    def validate(self, attrs):
        password_validation.validate_password(attrs["password"], User(email=attrs["email"], first_name=attrs.get("first_name", "")))
        return attrs

    def create(self, data):
        return User.objects.create_user(**data)


class ProfileSerializer(serializers.ModelSerializer):
    plan = serializers.CharField(read_only=True)
    is_premium = serializers.BooleanField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    streak = serializers.SerializerMethodField()
    is_admin = serializers.BooleanField(source="is_staff", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name", "education_stage", "grade", "region",
            "interests", "favorite_subjects", "future_goals", "target_countries", "english_level", "ielts_score", "birth_year", "daily_minutes",
            "onboarded", "plan", "is_premium", "premium_until", "xp", "streak", "best_streak", "is_admin", "date_joined",
        ]
        read_only_fields = ["id", "email", "premium_until", "xp", "best_streak", "date_joined"]

    def get_streak(self, u):
        return current_streak(u)

    def _str_list(self, v, limit=12, maxlen=40):
        if not isinstance(v, list) or len(v) > limit:
            raise serializers.ValidationError(f"Ko'pi bilan {limit} ta qiymat.")
        out = []
        for x in v:
            if not isinstance(x, str) or not x.strip() or len(x) > maxlen:
                raise serializers.ValidationError("Noto'g'ri qiymat.")
            out.append(x.strip())
        return list(dict.fromkeys(out))

    def validate_interests(self, v):
        return self._str_list(v)

    def validate_favorite_subjects(self, v):
        return self._str_list(v)

    def validate_target_countries(self, v):
        return self._str_list(v, limit=8)

    def validate_grade(self, v):
        if v is not None and not 1 <= v <= 11:
            raise serializers.ValidationError("Sinf 1–11 oralig'ida bo'lishi kerak.")
        return v

    def validate_ielts_score(self, v):
        if v is not None and (v < 0 or v > 9 or (v * 2) % 1 != 0):
            raise serializers.ValidationError("IELTS balli 0–9 oralig'ida, 0.5 qadam bilan.")
        return v

    def validate_birth_year(self, v):
        if v is not None and not 1950 <= v <= 2022:
            raise serializers.ValidationError("Tug'ilgan yil noto'g'ri.")
        return v

    def validate_daily_minutes(self, v):
        if not 10 <= v <= 480:
            raise serializers.ValidationError("Kunlik vaqt 10–480 daqiqa oralig'ida.")
        return v


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8, max_length=128)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError({"old_password": "Joriy parol noto'g'ri."})
        password_validation.validate_password(attrs["new_password"], user)
        return attrs


def achievement_list(user):
    earned = {a.code: a.earned_at for a in user.achievements.all()}
    return [
        {"code": c, **meta, "earned": c in earned, "earned_at": earned.get(c)}
        for c, meta in ACHIEVEMENTS.items()
    ]
