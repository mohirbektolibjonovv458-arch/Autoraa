"""Fayllarni «Range» so'rovlari bilan berish (206 Partial Content).
iPhone (Safari) video/audioni faqat shunday ijro etadi; boshqa brauzerlarda ham videoni o'rtasidan boshlash tezlashadi."""
import mimetypes
import os
import re

from django.http import FileResponse, Http404, HttpResponse, StreamingHttpResponse

_RANGE = re.compile(r"^bytes=(\d*)-(\d*)$")
CHUNK = 64 * 1024


def _iter(fh, start, length):
    try:
        fh.seek(start)
        left = length
        while left > 0:
            data = fh.read(min(CHUNK, left))
            if not data:
                break
            left -= len(data)
            yield data
    finally:
        fh.close()


def ranged_response(request, fh, size, content_type):
    """fh — ochilgan fayl (rb). Range bo'lmasa — oddiy javob; noto'g'ri Range — 416."""
    rng = request.headers.get("Range", "").strip()
    m = _RANGE.match(rng) if rng else None
    if not m or (not m.group(1) and not m.group(2)):
        resp = FileResponse(fh, content_type=content_type)
        resp["Accept-Ranges"] = "bytes"
        return resp
    a, b = m.group(1), m.group(2)
    if a:
        start = int(a)
        end = min(int(b), size - 1) if b else size - 1
    else:  # bytes=-N — oxirgi N bayt
        start, end = max(0, size - int(b)), size - 1
    if start >= size or start > end:
        fh.close()
        resp = HttpResponse(status=416)
        resp["Content-Range"] = f"bytes */{size}"
        return resp
    length = end - start + 1
    resp = StreamingHttpResponse(_iter(fh, start, length), status=206, content_type=content_type)
    resp["Content-Length"] = str(length)
    resp["Content-Range"] = f"bytes {start}-{end}/{size}"
    resp["Accept-Ranges"] = "bytes"
    return resp


def serve_file(request, root, path, content_type=None):
    full = os.path.realpath(os.path.join(root, path))
    if not full.startswith(os.path.realpath(root) + os.sep) or not os.path.isfile(full):
        raise Http404
    from .uploads import AUDIO_FORMATS, VIDEO_FORMATS
    ext = os.path.splitext(full)[1].lower()
    ctype = content_type or VIDEO_FORMATS.get(ext) or AUDIO_FORMATS.get(ext) or mimetypes.guess_type(full)[0] or "application/octet-stream"
    return ranged_response(request, open(full, "rb"), os.path.getsize(full), ctype)
