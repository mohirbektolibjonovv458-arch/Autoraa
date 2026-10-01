import { Suspense } from "react";
import { getPreciseLocation } from "../geo";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, Car, ClipboardList, Crown, Fuel, Home, LogOut, Map, MessageCircle, Package, Siren, Store, Truck,
  User as UserIcon, Users, Wrench, LayoutDashboard, Search,
} from "lucide-react";
import { api, errMsg } from "../api";
import { homeFor, useAuth, ROLE_LABEL } from "../auth";
import { Avatar, Logo, useToast } from "./ui";
import { Spinner } from "./ui";
import InstallButton from "./InstallButton";
import EnablePush from "./EnablePush";
import { ThemeToggle } from "./ThemeToggle";
import { syncPush } from "../push";

type Item = { to: string; label: string; icon: any; end?: boolean; badge?: "notif" | "chat" };

const NAV: Record<string, { side: Item[]; bottom: Item[] }> = {
  user: {
    side: [
      { to: "/app", label: "Bosh sahifa", icon: Home, end: true },
      { to: "/app/fuel", label: "Yoqilg'i xaritasi", icon: Fuel },
      { to: "/app/masters", label: "Usta topish", icon: Users },
      { to: "/app/sos", label: "SOS / Evakuator", icon: Siren },
      { to: "/app/parts", label: "Ehtiyot qismlar", icon: Package },
      { to: "/app/cars", label: "Mening avtomobilim", icon: Car },
      { to: "/app/orders", label: "Buyurtmalarim", icon: ClipboardList },
      { to: "/app/chat", label: "Xabarlar", icon: MessageCircle, badge: "chat" },
      { to: "/app/profile", label: "Profil", icon: UserIcon },
    ],
    bottom: [
      { to: "/app", label: "Asosiy", icon: Home, end: true },
      { to: "/app/fuel", label: "Yoqilg'i", icon: Fuel },
      { to: "/app/sos", label: "SOS", icon: Siren },
      { to: "/app/masters", label: "Ustalar", icon: Users },
      { to: "/app/profile", label: "Profil", icon: UserIcon },
    ],
  },
  usta: {
    side: [
      { to: "/app/usta", label: "Bosh sahifa", icon: LayoutDashboard, end: true },
      { to: "/app/usta/orders", label: "Buyurtmalar", icon: ClipboardList },
      { to: "/app/usta/services", label: "Xizmatlar va narxlar", icon: Wrench },
      { to: "/app/usta/shop", label: "Zapchast do'koni", icon: Store },
      { to: "/app/usta/premium", label: "Premium", icon: Crown },
      { to: "/app/usta/sos", label: "Tezkor so'rovlar", icon: Siren },
      { to: "/app/fuel", label: "Yoqilg'i xaritasi", icon: Fuel },
      { to: "/app/chat", label: "Mijozlar bilan chat", icon: MessageCircle, badge: "chat" },
      { to: "/app/profile", label: "Profil", icon: UserIcon },
    ],
    bottom: [
      { to: "/app/usta", label: "Asosiy", icon: Home, end: true },
      { to: "/app/usta/orders", label: "Buyurtmalar", icon: ClipboardList },
      { to: "/app/usta/shop", label: "Do'kon", icon: Store },
      { to: "/app/chat", label: "Chat", icon: MessageCircle, badge: "chat" },
      { to: "/app/profile", label: "Profil", icon: UserIcon },
    ],
  },
  evakuator: {
    side: [
      { to: "/app/evak", label: "Buyurtmalar", icon: Truck, end: true },
      { to: "/app/map", label: "Xarita", icon: Map },
      { to: "/app/fuel", label: "Yoqilg'i xaritasi", icon: Fuel },
      { to: "/app/chat", label: "Chat", icon: MessageCircle, badge: "chat" },
      { to: "/app/profile", label: "Profil", icon: UserIcon },
    ],
    bottom: [
      { to: "/app/evak", label: "Asosiy", icon: Home, end: true },
      { to: "/app/map", label: "Xarita", icon: Map },
      { to: "/app/chat", label: "Chat", icon: MessageCircle, badge: "chat" },
      { to: "/app/notifications", label: "Xabarnoma", icon: Bell, badge: "notif" },
      { to: "/app/profile", label: "Profil", icon: UserIcon },
    ],
  },
};

/** Qisqa signal (ilova ochiq turganda yangi bron/SOS kelsa). Brauzer ruxsat bermasa — jim o'tib ketadi. */
function chime() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    ctx.resume?.().catch?.(() => {});
    [0, 0.18].forEach((at, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = i ? 1175 : 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 0.17);
    });
    setTimeout(() => ctx.close?.().catch?.(() => {}), 800);
  } catch { /* */ }
}

