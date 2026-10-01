import { useEffect, useState } from "react";
import { rememberFix } from "./geo";

export const money = (n?: number | null) =>
  n == null ? "—" : `${Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;

export const shortDate = (s?: string) => {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("ru-RU");
};

export const timeAgo = (s: string) => {
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (diff < 60) return "hozirgina";
  if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  return `${Math.floor(diff / 86400)} kun oldin`;
};

export const hhmm = (s: string) => new Date(s).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

export const formatPhone = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, 9);
  const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return "+998 " + p.join(" ");
};

export const TASHKENT: [number, number] = [41.3111, 69.2797];

export const SPECIALTIES: Record<string, string> = {
  motor: "Motor", elektrik: "Elektrik", hodovoy: "Hodovoy", diagnostika: "Diagnostika",
  tormoz: "Tormoz", konditsioner: "Konditsioner", kuzov: "Kuzov", shina: "Shina",
};

export const STATUS_TONE: Record<string, string> = {
  pending: "amber", new: "amber", searching: "amber",
  confirmed: "blue", accepted: "blue", in_progress: "blue", on_the_way: "blue", shipped: "blue", arrived: "blue",
  completed: "green", delivered: "green", approved: "green",
  cancelled: "red", rejected: "red",
};

/** Brauzer GPS. Rad etilsa (yoki hali aniqlanmagan bo'lsa) Toshkent markazi qaytadi — real=false.
 * Birinchi taxminiy (Wi-Fi/minora) nuqtada to'xtamaydi: GPS aniqlashguncha kuzatadi va eng aniq natijani oladi.
 * watch=false — aniq nuqta (≤25 m) topilgach yoki 25 soniyadan keyin kuzatish to'xtaydi; refresh() — qaytadan aniqlash. */
export function useGeo(watch = false) {
  const [pos, setPos] = useState<{ lat: number; lng: number; real: boolean; accuracy: number | null }>({ lat: TASHKENT[0], lng: TASHKENT[1], real: false, accuracy: null });
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!navigator.geolocation) { setError("Brauzeringiz GPS ni qo'llab-quvvatlamaydi."); setLocating(false); return; }
    setLocating(true);
    let cur: { accuracy: number; at: number; lat: number; lng: number } | null = null;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { navigator.geolocation.clearWatch(id); setLocating(false); };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const acc = Math.round(Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : 9999), now = Date.now();
        rememberFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: acc, at: now });
        const { latitude: lat, longitude: lng } = p.coords;
        const movedM = cur ? Math.hypot((lat - cur.lat) * 111320, (lng - cur.lng) * 111320 * Math.cos(lat * Math.PI / 180)) : Infinity;
        const better = !cur || acc < cur.accuracy * 0.7;              // aniqlik sezilarli oshdi
        const usable = !cur || acc <= cur.accuracy || acc <= 50 || now - cur.at > 15000;  // harakatlanayotganda yangi nuqta
        // 10 m dan kam siljish — sahifani (va server so'rovlarini) qayta yuklatmaymiz
        if (better || (usable && movedM >= 10)) {
          cur = { accuracy: acc, at: now, lat, lng };
          setPos({ lat, lng, real: true, accuracy: acc });
        }
        setError(null);
        if (!watch && acc <= 25) stop();
      },
      (e) => {
        if (e.code === 1) { setError("Joylashuvga ruxsat berilmadi. Toshkent markazi ko'rsatilmoqda — telefon sozlamalarida joylashuvga ruxsat bering."); stop(); }
        else if (!cur) setError("GPS signal topilmadi. Telefonda «Joylashuv» yoqilganini tekshiring yoki xaritadan joyingizni belgilang.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    if (!watch) stopTimer = setTimeout(stop, 25000);
    return () => { clearTimeout(stopTimer); navigator.geolocation.clearWatch(id); };
  }, [watch, run]);
  const refresh = () => { setError(null); setRun((r) => r + 1); };
  /** tashqaridan olingan aniq nuqta («Mening joylashuvim» tugmasi) */
  const set = (lat: number, lng: number, accuracy: number) => { setPos({ lat, lng, real: true, accuracy }); setError(null); };
  return { ...pos, error, locating, refresh, set };
}

export function usePoll(fn: () => void, ms: number, deps: any[] = []) {
  useEffect(() => {
    fn();
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
