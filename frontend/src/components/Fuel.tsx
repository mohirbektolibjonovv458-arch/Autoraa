import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bell, BellRing, Check, Clock, List, LocateFixed, Map as MapIcon, MapPin, Navigation, Phone, Plus, Route, Search, Trophy, Users, X } from "lucide-react";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import MapView from "./MapView";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useSite } from "../site";
import { BaseTiles, LayerButton } from "./MapLayers";
import { Empty, Modal, Spinner, useToast } from "./ui";

export const FUELS = [
  { key: "metan", label: "Metan", unit: "m³" },
  { key: "propan", label: "Propan", unit: "l" },
  { key: "benzin", label: "Benzin", unit: "l" },
  { key: "dizel", label: "Dizel", unit: "l" },
  { key: "elektr", label: "Elektr", unit: "kVt·s" },
];
export const FSTATUS: Record<string, { label: string; short: string; color: string; icon: string }> = {
  bor: { label: "Bor, navbatsiz", short: "Bor", color: "#12a150", icon: "🟢" },
  navbat_kichik: { label: "Bor, navbat kichik", short: "Navbat kichik", color: "#e6a100", icon: "🟡" },
  navbat_katta: { label: "Bor, navbat katta", short: "Navbat katta", color: "#ff6a1f", icon: "🟠" },
  yoq: { label: "Yo'q", short: "Yo'q", color: "#ee2b2f", icon: "🔴" },
  yopiq: { label: "Yopiq", short: "Yopiq", color: "#3b4658", icon: "⚫" },
  unknown: { label: "Ma'lumot yo'q", short: "Noma'lum", color: "#9aa6b8", icon: "⚪" },
};
const ago = (m?: number | null) => (m == null ? "" : m < 1 ? "hozirgina" : m < 60 ? `${m} daq. oldin` : `${Math.floor(m / 60)} soat oldin`);
const price = (n?: number) => (n ? n.toLocaleString("ru-RU").replace(/,/g, " ") : "");

export function FuelBadge({ s }: { s?: any }) {
  const code = s?.status || "unknown";
  const st = FSTATUS[code] || FSTATUS.unknown;
  return <span className="fuel-badge" style={{ background: st.color + "1c", color: st.color }}><i style={{ background: st.color }} />{st.short}</span>;
}

/** Butun O'zbekiston bo'yicha viloyat markazlari (tezkor o'tish uchun) */
export const REGIONS: { name: string; c: [number, number]; z: number }[] = [
  { name: "Toshkent shahri", c: [41.2995, 69.2401], z: 11 },
  { name: "Toshkent viloyati", c: [41.05, 69.6], z: 9 },
  { name: "Samarqand", c: [39.6542, 66.9597], z: 10 },
  { name: "Buxoro", c: [39.7747, 64.4286], z: 10 },
  { name: "Andijon", c: [40.7821, 72.3442], z: 10 },
  { name: "Farg'ona", c: [40.3842, 71.7843], z: 10 },
  { name: "Namangan", c: [40.9983, 71.6726], z: 10 },
  { name: "Qashqadaryo (Qarshi)", c: [38.8606, 65.7891], z: 10 },
  { name: "Surxondaryo (Termiz)", c: [37.2242, 67.2783], z: 10 },
  { name: "Jizzax", c: [40.1158, 67.8422], z: 10 },
  { name: "Sirdaryo (Guliston)", c: [40.4897, 68.7842], z: 10 },
  { name: "Navoiy", c: [40.0844, 65.3792], z: 10 },
  { name: "Xorazm (Urganch)", c: [41.55, 60.6333], z: 10 },
  { name: "Qoraqalpog'iston (Nukus)", c: [42.46, 59.6103], z: 10 },
];
const UZ_VIEW: { c: [number, number]; z: number } = { c: [41.3, 64.6], z: 6 };
const FILTERS = [
  { key: "", label: "Barchasi" }, { key: "benzin", label: "Benzin" }, { key: "propan", label: "Propan" }, { key: "metan", label: "Metan" },
];
/** Xaritadagi belgi rangi — yoqilg'i turi bo'yicha */
export const TYPE_COLOR: Record<string, string> = { metan: "#ff7a2f", propan: "#12a150", benzin: "#1f6feb", dizel: "#5b6b82", elektr: "#7c4dff" };
const mainType = (fuels: string[], filter: string) => (filter && fuels.includes(filter) ? filter : ["metan", "propan", "benzin", "dizel", "elektr"].find((f) => fuels.includes(f)) || "benzin");

type View = { s: number; w: number; n: number; e: number; zoom: number; center: [number, number] };