/** SOS signali: yordamchi «Ko'rish» yoki «Yopish» bosmaguncha (ko'pi bilan 1 daqiqa) qo'ng'iroqdek takrorlanadi. */
function SosAlarm() {
  const go = useNavigate();
  const [item, setItem] = useState<any>(null);
  useEffect(() => {
    const on = (e: Event) => setItem((e as CustomEvent).detail);
    window.addEventListener("avtora-sos-alarm", on);
    return () => window.removeEventListener("avtora-sos-alarm", on);
  }, []);
  useEffect(() => {
    if (!item) return;
    let n = 0;
    const ring = () => { chime(); setTimeout(chime, 380); (navigator as any).vibrate?.([600, 250, 600]); };
    ring();
    const id = setInterval(() => { if (++n >= 40) { clearInterval(id); return; } ring(); }, 1500);
    return () => { clearInterval(id); (navigator as any).vibrate?.(0); };
  }, [item?.id]);
  if (!item) return null;
  const close = () => setItem(null);
  return (
    <div className="modal-back sos-alarm" role="alertdialog" aria-label="SOS">
      <div className="modal col gap-12" style={{ textAlign: "center" }}>
        <div className="sos-big pulse" style={{ margin: "0 auto" }}>SOS</div>
        <h3>{item.title}</h3>
        {item.body && <p className="small">{item.body}</p>}
        <button className="btn btn-red btn-lg btn-block" onClick={() => { const l = item.link; close(); if (l) go(l); }}>Ko'rish va qabul qilish</button>
        <button className="btn btn-ghost btn-block" onClick={close}>Yopish</button>
      </div>
    </div>
  );
}

export function useCounts() {
  const [c, setC] = useState({ notif: 0, chat: 0 });
  const toast = useToast();
  const lastId = useRef<number | null>(null);
  useEffect(() => {
    const load = () =>
      Promise.all([api.get("/notifications/?unread=1"), api.get("/chat/unread/")])
        .then(([n, ch]) => {
          setC({ notif: n.data.unread, chat: ch.data.unread });
          // ilova ochiq turganda yangi bron / SOS — ekranda xabar + ovoz (push yoqilmagan bo'lsa ham o'tkazib yuborilmaydi)
          const items: any[] = n.data.results || [];
          const maxId = items.reduce((m, x) => Math.max(m, x.id || 0), lastId.current || 0);
          if (lastId.current !== null) {
            const here = window.location.pathname;
            const fresh = items.filter((x) => x.id > (lastId.current as number)
              && (x.kind === "order" || x.kind === "sos" || (x.kind === "chat" && x.link !== here)));  // ochiq suhbat haqida emas
            const sos = fresh.find((x) => x.kind === "sos" && x.title.startsWith("🆘"));
            if (sos) {
              // SOS — qo'ng'iroqdek takrorlanadigan signal va katta oyna (yordamchi ko'rmaguncha)
              window.dispatchEvent(new CustomEvent("avtora-sos-alarm", { detail: sos }));
            } else if (fresh.length) {
              toast(`🔔 ${fresh[0].title}${fresh[0].body ? " — " + fresh[0].body.split("\n")[0] : ""}`, "success");
              // push ruxsati bo'lmasa tizim bildirishnomasi chiqmaydi — o'zimiz signal beramiz (ikki marta ovoz chiqmasin)
              const systemShown = "Notification" in window && Notification.permission === "granted";
              if (!systemShown) { chime(); (navigator as any).vibrate?.([200, 100, 200]); }
            }
            if (fresh.length) window.dispatchEvent(new Event("avtora-push"));
          }
          lastId.current = maxId;
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 15000);
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "avtora-push") { load(); window.dispatchEvent(new Event("avtora-push")); } };
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      navigator.serviceWorker?.removeEventListener("message", onMsg);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  useEffect(() => {
    const nav: any = navigator;
    if (nav.setAppBadge) { (c.notif > 0 ? nav.setAppBadge(c.notif) : nav.clearAppBadge?.())?.catch?.(() => {}); }
  }, [c.notif]);
  return c;
}

/** Usta/evakuator online bo'lsa GPS joylashuvini serverga yuborib turadi */
function LocationSync() {
  const { user } = useAuth();
  const last = useRef(0);
  useEffect(() => {
    if (!user || user.role === "user" || !user.is_online || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if ((p.coords.accuracy || 0) > 1000) return;  // minora bo'yicha taxminiy nuqta — mijozlarga noto'g'ri masofa ko'rsatmaylik
        if (Date.now() - last.current < 15000) return;
        last.current = Date.now();
        api.post("/auth/location/", { lat: p.coords.latitude, lng: p.coords.longitude }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [user?.id, user?.is_online]);
  return null;
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const counts = useCounts();
  const loc = useLocation();
  const nav = NAV[user?.role || "user"] || NAV.user;
  const current = nav.side.find((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to)));

  const badge = (b?: string) => (b === "notif" ? counts.notif : b === "chat" ? counts.chat : 0);
  const go = useNavigate();
  useEffect(() => {
    syncPush();  // qurilma obunasi serverda dolzarb bo'lsin
    const onMsg = (e: MessageEvent) => {
      const url = e.data?.type === "avtora-navigate" ? String(e.data.url || "") : "";
      if (url.startsWith("/") && !url.startsWith("//")) go(url);  // bildirishnoma bosilganda kerakli sahifa
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, []);

  return (
    <div className="shell">
      <LocationSync />
      {(user?.role === "usta" || user?.role === "evakuator") && <SosAlarm />}
      <aside className="side">
        <Link to="/" className="logo-link"><div className="logo"><Logo /></div></Link>
        <nav>
          {nav.side.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? "active" : "")}>
              <i.icon size={18} />{i.label}
              {badge(i.badge) > 0 && <span className="count">{badge(i.badge)}</span>}
            </NavLink>
          ))}
        </nav>
        <InstallButton className="side-install" />
        <div className="side-foot">
          <div className="row gap-8" style={{ padding: "4px 8px 10px" }}>
            <Avatar name={user?.full_name} src={user?.avatar} />
            <div className="grow">
              <div className="bold small ellipsis" style={{ color: "#fff" }}>{user?.full_name}</div>
              <div className="xs">{ROLE_LABEL[user?.role || "user"]}{user?.is_premium && " · Premium"}</div>
            </div>
          </div>
          <a onClick={logout} style={{ cursor: "pointer" }}><LogOut size={18} />Chiqish</a>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Link to={homeFor(user?.role)} className="mobile-only"><Logo dark size={26} /></Link>
          {user?.role === "user" && <TopSearch />}
          <div className="grow" />
          <TopActions notif={counts.notif} />
        </header>
        <main className="content">
          {loc.pathname !== "/app/notifications" && <div style={{ marginBottom: 14 }}><EnablePush variant="banner" /></div>}
          <Suspense fallback={<Spinner />}><Outlet /></Suspense>
        </main>
      </div>
      <nav className="bottom-nav">
        {nav.bottom.map((i) =>
          i.label === "SOS" ? (
            <NavLink key={i.to} to={i.to}><span className="sos-fab">SOS</span></NavLink>
          ) : (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? "active" : "")}>
              <i.icon size={21} />{i.label}
              {badge(i.badge) > 0 && <span className="bn-badge">{badge(i.badge)}</span>}
            </NavLink>
          )
        )}
      </nav>
    </div>
  );
}

