from django.urls import path

from . import views

urlpatterns = [
    path("parts/", views.ProductListView.as_view()),
    path("parts/categories/", views.PartCategoriesView.as_view()),
    path("parts/orders/", views.PartOrderView.as_view()),
    path("parts/orders/<int:pk>/cancel/", views.PartOrderCancelView.as_view()),
    path("parts/orders/<int:pk>/review/", views.PartOrderReviewView.as_view()),
    path("parts/<int:pk>/", views.ProductDetailView.as_view()),
    path("shops/<int:pk>/", views.PublicShopView.as_view()),
    path("shop/me/", views.MyShopView.as_view()),
    path("shop/me/products/", views.MyProductsView.as_view()),
    path("shop/me/products/<int:pk>/", views.MyProductDetailView.as_view()),
    path("shop/me/orders/", views.MyShopOrdersView.as_view()),
    path("shop/me/orders/<int:pk>/status/", views.MyShopOrderStatusView.as_view()),
    path("shop/me/stats/", views.MyShopStatsView.as_view()),
]
