from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("login/", views.LoginView.as_view()),
    path("refresh/", TokenRefreshView.as_view()),
    path("logout/", views.LogoutView.as_view()),
    path("me/", views.MeView.as_view()),
    path("password/", views.PasswordView.as_view()),
    path("options/", views.OptionsView.as_view()),
    path("phone/config/", views.phone_config),
    path("phone/start/", views.phone_start),
    path("phone/status/", views.phone_status),
    path("phone/resend/", views.phone_resend),
    path("phone/verify/", views.phone_verify),
    path("telegram/webhook/", views.telegram_webhook),
]
