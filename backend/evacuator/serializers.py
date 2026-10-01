from rest_framework import serializers

from accounts.serializers import UserShortSerializer

from .models import EvacuatorProfile, SOSRequest


class EvacuatorProfileSerializer(serializers.ModelSerializer):
    user = UserShortSerializer(read_only=True)

    class Meta:
        model = EvacuatorProfile
        fields = ["id", "user", "truck_model", "plate", "base_price", "price_per_km", "is_verified", "rating", "reviews_count", "completed"]
        read_only_fields = ["is_verified", "rating", "reviews_count", "completed"]


class SOSSerializer(serializers.ModelSerializer):
    client = UserShortSerializer(source="user", read_only=True)
    assignee = UserShortSerializer(read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    vehicle_title = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    truck = serializers.SerializerMethodField()

    class Meta:
        model = SOSRequest
        fields = [
            "id", "kind", "kind_label", "lat", "lng", "address", "note", "vehicle", "vehicle_title", "status",
            "status_label", "client", "assignee", "truck", "price", "distance_km", "rating", "created_at", "updated_at",
        ]
        read_only_fields = ["status", "price", "rating"]

    def get_vehicle_title(self, o):
        return str(o.vehicle) if o.vehicle else ""

    def get_distance_km(self, o):
        return getattr(o, "_distance", None)

    def get_truck(self, o):
        if o.assignee and hasattr(o.assignee, "evacuator"):
            e = o.assignee.evacuator
            return f"{e.truck_model} {e.plate}".strip()
        return ""
