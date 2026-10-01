import { useEffect, useState } from "react";

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

/** Brauzer GPS. Rad etilsa Toshkent markazi qaytadi. */
export function useGeo(watch = false) {
  const [pos, setPos] = useState<{ lat: number; lng: number; real: boolean }>({ lat: TASHKENT[0], lng: TASHKENT[1], real: false });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) { setError("Brauzeringiz GPS ni qo'llab-quvvatlamaydi."); return; }
    const ok = (p: GeolocationPosition) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, real: true }); setError(null); };
    const fail = () => setError("Joylashuvga ruxsat berilmadi. Toshkent markazi ko'rsatilmoqda.");
    const opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 };
    if (watch) {
      const id = navigator.geolocation.watchPosition(ok, fail, opts);
      return () => navigator.geolocation.clearWatch(id);
    }
    navigator.geolocation.getCurrentPosition(ok, fail, opts);
  }, [watch]);
  return { ...pos, error };
}

export function usePoll(fn: () => void, ms: number, deps: any[] = []) {
  useEffect(() => {
    fn();
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
