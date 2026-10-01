from django.urls import path

from . import views

urlpatterns = [
    path("meta/", views.MetaView.as_view()),
    path("stations/", views.StationsView.as_view()),
    path("map/", views.MapView.as_view()),
    path("along/", views.AlongRouteView.as_view()),
    path("stations/<int:pk>/", views.StationDetailView.as_view()),
    path("stations/<int:pk>/report/", views.ReportView.as_view()),
    path("stations/<int:pk>/subscribe/", views.SubscribeView.as_view()),
    path("my/", views.MyFuelView.as_view()),
    path("leaders/", views.LeadersView.as_view()),
    path("admin/stations/", views.AdminStationsView.as_view()),
    path("admin/stations/<int:pk>/", views.AdminStationDetailView.as_view()),
    path("admin/reports/", views.AdminReportsView.as_view()),
]
