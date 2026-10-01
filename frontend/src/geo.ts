/**
 * Aniq GPS joylashuvi.
 *
 * Muammo: getCurrentPosition() birinchi kelgan natijani qaytaradi — telefonda bu ko'pincha
 * Wi-Fi/minora bo'yicha taxminiy nuqta (aniqligi yuzlab metrdan bir necha km gacha) yoki
 * eski keshlangan nuqta. Shuning uchun xaritada «boshqa joy» ko'rinadi.
 *
 * Yechim: GPS bir necha soniya kuzatiladi, eng aniq natija olinadi; yetarlicha aniq
 * (≤ desired metr) natija kelishi bilan darhol qaytariladi. 5 soniyadan eski nuqtalar ishlatilmaydi.
 */
export type Fix = { lat: number; lng: number; accuracy: number; at: number };

export type GeoError = { code: number; message: string };

export function geoErrorText(e: GeoError | null | undefined) {
  if (!e) return "";
  if (e.code === 1) return "Joylashuvga ruxsat berilmagan. Brauzer/telefon sozlamalarida Avtora uchun joylashuvga ruxsat bering.";
  if (e.code === -1) return "Qurilmangiz joylashuvni aniqlay olmaydi.";
  return "GPS signal topilmadi. Ochiq joyga chiqing yoki telefonda «Joylashuv» (GPS) yoqilganini tekshiring.";
}

// Ilovadagi barcha GPS kuzatuvchilar (useGeo) oxirgi nuqtani shu yerga yozadi — «Mening joylashuvim» bosilganda
// GPS allaqachon ishlab turgan bo'lsa, javobni kutib o'tirmasdan darhol ishlatiladi.
let lastFix: Fix | null = null;
const FRESH_MS = 5000;
export function rememberFix(f: Fix) { if (!lastFix || f.at >= lastFix.at) lastFix = f; }

export function getPreciseLocation({ desired = 25, maxWait = 12000 }: { desired?: number; maxWait?: number } = {}): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject({ code: -1, message: "unsupported" }); return; }
    if (lastFix && Date.now() - lastFix.at < FRESH_MS && lastFix.accuracy <= desired) { resolve(lastFix); return; }
    let best: Fix | null = null;
    let done = false;
    const finish = (ok: boolean, err?: GeoError) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(id);
      clearTimeout(timer);
      if (ok && best) resolve(best);
      else reject(err || { code: 3, message: "timeout" });
    };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const f: Fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : 9999), at: Date.now() };
        rememberFix(f);
        if (!best || f.accuracy <= best.accuracy) best = f;
        if (best.accuracy <= desired) finish(true);
      },
      (e) => {
        // ruxsat yo'q — darhol; boshqa xatolarda vaqt tugaguncha kutamiz (GPS kech «uyg'onishi» mumkin)
        if (e.code === 1) finish(false, { code: e.code, message: e.message });
      },
      // 5 soniyadan eski bo'lmagan nuqta ham qabul qilinadi: GPS boshqa joyda (xarita) kuzatilayotgan bo'lsa,
      // brauzer yangi so'rovga keyingi o'zgarishgacha javob bermasligi mumkin
      { enableHighAccuracy: true, maximumAge: FRESH_MS, timeout: maxWait },
    );
    const timer = setTimeout(() => finish(!!best, { code: 3, message: "timeout" }), maxWait);
  });
}

/** Aniqlik matni: «±12 m» */
export const accText = (m?: number | null) => (m == null ? "" : m >= 1000 ? `±${(m / 1000).toFixed(1)} km` : `±${m} m`);
