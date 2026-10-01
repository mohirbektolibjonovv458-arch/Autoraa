from datetime import date, timedelta

from django.db.models import Sum
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CarDocument, Expense, Vehicle
from .serializers import CarDocumentSerializer, ExpenseSerializer


def my_vehicle(request, pk):
    return get_object_or_404(Vehicle, pk=pk, owner=request.user)


def bump_mileage(vehicle, mileage):
    """Yangi probeg kiritilsa — servisgacha qolgan km lar ham kamayadi."""
    try:
        mileage = int(mileage)
    except (TypeError, ValueError):
        return
    diff = mileage - vehicle.mileage
    if diff <= 0:
        return
    vehicle.mileage = mileage
    for f in ("next_service_km", "oil_change_km", "tire_km", "inspection_km"):
        if getattr(vehicle, f) is not None:  # kiritilmagan ko'rsatkichga tegmaymiz
            setattr(vehicle, f, max(0, getattr(vehicle, f) - diff))
    vehicle.save()


class DocumentsView(APIView):
    def get(self, request, pk):
        return Response(CarDocumentSerializer(my_vehicle(request, pk).documents.all(), many=True).data)

    def post(self, request, pk):
        vehicle = my_vehicle(request, pk)  # avval egalik tekshiriladi
        s = CarDocumentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save(vehicle=vehicle)
        return Response(s.data, status=201)


class DocumentDetailView(APIView):
    def get_obj(self, request, pk):
        return get_object_or_404(CarDocument, pk=pk, vehicle__owner=request.user)

    def patch(self, request, pk):
        obj = self.get_obj(request, pk)
        s = CarDocumentSerializer(obj, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save(last_reminded=None)
        return Response(s.data)

    def delete(self, request, pk):
        self.get_obj(request, pk).delete()
        return Response(status=204)


class ExpensesView(APIView):
    def get(self, request, pk):
        v = my_vehicle(request, pk)
        qs = v.expenses.all()
        month = request.query_params.get("month")  # YYYY-MM
        if month:
            y, m = month.split("-")
            qs = qs.filter(date__year=int(y), date__month=int(m))
        by_cat = [{"category": c, "label": dict(Expense.CATS).get(c, c), "total": t}
                  for c, t in qs.values_list("category").annotate(t=Sum("amount")).order_by("-t")]
        # oxirgi 6 oy
        today = date.today()
        months = []
        for i in range(5, -1, -1):
            y, m = today.year, today.month - i
            while m <= 0:
                m += 12
                y -= 1
            total = v.expenses.filter(date__year=y, date__month=m).aggregate(s=Sum("amount"))["s"] or 0
            months.append({"month": f"{y}-{m:02d}", "total": total})
        return Response({"items": ExpenseSerializer(qs[:300], many=True).data, "total": qs.aggregate(s=Sum("amount"))["s"] or 0,
                         "by_category": by_cat, "months": months, "categories": [{"key": k, "label": l} for k, l in Expense.CATS]})

    def post(self, request, pk):
        v = my_vehicle(request, pk)
        s = ExpenseSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save(vehicle=v)
        if request.data.get("mileage"):
            bump_mileage(v, request.data.get("mileage"))
        return Response(s.data, status=201)


class ExpenseDetailView(APIView):
    def delete(self, request, pk):
        get_object_or_404(Expense, pk=pk, vehicle__owner=request.user).delete()
        return Response(status=204)


class MileageView(APIView):
    def post(self, request, pk):
        v = my_vehicle(request, pk)
        bump_mileage(v, request.data.get("mileage"))
        from .serializers import VehicleSerializer
        return Response(VehicleSerializer(v).data)


class GarageSummaryView(APIView):
    """Bosh sahifa uchun: yaqinlashayotgan hujjat muddatlari va shu oy xarajati."""

    def get(self, request):
        today = date.today()
        docs = CarDocument.objects.filter(vehicle__owner=request.user, expires_on__lte=today + timedelta(days=30)).select_related("vehicle")
        month_total = Expense.objects.filter(vehicle__owner=request.user, date__year=today.year, date__month=today.month).aggregate(s=Sum("amount"))["s"] or 0
        service_due = [{"id": v.id, "title": f"{v.brand} {v.model}".strip(), "km": v.next_service_km}
                       for v in Vehicle.objects.filter(owner=request.user, next_service_km__lte=500)]
        return Response({"documents": CarDocumentSerializer(docs, many=True).data, "month_expenses": month_total, "service_due": service_due})
