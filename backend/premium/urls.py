from django.urls import path

from . import views

urlpatterns = [
    path("receipt/<int:pk>/", views.ReceiptView.as_view()),
    path("info/", views.PremiumInfoView.as_view()),
    path("pay/", views.PremiumPayView.as_view()),
    path("payments/", views.PremiumHistoryView.as_view()),
]
