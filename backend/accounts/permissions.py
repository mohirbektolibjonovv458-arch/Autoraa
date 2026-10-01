from rest_framework.permissions import BasePermission


class IsUsta(BasePermission):
    message = "Bu bo'lim faqat ustalar uchun."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "usta"


class IsEvakuator(BasePermission):
    message = "Bu bo'lim faqat evakuator haydovchilari uchun."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "evakuator"


class IsProvider(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("usta", "evakuator")


class IsAdmin(BasePermission):
    message = "Faqat administratorlar uchun."

    def has_permission(self, request, view):
        u = request.user
        if not (u.is_authenticated and u.is_active and (u.role == "admin" or u.is_staff)):
            return False
        from accounts.views import admin_ip_allowed
        return admin_ip_allowed(request)
