/* Avtora service worker — build vaqtida avtomatik yaratiladi (vite.config.ts → avtoraServiceWorker).
 *
 * Strategiya:
 *  - Sahifalar (navigatsiya): har doim TARMOQDAN. Internet bo'lmasa — /offline.html.
 *    index.html keshlanmaydi, shuning uchun foydalanuvchi hech qachon eski versiyada qolib ketmaydi.
 *  - /assets/* (nomida hash bor, o'zgarmaydi): kesh → tarmoq. Tez ochilish.
 *  - Ikonkalar, manifest, shriftlar: kesh + fonda yangilash.
 *  - /api/*, /media/*, xarita plitalari va boshqa domenlar: HECH QACHON keshlanmaydi —
 *    eskirgan ma'lumot (buyurtma, SOS, narx, chat) ko'rsatilmaydi.
 */
const VERSION = "8fa976589e4f";
const PRECACHE = `avtora-precache-${VERSION}`;
const RUNTIME = `avtora-runtime-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const META = "avtora-meta";            // versiyadan mustaqil: push obuna manzili (pushsubscriptionchange uchun)
const PUSH_EP_KEY = "/__avtora/push-endpoint";
const PRECACHE_URLS = [
  "/index.html",
  "/offline.html",
  "/offline.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/favicon.ico",
  "/brand/avtora-logo.png",
  "/brand/mark-light.png",
  "/brand/mark-dark.png",
  "/assets/AdminLogin-CiNtgvMn.js",
  "/assets/AdminShell-ldG76Oh1.js",
  "/assets/Analytics-oPokZL0i.js",
  "/assets/Blog-C5U4m2kz.js",
  "/assets/Blog-DH8SPHL2.js",
  "/assets/Cars-B3mj0JUP.js",
  "/assets/Chats-Dc2vE1gh.js",
  "/assets/Dashboard-Cjbns_FQ.js",
  "/assets/EvakHome-6QEtsP3x.js",
  "/assets/Favorites-BlOFZcD7.js",
  "/assets/Fuel-BKtpJfZz.js",
  "/assets/FuelPage-mSfgQcLK.js",
  "/assets/FuelPublic-BpmCLQEl.js",
  "/assets/ImagePicker-8OOFNZNZ.js",
  "/assets/LiveMap-BudWtbuc.js",
  "/assets/MapPage-CXFcjU_V.js",
  "/assets/MasterDetail-5WEvMCxy.js",
  "/assets/Masters-DCfBaPMb.js",
  "/assets/Masters-DPr9fM0t.js",
  "/assets/MastersTabs-BoX57zAg.js",
  "/assets/Notifications-DTlWHnbE.js",
  "/assets/Orders-BivVbuGh.js",
  "/assets/Orders-aw31JKSr.js",
  "/assets/Parts-CXAze4id.js",
  "/assets/Payments-B39xpPCj.js",
  "/assets/ProductDetail-2uyBGyiB.js",
  "/assets/Profile-FhwqypT3.js",
  "/assets/ProviderJobs-0Zt4LUDI.js",
  "/assets/Register-CIGY_XEu.js",
  "/assets/RescheduleModal-BOLNOg-n.js",
  "/assets/Safar-B31OxqLs.js",
  "/assets/Search-Bzftyamu.js",
  "/assets/Settings-cgfcymsc.js",
  "/assets/ShopPage-DmXoLr13.js",
  "/assets/Shops-BhEL3K9u.js",
  "/assets/SlotPicker-Bs9feyz9.js",
  "/assets/Sos-u8T5sBfa.js",
  "/assets/Terms-B5tvsIr5.js",
  "/assets/Users-C6OAPwIR.js",
  "/assets/UstaHome-ej7tIJzH.js",
  "/assets/UstaOrders-ClNaveQM.js",
  "/assets/UstaPremium-BRC_R6Uq.js",
  "/assets/UstaServices-DCMY6WJz.js",
  "/assets/UstaShop-DawuWEqr.js",
  "/assets/UstaSos-7jssntyf.js",
  "/assets/arrow-left-4Xd-MCLZ.js",
  "/assets/camera-CjuS0q9u.js",
  "/assets/cart-DN9FWBRq.js",
  "/assets/circle-check-o3gT30ex.js",
  "/assets/circle-dot-e01GhsQo.js",
  "/assets/credit-card-YPokUpub.js",
  "/assets/generateCategoricalChart-BweKulxt.js",
  "/assets/heart-fkGTayR2.js",
  "/assets/image-plus-6rP_YqVj.js",
  "/assets/index-DaM0pzsd.js",
  "/assets/index-Kv5kjx2x.css",
  "/assets/pencil-C0yw-NVp.js",
  "/assets/share-2-CEyGTAQ9.js",
  "/assets/shield-check-CvzOU70D.js",
  "/assets/trash-2-Da_bbVTJ.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then((c) => c.addAll(PRECACHE_URLS.map((u) => new Request(u, { cache: "reload" }))))
      // yangi versiya o'zi faollashmaydi — foydalanuvchi «Yangilash»ni bosadi (ochiq sahifa buzilmasin).
      // Birinchi o'rnatishda eski worker yo'q, shuning uchun darhol ishga tushadi.
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PRECACHE, RUNTIME, META]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

const NEVER_CACHE = [/^\/api\//, /^\/media\//, /^\/django-admin/, /^\/sw\.js$/];
const SWR = [/^\/icons\//, /^\/brand\//, /^\/manifest\.webmanifest$/, /^\/favicon/, /^\/apple-touch-icon/, /^\/splash\//, /^\/screenshots\//];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts — o'zgarmaydigan resurslar, kesh + fonda yangilash
  if (url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (url.origin !== self.location.origin) return; // xarita plitalari va boshqa domenlar — brauzerning o'zi
  if (NEVER_CACHE.some((r) => r.test(url.pathname))) return;

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        return await fetch(req);
      } catch (e) {
        // internet yo'q: ilova qobig'i (o'sha versiyadagi index.html) ochiladi, sahifalar «Internet yo'q» holatini ko'rsatadi.
        // API javoblari hech qachon keshlanmagani uchun eski ma'lumot «hozirgi» deb ko'rsatilmaydi.
        const cached = (await caches.match("/index.html")) || (await caches.match(OFFLINE_URL));
        return cached || new Response("Internet aloqasi yo'q", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (SWR.some((r) => r.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(RUNTIME)).put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => {
    if (res.ok || res.type === "opaque") cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || net;
}

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});


/* ================= Web Push: ilova yopiq bo'lsa ham bildirishnoma ================= */
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: "Avtora", body: event.data ? event.data.text() : "" }; }
  const title = d.title || "Avtora";
  const options = {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: d.tag || undefined,          // bir xil hodisa qurilmada takrorlanmaydi, yangisi bilan almashtiriladi
    renotify: !!d.urgent,
    requireInteraction: !!d.urgent,   // SOS — foydalanuvchi ko'rmaguncha yopilmaydi
    vibrate: d.urgent ? [200, 100, 200, 100, 300] : [120],
    timestamp: Date.now(),
    data: { url: d.url || "/app/notifications", id: d.id },
  };
  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    if (typeof d.unread === "number" && self.navigator.setAppBadge) {
      try { d.unread > 0 ? await self.navigator.setAppBadge(d.unread) : await self.navigator.clearAppBadge(); } catch (e) { /* */ }
    }
    // ochiq oynalar darhol yangilansin (hisoblagich, ro'yxat)
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    wins.forEach((w) => w.postMessage({ type: "avtora-push", payload: d }));
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/app/notifications";
  const url = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app/notifications"; // faqat o'z saytimiz ichida
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        w.postMessage({ type: "avtora-navigate", url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});

/* Brauzer push obunasini o'zi yangilasa (muddati tugashi, kalit almashishi) — ilova ochilmasa ham
 * yangi obuna serverga yoziladi. Aks holda usta keyingi safar ilovani ochguncha bron xabarlarini olmay qoladi. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      const meta = await caches.open(META);
      const saved = await meta.match(PUSH_EP_KEY);
      const old = (event.oldSubscription && event.oldSubscription.endpoint) || (saved ? await saved.text() : "");
      if (!old) return;
      let sub = event.newSubscription;
      if (!sub) {
        const k = await (await fetch("/api/push/key/", { credentials: "omit" })).json();
        if (!k.enabled || !k.public_key) return;
        const pad = "=".repeat((4 - (k.public_key.length % 4)) % 4);
        const raw = atob((k.public_key + pad).replace(/-/g, "+").replace(/_/g, "/"));
        const appKey = Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
        sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      }
      const j = sub.toJSON();
      const res = await fetch("/api/push/resubscribe/", {
        method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_endpoint: old, endpoint: j.endpoint, keys: j.keys }),
      });
      if (res.ok) await meta.put(PUSH_EP_KEY, new Response(j.endpoint));
    } catch (e) { /* keyingi safar ilova ochilganda syncPush() tuzatadi */ }
  })());
});
