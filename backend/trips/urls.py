from django.urls import path

from . import views

urlpatterns = [
    path("", views.TripListCreateView.as_view()),
    path("settings/", views.TripSettingsView.as_view()),
    path("active/", views.TripActiveView.as_view()),
    path("<int:pk>/", views.TripDetailView.as_view()),
    path("<int:pk>/progress/", views.TripProgressView.as_view()),
    path("<int:pk>/fuel-stop/", views.TripFuelStopView.as_view()),
    path("<int:pk>/finish/", views.TripFinishView.as_view()),
]
