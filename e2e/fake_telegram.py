"""Sinov uchun Telegram Bot API o'rinbosari: xabarlarni yozib boradi, getUpdates navbatini beradi."""
import json, threading, time, io
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
STATE = {"updates": {}, "sent": [], "uid": 1}
LOCK = threading.Lock()
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6300010000050001")+b""
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _json(self, obj, code=200):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def _body(self):
        n = int(self.headers.get("Content-Length") or 0); raw = self.rfile.read(n) if n else b""
        ct = self.headers.get("Content-Type", "")
        if "json" in ct:
            try: return json.loads(raw or b"{}")
            except Exception: return {}
        if "multipart" in ct:
            out = {}
            for part in raw.split(b"--"):
                if b'name="' in part:
                    name = part.split(b'name="')[1].split(b'"')[0].decode()
                    val = part.split(b"\r\n\r\n", 1)[1].rsplit(b"\r\n", 1)[0] if b"\r\n\r\n" in part else b""
                    out[name] = val.decode("utf-8", "ignore") if name not in ("photo",) else "<file>"
            return out
        return {k: v[0] for k, v in parse_qs(raw.decode()).items()}
    def do_GET(self):
        p = urlparse(self.path)
        if p.path == "/_sent":
            return self._json(STATE["sent"])
        if p.path.startswith("/file/"):
            self.send_response(200); self.send_header("Content-Type", "image/png"); b = open(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "receipt.png"), "rb").read(); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b); return
        self._json({"ok": False}, 404)
    def do_POST(self):
        p = urlparse(self.path); parts = p.path.strip("/").split("/")
        if parts[0] == "_push":
            token = parts[1]; upd = self._body()
            with LOCK:
                upd["update_id"] = STATE["uid"]; STATE["uid"] += 1
                STATE["updates"].setdefault(token, []).append(upd)
            return self._json({"ok": True})
        if not parts[0].startswith("bot") or len(parts) < 2:
            return self._json({"ok": False}, 404)
        token, method = parts[0][3:], parts[1]; data = self._body()
        if method == "getMe":
            return self._json({"ok": True, "result": {"id": 1, "is_bot": True, "username": "avtora_code_bot" if token.startswith("89") else "avtora_premium_bot"}})
        if method == "getUpdates":
            off = int(data.get("offset") or 0); t0 = time.time()
            while time.time() - t0 < 1.0:
                with LOCK:
                    ups = [u for u in STATE["updates"].get(token, []) if u["update_id"] >= off]
                if ups: return self._json({"ok": True, "result": ups})
                time.sleep(0.1)
            return self._json({"ok": True, "result": []})
        if method == "getFile":
            return self._json({"ok": True, "result": {"file_path": "photos/r.png"}})
        with LOCK:
            STATE["sent"].append({"token": token[:4], "method": method, "chat_id": data.get("chat_id"), "text": data.get("text") or data.get("caption") or "", "markup": data.get("reply_markup")})
        return self._json({"ok": True, "result": {"message_id": len(STATE["sent"])}})
ThreadingHTTPServer(("127.0.0.1", 9900), H).serve_forever()
