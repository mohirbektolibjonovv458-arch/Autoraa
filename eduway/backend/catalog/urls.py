from django.urls import path

from . import views

urlpatterns = [
    path("universities/", views.university_list),
    path("universities/filters/", views.university_filters),
    path("universities/compare/", views.university_compare),
    path("universities/<int:pk>/", views.university_detail),
    path("universities/<int:pk>/favorite/", views.university_favorite),
    path("grants/", views.grant_list),
    path("grants/saved/", views.saved_grants),
    path("grants/saved/<int:pk>/", views.saved_grant_update),
    path("grants/saved/<int:pk>/checklist/", views.checklist_add),
    path("grants/checklist/<int:pk>/", views.checklist_item),
    path("grants/<int:pk>/", views.grant_detail),
    path("grants/<int:pk>/save/", views.grant_save),
]
