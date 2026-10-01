from django.urls import path

from . import views

urlpatterns = [
    path("send-code/", views.SendCodeView.as_view()),
    path("telegram-status/", views.TelegramStatusView.as_view()),
    path("register/", views.RegisterView.as_view()),
    path("login/", views.LoginView.as_view()),
    path("admin-login/", views.AdminLoginView.as_view()),
    path("refresh/", views.SafeRefreshView.as_view()),
    path("logout/", views.LogoutView.as_view()),
    path("me/", views.MeView.as_view()),
    path("location/", views.LocationView.as_view()),
]
