import threading
"""Xarita plitalari (tiles) proksisi: provayder API kaliti faqat serverda turadi, frontendga berilmaydi.
Plitalar diskda keshlanadi (tez ochiladi va provayder limitlari tejaladi).

.env:
  MAP_TILE_URL=https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key={key}   (yoki boshqa provayder)
  MAP_TILE_KEY=...            # kalit — faqat serverda
  MAP_ATTRIBUTION=© MapTiler © OpenStreetMap contributors
Sukut bo'yicha — OpenStreetMap standart plitalari (kichik va o'rta trafik uchun; katta trafikda tijoriy provayder tavsiya etiladi)."""
import logging
import os
import time
from pathlib import Path

import requests
from django.conf import settings
from django.http import Http404, HttpResponse
from rest_framework.throttling import AnonRateThrottle

log = logging.getLogger("avtora")
MAX_AGE = 7 * 24 * 3600
_session = requests.Session()
# xaritani surganda bir vaqtda o'nlab plita so'raladi — ulanishlar havzasi kattaroq
_session.mount("https://", requests.adapters.HTTPAdapter(pool_connections=8, pool_maxsize=48))
_down_until = {}  # provayder ishlamay qolsa — 30 soniya qayta urinmaymiz (server oqimlari band bo'lib qolmasin)


class TileThrottle(AnonRateThrottle):
    scope = "tiles"

    def get_cache_key(self, request, view=None):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


def _layer(name):
    """Qatlamlar: std — oddiy xarita; dark — tayyor tungi plitalar (ixtiyoriy); sat — sun'iy yo'ldosh surati;
    labels — ko'cha/joy nomlari (sun'iy yo'ldosh ustiga)."""
    if name == "std":
        return settings.MAP_TILE_URL, settings.MAP_TILE_KEY
    if name == "dark":
        return (settings.MAP_DARK_TILE_URL or None), settings.MAP_DARK_TILE_KEY
    if name == "sat":
        return settings.SAT_TILE_URL, settings.SAT_TILE_KEY
    if name == "labels":
        return settings.SAT_LABELS_URL, settings.SAT_TILE_KEY
    return None, None


def tile_view(request, z, x, y, layer="std"):
    url_tpl, key = _layer(layer)
    if not url_tpl:
        raise Http404
    z, x, y = int(z), int(x), int(y)
    max_z = 19 if layer in ("std", "dark") else 20
    if not (0 <= z <= max_z) or not (0 <= x < 2 ** z) or not (0 <= y < 2 ** z):
        raise Http404
    path = Path(settings.TILE_CACHE_DIR) / ("" if layer == "std" else layer) / str(z) / str(x) / f"{y}.img"
    legacy = Path(settings.TILE_CACHE_DIR) / str(z) / str(x) / f"{y}.png"
    if layer == "std" and not path.exists() and legacy.exists():
        path = legacy  # oldingi versiyadagi kesh
    fresh = path.exists() and time.time() - path.stat().st_mtime < MAX_AGE
    data, ctype = None, "image/png"
    down = _down_until.setdefault(layer, 0.0) if isinstance(_down_until, dict) else 0.0
    if not fresh and time.time() < down:
        fresh = path.exists()
        if not fresh:
            return HttpResponse(status=503)
    if not fresh:
        # cheklov faqat provayderdan yangi plita olishga qo'yiladi (keshdagi plitalar cheklanmaydi)
        if not TileThrottle().allow_request(request, None):
            return HttpResponse(status=429)
        url = url_tpl.format(z=z, x=x, y=y, s="a", key=key)
        try:
            r = _session.get(url, timeout=6, headers={"User-Agent": f"Avtora/1.0 (+{settings.SITE_URL or 'https://avtora.uz'})"})
            ct = r.headers.get("Content-Type", "")
            if r.ok and ct.startswith("image/"):
                data, ctype = r.content, ct.split(";")[0]
                path = path if path.suffix == ".img" else path.with_suffix(".img")
                path.parent.mkdir(parents=True, exist_ok=True)
                # bir plitani bir vaqtda ikki so'rov yozsa ham to'qnashmasin — har biriga alohida vaqtinchalik fayl
                tmp = path.with_name(f"{path.stem}.{os.getpid()}.{threading.get_ident()}.tmp")
                try:
                    tmp.write_bytes(data)
                    os.replace(tmp, path)
                except OSError:
                    tmp.unlink(missing_ok=True)  # kesh yozilmasa ham plita foydalanuvchiga beriladi
            else:
                log.warning("Tile provider javobi (%s): %s", layer, r.status_code)
        except requests.RequestException as exc:  # faqat tarmoq xatosida provayder «vaqtincha ishlamaydi» deb belgilanadi
            if isinstance(_down_until, dict):
                _down_until[layer] = time.time() + 30
            log.warning("Tile provider xatosi (%s): %s", layer, exc.__class__.__name__)
    if data is None:
        if not path.exists():
            return HttpResponse(status=502)
        data = path.read_bytes()  # provayder ishlamasa — eskirgan bo'lsa ham keshdagisi
        ctype = "image/jpeg" if data[:3] == b"\xff\xd8\xff" else "image/png"
    resp = HttpResponse(data, content_type=ctype)
    resp["Cache-Control"] = "public, max-age=86400"
    return resp
