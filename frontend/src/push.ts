/**
 * Web Push: ruxsat so'rash, qurilmani obuna qilish, serverga yozish, logout'da bekor qilish.
 * Maxfiy VAPID kalit faqat serverda — bu yerga faqat ochiq kalit /api/push/key orqali keladi.
 */
import { api } from "./api";
import { isIOS, isStandalone } from "./pwa";

export type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on" | "server-off" | "service-error";

function sameKey(sub: PushSubscription, key: Uint8Array) {
  const k = sub.options?.applicationServerKey;
  if (!k) return true;  // brauzer kalitni ko'rsatmasa — tekshirib bo'lmaydi, mavjud obunani saqlaymiz
  const a = new Uint8Array(k as ArrayBuffer);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

const b64ToBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration() {
  if (!pushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration()) || null;
}

export async function pushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return "ios-install"; // iPhone'da push faqat bosh ekranga o'rnatilgan ilovada
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

// service worker obunani o'zi yangilaganda (pushsubscriptionchange) eski manzilni shu yerdan oladi — sw.template.js
const META = "avtora-meta";
const PUSH_EP_KEY = "/__avtora/push-endpoint";

async function rememberEndpoint(endpoint: string | null) {
  try {
    const c = await caches.open(META);
    if (endpoint) await c.put(PUSH_EP_KEY, new Response(endpoint));
    else await c.delete(PUSH_EP_KEY);
  } catch { /* */ }
}

async function sendToServer(sub: PushSubscription) {
  const j = sub.toJSON();
  await api.post("/push/subscribe/", { endpoint: j.endpoint, keys: j.keys });
  await rememberEndpoint(j.endpoint || null);
}

/** Foydalanuvchi «Yoqish» bosganda. Ruxsat so'raladi faqat shu yerda (sahifa ochilishida emas). */
export async function enablePush(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return "ios-install";
  if (!pushSupported()) return "unsupported";
  const key = await api.get("/push/key/");
  if (!key.data.enabled) return "server-off";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = (await registration()) || (await navigator.serviceWorker.ready);
  const appKey = b64ToBytes(key.data.public_key);
  let sub = await reg.pushManager.getSubscription();
  // eski obuna boshqa kalit bilan qilingan bo'lsa (server kaliti almashgan) — yangisiga o'tamiz, aks holda xabar kelmaydi
  if (sub && !sameKey(sub, appKey)) { await sub.unsubscribe().catch(() => {}); sub = null; }
  if (!sub) {
    try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey }); }
    catch (e: any) {
      if (e?.name === "InvalidStateError") {      // eski obuna qolib ketgan — tozalab qayta urinamiz
        await (await reg.pushManager.getSubscription())?.unsubscribe().catch(() => {});
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      } else if (e?.name === "NotAllowedError") return "denied";
      else if (e?.name === "AbortError" || e?.name === "NotSupportedError") return "service-error";
      else throw e;
    }
  }
  await sendToServer(sub);
  return "on";
}

/** Ilova har ochilganda: ruxsat bor bo'lsa obunani serverga qayta yozamiz (brauzer obunani yangilagan bo'lishi mumkin). */
export async function syncPush() {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    const reg = await registration();
    if (!reg) return;
    const key = await api.get("/push/key/");
    if (!key.data.enabled) return;
    const appKey = b64ToBytes(key.data.public_key);
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub, appKey)) { await sub.unsubscribe().catch(() => {}); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    await sendToServer(sub);
  } catch { /* push ixtiyoriy — ilova ishlashda davom etadi */ }
}

/** Logout / «o'chirish»: bu qurilmaga boshqa xabar kelmasin. */
export async function disablePush() {
  try {
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.post("/push/unsubscribe/", { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
    await rememberEndpoint(null);
    (navigator as any).clearAppBadge?.();
  } catch { /* */ }
}
