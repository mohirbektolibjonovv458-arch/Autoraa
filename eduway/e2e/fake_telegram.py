"""Sinov uchun soxta Telegram Bot API (port 8766).
Backend: TELEGRAM_API_BASE=http://127.0.0.1:8766 TELEGRAM_BOT_TOKEN=123:test bilan ishga tushiriladi (lokal — polling rejimi).
Boshqaruv: POST /__push (update) — botga «foydalanuvchi xabari»; GET /__messages — bot yuborgan xabarlar."""
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

updates, messages, lock = [], [], threading.Lock()
seq = [0]


class H(BaseHTTPRequestHandler):
    def _json(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/__messages"):
            with lock:
                return self._json(messages)
        self._json({"ok": False}, 404)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        if self.path == "/__push":
            with lock:
                seq[0] += 1
                updates.append({"update_id": seq[0], **body})
            return self._json({"ok": True})
        method = self.path.rsplit("/", 1)[-1]
        if method == "getMe":
            return self._json({"ok": True, "result": {"username": "eduway_test_bot"}})
        if method == "sendMessage":
            with lock:
                messages.append(body)
            return self._json({"ok": True, "result": {"message_id": len(messages)}})
        if method == "getUpdates":
            offset = body.get("offset") or 0
            for _ in range(10):
                with lock:
                    out = [u for u in updates if u["update_id"] >= offset]
                if out:
                    return self._json({"ok": True, "result": out})
                time.sleep(0.1)
            return self._json({"ok": True, "result": []})
        self._json({"ok": True, "result": True})

    def log_message(self, *a):
        pass


ThreadingHTTPServer(("127.0.0.1", 8766), H).serve_forever()
