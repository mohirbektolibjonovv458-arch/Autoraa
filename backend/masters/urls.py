from django.urls import path

from . import stories, views

urlpatterns = [
    path("stories/", stories.StoryListView.as_view()),
    path("stories/<int:pk>/", stories.StoryDetailView.as_view()),
    path("stories/<int:pk>/view/", stories.StoryViewMark.as_view()),
    path("", views.MasterListView.as_view()),
    path("categories/", views.CategoriesView.as_view()),
    path("favorites/", views.FavoritesView.as_view()),
    path("bookings/", views.BookingListCreateView.as_view()),
    path("bookings/<int:pk>/status/", views.BookingStatusView.as_view()),
    path("bookings/<int:pk>/reschedule/", views.BookingRescheduleView.as_view()),
    path("bookings/<int:pk>/review/", views.ReviewCreateView.as_view()),
    path("me/", views.MyMasterProfileView.as_view()),
    path("me/services/", views.MyServicesView.as_view()),
    path("me/services/<int:pk>/", views.MyServiceDetailView.as_view()),
    path("me/stats/", views.MasterStatsView.as_view()),
    path("me/photos/", views.MyPhotosView.as_view()),
    path("me/photos/<int:pk>/", views.MyPhotoDetailView.as_view()),
    path("<int:pk>/", views.MasterDetailView.as_view()),
    path("<int:pk>/slots/", views.SlotsView.as_view()),
    path("<int:pk>/favorite/", views.FavoriteToggleView.as_view()),
]
