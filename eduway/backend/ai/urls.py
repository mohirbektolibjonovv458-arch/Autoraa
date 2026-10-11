from django.urls import path

from . import views

urlpatterns = [
    path("status/", views.status),
    path("chat/", views.chat),
    path("conversations/", views.conversations),
    path("conversations/<int:pk>/", views.conversation_detail),
    path("messages/<int:pk>/feedback/", views.feedback),
    path("writing/", views.writing),
    path("plan/<int:goal_id>/", views.plan),
    path("career-advice/<int:result_id>/", views.career_advice),
    path("quiz/", views.generate_quiz),
    path("usage/", views.usage_history),
]
