from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Faqat administratorlar (is_staff). Oddiy foydalanuvchilar admin API'ga kira olmaydi."""

    message = "Bu bo'lim faqat administratorlar uchun."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_active and u.is_staff)


class IsPremium(BasePermission):
    message = "Bu imkoniyat Premium tarifda mavjud."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_premium or u.is_staff))
