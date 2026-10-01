from django.conf import settings


class SecurityHeadersMiddleware:
    """Barcha javoblarga xavfsizlik sarlavhalari: CSP, Permissions-Policy, API javoblari keshlanmasin."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        resp = self.get_response(request)
        ctype = resp.get("Content-Type", "")
        if "text/html" in ctype:
            resp.setdefault("Content-Security-Policy", settings.CSP_HEADER)
        resp.setdefault("Permissions-Policy", settings.PERMISSIONS_POLICY)
        resp.setdefault("X-Content-Type-Options", "nosniff")
        resp.setdefault("Cross-Origin-Resource-Policy", "same-origin")
        if request.path.startswith("/api/") and "Cache-Control" not in resp:
            # shaxsiy ma'lumotlar brauzer/proksi keshida qolib ketmasin
            resp["Cache-Control"] = "no-store"
        if request.path.startswith(("/admin", "/api/admin", "/api/auth")):
            resp["X-Robots-Tag"] = "noindex, nofollow"
        return resp
