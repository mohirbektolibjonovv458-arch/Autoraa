from django.urls import path

from . import views

urlpatterns = [
    path("", views.SOSCreateView.as_view()),
    path("available/", views.SOSAvailableView.as_view()),
    path("assigned/", views.SOSAssignedView.as_view()),
    path("stats/", views.ProviderStatsView.as_view()),
    path("evacuator/me/", views.EvacuatorMeView.as_view()),
    path("<int:pk>/", views.SOSDetailView.as_view()),
    path("<int:pk>/cancel/", views.SOSCancelView.as_view()),
    path("<int:pk>/accept/", views.SOSAcceptView.as_view()),
    path("<int:pk>/status/", views.SOSStatusView.as_view()),
    path("<int:pk>/review/", views.SOSReviewView.as_view()),
]