/** Yoqilg'i xaritasi: butun O'zbekiston, ko'rinib turgan hudud bo'yicha yuklanadi (server klasterlaydi). */
export default function FuelView({ publicMode = false }: { publicMode?: boolean }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [filter, setFilter] = useState(() => { const f = localStorage.getItem("ah_fuel_filter"); return f === null ? "" : f; });
  const [view, setView] = useState<View | null>(null);
  const [mapData, setMapData] = useState<any>(null);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [fly, setFly] = useState<{ c: [number, number]; z: number; k: number } | null>(null);
  const [list, setList] = useState<any[] | null>(null);
  const [more, setMore] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [sel, setSel] = useState<number | null>(sp.get("station") ? Number(sp.get("station")) : null);
  const [add, setAdd] = useState(false);
  const [leaders, setLeaders] = useState<any>(null);
  const [route, setRoute] = useState<any>(null);       // {station, points, distance_km, duration_min, steps, along}
  const [openOnly, setOpenOnly] = useState(false);     // «Hozir ochiq» filtri
  const [trip, setTrip] = useState(false);             // «Qayerga borasiz?» oynasi
  const [alongOpen, setAlongOpen] = useState(true);
  const [routing, setRouting] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  /** Marshrut bo'yidagi shoxobchalar (filtr va «hozir ochiq» hisobga olinadi) */
  const loadAlong = (points: any, st?: any) => {
    api.post("/fuel/along/", { points, fuel: filter || undefined, open_now: openOnly, buffer_km: 2 })
      .then((r) => setRoute((cur: any) => (cur && (!st || cur.station === st) ? { ...cur, along: r.data.results } : cur)))
      .catch(() => {});
  };
  useEffect(() => { if (route?.station?.dest && route.points) loadAlong(route.points); }, [filter, openOnly]);

  /** Ilova ichida marshrut: joylashuvim → shoxobcha. Joylashuv bo'lmasa — avval aniqlaymiz. */
  const buildRoute = (st: any) => {
    const go = (from: [number, number]) => {
      setRouting(true); setMobileView("map"); open(null);
      api.get("/map/route/", { params: { from: `${from[0]},${from[1]}`, to: `${st.lat},${st.lng}` } })
        .then((r) => {
          setRoute({ station: st, ...r.data }); setStepsOpen(false);
          if (st.dest) loadAlong(r.data.points, st);
          setTimeout(() => document.querySelector(".fuel-map")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
        })
        .catch((e) => toast(errMsg(e), "error"))
        .finally(() => setRouting(false));
    };
    if (me) return go(me);
    if (!navigator.geolocation) { toast("Qurilma joylashuvni aniqlay olmaydi", "error"); return; }
    setRouting(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { const c: [number, number] = [p.coords.latitude, p.coords.longitude]; setMe(c); go(c); },
      () => { setRouting(false); toast("Marshrut uchun joylashuvga ruxsat bering", "error"); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  useEffect(() => { localStorage.setItem("ah_fuel_filter", filter); }, [filter]);
  useEffect(() => { api.get("/fuel/leaders/").then((r) => setLeaders(r.data)).catch(() => {}); }, []);

  // Joylashuv: ruxsat allaqachon berilgan bo'lsa — jimgina aniqlaymiz; so'ralmagan bo'lsa — butun O'zbekiston ko'rinadi
  useEffect(() => {
    const perms: any = (navigator as any).permissions;
    perms?.query?.({ name: "geolocation" }).then((r: any) => { if (r.state === "granted") locate(false); }).catch(() => {});
  }, []);

  const locate = (explicit = true) => {
    if (!navigator.geolocation) { if (explicit) toast("Qurilmangiz joylashuvni aniqlay olmaydi", "error"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c: [number, number] = [p.coords.latitude, p.coords.longitude];
        setMe(c); setLocating(false);
        setFly({ c, z: 13, k: Date.now() });
        if (explicit) setMobileView("list");
      },
      (e) => {
        setLocating(false);
        if (explicit) toast(e.code === 1 ? "Joylashuvga ruxsat berilmadi. Xaritani surib istalgan hududni ko'rishingiz mumkin." : "Joylashuvni aniqlab bo'lmadi, qayta urinib ko'ring.", "error");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  // Xarita hududi o'zgarganda — faqat shu hudud (debounce)
  const reqId = useRef(0);
  useEffect(() => {
    if (!view) return;
    const id = ++reqId.current;
    const t = setTimeout(() => {
      api.get("/fuel/map/", { params: { south: view.s, west: view.w, north: view.n, east: view.e, zoom: view.zoom, fuel: filter || undefined, open_now: openOnly ? 1 : undefined } })
        .then((r) => { if (id === reqId.current) setMapData(r.data); }).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [view?.s, view?.w, view?.n, view?.e, view?.zoom, filter, openOnly]);

  // Ro'yxat: joylashuvim bo'lsa — mendan eng yaqinlari; bo'lmasa — xarita markazidan
  const origin: [number, number] | null = me || (view && view.zoom >= 10 ? view.center : null);
  const radiusKm = view ? Math.min(60, Math.max(3, haversine(view.center, [view.n, view.e]))) : 25;
  const loadList = (offset = 0) => {
    if (!origin) { setList(null); return; }
    api.get("/fuel/stations/", { params: { lat: origin[0], lng: origin[1], radius: me ? 30 : radiusKm, fuel: filter || undefined, open_now: openOnly ? 1 : undefined, limit: 30, offset } })
      .then((r) => { setList((old) => (offset ? [...(old || []), ...r.data.results] : r.data.results)); setMore(r.data.next_offset); })
      .catch(() => {});
  };
  useEffect(() => {
    const t = setTimeout(() => loadList(0), 450);
    return () => clearTimeout(t);
  }, [origin?.[0]?.toFixed(3), origin?.[1]?.toFixed(3), filter, openOnly, me ? 1 : Math.round(radiusKm)]);

  const open = (id: number | null) => { setSel(id); const n = new URLSearchParams(sp); id ? n.set("station", String(id)) : n.delete("station"); setSp(n, { replace: true }); };
  const needLogin = () => nav(`/login?next=${encodeURIComponent(`/app/fuel${sel ? `?station=${sel}` : ""}`)}`);
  const refresh = () => { setView((v) => (v ? { ...v } : v)); loadList(0); api.get("/fuel/leaders/").then((r) => setLeaders(r.data)).catch(() => {}); };
  const geoForModal = { lat: me?.[0], lng: me?.[1], real: !!me };

  return (
    <div className="col gap-12">
      <div className="page-head">
        <div style={{ marginRight: "auto" }}><h2 className="page-title">Yoqilg'i xaritasi</h2>
          <div className="xs muted">Butun O'zbekiston · {mapData ? `bu hududda ${mapData.total} ta shoxobcha` : "yuklanmoqda…"} · holatni haydovchilar belgilaydi</div></div>
        {!publicMode && <button className="btn btn-sm btn-ghost" onClick={() => setAdd(true)}><Plus size={15} />Shoxobcha</button>}
      </div>

      <div className="fuel-tabs" role="tablist">{FILTERS.map((f) => <button key={f.key || "all"} role="tab" aria-selected={filter === f.key} className={filter === f.key ? "active" : ""} onClick={() => setFilter(f.key)}>{f.key && <i className="tdot" style={{ background: TYPE_COLOR[f.key] }} />}{f.label}</button>)}</div>

      <div className="fuel-toolbar">
        <button className="btn btn-sm" onClick={() => locate(true)} disabled={locating}><LocateFixed size={15} />{locating ? "Aniqlanmoqda…" : "Yaqinimdagi zapravkalar"}</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setTrip(true)}><Route size={15} />Yo'nalish</button>
        <button className={"chip open-chip" + (openOnly ? " active" : "")} onClick={() => setOpenOnly((x) => !x)} aria-pressed={openOnly}><span className="dot-live" />Hozir ochiq</button>
        <select className="select fuel-region" value="" onChange={(e) => { const r = REGIONS[Number(e.target.value)]; if (r) { setFly({ c: r.c, z: r.z, k: Date.now() }); setMobileView("map"); } }} aria-label="Viloyatni tanlash">
          <option value="">Viloyatga o'tish…</option>
          {REGIONS.map((r, i) => <option key={r.name} value={i}>{r.name}</option>)}
        </select>
        <div className="tabs mobile-only" style={{ width: "auto", marginLeft: "auto" }}>
          <button className={mobileView === "map" ? "active" : ""} onClick={() => setMobileView("map")} aria-label="Xarita"><MapIcon size={15} /></button>
          <button className={mobileView === "list" ? "active" : ""} onClick={() => setMobileView("list")} aria-label="Ro'yxat"><List size={15} /></button>
        </div>
      </div>

      <div className="fuel-layout" data-view={mobileView}>
        <div className="fuel-map">
          {route && (
            <div className="route-card">
              <div className="row gap-12">
                <span className="route-ic"><Route size={18} /></span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <b className="ellipsis">{route.station.name}</b>
                  <div className="route-meta"><b>{route.duration_min} daq</b> · {route.distance_km} km</div>
                </div>
                <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Marshrutni yopish" onClick={() => setRoute(null)}><X size={16} /></button>
              </div>
              <div className="row gap-8 mt-8">
                <a className="btn btn-sm btn-red grow" href={`https://yandex.uz/maps/?rtext=${me ? `${me[0]},${me[1]}` : ""}~${route.station.lat},${route.station.lng}&rtt=auto`} target="_blank" rel="noreferrer"><Navigation size={14} />Navigatorda boshlash</a>
                {route.steps?.length > 0 && <button className="btn btn-sm btn-ghost" onClick={() => setStepsOpen((x) => !x)}>{stepsOpen ? "Yopish" : "Yo'l tavsifi"}</button>}
              </div>
              {route.along && (
                <div className="along">
                  <button className="along-head" onClick={() => setAlongOpen((x) => !x)}>
                    <b>Yo'l bo'yida {route.along.length} ta shoxobcha</b><span className="xs muted">{filter ? fuelLabel(filter) : "Barchasi"}{openOnly ? " · hozir ochiq" : ""}</span>
                  </button>
                  {alongOpen && (route.along.length === 0 ? <p className="xs muted" style={{ margin: "6px 0 0" }}>Bu yo'lda mos shoxobcha topilmadi. Filtrni o'zgartirib ko'ring.</p> : (
                    <ol className="along-list">
                      {route.along.map((s: any) => { const f = mainType(s.fuels, filter); return (
                        <li key={s.id}><button onClick={() => open(s.id)}>
                          <span className="ftype" style={{ background: TYPE_COLOR[f] }} />
                          <span className="grow" style={{ minWidth: 0 }}><b className="small ellipsis" translate="no">{stationTitle(s, filter)}</b>
                            <span className="xs muted">{s.along_km} km dan keyin · yo'ldan {s.off_km < 1 ? `${Math.round(s.off_km * 1000)} m` : `${s.off_km} km`}</span></span>
                          {s.open_now === false ? <span className="open-badge off">Yopiq</span> : <FuelBadge s={s.status?.[f]} />}
                        </button></li>
                      ); })}
                    </ol>
                  ))}
                </div>
              )}
              {stepsOpen && <ol className="route-steps">{route.steps.map((s: any, i: number) => <li key={i}><span>{s.text}</span>{s.distance_m > 0 && <em>{s.distance_m >= 1000 ? `${(s.distance_m / 1000).toFixed(1)} km` : `${s.distance_m} m`}</em>}</li>)}</ol>}
              <div className="xs muted mt-4">{route.provider}</div>
            </div>
          )}
          {routing && <div className="route-loading"><span className="im-spin" />Marshrut hisoblanmoqda…</div>}
          <FuelMap data={mapData} filter={filter} me={me} selected={sel} fly={fly} onView={setView} onOpen={open} route={route}
            onLocate={() => { if (me) setFly({ c: me, z: 15, k: Date.now() }); else locate(true); }}
            onZoomTo={(c, z) => setFly({ c, z, k: Date.now() })} />
          <div className="fuel-legend">{["benzin", "propan", "metan"].map((k) => <span key={k}><i style={{ background: TYPE_COLOR[k] }} />{fuelLabel(k)}</span>)}<span><i className="st" />holat</span></div>
        </div>
        <div className="fuel-list">
          <div className="xs muted" style={{ padding: "0 2px" }}>{me ? "Sizga eng yaqin shoxobchalar" : origin ? "Xarita markaziga yaqin shoxobchalar" : ""}</div>
          {!origin ? (
            <Empty title="Hududni tanlang" text="«Yaqinimdagi zapravkalar» tugmasini bosing, viloyatni tanlang yoki xaritani kattalashtiring." />
          ) : list === null ? <Spinner /> : list.length === 0 ? (
            <Empty title="Bu atrofda shoxobcha topilmadi" text={filter ? "Filtrni «Barchasi» ga o'zgartirib ko'ring." : "Xaritada yo'q shoxobchani qo'shishingiz mumkin."}
              action={!publicMode ? <button className="btn" onClick={() => setAdd(true)}>Shoxobcha qo'shish</button> : undefined} />
          ) : <>
            {list.map((s) => {
              const f = mainType(s.fuels, filter);
              const x = s.status?.[f];
              return (
                <button key={s.id} className={"fuel-item" + (s.id === sel ? " active" : "")} onClick={() => open(s.id)}>
                  <span className="ftype" style={{ background: TYPE_COLOR[f] }} aria-hidden />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row gap-8"><b className="small ellipsis" translate="no">{stationTitle(s, filter)}</b>{s.subscribed?.includes(f) && <BellRing size={13} color="#1f6feb" />}</div>
                    <div className="xs muted ellipsis">{s.distance_km != null && `${s.distance_km} km · `}{s.fuels.map((k: string) => fuelLabel(k)).join(", ")}{s.is_24_7 ? " · 24/7" : s.opening_hours ? ` · ${s.opening_hours}` : ""}</div>
                    {s.open_now === true && <span className="open-badge on">Ochiq</span>}{s.open_now === false && <span className="open-badge off">Yopiq</span>}
                    {x?.status && x.status !== "unknown" && <div className="xs muted row gap-4 mt-4"><Clock size={11} />{ago(x.minutes_ago)}{x.confirms > 1 && <><Users size={11} style={{ marginLeft: 6 }} />{x.confirms} kishi</>}</div>}
                  </div>
                  <div className="col" style={{ alignItems: "flex-end", gap: 4 }}>
                    <FuelBadge s={x} />
                    {x?.price && <b className="xs">{price(x.price)} so'm</b>}
                  </div>
                </button>
              );
            })}
            {more != null && <button className="btn btn-ghost btn-block" onClick={() => loadList(more)}>Yana ko'rsatish</button>}
          </>}
        </div>
      </div>

      <p className="xs muted">Shoxobchalar manbai: OpenStreetMap (haftalik yangilanadi) va foydalanuvchilar. Xato topsangiz — shoxobcha oynasida holatni belgilang yoki yangi shoxobcha qo'shing.</p>

      {leaders && (leaders.leaders.length > 0 || leaders.me) && (
        <div className="card">
          <div className="row between"><b className="row gap-8"><Trophy size={18} color="#f5a623" />Haftaning yordamchilari</b>{leaders.me && <span className="small muted">Siz: <b>{leaders.me.week}</b> ta{leaders.me.rank && ` · ${leaders.me.rank}-o'rin`}</span>}</div>
          <div className="row gap-8 wrap mt-8">{leaders.leaders.slice(0, 5).map((l: any, i: number) => <span key={l.user_id} className="chip" style={{ padding: "5px 10px" }}>{["🥇", "🥈", "🥉"][i] || "⭐"} {l.name} · {l.count}</span>)}
            {leaders.leaders.length === 0 && <span className="small muted">Birinchi bo'ling!</span>}</div>
        </div>
      )}

      {trip && <TripModal near={me} onClose={() => setTrip(false)} onPick={(d) => { setTrip(false); buildRoute({ ...d, dest: true }); }} />}
      {sel && <StationModal id={sel} fuel={filter || "metan"} geo={geoForModal} publicMode={publicMode} needLogin={needLogin} onClose={() => open(null)} onChanged={refresh} onRoute={buildRoute} />}
      {add && user && <AddStation geo={{ lat: (me || view?.center || UZ_VIEW.c)[0], lng: (me || view?.center || UZ_VIEW.c)[1] }} onClose={() => setAdd(false)} onDone={(id) => { setAdd(false); refresh(); open(id); toast("Shoxobcha qo'shildi. Rahmat!", "success"); }} />}
    </div>
  );
}

function haversine(a: [number, number], b: [number, number]) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
const clusterIcon = (n: number) => {
  const size = n < 10 ? 34 : n < 100 ? 40 : n < 1000 ? 48 : 56;
  return L.divIcon({ className: "", html: `<div class="fcluster" style="width:${size}px;height:${size}px">${n}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
};
const stationIcon = (type: string, status: string, active: boolean) =>
  L.divIcon({ className: "", html: `<div class="fpin${active ? " on" : ""}" style="background:${TYPE_COLOR[type] || "#1f6feb"}"><span class="fst" style="background:${(FSTATUS[status] || FSTATUS.unknown).color}"></span></div>`, iconSize: [28, 36], iconAnchor: [14, 34] });
const meIcon = L.divIcon({ className: "", html: `<div class="me-dot"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });

function ViewWatcher({ onView }: { onView: (v: View) => void }) {
  const map = useMapEvents({ moveend: () => emit(), zoomend: () => emit() });
  const emit = () => {
    const b = map.getBounds(); const c = map.getCenter();
    onView({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast(), zoom: map.getZoom(), center: [c.lat, c.lng] });
  };
  useEffect(() => { emit(); }, []);
  return null;
}
function Flyer({ fly }: { fly: { c: [number, number]; z: number; k: number } | null }) {
  const map = useMap();
  useEffect(() => { if (fly) map.flyTo(fly.c, fly.z, { duration: 0.8 }); }, [fly?.k]);
  return null;
}

function RouteLayer({ route, onOpenStation }: { route: any; onOpenStation?: (id: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!route?.points?.length) return;
    map.fitBounds(L.latLngBounds(route.points), { padding: [40, 40], maxZoom: 16 });
  }, [route]);
  if (!route?.points?.length) return null;
  return <>
    <Polyline positions={route.points} pathOptions={{ color: "#0a1424", weight: 9, opacity: .18, lineCap: "round" }} />
    <Polyline positions={route.points} pathOptions={{ color: "#1f6feb", weight: 5, opacity: .95, lineCap: "round", className: "route-line" }} />
    <Marker position={[route.station.lat, route.station.lng]} icon={destIcon} title={route.station.name} alt={route.station.name} />
    {(route.along || []).map((s: any) => (
      <Marker key={"a" + s.id} position={[s.lat, s.lng]} icon={stationIcon(mainType(s.fuels, ""), s.status?.[mainType(s.fuels, "")]?.status || "unknown", false)}
        title={stationTitle(s)} alt={stationTitle(s)} eventHandlers={{ click: () => onOpenStation?.(s.id) }} />
    ))}
  </>;
}
const destIcon = L.divIcon({ className: "", html: `<div class="dest-pin"><span></span></div>`, iconSize: [30, 40], iconAnchor: [15, 38] });

function FuelMap({ data, filter, me, selected, fly, onView, onOpen, onZoomTo, route, onLocate }: {
  data: any; filter: string; me: [number, number] | null; selected: number | null; fly: any;
  onView: (v: View) => void; onOpen: (id: number) => void; onZoomTo: (c: [number, number], z: number) => void; route?: any; onLocate: () => void;
}) {
  const site = useSite();
  const [zoom, setZoom] = useState(UZ_VIEW.z);
  return (
    <div className="map-box">
      <MapContainer bounds={[[37.18, 55.99], [45.59, 73.15]]} minZoom={5} maxZoom={18} style={{ height: "100%", width: "100%" }} scrollWheelZoom
        maxBounds={[[34.5, 52], [48.5, 77]]} maxBoundsViscosity={0.8}>
        <BaseTiles />
        <ViewWatcher onView={(v) => { setZoom(v.zoom); onView(v); }} />
        <Flyer fly={fly} />
        {me && <Marker position={me} icon={meIcon} title="Siz shu yerdasiz" alt="Siz shu yerdasiz" />}
        <RouteLayer route={route} onOpenStation={onOpen} />
        {data?.mode === "clusters" && data.items.map((c: any, i: number) => (
          <Marker key={`c${i}-${c.lat}-${c.lng}`} position={[c.lat, c.lng]} icon={clusterIcon(c.count)} title={`${c.count} ta shoxobcha`} alt={`${c.count} ta shoxobcha`}
            eventHandlers={{ click: () => onZoomTo([c.lat, c.lng], Math.min(zoom + 2, 16)) }} />
        ))}
        {data?.mode === "points" && data.items.map((s: any) => {
          const t = mainType(s.fuels || [], filter);
          return (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={stationIcon(t, s.status?.[t]?.status || "unknown", s.id === selected)}
              title={stationTitle(s, filter)} alt={stationTitle(s, filter)} eventHandlers={{ click: () => onOpen(s.id) }} />
          );
        })}
      </MapContainer>
      <LayerButton />
      <button className="map-locate" onClick={onLocate} aria-label="Mening joylashuvim" title="Mening joylashuvim"><LocateFixed size={20} /></button>
    </div>
  );
}

function StationModal({ id, fuel: fuel0, geo, publicMode, needLogin, onClose, onChanged, onRoute }: any) {
  const toast = useToast();
  const [s, setS] = useState<any>(null);
  const [fuel, setFuel] = useState(fuel0);
  const [priceV, setPriceV] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api.get(`/fuel/stations/${id}/`, { params: geo.real ? { lat: geo.lat, lng: geo.lng } : {} }).then((r) => {
    setS(r.data);
    if (!r.data.fuels.includes(fuel0) && r.data.fuels[0]) setFuel(r.data.fuels[0]);
  }).catch(() => { toast("Shoxobcha topilmadi", "error"); onClose(); });
  useEffect(() => { load(); }, [id]);
  if (!s) return <Modal title="Shoxobcha" onClose={onClose}><Spinner /></Modal>;

  const x = s.status?.[fuel];
  const report = async (status: string) => {
    if (publicMode) return needLogin();
    if (!geo.real) { toast("Belgilash uchun joylashuvga (GPS) ruxsat bering.", "error"); return; }
    setBusy(true);
    try {
      const r = await api.post(`/fuel/stations/${id}/report/`, { fuel, status, lat: geo.lat, lng: geo.lng, price: priceV || undefined });
      toast(`Rahmat! Bu hafta ${r.data.my_week} ta belgi qo'ydingiz 🙌`, "success"); setPriceV(""); load(); onChanged();
    } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  };
  const sub = async () => {
    if (publicMode) return needLogin();
    try {
      const r = await api.post(`/fuel/stations/${id}/subscribe/`, { fuel });
      toast(r.data.subscribed ? (r.data.telegram ? `${fuelLabel(fuel)} kelganda Telegramga xabar yuboramiz` : "Obuna bo'ldingiz. Xabar saytdagi bildirishnomalarda chiqadi") : "Obuna bekor qilindi", "success");
      load(); onChanged();
    } catch (e) { toast(errMsg(e), "error"); }
  };
  const subscribed = s.subscribed?.includes(fuel);

  return (
    <Modal title={stationTitle(s, fuel0)} onClose={onClose}>
      <div className="col gap-12">
        <div className="xs muted">{s.distance_km != null && `${s.distance_km} km · `}{s.address || (s.source === "osm" ? "OpenStreetMap ma'lumoti" : "Foydalanuvchi qo'shgan")}{s.is_24_7 && " · 24/7"}{!s.is_verified && " · tekshirilmagan"}</div>
        <div className="fuel-facts">
          <span>🕒 {s.is_24_7 ? "24 soat" : s.opening_hours || "Ish vaqti ko'rsatilmagan"}{s.open_now === true && <b className="open-badge on" style={{ marginLeft: 8 }}>Hozir ochiq</b>}{s.open_now === false && <b className="open-badge off" style={{ marginLeft: 8 }}>Hozir yopiq</b>}</span>
          {s.phone && <a href={`tel:${s.phone.replace(/\s/g, "")}`}>📞 {s.phone}</a>}
          <span>⛽ {s.fuels.map((k: string) => fuelLabel(k)).join(", ")}{!s.fuels_confirmed && <em className="muted"> (nomidan aniqlangan — belgi qo'yib tasdiqlang)</em>}</span>
        </div>
        {s.fuels.length > 1 && <div className="row gap-8 wrap">{s.fuels.map((f: string) => <button key={f} className={"chip" + (fuel === f ? " active" : "")} onClick={() => setFuel(f)}>{fuelLabel(f)} {FSTATUS[s.status?.[f]?.status || "unknown"].icon}</button>)}</div>}

        <div className="fuel-now" style={{ borderColor: FSTATUS[x?.status || "unknown"].color }}>
          <div className="small muted">{fuelLabel(fuel)} hozir</div>
          <div className="row between wrap gap-8"><b style={{ fontSize: 20, color: FSTATUS[x?.status || "unknown"].color }}>{FSTATUS[x?.status || "unknown"].label}</b>{x?.price && <b>{price(x.price)} so'm/{x.unit}</b>}</div>
          {x?.status && x.status !== "unknown" ? <div className="xs muted">{ago(x.minutes_ago)} belgilangan{x.confirms > 1 && ` · ${x.confirms} kishi tasdiqladi`}</div>
            : <div className="xs muted">{x?.last_label ? `Oxirgi ma'lumot: ${x.last_label.toLowerCase()} (${ago(x.minutes_ago)}) — eskirgan` : "So'nggi 3 soatda hech kim belgilamagan. Birinchi bo'ling!"}</div>}
        </div>

        <div>
          <b className="small">Siz shu yerdamisiz? Hozirgi holatni belgilang:</b>
          <div className="fuel-report mt-8">
            {["bor", "navbat_kichik", "navbat_katta", "yoq", "yopiq"].map((k) => (
              <button key={k} disabled={busy} onClick={() => report(k)} style={{ borderColor: FSTATUS[k].color + "55" }}><span>{FSTATUS[k].icon}</span>{FSTATUS[k].label}</button>
            ))}
          </div>
          {!publicMode && <input className="input mt-8" type="number" inputMode="numeric" placeholder={`Narx (ixtiyoriy), so'm/${FUELS.find((f) => f.key === fuel)?.unit}`} value={priceV} onChange={(e) => setPriceV(e.target.value)} />}
          <p className="xs muted mt-4">Faqat shoxobchadan 2 km radiusda belgilash mumkin — ma'lumot ishonchli bo'lishi uchun.</p>
        </div>

        <div className="grid g2">
          <button className={"btn " + (subscribed ? "btn-soft" : "btn-ghost")} onClick={sub}>{subscribed ? <BellRing size={16} /> : <Bell size={16} />}{subscribed ? "Obunadasiz" : `${fuelLabel(fuel)} kelsa xabar ber`}</button>
          <button className="btn btn-red" onClick={() => onRoute?.(s)}><Route size={16} />Marshrut</button>
        </div>
        <div className="row gap-8 wrap">
          <a className="btn btn-sm btn-ghost" href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`} target="_blank" rel="noreferrer"><Navigation size={14} />Google xarita</a>
          <a className="btn btn-sm btn-ghost" href={`https://yandex.uz/maps/?rtext=~${s.lat},${s.lng}&rtt=auto`} target="_blank" rel="noreferrer">Yandex xarita</a>
          {s.phone && <a className="btn btn-sm btn-ghost" href={`tel:${s.phone}`}><Phone size={14} />{s.phone}</a>}
        </div>

        {s.reports.length > 0 && (
          <div>
            <b className="small">So'nggi 24 soat</b>
            <div className="list mt-4">{s.reports.slice(0, 10).map((r: any) => (
              <div key={r.id} className="list-row" style={{ padding: "8px 0" }}>
                <span>{FSTATUS[r.status].icon}</span>
                <div className="grow"><span className="small">{fuelLabel(r.fuel)}: <b>{r.label.toLowerCase()}</b>{r.price && ` · ${price(r.price)} so'm`}</span><div className="xs muted">{r.user}</div></div>
                <span className="xs muted">{new Date(r.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

const fuelLabel = (k: string) => FUELS.find((f) => f.key === k)?.label || k;

function AddStation({ geo, onClose, onDone }: { geo: any; onClose: () => void; onDone: (id: number) => void }) {
  const [pt, setPt] = useState<[number, number]>([geo.lat, geo.lng]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [fuels, setFuels] = useState<string[]>(["metan"]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [h24, setH24] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (k: string) => setFuels(fuels.includes(k) ? fuels.filter((x) => x !== k) : [...fuels, k]);
  const save = async () => {
    setErr("");
    try {
      const opening_hours = h24 ? "24/7" : from && to ? `${from}-${to}` : "";
      const r = await api.post("/fuel/stations/", { name, address, lat: pt[0], lng: pt[1], fuels, is_24_7: h24, opening_hours }); onDone(r.data.id);
    }
    catch (e) { setErr(errMsg(e)); }
  };
  return (
    <Modal title="Shoxobcha qo'shish" onClose={onClose}>
      <div className="col gap-12">
        <div className="row between"><span className="xs muted">Xaritada aniq joyini bosing</span><button className="btn btn-sm btn-ghost" onClick={() => setPt([geo.lat, geo.lng])}><LocateFixed size={14} />Men turgan joy</button></div>
        <MapView center={pt} me={pt} zoom={16} onPick={(a, b) => setPt([a, b])} follow className="map-box" />
        <label className="field"><span>Nomi</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: «Chilonzor AGNKS»" /></label>
        <label className="field"><span>Mo'ljal / manzil</span><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ko'cha, mo'ljal" /></label>
        <div className="field"><span>Yoqilg'i turlari</span><div className="row gap-8 wrap">{FUELS.map((f) => <button key={f.key} className={"chip" + (fuels.includes(f.key) ? " active" : "")} onClick={() => toggle(f.key)}>{f.label}</button>)}</div></div>
        <label className="row gap-8 small"><input type="checkbox" checked={h24} onChange={(e) => setH24(e.target.checked)} />24 soat ishlaydi</label>
        {!h24 && (
          <div className="field"><span>Ish vaqti (ixtiyoriy)</span>
            <div className="row gap-8"><input className="input" type="time" aria-label="Ochilish" value={from} onChange={(e) => setFrom(e.target.value)} /><span className="muted">—</span><input className="input" type="time" aria-label="Yopilish" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        )}
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-block btn-lg" disabled={!name.trim() || fuels.length === 0} onClick={save}>Qo'shish</button>
      </div>
    </Modal>
  );
}

/** «Qayerga borasiz?» — O'zbekiston bo'yicha joy qidirish (shahar, tuman, bozor, ko'cha) */
function TripModal({ near, onClose, onPick }: { near: [number, number] | null; onClose: () => void; onPick: (d: { lat: number; lng: number; name: string }) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (q.trim().length < 3) { setRes(null); return; }
    const t = setTimeout(() => {
      api.get("/map/geocode/", { params: { q, lang: localStorage.getItem("ah_lang") === "ru" ? "ru" : "uz" } })
        .then((r) => { setRes(r.data); setErr(""); }).catch((e) => setErr(errMsg(e)));
    }, 400);
    return () => clearTimeout(t);
  }, [q]);
  const QUICK = ["Toshkent", "Samarqand", "Buxoro", "Andijon", "Farg'ona", "Namangan", "Qarshi", "Nukus"];
  return (
    <Modal title="Qayerga borasiz?" onClose={onClose}>
      <div className="col gap-12">
        <div className="search"><Search size={17} /><input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Shahar, tuman yoki joy nomi" aria-label="Manzil" /></div>
        {!near && <p className="xs muted" style={{ margin: 0 }}>Marshrut siz turgan joydan tuziladi — joylashuvga ruxsat so'raladi.</p>}
        {q.trim().length < 3 && <div className="chips" style={{ margin: 0 }}>{QUICK.map((c) => <button key={c} className="chip" onClick={() => setQ(c)}>{c}</button>)}</div>}
        {err && <div className="alert error">{err}</div>}
        {res && res.length === 0 && <p className="small muted">Hech narsa topilmadi. Boshqacha yozib ko'ring.</p>}
        {res && res.length > 0 && (
          <div className="list">{res.map((r, i) => (
            <button key={i} className="list-row" style={{ background: "none", border: 0, width: "100%", textAlign: "left" }} onClick={() => onPick(r)}>
              <span className="ico"><MapPin size={16} /></span>
              <div className="grow" style={{ minWidth: 0 }}><b className="small ellipsis" translate="no">{r.name}</b><div className="xs muted ellipsis" translate="no">{r.address}</div></div>
            </button>
          ))}</div>
        )}
        <p className="xs muted" style={{ margin: 0 }}>Yo'lingizdagi {`metan, propan va benzin`} shoxobchalari masofasi bilan ko'rsatiladi.</p>
      </div>
    </Modal>
  );
}

/** Umumiy («АГЗС метан», «Заправка», «Yoqilg'i quyish shoxobchasi») nomlar o'rniga tushunarli nom: «Metan shoxobchasi».
 *  Brend nomlari (Uzneftegaz, Navro'z Oil, Mustang…) o'zgarmaydi. */
const GENERIC = /^(агзс|агнкс|азс|агзс\.|газ\s*заправка|заправка|автозаправка|газ|метан|пропан|бензин|gaz|zapravka|agzs|agnks|azs|yoqilg'i quyish shoxobchasi|yoqilg‘i quyish shoxobchasi|fuel|gas station|petrol station)(\s*[-—]?\s*(метан|пропан|газ|бензин|metan|propan|benzin|gaz|№?\s*\d+))*$/i;
export function stationTitle(s: any, prefer?: string) {
  const name = String(s?.name || "").trim();
  if (name && !GENERIC.test(name)) return name;
  const f = (prefer && s?.fuels?.includes(prefer) ? prefer : s?.fuels?.[0]) || "";
  const label: Record<string, string> = { metan: "Metan", propan: "Propan", benzin: "Benzin", dizel: "Dizel", elektr: "Quvvatlash" };
  return `${label[f] || "Yoqilg'i"} shoxobchasi`;
}
