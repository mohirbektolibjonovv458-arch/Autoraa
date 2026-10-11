from rest_framework import serializers

from .models import ChecklistItem, Grant, Program, SavedGrant, University


class ProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = ["id", "university", "name", "field", "degree", "language", "duration_years", "tuition", "note"]


class UniversityListSerializer(serializers.ModelSerializer):
    is_favorite = serializers.SerializerMethodField()
    fields_list = serializers.SerializerMethodField()

    class Meta:
        model = University
        fields = ["id", "name", "short_name", "country", "city", "kind", "languages", "tuition_min", "tuition_max",
                  "tuition_currency", "ielts_min", "has_grants", "verified", "is_favorite", "fields_list", "application_end"]

    def get_is_favorite(self, u):
        fav = self.context.get("favorites")
        return u.id in fav if fav is not None else False

    def get_fields_list(self, u):
        return sorted({p.field for p in u.programs.all()})


class UniversityDetailSerializer(UniversityListSerializer):
    programs = ProgramSerializer(many=True, read_only=True)

    class Meta(UniversityListSerializer.Meta):
        fields = UniversityListSerializer.Meta.fields + [
            "website", "description", "tuition_note", "admission_requirements", "application_start", "deadline_note",
            "grant_note", "source_url", "last_verified", "updated", "programs",
        ]


class UniversityAdminSerializer(serializers.ModelSerializer):
    programs = ProgramSerializer(many=True, read_only=True)

    class Meta:
        model = University
        fields = "__all__"

    def validate(self, attrs):
        lo, hi = attrs.get("tuition_min"), attrs.get("tuition_max")
        if lo and hi and lo > hi:
            raise serializers.ValidationError({"tuition_max": "Maksimal narx minimaldan kichik bo'lmasin."})
        if attrs.get("verified") and not (attrs.get("source_url") or getattr(self.instance, "source_url", "")):
            raise serializers.ValidationError({"source_url": "Tasdiqlangan deb belgilash uchun rasmiy manba havolasi kerak."})
        return attrs


class GrantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grant
        fields = ["id", "name", "provider", "country", "levels", "funding", "funding_note", "description", "eligibility",
                  "min_age", "max_age", "ielts_min", "language_note", "documents", "fields", "deadline", "deadline_note",
                  "official_url", "source_url", "verified", "last_verified", "updated"]


class GrantAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grant
        fields = "__all__"

    def validate_documents(self, v):
        if not isinstance(v, list) or not all(isinstance(x, str) and x.strip() for x in v):
            raise serializers.ValidationError("Hujjatlar matnlar ro'yxati bo'lishi kerak.")
        return v

    def validate(self, attrs):
        if attrs.get("verified") and not (attrs.get("source_url") or getattr(self.instance, "source_url", "")):
            raise serializers.ValidationError({"source_url": "Tasdiqlangan deb belgilash uchun rasmiy manba havolasi kerak."})
        return attrs


class ChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItem
        fields = ["id", "title", "done", "order"]


class SavedGrantSerializer(serializers.ModelSerializer):
    checklist = ChecklistItemSerializer(many=True, read_only=True)
    grant = GrantSerializer(read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = SavedGrant
        fields = ["id", "grant", "status", "created", "checklist", "progress"]
        read_only_fields = ["created"]

    def get_progress(self, s):
        items = list(s.checklist.all())
        return {"done": sum(1 for i in items if i.done), "total": len(items)}
