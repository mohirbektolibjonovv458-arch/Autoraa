from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import admin_api as a, views

router = DefaultRouter(trailing_slash=True)
router.register("universities", a.UniversityAdmin, basename="adm-uni")
router.register("programs", a.ProgramAdmin, basename="adm-program")
router.register("grants", a.GrantAdmin, basename="adm-grant")
router.register("careers", a.CareerAdmin, basename="adm-career")
router.register("quizzes", a.QuizAdmin, basename="adm-quiz")
router.register("questions", a.QuestionAdmin, basename="adm-question")
router.register("lessons", a.LessonAdmin, basename="adm-lesson")
router.register("users", a.UserAdmin, basename="adm-user")

admin_urls = [
    path("overview/", a.overview),
    path("errors/", a.errors),
    path("premium-requests/", a.premium_requests),
    path("premium-requests/<int:pk>/review/", a.premium_review),
    path("users/<int:pk>/premium/", a.grant_premium),
    path("flagged/", a.flagged_messages),
    path("flagged/<int:pk>/review/", a.flagged_review),
    path("", include(router.urls)),
]

urlpatterns = [
    path("health/", views.health),
    path("dashboard/", views.dashboard),
    path("search/", views.search),
    path("push/key/", views.push_key),
    path("push/subscribe/", views.push_subscribe),
    path("push/unsubscribe/", views.push_unsubscribe),
    path("push/test/", views.push_test),
    path("notifications/", views.notifications),
    path("notifications/read/", views.notifications_read),
    path("admin/", include(admin_urls)),
]
