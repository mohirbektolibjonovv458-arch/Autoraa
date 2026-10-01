"""SAFAR AI yordamchisi — qaror qabul qiluvchi mantiq.
Kiruvchi ma'lumot: haqiqiy marshrut, yo'l bo'yidagi haqiqiy shoxobchalar, foydalanuvchining joriy nuqtasi, safar vaqti,
avtomobil yoqilg'i turi va SAFAR sozlamalari. Chiqish: qisqa, kerakli paytdagina aytiladigan xabarlar.
Tamoyil: «Haydovchiga yordam ber, lekin uni chalg'itma» —
  • ma'lumot yo'q bo'lsa taxmin qilinmaydi;
  • har bir hodisa bir marta (dedup);
  • bir vaqtda bir nechta sabab bo'lsa — faqat eng muhimi ovozli aytiladi;
  • davriy xavfsizlik eslatmasi yaqinda boshqa xabar aytilgan bo'lsa o'tkazib yuboriladi."""
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import TripNotification

FUEL_UZ = {"metan": "metan", "propan": "propan", "benzin": "benzin", "dizel": "dizel", "elektr": "quvvatlash"}
FUEL_RU = {"metan": "метан", "propan": "пропан", "benzin": "бензин", "dizel": "дизель", "elektr": "зарядки"}
THRESHOLDS = [40, 10, 2, 1]
GAP_KM = 80  # bundan uzun bo'shliq — ogohlantirish


def km_txt(km, ru=False):
    if km < 1:
        return f"{int(round(km * 1000 / 50) * 50)} м" if ru else f"{int(round(km * 1000 / 50) * 50)} metr"
    v = int(round(km)) if km >= 3 else round(km, 1)
    return f"{v} км" if ru else f"{v} kilometr"


def T(ru, uz_text, ru_text):
    return ru_text if ru else uz_text


def ahead(trip, pos_km, fuel=None):
    out = [s for s in trip.stations if s["along_km"] > pos_km + 0.05 and (not fuel or fuel in s.get("fuels", []))]
    return sorted(out, key=lambda s: s["along_km"])


def start_messages(trip, st, ru=False):
    """Safar boshlanganda: keyingi mos shoxobcha va (bo'lsa) katta bo'shliq haqida."""
    msgs = []
    f = trip.fuel
    fname = FUEL_RU[f] if ru else FUEL_UZ[f]
    nxt = ahead(trip, 0, f)
    if not st.enabled:
        return msgs
    if nxt:
        d1 = nxt[0]["along_km"]
        text = T(ru, f"Safaringiz boshlandi. Keyingi {fname} shoxobchasi {km_txt(d1)}dan keyin.",
                 f"Поездка началась. Следующая заправка ({fname}) через {km_txt(d1, True)}.")
        # boshlanishda aytilgan masofa bosqichlari qayta aytilmasin (masalan, 32 km — «40 km» bosqichi allaqachon o'tgan)
        done = [f"fuel-{nxt[0]['id']}-{t}" for t in THRESHOLDS if d1 <= t]
        msgs.append(("start", text, 0, None, "start", done))
        gap = _gap_message(trip, 0, nxt, ru)
        if gap and st.fuel_alerts:
            msgs.append(gap)
    elif st.fuel_alerts:
        text = T(ru, f"Safaringiz boshlandi. Diqqat: yo'lingizda {fname} shoxobchasi topilmadi. Yo'lga chiqishdan oldin yoqilg'i to'ldiring.",
                 f"Поездка началась. Внимание: на маршруте нет заправок ({fname}). Заправьтесь перед выездом.")
        msgs.append(("gap", text, 0, None, "start-nofuel"))
    else:
        msgs.append(("start", T(ru, "Safaringiz boshlandi. Yo'lingiz bexatar bo'lsin.", "Поездка началась. Счастливого пути."), 0, None, "start"))
    return msgs


def _gap_message(trip, pos_km, nxt, ru):
    """Keyingi mos shoxobchadan keyin katta bo'shliq bo'lsa — shu yerda to'ldirishni maslahat berish."""
    if not nxt:
        return None
    f = trip.fuel
    fname = FUEL_RU[f] if ru else FUEL_UZ[f]
    d1 = nxt[0]["along_km"] - pos_km
    end_left = trip.distance_km - nxt[0]["along_km"]
    gap = (nxt[1]["along_km"] - nxt[0]["along_km"]) if len(nxt) > 1 else end_left
    if gap < GAP_KM or (len(nxt) == 1 and end_left < GAP_KM):
        return None
    if len(nxt) > 1:
        text = T(ru, f"Keyingi {fname} {km_txt(d1)}dan keyin. Undan keyingisi {km_txt(gap)} uzoqroq — shu yerda yoqilg'i olishni ko'rib chiqing.",
                 f"Следующий {fname} через {km_txt(d1, True)}. Потом {km_txt(gap, True)} без заправок — лучше заправиться там.")
    else:
        text = T(ru, f"Keyingi {fname} {km_txt(d1)}dan keyin. Undan keyin manzilgacha {fname} yo'q — shu yerda to'ldirib oling.",
                 f"Следующий {fname} через {km_txt(d1, True)}. Дальше до конца маршрута заправок нет — заправьтесь там.")
    return ("gap", text, pos_km, nxt[0]["id"], f"gap-{nxt[0]['id']}")


