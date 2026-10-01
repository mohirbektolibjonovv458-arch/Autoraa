"""WhiteNoise orqali beriladigan frontend fayllari uchun to'g'ri kesh sarlavhalari (PWA uchun muhim)."""


def add_headers(headers, path, url):
    if url.startswith("/assets/"):
        # nomida hash bor — hech qachon o'zgarmaydi
        headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif url == "/sw.js":
        # service worker har doim yangisi tekshirilishi kerak
        headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        headers["Service-Worker-Allowed"] = "/"
        headers["Content-Type"] = "application/javascript; charset=utf-8"
    elif url.endswith(".webmanifest"):
        headers["Content-Type"] = "application/manifest+json; charset=utf-8"
        headers["Cache-Control"] = "public, max-age=3600"
    elif url in ("/offline.html", "/index.html"):
        from django.conf import settings
        headers["Cache-Control"] = "no-cache"
        headers["Content-Security-Policy"] = settings.CSP_HEADER
    elif url.startswith(("/icons/", "/splash/", "/brand/", "/favicon")) or url == "/apple-touch-icon.png":
        headers["Cache-Control"] = "public, max-age=604800"
