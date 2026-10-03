import { useEffect, useMemo, useRef, useState } from "react";
import { getPreciseLocation } from "../../geo";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import {
  ArrowLeft, Bell, BellOff, Car, Check, Crosshair, Flag, Fuel, History, LocateFixed, MapPin, Navigation, Search, Square, Volume2, VolumeX, Wrench, X,
} from "lucide-react";
import { api, errMsg } from "../../api";
import { BaseTiles, MapChrome } from "../../components/MapLayers";
import { markerIcon, meIcon } from "../../mapMarkers";
import MapView from "../../components/MapView";
import { Modal, Spinner, useToast } from "../../components/ui";
import { getLang } from "../../i18n";
import { speechParts } from "../../speech";
import { stationTitle } from "../../components/Fuel";

const FUELS: [string, string, string][] = [["metan", "Metan", "#ff7a2f"], ["propan", "Propan", "#12a150"], ["benzin", "Benzin", "#1f6feb"], ["dizel", "Dizel", "#5b6b82"], ["elektr", "Elektr", "#7c4dff"]];
const color = (f: string) => FUELS.find((x) => x[0] === f)?.[2] || "#1f6feb";
const fname = (f: string) => FUELS.find((x) => x[0] === f)?.[1] || f;
const km = (v?: number | null) => (v == null ? "—" : v < 1 ? `${Math.round(v * 1000)} m` : `${v >= 10 ? Math.round(v) : v.toFixed(1)} km`);
const dur = (m?: number | null) => (m == null ? "—" : m < 60 ? `${m} daq` : `${Math.floor(m / 60)} soat ${m % 60} daq`);
type Pt = { lat: number; lng: number; name: string };

/* ================= Ovozli yordamchi (brauzerning nutq sintezi) ================= */
function pickVoice(): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis?.getVoices?.() || [];
  const want = getLang() === "ru" ? ["ru"] : ["uz", "tr"]; // o'zbek ovozi bo'lmasa — turkcha (lotin yozuvini yaxshi o'qiydi)
  for (const w of want) {
    const m = vs.filter((x) => x.lang?.toLowerCase().startsWith(w));
    const v = m.find((x) => /google|neural|natural|enhanced|premium/i.test(x.name)) || m.find((x) => !x.localService) || m[0];
    if (v) return v;
  }
  return null;
}
export function voiceInfo() {
  if (!("speechSynthesis" in window)) return "Bu brauzerda ovoz yo'q";
  const v = pickVoice();
  return v ? (v.lang.startsWith("uz") ? "O'zbekcha ovoz" : v.lang.startsWith("tr") ? "Turkcha ovoz (o'zbek ovozi qurilmada yo'q)" : "Ruscha ovoz") : "Mos ovoz topilmadi — faqat matn ko'rsatiladi";
}
function speak(text: string) {
  try {
    const s = window.speechSynthesis; if (!s) return false;
    const v = pickVoice(); if (!v) return false;
    s.cancel();
    // gapma-gap, biroz sekinroq — haydovchi uchun aniqroq eshitiladi
    for (const part of speechParts(text, v.lang)) {
      const u = new SpeechSynthesisUtterance(part); u.voice = v; u.lang = v.lang; u.rate = 0.88; u.pitch = 1; u.volume = 1;
      s.speak(u);
    }
    return true;
  } catch { return false; }
}

export default function Safar() {
  const [active, setActive] = useState<any>(undefined);
  const [summary, setSummary] = useState<any>(null);
  const load = () => api.get("/trips/active/").then((r) => setActive(r.data)).catch(() => setActive(null));
  useEffect(() => { load(); window.speechSynthesis?.getVoices?.(); }, []);
  if (active === undefined) return <Spinner />;
  if (summary) return <Summary s={summary} onClose={() => { setSummary(null); load(); }} />;
  if (active) return <Active trip={active} onFinished={(s) => { setActive(null); setSummary(s); }} />;
  return <Plan onStarted={(t) => setActive(t)} />;
}

