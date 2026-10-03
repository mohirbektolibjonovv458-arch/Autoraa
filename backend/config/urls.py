from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, HttpResponse
from django.urls import include, path, re_path
from django.views.static import serve

from core.routing import GeocodeView, RouteView
from core.tiles import tile_view


def spa(request, *args, **kwargs):
    """React ilovasi.
    - frontend_build ichida mavjud fayl bo'lsa (masalan server qayta ishga tushmasdan yangi build qilingan) — o'zini beradi;
    - kengaytmali, lekin mavjud bo'lmagan fayl (.js, .css, .png ...) — 404 (HTML qaytarilsa sahifa oq bo'lib qoladi);
    - qolgan barcha manzillar — index.html (React Router hal qiladi)."""
    import mimetypes
    from django.http import Http404
    root = settings.FRONTEND_DIR.resolve()
    rel = request.path.lstrip("/")
    if rel:
        candidate = (root / rel).resolve()
        if str(candidate).startswith(str(root)) and candidate.is_file():
            ctype = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
            if candidate.suffix == ".apk":
                ctype = "application/vnd.android.package-archive"
            resp = FileResponse(open(candidate, "rb"), content_type=ctype, as_attachment=candidate.suffix == ".apk")
            if rel.startswith("assets/"):
                resp["Cache-Control"] = "public, max-age=31536000, immutable"
            return resp
        last = rel.rstrip("/").rsplit("/", 1)[-1]
        if rel.startswith("assets/") or ("." in last and not last.startswith(".")):
            raise Http404
    index = root / "index.html"
    if not index.exists():
        return HttpResponse("Frontend build topilmadi. frontend papkasida: npm install && npm run build", status=503)
    resp = FileResponse(open(index, "rb"), content_type="text/html; charset=utf-8")
    resp["Cache-Control"] = "no-cache"  # yangi deploy darhol ko'rinishi uchun (PWA ham eski versiyada qolmaydi)
    return resp


def media_serve(request, path):
    """Ochiq media fayllar. To'lov cheklari bu yerdan berilmaydi (faqat imzoli havola orqali)."""
    from django.http import Http404
    # to'lov cheklari va chat rasmlari shaxsiy — faqat imzoli havola orqali
    if path.startswith(("receipts/", "chat/", "chat-audio/")) or ".." in path:
        raise Http404
    resp = serve(request, path, document_root=settings.MEDIA_ROOT)
    resp["Cache-Control"] = "public, max-age=604800"
    resp["X-Content-Type-Options"] = "nosniff"
    return resp


def assetlinks(request):
    """Play Market (Trusted Web Activity) uchun: Android ilova shu sayt egasiniki ekanini tasdiqlaydi.
    .env: TWA_PACKAGE_NAME=uz.avtora.app, TWA_SHA256_FINGERPRINTS=AB:CD:... (Play Console → App signing)."""
    import os
    from django.http import Http404, JsonResponse
    pkg = os.getenv("TWA_PACKAGE_NAME", "").strip()
    fps = [f.strip() for f in os.getenv("TWA_SHA256_FINGERPRINTS", "").split(",") if f.strip()]
    if not pkg or not fps:
        raise Http404
    return JsonResponse([{"relation": ["delegate_permission/common.handle_all_urls"],
                          "target": {"namespace": "android_app", "package_name": pkg, "sha256_cert_fingerprints": fps}}], safe=False)


def health(request):
    """Monitoring uchun: baza ishlayaptimi."""
    from django.db import connection
    from django.http import JsonResponse
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
        from accounts.utils import BOT_STATUS
        from core.push import key_state
        ok, why = key_state()
        return JsonResponse({"status": "ok", "bots": BOT_STATUS, "push": "ok" if ok else why})
    except Exception:
        return JsonResponse({"status": "db_error"}, status=503)


urlpatterns = [
    path("api/health/", health),
    path(".well-known/assetlinks.json", assetlinks),
    path("api/map/route/", RouteView.as_view()),
    path("api/map/geocode/", GeocodeView.as_view()),
    re_path(r"^api/map/tiles/(?P<z>\d{1,2})/(?P<x>\d{1,7})/(?P<y>\d{1,7})\.png$", tile_view),
    re_path(r"^api/map/(?P<layer>sat|labels|dark)/(?P<z>\d{1,2})/(?P<x>\d{1,7})/(?P<y>\d{1,7})\.img$", tile_view),
    path("api/auth/", include("accounts.urls")),
    path("api/garage/", include("garage.urls")),
    path("api/masters/", include("masters.urls")),
    path("api/sos/", include("evacuator.urls")),
    path("api/", include("market.urls")),
    path("api/premium/", include("premium.urls")),
    path("api/chat/", include("chat.urls")),
    path("api/fuel/", include("fuel.urls")),
    path("api/trips/", include("trips.urls")),
    path("api/", include("core.urls")),
    re_path(r"^media/(?P<path>.*)$", media_serve),
    re_path(r"^(?!api/|media/|static/|django-admin/).*$", spa),
]
if settings.DJANGO_ADMIN_ENABLED:
    urlpatterns.insert(0, path("django-admin/", admin.site.urls))
