from django.urls import path

from . import views as v

urlpatterns = [
    path("config/", v.config),
    path("rules/", v.accept_rules),
    path("find/", v.find),
    path("<uuid:pk>/", v.poll),
    path("<uuid:pk>/signal/", v.signal),
    path("<uuid:pk>/end/", v.end),
    path("<uuid:pk>/rate/", v.rate),
    path("<uuid:pk>/report/", v.report),
    path("<uuid:pk>/block/", v.block),
]
