from rest_framework import serializers

from .models import ServiceRecord, Vehicle


class ServiceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRecord
        fields = ["id", "title", "date", "mileage", "cost", "master_name", "note"]


class VehicleSerializer(serializers.ModelSerializer):
    records = ServiceRecordSerializer(many=True, read_only=True)
    documents_due = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    health = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        exclude = ["owner"]

    def get_documents_due(self, o):
        from datetime import date, timedelta
        return o.documents.filter(expires_on__lte=date.today() + timedelta(days=30)).count()

    def get_title(self, o):
        return f"{o.brand} {o.model}".strip()

    def get_health(self, o):
        """Faqat egasi kiritgan ma'lumot asosida. Hech narsa kiritilmagan bo'lsa — baho berilmaydi."""
        known = [v for v in (o.next_service_km, o.oil_change_km) if v is not None]
        if not known:
            return "Ma'lumot yo'q"
        left = min(known)
        if left <= 300:
            return "Servis kerak"
        if left <= 1000:
            return "O'rtacha"
        return "Yaxshi"


from datetime import date as _date

from .models import CarDocument, Expense


class CarDocumentSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    days_left = serializers.SerializerMethodField()
    vehicle_title = serializers.SerializerMethodField()

    class Meta:
        model = CarDocument
        fields = ["id", "vehicle", "vehicle_title", "kind", "kind_label", "title", "number", "expires_on", "note", "days_left"]
        read_only_fields = ["vehicle"]

    def get_days_left(self, o):
        return (o.expires_on - _date.today()).days

    def get_vehicle_title(self, o):
        return f"{o.vehicle.brand} {o.vehicle.model}".strip()


class ExpenseSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = Expense
        fields = ["id", "vehicle", "category", "category_label", "amount", "date", "mileage", "liters", "note"]
        read_only_fields = ["vehicle"]
