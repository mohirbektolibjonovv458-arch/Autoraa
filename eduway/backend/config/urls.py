from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import include, path, re_path


def spa(request, *args, **kwargs):
    """React ilovasini beradi (production build). Build bo'lmasa — yo'riqnoma."""
    index = settings.FRONTEND_DIST / "index.html"
    if index.exists():
        return HttpResponse(index.read_text(encoding="utf-8"))
    return HttpResponse("Frontend build topilmadi. eduway/frontend papkasida: npm install && npm run build", status=503, content_type="text/plain; charset=utf-8")


def api_404(request, *args, **kwargs):
    return JsonResponse({"detail": "Topilmadi."}, status=404)


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/career/", include("career.urls")),
    path("api/learn/", include("learning.urls")),
    path("api/ai/", include("ai.urls")),
    path("api/billing/", include("billing.urls")),
    path("api/speak/", include("speaking.urls")),
    path("api/", include("catalog.urls")),
    path("api/", include("core.urls")),
    re_path(r"^api/", api_404),
    re_path(r"^(?!static/|django-admin/).*$", spa),
]
