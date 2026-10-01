from django.urls import path

from . import views

urlpatterns = [
    path("file/<int:pk>/", views.ChatFileView.as_view()),
    path("", views.ConversationListView.as_view()),
    path("start/", views.StartConversationView.as_view()),
    path("unread/", views.UnreadView.as_view()),
    path("<int:pk>/messages/", views.MessagesView.as_view()),
]
