from django.urls import path

from . import admin_api as a
from . import push_views, views

urlpatterns = [
    path("settings/", views.PublicSettingsView.as_view()),
    path("stats/", views.PublicStatsView.as_view()),
    path("search/", views.SearchView.as_view()),
    path("push/key/", push_views.PushKeyView.as_view()),
    path("push/subscribe/", push_views.PushSubscribeView.as_view()),
    path("push/unsubscribe/", push_views.PushUnsubscribeView.as_view()),
    path("push/resubscribe/", push_views.PushResubscribeView.as_view()),
    path("push/status/", push_views.PushStatusView.as_view()),
    path("notifications/", views.NotificationListView.as_view()),
    path("notifications/read/", views.NotificationReadView.as_view()),
    path("notifications/<int:pk>/read/", views.NotificationReadView.as_view()),
    path("blog/", views.BlogListView.as_view()),
    path("blog/<int:pk>/", views.BlogDetailView.as_view()),
    path("orders/my/", views.MyOrdersView.as_view()),
    # admin panel
    path("admin/dashboard/", a.DashboardView.as_view()),
    path("admin/users/", a.UsersView.as_view()),
    path("admin/users/<int:pk>/", a.UserUpdateView.as_view()),
    path("admin/masters/", a.MastersView.as_view()),
    path("admin/masters/<int:pk>/verify/", a.MasterVerifyView.as_view()),
    path("admin/orders/", a.OrdersView.as_view()),
    path("admin/payments/", a.PaymentsView.as_view()),
    path("admin/payments/<int:pk>/<str:action>/", a.PaymentActionView.as_view()),
    path("admin/shops/", a.ShopsView.as_view()),
    path("admin/map/", a.LiveMapView.as_view()),
    path("admin/settings/", a.SettingsView.as_view()),
    path("admin/blog/", a.BlogAdminView.as_view()),
    path("admin/blog/<int:pk>/", a.BlogAdminDetailView.as_view()),
    path("admin/broadcast/", a.BroadcastView.as_view()),
]
