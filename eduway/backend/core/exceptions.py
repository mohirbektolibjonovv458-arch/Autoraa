import logging

from rest_framework.views import exception_handler

log = logging.getLogger("eduway")


def handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        # Kutilmagan xato: foydalanuvchiga ichki tafsilotlarni ko'rsatmaymiz, lekin admin uchun qayd qilamiz
        log.exception("Unhandled API error", exc_info=exc)
        try:
            from .models import ErrorLog

            req = context.get("request")
            user = req.user if req and getattr(req.user, "is_authenticated", False) else None
            ErrorLog.objects.create(source="server", code=type(exc).__name__, message=str(exc)[:2000], user=user)
        except Exception:  # noqa: BLE001 — log yozish xatosi asosiy javobni buzmasin
            pass
        from rest_framework.response import Response

        return Response({"detail": "Serverda kutilmagan xatolik. Birozdan so'ng qayta urinib ko'ring."}, status=500)
    return response
