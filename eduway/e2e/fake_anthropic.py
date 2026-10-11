"""Sinov uchun soxta Anthropic Messages API serveri: backend haqiqiy SDK orqali so'rov yuboradi,
bu server esa tayyor javob qaytaradi va kelgan so'rovni requests.jsonl ga yozadi."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

WRITING = {"overall": 6.0, "criteria": [{"name": n, "band": 6.0, "comment": "Yaxshi, lekin rivojlantirish mumkin."} for n in ["Task Response", "Coherence and Cohesion", "Lexical Resource", "Grammatical Range and Accuracy"]],
           "strengths": ["Aniq pozitsiya"], "mistakes": [{"original": "peoples thinks", "correction": "people think", "explanation": "«people» ko'plikda, fe'l -s olmaydi."}],
           "next_steps": ["Bog'lovchi so'zlarni ko'paytiring"], "improved_version": "Some people think that..."}


class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        with open("/tmp/claude-0/fake-anthropic-requests.jsonl", "a") as f:
            f.write(json.dumps({"path": self.path, "headers": {k: v for k, v in self.headers.items() if k.lower().startswith("anthropic")}, "body": body}) + "\n")
        fmt = (body.get("output_config") or {}).get("format")
        if fmt:
            text = json.dumps(WRITING)
        else:
            text = "## Yechim\n\n1. **Diskriminant**: D = b² − 4ac = 25 − 24 = 1\n2. x₁ = 3, x₂ = 2\n\n| x | qiymat |\n|---|---|\n| x₁ | 3 |\n| x₂ | 2 |\n\nEndi o'zingiz sinab ko'ring: x² − 7x + 12 = 0"
        out = {"id": "msg_test", "type": "message", "role": "assistant", "model": body["model"], "stop_reason": "end_turn", "stop_sequence": None,
               "content": [{"type": "thinking", "thinking": "", "signature": "x"}, {"type": "text", "text": text}],
               "usage": {"input_tokens": 120, "output_tokens": 80}}
        data = json.dumps(out).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


HTTPServer(("127.0.0.1", 8765), H).serve_forever()