/* ================= 1. Safarni rejalashtirish ================= */
function Plan({ onStarted }: { onStarted: (t: any) => void }) {
  const toast = useToast();
  const [start, setStart] = useState<Pt | null>(null);
  const [dest, setDest] = useState<Pt | null>(null);
  const [cars, setCars] = useState<any[]>([]);
  const [car, setCar] = useState<string>("");
  const [fuel, setFuel] = useState("");
  const [pick, setPick] = useState<"start" | "dest" | null>(null);
  const [search, setSearch] = useState<"start" | "dest" | null>(null);
  const [locErr, setLocErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    api.get("/garage/vehicles/").then((r) => { setCars(r.data); const p = r.data.find((c: any) => c.is_primary) || r.data[0]; if (p) { setCar(String(p.id)); if (p.fuel_type) setFuel(p.fuel_type); } }).catch(() => {});
    api.get("/trips/").then((r) => setHistory(r.data)).catch(() => {});
    useMyLocation();
  }, []);
  const useMyLocation = () => {
    setLocErr("");
    if (!navigator.geolocation) { setLocErr("Qurilma joylashuvni aniqlay olmaydi. Boshlanish nuqtasini qidiring yoki xaritadan tanlang."); return; }
    getPreciseLocation({ desired: 30, maxWait: 12000 })
      .then((f) => setStart({ lat: f.lat, lng: f.lng, name: "Mening joylashuvim" }))
      .catch((e) => setLocErr(e.code === 1 ? "📍 Joylashuvga ruxsat berilmagan. Safar davomida aniq yoqilg'i va marshrut eslatmalarini olish uchun joylashuvga ruxsat bering." : "GPS signal topilmadi. Boshlanish nuqtasini qidiring yoki xaritadan tanlang."));
  };
  const go = async () => {
    if (!start || !dest || !fuel) return;
    setBusy(true); setErr("");
    try { const r = await api.post("/trips/", { start, dest, vehicle: car || undefined, fuel }); onStarted(r.data); }
    catch (e: any) { if (e?.response?.status === 409) { toast("Davom etayotgan safaringiz ochildi"); window.location.reload(); } else setErr(errMsg(e)); }
    finally { setBusy(false); }
  };
  const selCar = cars.find((c) => String(c.id) === car);
  return (
    <div className="safar-plan">
      <div className="safar-hero">
        <Link to="/app" className="icon-btn safar-back" aria-label="Orqaga"><ArrowLeft size={18} /></Link>
        <div className="safar-badge"><Car size={14} />SAFAR</div>
        <h1>Uzoq yo'lga aqlli tayyorgarlik</h1>
        <p>Yo'lingizdagi yoqilg'i, servis va evakuatorlar — oldindan. Avtora yo'l davomida kerakli paytda qisqa eslatadi.</p>
      </div>

      <div className="card safar-form">
        <div className="trip-points">
          <div className="tp-line" aria-hidden />
          <PointRow icon={<span className="tp-dot a" />} label="Qayerdan" value={start} placeholder="Boshlanish nuqtasi"
            onSearch={() => setSearch("start")} onMap={() => setPick("start")} extra={<button className="tp-mini" onClick={useMyLocation} aria-label="Mening joylashuvim"><LocateFixed size={16} /></button>} />
          <PointRow icon={<span className="tp-dot b" />} label="Qayerga" value={dest} placeholder="Borish manzili" onSearch={() => setSearch("dest")} onMap={() => setPick("dest")} />
        </div>
        {locErr && <div className="alert">{locErr}</div>}

        <div className="field"><span>Avtomobil</span>
          {cars.length > 0 ? (
            <select className="select" value={car} onChange={(e) => { setCar(e.target.value); const c = cars.find((x) => String(x.id) === e.target.value); if (c?.fuel_type) setFuel(c.fuel_type); }} aria-label="Avtomobilingizni tanlang">
              {cars.map((c) => <option key={c.id} value={c.id}>{[c.brand, c.model, c.engine].filter(Boolean).join(" ")}</option>)}
              <option value="">Avtomobilsiz</option>
            </select>
          ) : <Link to="/app/cars" className="small link">+ Avtomobilingizni qo'shing — yoqilg'i turi eslab qolinadi</Link>}
        </div>
        <div className="field"><span>Yoqilg'i turi {selCar && !selCar.fuel_type && <em className="xs muted" style={{ fontStyle: "normal" }}>— avtomobilingiz uchun saqlanadi</em>}</span>
          <div className="fuel-pick">{FUELS.map(([k, l, c]) => <button key={k} className={fuel === k ? "on" : ""} style={{ ["--c" as any]: c }} onClick={() => setFuel(k)} aria-pressed={fuel === k}><i />{l}</button>)}</div>
        </div>
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-red btn-lg btn-block safar-go" disabled={!start || !dest || !fuel || busy} onClick={go}>
          {busy ? <><span className="im-spin" />Marshrut va shoxobchalar hisoblanmoqda…</> : !dest ? "Manzilni tanlang" : !fuel ? "Yoqilg'i turini tanlang" : <><Navigation size={18} />SAFARNI BOSHLASH</>}
        </button>
      </div>

      {history.length > 0 && (
        <div className="card">
          <b className="row gap-8"><History size={16} />So'nggi safarlar</b>
          <div className="list mt-8">{history.slice(0, 5).map((t) => (
            <div key={t.id} className="list-row">
              <div className="grow" style={{ minWidth: 0 }}><b className="small ellipsis" translate="no">{t.start.name} → {t.dest.name}</b>
                <div className="xs muted">{new Date(t.started_at).toLocaleDateString()} · {km(t.distance_km)} · {dur(t.elapsed_min)} · {t.status === "finished" ? "yakunlangan" : "bekor qilingan"}</div></div>
              <button className="btn btn-sm btn-ghost" onClick={() => { setStart({ ...t.start }); setDest({ ...t.dest }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Takrorlash</button>
            </div>
          ))}</div>
        </div>
      )}

      {search && <PlaceSearch title={search === "start" ? "Qayerdan?" : "Qayerga borasiz?"} onClose={() => setSearch(null)} onPick={(p) => { search === "start" ? setStart(p) : setDest(p); setSearch(null); }} />}
      {pick && <MapPick title={pick === "start" ? "Boshlanish nuqtasi" : "Borish manzili"} center={(pick === "start" ? start : dest) || start} onClose={() => setPick(null)}
        onPick={(p) => { pick === "start" ? setStart(p) : setDest(p); setPick(null); }} />}
    </div>
  );
}

function PointRow({ icon, label, value, placeholder, onSearch, onMap, extra }: any) {
  return (
    <div className="tp-row">
      {icon}
      <button className="tp-input" onClick={onSearch}>
        <small>{label}</small>
        <b className={value ? "" : "muted"} translate={value ? "no" : undefined}>{value?.name || placeholder}</b>
      </button>
      {extra}
      <button className="tp-mini" onClick={onMap} aria-label="Xaritadan tanlash"><MapPin size={16} /></button>
    </div>
  );
}

function PlaceSearch({ title, onClose, onPick }: { title: string; onClose: () => void; onPick: (p: Pt) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (q.trim().length < 3) { setRes(null); return; }
    const t = setTimeout(() => api.get("/map/geocode/", { params: { q, lang: getLang() } }).then((r) => { setRes(r.data); setErr(""); }).catch((e) => setErr(errMsg(e))), 400);
    return () => clearTimeout(t);
  }, [q]);
  const QUICK = ["Toshkent", "Samarqand", "Buxoro", "Andijon", "Farg'ona", "Namangan", "Qarshi", "Termiz", "Nukus", "Urganch"];
  return (
    <Modal title={title} onClose={onClose}>
      <div className="col gap-12">
        <div className="search"><Search size={17} /><input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Shahar, tuman yoki joy nomi" aria-label="Manzil" /></div>
        {q.trim().length < 3 && <div className="chips" style={{ margin: 0 }}>{QUICK.map((c) => <button key={c} className="chip" onClick={() => setQ(c)}>{c}</button>)}</div>}
        {err && <div className="alert error">{err}</div>}
        {res && res.length === 0 && <p className="small muted">Hech narsa topilmadi. Boshqacha yozib ko'ring.</p>}
        {res && res.length > 0 && <div className="list">{res.map((r, i) => (
          <button key={i} className="list-row" style={{ background: "none", border: 0, width: "100%", textAlign: "left" }} onClick={() => onPick({ lat: r.lat, lng: r.lng, name: r.name })}>
            <span className="ico"><MapPin size={16} /></span>
            <div className="grow" style={{ minWidth: 0 }}><b className="small ellipsis" translate="no">{r.name}</b><div className="xs muted ellipsis" translate="no">{r.address}</div></div>
          </button>))}</div>}
      </div>
    </Modal>
  );
}

function MapPick({ title, center, onClose, onPick }: { title: string; center: Pt | null; onClose: () => void; onPick: (p: Pt) => void }) {
  const [pt, setPt] = useState<[number, number] | null>(center ? [center.lat, center.lng] : null);
  const c: [number, number] = center ? [center.lat, center.lng] : [41.3, 64.6];
  return (
    <Modal title={title} onClose={onClose}>
      <div className="col gap-12">
        <p className="xs muted" style={{ margin: 0 }}>Xaritada kerakli joyni bosing</p>
        <MapView center={c} zoom={center ? 12 : 6} className="map-box pick-map" onPick={(lat, lng) => setPt([lat, lng])}
          pins={pt ? [{ id: "p", lat: pt[0], lng: pt[1], color: "#ee2b2f", label: "●", title: "Tanlangan joy" }] : []} />
        <button className="btn btn-lg btn-block" disabled={!pt} onClick={() => pt && onPick({ lat: pt[0], lng: pt[1], name: `Xaritadagi nuqta (${pt[0].toFixed(3)}, ${pt[1].toFixed(3)})` })}>
          <Check size={16} />Shu joyni tanlash</button>
      </div>
    </Modal>
  );
}

/* ================= 2. Faol safar ================= */
function Active({ trip, onFinished }: { trip: any; onFinished: (s: any) => void }) {
  const toast = useToast();
  const [dash, setDash] = useState<any>(trip.dashboard);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [gpsErr, setGpsErr] = useState("");
  const [st, setSt] = useState<any>(trip.settings);
  const [panel, setPanel] = useState<null | "alerts">(null);
  const [history, setHistory] = useState<any[]>(trip.notifications || []);
  const [bubble, setBubble] = useState<string>("");
  const [follow, setFollow] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [stops, setStops] = useState<number>(trip.fuel_stops || 0);
  const last = useRef<{ t: number; lat: number; lng: number } | null>(null);
  const bubbleT = useRef<any>(null);

  const announce = (said: any[]) => {
    if (!said?.length) return;
    setHistory((h) => [...h, ...said]);
    const main = said.find((s: any) => s.speak) || said[0];
    setBubble(main.message);
    clearTimeout(bubbleT.current); bubbleT.current = setTimeout(() => setBubble(""), 7000);
    if (main.speak && st?.voice) speak(main.message);
  };
  useEffect(() => { announce(trip.said); }, []);

  // GPS: faqat ruxsat bo'lsa; serverga 15 soniyada yoki 150 m siljiganda bir marta
  useEffect(() => {
    if (!navigator.geolocation) { setGpsErr("Qurilmada GPS yo'q — eslatmalar ishlamaydi."); return; }
    const id = navigator.geolocation.watchPosition((p) => {
      const c: [number, number] = [p.coords.latitude, p.coords.longitude];
      setMe(c); setGpsErr("");
      const now = Date.now(), prev = last.current;
      const moved = prev ? L.latLng(prev.lat, prev.lng).distanceTo(L.latLng(c[0], c[1])) : 1e9;
      if (prev && now - prev.t < 15000 && moved < 150) return;
      last.current = { t: now, lat: c[0], lng: c[1] };
      api.post(`/trips/${trip.id}/progress/`, { lat: c[0], lng: c[1], accuracy: p.coords.accuracy })
        .then((r) => { setDash(r.data.dashboard); announce(r.data.said); }).catch(() => {});
    }, (e) => setGpsErr(e.code === 1 ? "📍 Joylashuvga ruxsat berilmagan. Aniq eslatmalar uchun brauzer sozlamalarida joylashuvga ruxsat bering." : "GPS signal yo'q. Ochiq joyga chiqing — signal tiklanishi bilan eslatmalar davom etadi."),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  // ekran o'chib qolmasin (qo'llansa)
  useEffect(() => {
    let lock: any = null;
    const req = () => (navigator as any).wakeLock?.request?.("screen").then((l: any) => { lock = l; }).catch(() => {});
    req(); const v = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", v);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { lock?.release?.(); document.removeEventListener("visibilitychange", v); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const saveSt = (patch: any) => { const n = { ...st, ...patch }; setSt(n); api.put("/trips/settings/", n).catch(() => toast("Sozlama saqlanmadi", "error")); if (patch.voice === false) window.speechSynthesis?.cancel(); };
  const finish = async () => {
    if (!confirm("Safarni yakunlaysizmi?")) return;
    window.speechSynthesis?.cancel();
    try { const r = await api.post(`/trips/${trip.id}/finish/`); onFinished(r.data); } catch (e) { toast(errMsg(e), "error"); }
  };
  const fuelStop = async () => { try { const r = await api.post(`/trips/${trip.id}/fuel-stop/`); setStops(r.data.fuel_stops); toast("Belgilandi — yo'lingiz bexatar bo'lsin", "success"); } catch (e) { toast(errMsg(e), "error"); } };
  const pref = dash?.next?.[trip.fuel];
  const [map, setMap] = useState<L.Map | null>(null);

  return (
    <div className="safar-live">
      <div className="sl-map">
        <MapContainer center={[trip.start.lat, trip.start.lng]} zoom={11} style={{ height: "100%", width: "100%" }} zoomControl={false} ref={setMap}>
          <BaseTiles />
          <TripLayer trip={trip} me={me} follow={follow} onUserMove={() => setFollow(false)} pref={trip.fuel} passedKm={dash?.progress_km || 0} />
        </MapContainer>
        <MapChrome map={map} onLocate={() => setFollow(true)} locateLabel="Meni kuzatish" locateActive={follow} />
        <div className="sl-top">
          <div className="sl-title" translate="no"><b>{trip.start.name.split(",")[0]} → {trip.dest.name.split(",")[0]}</b><span>{dash?.percent ?? 0}%</span></div>
          <div className="sl-prog"><i style={{ width: `${dash?.percent ?? 0}%` }} /></div>
        </div>
        {bubble && <div className="sl-bubble" role="status" aria-live="polite"><Volume2 size={16} /><span><small>Avtora Assistant</small>{bubble}</span></div>}
        {(gpsErr || !online || dash?.off_route) && <div className="sl-warn">{!online ? "Internet yo'q — eslatmalar aloqa tiklanganda davom etadi." : gpsErr || "Marshrutdan chetdasiz — yo'lga qayting yoki yangi safar tuzing."}</div>}
      </div>

      <div className="sl-sheet">
        <div className="sl-main">
          <div className="sl-big"><small>Qolgan masofa</small><b>{km(dash?.remaining_km)}</b><span>{dur(dash?.eta_min)}</span></div>
          <div className="sl-big fuel" style={{ ["--c" as any]: color(trip.fuel) }}><small>Keyingi {fname(trip.fuel).toLowerCase()}</small>
            <b>{pref ? km(pref.km) : "Yo'q"}</b><span className="ellipsis" translate="no">{pref ? stationTitle(pref, trip.fuel) : "Yo'lda topilmadi"}</span></div>
        </div>
        <div className="sl-chips">
          {FUELS.filter(([k]) => k !== trip.fuel && dash?.next?.[k]).slice(0, 3).map(([k, l, c]) => <span key={k} style={{ ["--c" as any]: c }}><i />{l} {km(dash.next[k].km)}</span>)}
          {dash?.next_service && <span><Wrench size={13} />Servis {km(dash.next_service.km)}</span>}
          {dash?.next_evak && <span>🚛 Evakuator {km(dash.next_evak.km)}</span>}
        </div>
        <div className="sl-actions">
          <button onClick={() => setPanel("alerts")} aria-label="Eslatmalar">{st?.enabled ? <Bell size={20} /> : <BellOff size={20} />}<span>Eslatmalar</span></button>
          <button onClick={() => saveSt({ voice: !st?.voice })} aria-pressed={!!st?.voice}>{st?.voice ? <Volume2 size={20} /> : <VolumeX size={20} />}<span>{st?.voice ? "Ovoz yoqiq" : "Ovoz o'chiq"}</span></button>
          <button onClick={fuelStop}><Fuel size={20} /><span>Yoqilg'i oldim{stops ? ` · ${stops}` : ""}</span></button>
          <button className="stop" onClick={finish}><Square size={18} /><span>Yakunlash</span></button>
        </div>
      </div>

      {panel === "alerts" && (
        <Modal title="Safar eslatmalari" onClose={() => setPanel(null)}>
          <div className="col gap-8">
            {[["enabled", "Safar eslatmalari", "Barcha SAFAR xabarlari"], ["voice", "AI ovozli yordamchi", voiceInfo()], ["fuel_alerts", "Yoqilg'i AI", "Keyingi shoxobcha va uzoq bo'shliqlar"],
              ["safety_alerts", "Xavfsizlik AI", "Uzoq yo'l va dam olish"], ["periodic", `${st?.interval_min || 20} daqiqalik eslatma`, "Muhim xabar aytilgan bo'lsa o'tkazib yuboriladi"]].map(([k, l, d]) => (
              <label key={k} className="sw-row"><div className="grow"><b className="small">{l}</b><div className="xs muted">{d}</div></div>
                <input type="checkbox" className="switch" checked={!!st?.[k]} onChange={(e) => saveSt({ [k]: e.target.checked })} disabled={k !== "enabled" && !st?.enabled} /></label>
            ))}
            <label className="sw-row"><div className="grow"><b className="small">Davriy eslatma oralig'i</b></div>
              <select className="select" style={{ width: "auto" }} value={st?.interval_min || 20} onChange={(e) => saveSt({ interval_min: Number(e.target.value) })}>{[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} daq</option>)}</select></label>
            {st?.voice && <button className="btn btn-sm btn-ghost" onClick={() => { if (!speak(pref ? `Keyingi ${fname(trip.fuel).toLowerCase()} ${km(pref.km)} dan keyin.` : "Avtora yordamchisi ishlayapti.")) toast("Bu qurilmada mos ovoz topilmadi", "error"); }}><Volume2 size={15} />Ovozni sinash</button>}
            <b className="small mt-8">Xabarlar tarixi</b>
            {history.filter((h) => h.message !== "(o'tkazib yuborildi)").length === 0 ? <p className="xs muted">Hali xabar yo'q.</p> : (
              <ol className="trip-log">{[...history].reverse().filter((h) => h.message !== "(o'tkazib yuborildi)").map((h) => <li key={h.id}><span className={"k " + h.kind} /><div><span className="small">{h.message}</span><small className="muted">{new Date(h.created_at).toLocaleTimeString().slice(0, 5)}</small></div></li>)}</ol>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

const iconCache: Record<string, L.DivIcon> = {};
const stIcon = (f: string, big: boolean, passed: boolean) => {
  const k = `${f}${big}${passed}`;
  return (iconCache[k] ||= L.divIcon({ className: "", html: `<div class="tpin${big ? " big" : ""}${passed ? " passed" : ""}" style="background:${color(f)}">⛽</div>`, iconSize: big ? [32, 32] : [24, 24], iconAnchor: big ? [16, 16] : [12, 12] }));
};
const svcIcon = (k: string) => markerIcon({ kind: k === "usta" ? "usta" : "evakuator" });
const endIcon = (a: boolean) => (iconCache["e" + a] ||= L.divIcon({ className: "", html: `<div class="tend ${a ? "a" : "b"}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] }));

function TripLayer({ trip, me, follow, onUserMove, pref, passedKm }: any) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => { if (!fitted.current && trip.route?.length) { map.fitBounds(L.latLngBounds(trip.route), { padding: [30, 30] }); fitted.current = true; } }, []);
  useEffect(() => { if (follow && me) map.setView(me, Math.max(map.getZoom(), 14), { animate: true }); }, [me?.[0], me?.[1], follow]);
  useEffect(() => { const h = () => onUserMove(); map.on("dragstart", h); return () => { map.off("dragstart", h); }; }, []);
  const sts = useMemo(() => trip.stations || [], [trip.id]);
  return <>
    <Polyline positions={trip.route} pathOptions={{ color: "#0a1424", weight: 9, opacity: .18, lineCap: "round" }} />
    <Polyline positions={trip.route} pathOptions={{ color: "#1f6feb", weight: 5, opacity: .95, lineCap: "round", className: "route-line" }} />
    <Marker position={[trip.start.lat, trip.start.lng]} icon={endIcon(true)} title="Boshlanish" alt="Boshlanish" />
    <Marker position={[trip.dest.lat, trip.dest.lng]} icon={endIcon(false)} title="Manzil" alt="Manzil" />
    {sts.map((s: any) => { const f = s.fuels.includes(pref) ? pref : s.fuels[0] || "benzin"; return (
      <Marker key={s.id} position={[s.lat, s.lng]} icon={stIcon(f, f === pref, s.along_km < passedKm)} title={s.name} alt={s.name} zIndexOffset={f === pref ? 500 : 0} />); })}
    {(trip.services || []).map((s: any) => <Marker key={s.kind + s.id} position={[s.lat, s.lng]} icon={svcIcon(s.kind)} title={s.name} alt={s.name} />)}
    {me && <Marker position={me} icon={meIcon} title="Siz shu yerdasiz" alt="Siz shu yerdasiz" zIndexOffset={1000} />}
  </>;
}

/* ================= 3. Safar yakuni ================= */
function Summary({ s, onClose }: { s: any; onClose: () => void }) {
  const x = s.summary || {};
  return (
    <div className="safar-plan">
      <div className="card safar-done">
        <div className="sd-flag"><Flag size={28} /></div>
        <h2>Safar yakunlandi</h2>
        <div className="sd-route" translate="no"><span>{x.start}</span><i /><span>{x.dest}</span></div>
        <div className="sd-grid">
          <div><small>Masofa</small><b>{km(x.travelled_km || x.distance_km)}</b></div>
          <div><small>Davomiyligi</small><b>{dur(x.duration_min)}</b></div>
          <div><small>Yoqilg'i to'xtashlari</small><b>{x.fuel_stops ?? 0} ta</b></div>
          <div><small>Eslatmalar</small><b>{x.notifications ?? 0} ta</b></div>
        </div>
        <button className="btn btn-lg btn-block" onClick={onClose}>Yangi safar</button>
        <Link to="/app" className="btn btn-ghost btn-block">Bosh sahifa</Link>
      </div>
    </div>
  );
}
