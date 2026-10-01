from rest_framework import serializers

from accounts.serializers import UserShortSerializer

from .models import Booking, MasterPhoto, MasterProfile, Review, Service


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "name", "category", "price", "duration"]


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    service = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "rating", "text", "user_name", "created_at", "photos", "service"]

    def get_user_name(self, r):
        # maxfiylik: ochiq sharhda faqat ism va familiyaning bosh harfi
        fn, ln = (r.user.first_name or "").strip(), (r.user.last_name or "").strip()
        return (f"{fn} {ln[:1]}." if ln else fn) or "Mijoz"

    def get_photos(self, r):
        return [p.image.url for p in r.photos.all()]

    def get_service(self, r):
        return r.booking.service_name if r.booking_id and r.booking else ""


def master_open_now(m):
    from core.hours import is_open
    days = set(m.work_days) if m.work_days else None
    return is_open(m.work_hours, is_24_7=m.is_24_7, days_allowed=days)


class MasterSerializer(serializers.ModelSerializer):
    user = UserShortSerializer(read_only=True)
    open_now = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    min_price = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()
    services = ServiceSerializer(many=True, read_only=True)

    class Meta:
        model = MasterProfile
        fields = [
            "id", "user", "name", "title", "specialties", "experience_years", "address", "work_hours", "is_24_7",
            "bio", "cover", "rating", "reviews_count", "completed_jobs", "is_verified", "min_price",
            "distance_km", "is_favorite", "services", "work_days", "open_now"]
        read_only_fields = ["rating", "reviews_count", "completed_jobs", "is_verified"]

    def get_name(self, o):
        return o.title or o.user.full_name

    def get_min_price(self, o):
        prices = [s.price for s in o.services.all()]
        return min(prices) if prices else None

    def get_distance_km(self, o):
        return getattr(o, "_distance", None)

    def get_is_favorite(self, o):
        favs = self.context.get("favorites")
        return o.id in favs if favs is not None else False

    def get_open_now(self, m):
        return master_open_now(m)

    def validate_work_days(self, v):
        if not isinstance(v, list) or any(not isinstance(d, int) or not 0 <= d <= 6 for d in v):
            raise serializers.ValidationError("Ish kunlari noto'g'ri.")
        return sorted(set(v))


class MasterPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterPhoto
        fields = ["id", "image", "before", "caption", "created_at"]


class MasterDetailSerializer(MasterSerializer):
    reviews = serializers.SerializerMethodField()
    photos = MasterPhotoSerializer(many=True, read_only=True)

    class Meta(MasterSerializer.Meta):
        fields = MasterSerializer.Meta.fields + ["reviews", "photos"]

    def get_reviews(self, o):
        return ReviewSerializer(o.reviews.select_related("user", "booking").prefetch_related("photos")[:20], many=True).data


class BookingSerializer(serializers.ModelSerializer):
    master_name = serializers.SerializerMethodField()
    master_user_id = serializers.IntegerField(source="master.user_id", read_only=True)
    client = UserShortSerializer(source="user", read_only=True)
    vehicle_title = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    has_review = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id", "master", "master_name", "master_user_id", "client", "service", "service_name", "vehicle",
            "vehicle_title", "date", "time", "price", "note", "status", "status_label", "has_review", "created_at",
        ]
        read_only_fields = ["service_name", "price", "status", "master"]

    def get_master_name(self, o):
        return o.master.title or o.master.user.full_name

    def get_vehicle_title(self, o):
        return str(o.vehicle) if o.vehicle else ""

    def get_has_review(self, o):
        return hasattr(o, "review")
