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
const VERSION = "46a298c906a8";
const PRECACHE = `avtora-precache-${VERSION}`;
const RUNTIME = `avtora-runtime-${VERSION}`;
const OFFLINE_URL = "/offline.html";
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
  "/assets/AdminLogin-Dlr587jA.js",
  "/assets/AdminShell-gVgO_k0y.js",
  "/assets/Analytics-BhB8-B75.js",
  "/assets/Blog-CgwWBXtU.js",
  "/assets/Blog-DCF9xkTM.js",
  "/assets/Cars-Cmcuu6dz.js",
  "/assets/Chats-SZR9ekjS.js",
  "/assets/Dashboard-3GfyN3Ri.js",
  "/assets/EvakHome-CxbTWBEb.js",
  "/assets/Favorites-DA9k2Bvk.js",
  "/assets/Fuel-DrazACDu.js",
  "/assets/FuelPage-DzPZIfDZ.js",
  "/assets/FuelPublic-CbVTNeH4.js",
  "/assets/ImagePicker-Bt3k1uU3.js",
  "/assets/LiveMap--8Yy3jau.js",
  "/assets/MapPage-CdlMntBZ.js",
  "/assets/MasterDetail-DKLl2gIh.js",
  "/assets/Masters-Bg3h6MpU.js",
  "/assets/Masters-CwrQCayA.js",
  "/assets/MastersTabs-BeT7_0lD.js",
  "/assets/Notifications-DHCP59H_.js",
  "/assets/Orders-D1OUnovy.js",
  "/assets/Orders-pTjXMd9b.js",
  "/assets/Parts-BxVYwvte.js",
  "/assets/Payments-CmtjyNI9.js",
  "/assets/ProductDetail-BbYgzd8q.js",
  "/assets/Profile-Z9pdFjal.js",
  "/assets/ProviderJobs-CPmKku8G.js",
  "/assets/Register-DzqyJv3F.js",
  "/assets/RescheduleModal-Dj4ucnzm.js",
  "/assets/Safar-ChNpslNN.js",
  "/assets/Search-CfAzmyMP.js",
  "/assets/Settings-DAkwMR0u.js",
  "/assets/ShopPage-Bc_1zqiX.js",
  "/assets/Shops-BLlV8rnX.js",
  "/assets/SlotPicker-Bo8rVy3D.js",
  "/assets/Sos-bNl8wn7W.js",
  "/assets/Terms-BCMjqzBv.js",
  "/assets/Users-BgWUW7Ux.js",
  "/assets/UstaHome-DxNBbjfs.js",
  "/assets/UstaOrders-C_fMsHXO.js",
  "/assets/UstaPremium-xkSZW0-p.js",
  "/assets/UstaServices-DWE-Ha4j.js",
  "/assets/UstaShop-Dlu6sPNB.js",
  "/assets/UstaSos-CqvPGBOs.js",
  "/assets/arrow-left-BCDWrPtL.js",
  "/assets/camera-CwaSqwBn.js",
  "/assets/cart-Bk0mM-cK.js",
  "/assets/circle-check-CV_vq1pR.js",
  "/assets/circle-dot-CFM2F4o-.js",
  "/assets/credit-card-BWzNYMRu.js",
  "/assets/generateCategoricalChart-BcLWuYnR.js",
  "/assets/heart-BYlFw7O4.js",
  "/assets/image-plus-CxKz6jd6.js",
  "/assets/index-CVDE4jcK.css",
  "/assets/index-DyQBaxpA.js",
  "/assets/pencil-r2drHSSc.js",
  "/assets/share-2-CtEhb-Ye.js",
  "/assets/shield-check-BO1J7o0V.js",
  "/assets/trash-2-C0S2zSPp.js"
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
    const keep = new Set([PRECACHE, RUNTIME]);
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
