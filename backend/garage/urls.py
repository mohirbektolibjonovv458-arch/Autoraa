from django.urls import path
from rest_framework.routers import DefaultRouter

from . import extra_views as x
from .views import VehicleViewSet

router = DefaultRouter()
router.register("vehicles", VehicleViewSet, basename="vehicle")
urlpatterns = [
    path("summary/", x.GarageSummaryView.as_view()),
    path("vehicles/<int:pk>/documents/", x.DocumentsView.as_view()),
    path("vehicles/<int:pk>/expenses/", x.ExpensesView.as_view()),
    path("vehicles/<int:pk>/mileage/", x.MileageView.as_view()),
    path("documents/<int:pk>/", x.DocumentDetailView.as_view()),
    path("expenses/<int:pk>/", x.ExpenseDetailView.as_view()),
] + router.urls
