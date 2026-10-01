/**
 * PWA yordamchilari: o'rnatish taklifi (beforeinstallprompt), platformani aniqlash, o'rnatilganlik holati.
 * Bu modul main.tsx'da ENG BIRINCHI import qilinadi — Chrome hodisani ilova yuklanmasdan oldin ham yuborishi mumkin.
 */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: BIPEvent | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

const K_INSTALLED = "ah_pwa_installed";
const K_DISMISSED = "ah_install_dismissed_at";
const DISMISS_DAYS = 30;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // brauzerning o'z mini-bannerini o'rniga o'zimizning banner
    deferred = e as BIPEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    try { localStorage.setItem(K_INSTALLED, "1"); } catch { /* */ }
    emit();
  });
}

export const onPwaChange = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const canPrompt = () => !!deferred;

export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.matchMedia?.("(display-mode: fullscreen)").matches || (navigator as any).standalone === true;
}
export const markedInstalled = () => { try { return localStorage.getItem(K_INSTALLED) === "1"; } catch { return false; } };
/** Ilova o'chirib tashlangan bo'lsa, brauzer yana o'rnatishni taklif qiladi — belgini tozalaymiz */
if (typeof window !== "undefined") window.addEventListener("beforeinstallprompt", () => { try { localStorage.removeItem(K_INSTALLED); } catch { /* */ } });

const ua = () => navigator.userAgent || "";
export const isIOS = () => /iphone|ipad|ipod/i.test(ua()) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isAndroid = () => /android/i.test(ua());
export const isMobile = () => isIOS() || isAndroid() || /mobile/i.test(ua()) ||
  (typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 900px) and (pointer: coarse)").matches);
/** Ekran telefon o'lchamidami (brauzerning «responsive» rejimida ham) */
export const isNarrow = () => typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 900px)").matches;
/** Telegram, Instagram, Facebook kabi ilovalar ichidagi brauzer — ulardan o'rnatib bo'lmaydi */
export const inAppBrowser = () => /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|; wv\)|Telegram/i.test(ua());
export const iosBrowser = (): "safari" | "chrome" | "firefox" | "edge" | "other" => {
  const u = ua();
  if (/CriOS/i.test(u)) return "chrome";
  if (/FxiOS/i.test(u)) return "firefox";
  if (/EdgiOS/i.test(u)) return "edge";
  if (/Safari/i.test(u) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(u)) return "safari";
  return "other";
};
export const androidBrowser = (): "chrome" | "samsung" | "firefox" | "opera" | "other" => {
  const u = ua();
  if (/SamsungBrowser/i.test(u)) return "samsung";
  if (/Firefox/i.test(u)) return "firefox";
  if (/OPR\//i.test(u)) return "opera";
  if (/Chrome/i.test(u)) return "chrome";
  return "other";
};

export function dismissedRecently() {
  try {
    const t = Number(localStorage.getItem(K_DISMISSED) || 0);
    return t > 0 && Date.now() - t < DISMISS_DAYS * 864e5;
  } catch { return false; }
}
export function dismissInstall() { try { localStorage.setItem(K_DISMISSED, String(Date.now())); } catch { /* */ } }

/** Haqiqiy brauzer o'rnatish oynasini ochadi */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const e = deferred;
  deferred = null; // bitta hodisa faqat bir marta ishlatiladi
  await e.prompt();
  const { outcome } = await e.userChoice;
  // «accepted» — foydalanuvchi rozi bo'ldi, lekin o'rnatish hali tugamagan: haqiqiy yakun — «appinstalled» hodisasi
  emit();
  return outcome;
}

/** Yangi versiya tayyor bo'lganda — «Yangilash» banneri uchun */
let waitingWorker: ServiceWorker | null = null;
const updSubs = new Set<() => void>();
export const onUpdate = (f: () => void) => { updSubs.add(f); return () => { updSubs.delete(f); }; };
export const updateReady = () => !!waitingWorker;
export function applyUpdate() {
  if (!waitingWorker) return;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; window.location.reload(); } });
  waitingWorker.postMessage("SKIP_WAITING");
}

/** Service worker ro'yxatdan o'tkazish (faqat production build'da) */
export function registerServiceWorker() {
  if (import.meta.env.DEV) {
    console.info("[Avtora] Dev rejim (npm run dev): service worker o'chiq, ilovani o'rnatib bo'lmaydi. Sinash uchun: python manage.py start → http://localhost:8000");
    return;
  }
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((reg) => {
      const markWaiting = (w: ServiceWorker | null) => {
        if (w && navigator.serviceWorker.controller) { waitingWorker = w; updSubs.forEach((f) => f()); }
      };
      markWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw?.addEventListener("statechange", () => { if (nw.state === "installed") markWaiting(nw); });
      });
      // yangi versiyani vaqti-vaqti bilan tekshirish (ilova uzoq ochiq tursa ham)
      const check = () => reg.update().catch(() => {});
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    }).catch((err) => console.warn("Service worker ro'yxatdan o'tmadi:", err));
  });
}

/** Brauzer ilova allaqachon o'rnatilganini aytsa (Chrome: getInstalledRelatedApps) — «O'rnatish» ko'rsatilmaydi. */
export async function detectInstalled() {
  try {
    const apps = await (navigator as any).getInstalledRelatedApps?.();
    if (apps && apps.length) { localStorage.setItem(K_INSTALLED, "1"); emit(); return true; }
  } catch { /* */ }
  return false;
}
