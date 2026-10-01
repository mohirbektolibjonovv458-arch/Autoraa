from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from accounts.utils import premium_bot_username, tg_call
from core.models import SiteSettings, notify


def fmt_money(n):
    return f"{n:,}".replace(",", " ") + " so'm"


def fmt_card(num):
    n = "".join(ch for ch in str(num) if ch.isdigit())
    return " ".join(n[i:i + 4] for i in range(0, len(n), 4))


def payment_keyboard(pid):
    return {"inline_keyboard": [[
        {"text": "✅ Pul tushdi — tasdiqlash", "callback_data": f"pay:approve:{pid}"},
        {"text": "❌ Rad etish", "callback_data": f"pay:reject:{pid}"},
    ]]}


from html import escape as esc


def payment_caption(p):
    u = p.user
    return (
        f"💳 <b>Yangi Premium to'lov #{p.id}</b>\n\n"
        f"👤 {esc(u.full_name)}\n📱 {u.phone}\n🛠 Rol: {u.get_role_display()}\n"
        f"📦 {p.months} oy — <b>{fmt_money(p.amount)}</b>\n"
        f"💳 Karta: {fmt_card(p.card_number)}\n"
        + (f"🔢 To'lovchi karta: **** {p.payer_card_last4}\n" if p.payer_card_last4 else "")
        + (f"📝 {esc(p.note)}\n" if p.note else "")
        + f"🕒 {timezone.localtime(p.created_at):%d.%m.%Y %H:%M}\n\n"
        "Bank ilovangizda pul haqiqatan tushganini tekshiring, so'ng tasdiqlang."
    )


def admin_chat_ids():
    """To'lovni tasdiqlovchi adminlar: Premium botga raqamini ulashgan admin akkauntlar (+ .env dagi ID lar)."""
    from premium.models import PremiumBotChat
    ids = set(settings.PREMIUM_ADMIN_CHAT_IDS)
    ids.update(PremiumBotChat.objects.filter(is_admin=True).values_list("chat_id", flat=True))
    return list(ids)


def notify_admins_new_payment(payment):
    token = settings.PREMIUM_BOT_TOKEN
    ids = admin_chat_ids()
    if not token or not ids:
        return False
    ok = False
    for chat_id in ids:
        data = {"chat_id": chat_id, "parse_mode": "HTML", "reply_markup": payment_keyboard(payment.id)}
        if payment.receipt:
            data["caption"] = payment_caption(payment)
            with payment.receipt.open("rb") as f:
                res = tg_call(token, "sendPhoto", data, files={"photo": f})
        else:
            data["text"] = payment_caption(payment)
            res = tg_call(token, "sendMessage", data)
        ok = ok or bool(res and res.get("ok"))
    return ok


def _user_tg(user, text):
    from premium.models import PremiumBotChat
    sent = False
    chat = PremiumBotChat.objects.filter(phone=user.phone).first()
    if chat:
        res = tg_call(settings.PREMIUM_BOT_TOKEN, "sendMessage", {"chat_id": chat.chat_id, "text": text, "parse_mode": "HTML"})
        sent = bool(res and res.get("ok"))
    if not sent:
        from accounts.utils import notify_user_telegram
        notify_user_telegram(user, text)


def approve_payment(payment, by="admin"):
    from django.db import transaction
    from market.models import Shop
    from premium.models import PremiumPayment
    with transaction.atomic():
        # qulflab qayta o'qiymiz: Telegram bot va admin panel bir vaqtda bossa ham faqat bir marta tasdiqlanadi
        payment = PremiumPayment.objects.select_for_update().select_related("user").get(pk=payment.pk)
        if payment.status != "pending":
            return False
        return _approve_locked(payment, by, Shop)


def _approve_locked(payment, by, Shop):
    user = payment.user
    now = timezone.now()
    start = user.premium_until if user.premium_until and user.premium_until > now else now
    user.premium_until = start + timedelta(days=30 * payment.months)
    user.save(update_fields=["premium_until"])
    payment.status, payment.reviewed_by, payment.reviewed_at = "approved", by, now
    payment.save(update_fields=["status", "reviewed_by", "reviewed_at"])
    shop, created = Shop.objects.get_or_create(owner=user, defaults={"name": f"{user.full_name} do'koni", "phone": user.phone})
    until = timezone.localtime(user.premium_until).strftime("%d.%m.%Y")
    notify(user, "Premium faollashtirildi! 🎉",
           f"To'lovingiz tasdiqlandi. Zapchast do'koningiz ochildi. Premium {until} gacha amal qiladi.", "premium", "/app/usta/shop")
    _user_tg(user, f"🎉 <b>Premium faollashtirildi!</b>\n\nTo'lov #{payment.id} tasdiqlandi. Zapchast do'koningiz ochildi.\nAmal qilish muddati: <b>{until}</b>")
    return True


def reject_payment(payment, by="admin", reason=""):
    from django.db import transaction
    from premium.models import PremiumPayment
    with transaction.atomic():
        payment = PremiumPayment.objects.select_for_update().select_related("user").get(pk=payment.pk)
        if payment.status != "pending":
            return False
        return _reject_locked(payment, by, reason)


def _reject_locked(payment, by, reason):
    payment.status, payment.reviewed_by, payment.reviewed_at = "rejected", by, timezone.now()
    payment.reject_reason = reason or "Pul kartaga tushmagan"
    payment.save(update_fields=["status", "reviewed_by", "reviewed_at", "reject_reason"])
    notify(payment.user, "Premium to'lov rad etildi", payment.reject_reason + ". Chekni tekshirib qayta yuboring.", "premium", "/app/usta/premium")
    _user_tg(payment.user, f"❌ To'lov #{payment.id} rad etildi.\nSabab: {payment.reject_reason}")
    return True


def premium_info():
    s = SiteSettings.load()
    return {"price": s.premium_price, "card_number": fmt_card(s.card_number), "card_raw": s.card_number,
            "card_holder": s.card_holder, "bot_username": premium_bot_username()}
