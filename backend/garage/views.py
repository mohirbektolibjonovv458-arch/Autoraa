from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Vehicle
from .serializers import ServiceRecordSerializer, VehicleSerializer


class VehicleViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleSerializer

    def get_queryset(self):
        return Vehicle.objects.filter(owner=self.request.user).prefetch_related("records")

    def perform_create(self, serializer):
        first = not Vehicle.objects.filter(owner=self.request.user).exists()
        serializer.save(owner=self.request.user, is_primary=first or serializer.validated_data.get("is_primary", False))

    @action(detail=True, methods=["post"])
    def make_primary(self, request, pk=None):
        v = self.get_object()
        Vehicle.objects.filter(owner=request.user).update(is_primary=False)
        v.is_primary = True
        v.save(update_fields=["is_primary"])
        return Response(VehicleSerializer(v).data)

    @action(detail=True, methods=["post"])
    def records(self, request, pk=None):
        v = self.get_object()
        s = ServiceRecordSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save(vehicle=v)
        return Response(s.data, status=201)
