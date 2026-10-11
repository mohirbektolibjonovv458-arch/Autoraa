"""Anthropic Claude API bilan ishlash. API kaliti faqat backend muhit o'zgaruvchisida (ANTHROPIC_API_KEY) saqlanadi."""
import json
import logging

import anthropic
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from core.models import ErrorLog

from .models import UsageDay

log = logging.getLogger("eduway")

# Server tomonidagi zaxira modelga o'tish (refusal fallback) qo'llab-quvvatlanadigan modellar
FALLBACK_MODELS = {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}


class AIError(Exception):
    def __init__(self, code, message, status=502):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def is_configured():
    return bool(settings.ANTHROPIC_API_KEY)


_client = None


def client():
    global _client
    if not is_configured():
        raise AIError("ai_not_configured", "AI xizmati hali sozlanmagan. Administrator ANTHROPIC_API_KEY ni backend .env fayliga kiritishi kerak.", 503)
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=settings.AI_TIMEOUT_SECONDS, max_retries=1)
    return _client


# --- Kunlik limitlar ---

def daily_limit(user):
    return settings.AI_DAILY_LIMIT_PREMIUM if (user.is_premium or user.is_staff) else settings.AI_DAILY_LIMIT_FREE


def used_today(user):
    row = UsageDay.objects.filter(user=user, date=timezone.localdate()).first()
    return row.count if row else 0


def check_quota(user, cost=1):
    limit = daily_limit(user)
    if used_today(user) + cost > limit:
        msg = f"Bugungi AI limiti tugadi ({limit} ta so'rov)."
        if not user.is_premium:
            msg += " Premium tarifda kunlik limit ancha yuqori."
        raise AIError("ai_limit_reached", msg, 429)


@transaction.atomic
def add_usage(user, usage, cost=1):
    row, _ = UsageDay.objects.get_or_create(user=user, date=timezone.localdate())
    UsageDay.objects.filter(pk=row.pk).update(
        count=F("count") + cost,
        input_tokens=F("input_tokens") + (usage.get("input_tokens") or 0),
        output_tokens=F("output_tokens") + (usage.get("output_tokens") or 0),
    )


def _log(code, exc, user=None):
    log.warning("AI error %s: %s", code, exc)
    try:
        ErrorLog.objects.create(source="ai", code=code, message=str(exc)[:2000], user=user)
    except Exception:  # noqa: BLE001
        pass


# --- So'rov ---

def ask(system, messages, *, user=None, max_tokens=8000, effort="medium", schema=None):
    """Claude'ga so'rov yuboradi. Qaytaradi: (matn yoki dict, usage). Xatolarni AIError ga aylantiradi."""
    params = {
        "model": settings.AI_MODEL,
        "max_tokens": max_tokens,
        "system": system,
        "messages": messages,
        "thinking": {"type": "adaptive"},
        "output_config": {"effort": effort},
    }
    if schema:
        params["output_config"]["format"] = {"type": "json_schema", "schema": schema}
    try:
        c = client()
        if settings.AI_MODEL in FALLBACK_MODELS:
            resp = c.beta.messages.create(**params, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
        else:
            resp = c.messages.create(**params)
    except AIError:
        raise
    except anthropic.AuthenticationError as e:
        _log("auth", e, user)
        raise AIError("ai_misconfigured", "AI xizmati kaliti noto'g'ri yoki bekor qilingan. Administratorga xabar bering.", 503)
    except anthropic.PermissionDeniedError as e:
        _log("permission", e, user)
        raise AIError("ai_misconfigured", "AI xizmatiga ruxsat yo'q. Administratorga xabar bering.", 503)
    except anthropic.RateLimitError as e:
        _log("rate_limit", e, user)
        raise AIError("ai_busy", "AI xizmati hozir band. Bir daqiqadan so'ng qayta urinib ko'ring.", 429)
    except anthropic.APITimeoutError as e:
        _log("timeout", e, user)
        raise AIError("ai_timeout", "AI javobi juda uzoq davom etdi. Savolni qisqartirib, qayta urinib ko'ring.", 504)
    except anthropic.APIConnectionError as e:
        _log("connection", e, user)
        raise AIError("ai_unavailable", "AI xizmatiga ulanib bo'lmadi. Keyinroq urinib ko'ring.", 502)
    except anthropic.BadRequestError as e:
        _log("bad_request", e, user)
        raise AIError("ai_bad_request", "So'rovni qayta ishlab bo'lmadi. Matnni qisqartirib ko'ring.", 502)
    except anthropic.APIStatusError as e:
        _log(f"status_{e.status_code}", e, user)
        raise AIError("ai_unavailable", "AI xizmatida vaqtinchalik nosozlik. Keyinroq urinib ko'ring.", 502)

    if resp.stop_reason == "refusal":
        raise AIError("ai_refusal", "Bu so'rovga javob bera olmayman. Savolni boshqacha tarzda bering.", 422)
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    usage = {"input_tokens": resp.usage.input_tokens, "output_tokens": resp.usage.output_tokens}
    if not text:
        raise AIError("ai_empty", "AI javob qaytarmadi. Qayta urinib ko'ring.", 502)
    if schema:
        try:
            return json.loads(text), usage
        except json.JSONDecodeError as e:
            _log("bad_json", e, user)
            raise AIError("ai_bad_output", "AI javobini o'qib bo'lmadi. Qayta urinib ko'ring.", 502)
    if resp.stop_reason == "max_tokens":
        text += "\n\n_(Javob uzunlik chegarasiga yetdi — davomini so'rang.)_"
    return text, usage
