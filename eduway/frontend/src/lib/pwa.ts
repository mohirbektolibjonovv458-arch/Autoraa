// Ilovani telefonga o'rnatish (PWA) va push-bildirishnomalar.
import { useEffect, useState } from "react";
import { get, post } from "./api";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // brauzerning o'z oynasi o'rniga o'zimizning tugmamizni ko'rsatamiz
    deferred = e as BIPEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => { deferred = null; emit(); });
}

export function registerSW() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

export const platform = () => {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return {
    ios,
    android: /Android/i.test(ua),
    iosSafari: ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|YaBrowser/i.test(ua),
    // Telegram, Instagram, Facebook ichidagi brauzerlar ilova o'rnatishga ruxsat bermaydi
    inApp: /Telegram|Instagram|FBAN|FBAV|Line\/|; wv\)|TikTok/i.test(ua),
    standalone: window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true,
  };
};

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  const p = platform();
  return {
    installed: p.standalone,
    canPrompt: !!deferred,
    platform: p,
    async prompt() {
      if (!deferred) return "unavailable" as const;
      await deferred.prompt();
      const r = await deferred.userChoice;
      deferred = null;
      emit();
      return r.outcome;
    },
  };
}

// --- Push ---

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupport() {
  const p = platform();
  const api = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // iPhone/iPad: push faqat Bosh ekranga o'rnatilgan ilovada ishlaydi (iOS 16.4+)
  if (p.ios && !p.standalone) return { ok: false, reason: "ios-install" as const };
  if (!api) return { ok: false, reason: "unsupported" as const };
  if (Notification.permission === "denied") return { ok: false, reason: "denied" as const };
  return { ok: true, reason: null };
}

export async function currentSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(): Promise<"ok" | "denied" | "unsupported" | "ios-install" | "error"> {
  const s = pushSupport();
  if (!s.ok) return s.reason!;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "denied";
    const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const { public_key } = await get("/push/key/");
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(public_key) });
    await post("/push/subscribe/", { subscription: sub.toJSON() });
    try { localStorage.setItem("eduway-push", "1"); } catch { /* ignore */ }
    return "ok";
  } catch {
    return "error";
  }
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    await post("/push/unsubscribe/", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  try { localStorage.removeItem("eduway-push"); } catch { /* ignore */ }
}

/** Ilova ochilganda: ruxsat berilgan bo'lsa obunani serverda yangilab qo'yadi (token almashgan bo'lishi mumkin). */
export async function syncPush() {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const sub = await currentSubscription();
    if (sub) await post("/push/subscribe/", { subscription: sub.toJSON() });
  } catch { /* ignore */ }
}
