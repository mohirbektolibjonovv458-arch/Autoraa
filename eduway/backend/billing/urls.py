from django.urls import path

from . import views

urlpatterns = [
    path("plans/", views.plans),
    path("requests/", views.create_request),
    path("requests/<int:pk>/cancel/", views.cancel_request),
]