function TopSearch() {
  const n = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form className="top-search desktop-only" onSubmit={(e) => { e.preventDefault(); if (q.trim()) n(`/app/search?q=${encodeURIComponent(q.trim())}`); }}>
      <Search size={17} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Usta, xizmat yoki ehtiyot qism qidirish…" aria-label="Qidiruv" />
    </form>
  );
}

function TopActions({ notif }: { notif: number }) {
  const { user } = useAuth();
  const n = useNavigate();
  return (
    <div className="row gap-8">
      {user?.role === "user" && <button className="icon-btn mobile-only" onClick={() => n("/app/search")} aria-label="Qidiruv"><Search size={18} /></button>}
      {user?.role !== "user" && <OnlineToggle />}
      <ThemeToggle />
      <button className="icon-btn" onClick={() => n("/app/notifications")} aria-label="Bildirishnomalar"><Bell size={18} />{notif > 0 && <span className="bell-count">{notif > 99 ? "99+" : notif}</span>}</button>
      <Link to="/app/profile"><Avatar name={user?.full_name} src={user?.avatar} /></Link>
    </div>
  );
}

export function OnlineToggle() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    const next = !user!.is_online;
    setBusy(true);
    try {
      // holat darhol o'zgaradi — GPS javobini kutib qolmaymiz (telefonda GPS bir necha soniya javob bermasligi mumkin)
      await api.patch("/auth/me/", { is_online: next });
      setUser({ ...user!, is_online: next });
      if (next) {
        getPreciseLocation({ desired: 30, maxWait: 15000 })
          .then((f) => { api.post("/auth/location/", { lat: f.lat, lng: f.lng }).catch(() => {}); })
          .catch(() => toast("Joylashuvga ruxsat bering — shunda sizga eng yaqin buyurtmalar keladi.", "error"));
      }
    } catch (e) {
      toast(errMsg(e), "error");
    } finally { setBusy(false); }
  };
  return (
    <button className={"btn btn-sm " + (user?.is_online ? "btn-green" : "btn-ghost")} onClick={toggle} disabled={busy} aria-pressed={!!user?.is_online}>
      <span className="online-dot" style={{ background: user?.is_online ? "#fff" : "#9aa6b8", boxShadow: "none" }} />
      {user?.is_online ? "Online" : "Offline"}
    </button>
  );
}

export function PageHead({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const n = useNavigate();
  return (
    <div className="back-row">
      {back && <button className="icon-btn" onClick={() => n(-1)} aria-label="Orqaga">←</button>}
      <h2 className="grow">{title}</h2>
      {right}
    </div>
  );
}
