from django.urls import path

from . import views

urlpatterns = [
    path("test/", views.test),
    path("submit/", views.submit),
    path("results/", views.results),
    path("results/<int:pk>/", views.result_detail),
    path("careers/", views.careers),
    path("careers/<slug:slug>/", views.career_detail),
    path("careers/<slug:slug>/save/", views.career_save),
]