def progress_messages(trip, st, pos_km, elapsed_min, ru=False):
    """Har bir joylashuv yangilanishida: masofa bo'yicha va vaqt bo'yicha eslatmalar (dedup bilan)."""
    if not st.enabled:
        return []
    msgs = []
    f = trip.fuel
    fname = FUEL_RU[f] if ru else FUEL_UZ[f]
    remaining = max(0.0, trip.distance_km - pos_km)
    if remaining <= 1.0 and trip.distance_km > 2:
        msgs.append(("arrive", T(ru, "Manzilga yetib keldingiz. Safaringiz yakunlanmoqda.", "Вы прибыли. Поездка завершается."), pos_km, None, "arrive"))
        return msgs
    if st.fuel_alerts:
        nxt = ahead(trip, pos_km, f)
        if nxt:
            s = nxt[0]
            d = s["along_km"] - pos_km
            crossed = [t for t in THRESHOLDS if d <= t]
            if crossed:
                t = min(crossed)
                if t == 1:
                    text = T(ru, f"Oldinda {fname} shoxobchasi — «{s['name'][:40]}».", f"Впереди заправка ({fname}) — «{s['name'][:40]}».")
                elif t == 2:
                    text = T(ru, f"{km_txt(d)}dan keyin {fname} shoxobchasi bor.", f"Через {km_txt(d, True)} заправка ({fname}).")
                else:
                    text = T(ru, f"Keyingi {fname} shoxobchasi {km_txt(d)}dan keyin.", f"Следующая заправка ({fname}) через {km_txt(d, True)}.")
                # yuqoriroq bosqichlar ham «aytilgan» deb belgilanadi — takrorlanmasin
                msgs.append(("fuel", text, pos_km, s["id"], f"fuel-{s['id']}-{t}", [f"fuel-{s['id']}-{x}" for x in THRESHOLDS if x > t]))
                gap = _gap_message(trip, pos_km, nxt, ru)
                if gap and d <= 10:
                    msgs.append(gap)
    if st.safety_alerts:
        if elapsed_min >= 120:
            n = elapsed_min // 120
            msgs.append(("safety", T(ru, f"{n * 2} soatdan beri yo'ldasiz. Dam olish uchun to'xtashni ko'rib chiqing.",
                                     f"Вы в пути {n * 2} ч. Подумайте об остановке для отдыха."), pos_km, None, f"fatigue-{n}"))
        elif st.periodic and st.interval_min and elapsed_min >= st.interval_min:
            n = elapsed_min // st.interval_min
            mins = n * st.interval_min
            when = T(ru, f"{mins} daqiqadan" if mins < 60 else f"{mins // 60} soat {mins % 60} daqiqadan" if mins % 60 else f"{mins // 60} soatdan",
                     f"{mins} мин" if mins < 60 else f"{mins // 60} ч {mins % 60} мин" if mins % 60 else f"{mins // 60} ч")
            msgs.append(("safety", T(ru, f"{when} beri yo'ldasiz. Ehtiyotkorlik bilan davom eting.", f"Вы в пути {when}. Будьте внимательны."),
                         pos_km, None, f"periodic-{n}", None, True))
    return msgs


PRIORITY = {"arrive": 0, "gap": 1, "fuel": 2, "service": 3, "safety": 4, "start": 5}


def save_messages(trip, st, items, elapsed_min=None):
    """Xabarlarni saqlaydi (har biri bir marta). Qaytaradi: yangi xabarlar ro'yxati; ovozli aytiladigan — faqat bittasi (eng muhimi)."""
    created = []
    now = timezone.now()
    for it in items:
        kind, text, km, sid, key = it[:5]
        silent_keys = it[5] if len(it) > 5 and it[5] else []
        periodic = len(it) > 6 and it[6]
        if periodic:
            # davriy eslatma: oxirgi (interval/2) daqiqa ichida boshqa xabar aytilgan bo'lsa — kerak emas
            window = timedelta(minutes=max(5, (st.interval_min or 20) // 2))
            if trip.notifications.filter(created_at__gte=now - window).exclude(kind="safety").exists():
                continue
        try:
            with transaction.atomic():
                n = TripNotification.objects.create(trip=trip, kind=kind, message=text[:240], trigger_km=round(km, 1) if km is not None else None,
                                                    trigger_min=elapsed_min, station_id=sid, dedup_key=key[:80])
            created.append(n)
        except IntegrityError:
            continue
        for sk in silent_keys:
            try:
                with transaction.atomic():
                    TripNotification.objects.create(trip=trip, kind=kind, message="(o'tkazib yuborildi)", dedup_key=sk[:80], spoken=True)
            except IntegrityError:
                pass
    if not created:
        return []
    speak = min(created, key=lambda n: PRIORITY.get(n.kind, 9))
    if st.voice:
        TripNotification.objects.filter(pk=speak.pk).update(spoken=True)
        speak.spoken = True
    return [{"id": n.id, "kind": n.kind, "message": n.message, "speak": bool(st.voice and n.pk == speak.pk), "created_at": n.created_at} for n in created]
