import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Cpu, LocateFixed, MapPin, MessageCircle, Phone, Share2, Truck, Wrench } from "lucide-react";
import { api, errMsg } from "../../api";
import MapView, { Pin } from "../../components/MapView";
import { useSite } from "../../site";
import { Spinner, useToast } from "../../components/ui";
import { money, TASHKENT, useGeo, usePoll } from "../../utils";
import { accText, geoErrorText, getPreciseLocation } from "../../geo";

const KINDS = [
  { k: "evakuator", t: "Evakuator", s: "Avtomobilingizni olib ketish", icon: Truck },
  { k: "tezkor_usta", t: "Tezkor usta", s: "Joyida zudlik bilan yordam", icon: Wrench },
  { k: "diagnostika", t: "Diagnostika", s: "Ko'chma kompyuter diagnostikasi", icon: Cpu },
];
const ACTIVE = ["searching", "accepted", "on_the_way", "arrived"];
const FLOW = [["searching", "So'rov yuborildi"], ["accepted", "Haydovchi qabul qildi"], ["on_the_way", "Yo'lga chiqdi"], ["arrived", "Yetib keldi"], ["completed", "Xizmat yakunlandi"]];

export default function Sos() {
  const [sp] = useSearchParams();
  const [active, setActive] = useState<any>(undefined);
  const load = () => api.get("/sos/").then((r) => {
    const id = sp.get("id");
    setActive(r.data.find((s: any) => (id ? String(s.id) === id && ACTIVE.includes(s.status) : ACTIVE.includes(s.status))) || null);
  });
  useEffect(() => { load(); }, []);
  if (active === undefined) return <Spinner />;
  return active ? <Tracking initial={active} onDone={() => setActive(null)} /> : <CreateSos initialKind={sp.get("kind") || "evakuator"} onCreated={setActive} />;
}

function CreateSos({ initialKind, onCreated }: { initialKind: string; onCreated: (s: any) => void }) {
  const site = useSite();
  const geo = useGeo();
  const toast = useToast();
  const [kind, setKind] = useState(initialKind);
  const [pick, setPick] = useState<[number, number] | null>(null);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [cars, setCars] = useState<any[]>([]);
  const [vehicle, setVehicle] = useState("");
  useEffect(() => { api.get("/garage/vehicles/").then((r) => { setCars(r.data); if (r.data[0]) setVehicle(String(r.data[0].id)); }); }, []);
  // GPS hali aniqlanmagan bo'lsa — nuqta YO'Q (Toshkent markazi hech qachon SOS sifatida yuborilmaydi)
  const point: [number, number] | null = pick || (geo.real ? [geo.lat, geo.lng] : null);
  const [locBusy, setLocBusy] = useState(false);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let at = point;
      // xaritada qo'lda tanlanmagan va GPS hali yetarlicha aniq emas — bir necha soniya aniqroq nuqtani kutamiz
      if (!pick && (!geo.real || geo.accuracy == null || geo.accuracy > 30)) {
        setLocBusy(true);
        try {
          const f = await getPreciseLocation({ desired: 30, maxWait: geo.real ? 6000 : 12000 });
          if (!geo.real || geo.accuracy == null || f.accuracy <= geo.accuracy) { at = [f.lat, f.lng]; geo.set(f.lat, f.lng, f.accuracy); }
        } catch (e: any) {
          if (!at) { toast(geoErrorText(e) + " Xaritada turgan joyingizni bosing va SOS ni qayta bosing.", "error"); return; }
        } finally { setLocBusy(false); }
      }
      if (!at) { toast("Joylashuvingiz aniqlanmadi. Xaritada turgan joyingizni bosing va SOS ni qayta bosing.", "error"); return; }
      const r = await api.post("/sos/", { kind, lat: at[0], lng: at[1], address, note, vehicle: vehicle || undefined });
      toast("So'rov yuborildi! Eng yaqin yordamchilar xabardor qilindi.", "success"); onCreated(r.data);
    }
    catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  };

  return (
    <div className="sos-screen col gap-16" style={{ maxWidth: 760 }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 26 }}>Favqulodda yordam kerakmi?</h2>
        <p className="small" style={{ color: "#aab5c9" }}>Tez yordam chaqirish orqali sizga eng yaqin xizmat ko'rsatuvchilarni yuboramiz.</p>
      </div>
      <button className={"sos-big" + (busy ? " pulse" : "")} onClick={send} disabled={busy} aria-label="SOS yuborish">{locBusy ? "📍" : "SOS"}</button>
      <div className="col gap-8">
        {KINDS.map((k) => (
          <button key={k.k} className={"sos-option" + (kind === k.k ? " active" : " alt")} onClick={() => setKind(k.k)}>
            <span className="sico"><k.icon size={22} /></span>
            <div className="grow"><b>{k.t}</b><div className="small" style={{ color: "#aab5c9" }}>{k.s}</div></div>
            {kind === k.k && <Check size={20} />}
          </button>
        ))}
      </div>
      <div className="col gap-8">
        <div className="row between"><b className="row gap-8"><MapPin size={18} />Lokatsiya</b>
          <button className="btn btn-sm btn-ghost" style={{ color: "#fff" }} onClick={() => { setPick(null); geo.refresh(); }}><LocateFixed size={14} />GPS</button></div>
        <div className="small" style={{ color: geo.accuracy != null && geo.accuracy > 100 && !pick ? "#ffb4a8" : "#aab5c9" }}>
          {pick ? "📍 Xaritada tanlangan nuqta" : geo.error && !geo.real ? geo.error
            : geo.real ? <>📍 GPS orqali aniqlandi ({accText(geo.accuracy)}){geo.locating && " — aniqlashtirilmoqda…"}{geo.accuracy != null && geo.accuracy > 100 && " — aniqlik past, xaritada joyingizni bosib belgilang"}</>
            : "📍 Joylashuv aniqlanmoqda…"} {!pick && "Xaritaga bosib aniq joyni belgilashingiz mumkin."}
        </div>
        <MapView center={point || TASHKENT} me={point} accuracy={pick ? null : geo.accuracy} zoom={point ? 16 : 12} onPick={(a, b) => setPick([a, b])} follow
          onLocate={(lat, lng, acc) => { setPick(null); geo.set(lat, lng, acc); }} className="map-box" />
      </div>
      <div className="dark-form col gap-8">
        <label className="field"><span>Manzil / mo'ljal</span><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Masalan: Chilonzor, Bunyodkor ko'chasi, Makro yonida" /></label>
        {cars.length > 0 && <label className="field"><span>Avtomobil</span><select className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>{cars.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.model} {c.plate}</option>)}<option value="">—</option></select></label>}
        <label className="field"><span>Muammo</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Akkumulyator o'tirib qoldi, g'ildirak teshildi…" /></label>
      </div>
      <button className="btn btn-red btn-lg btn-block" onClick={send} disabled={busy}><Phone size={18} />{locBusy ? "Joylashuv aniqlanmoqda…" : busy ? "Yuborilmoqda…" : "Yordam chaqirish"}</button>
      <p className="xs" style={{ textAlign: "center", color: "#7d8aa3" }}>Hayotga xavf bo'lsa darhol <a href="tel:112" style={{ textDecoration: "underline" }}>112</a> ga qo'ng'iroq qiling.{site.support_phone && <> Avtora yordam: <a href={`tel:${site.support_phone.replace(/\s/g, "")}`} style={{ textDecoration: "underline" }}>{site.support_phone}</a></>}</p>
    </div>
  );
}

function Tracking({ initial, onDone }: { initial: any; onDone: () => void }) {
  const nav = useNavigate();
  const toast = useToast();
  const [s, setS] = useState<any>(initial);
  usePoll(() => { api.get(`/sos/${initial.id}/`).then((r) => setS(r.data)).catch(() => {}); }, 5000, [initial.id]);
  const idx = FLOW.findIndex(([k]) => k === s.status);
  const cancel = async () => { if (!confirm("So'rovni bekor qilasizmi?")) return; try { await api.post(`/sos/${s.id}/cancel/`); toast("Bekor qilindi"); onDone(); } catch (e) { toast(errMsg(e), "error"); } };
  const chat = async () => { const r = await api.post("/chat/start/", { user_id: s.assignee.id }); nav(`/app/chat/${r.data.id}`); };
  const a = s.assignee;
  const shareLoc = async () => {
    const url = `https://maps.google.com/?q=${s.lat},${s.lng}`;
    const text = `🆘 Menga yo'lda yordam kerak (${s.kind_label}). Joylashuvim: ${url}`;
    if (navigator.share) { try { await navigator.share({ title: "SOS", text }); } catch { /* bekor */ } }
    else window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
  };
  const pins: Pin[] = a?.lat ? [{ id: "a", lat: a.lat, lng: a.lng, kind: a.role === "usta" ? "usta" : "evakuator", avatar: a.avatar || null, title: "Yordamchi" }] : [];
  const closed = !ACTIVE.includes(s.status);

  return (
    <div className="sos-screen col gap-16" style={{ maxWidth: 760 }}>
      <div className="row between"><div><div className="xs" style={{ color: "#aab5c9" }}>#AS{100000 + s.id} · {s.kind_label}</div><h2 style={{ fontSize: 22 }}>{s.status === "searching" ? "Yordamchi qidirilmoqda…" : s.status_label}</h2></div>
        {s.status === "searching" && <span className="sos-big pulse" style={{ width: 54, height: 54, margin: 0, fontSize: 13 }}>SOS</span>}</div>
      <MapView center={[s.lat, s.lng]} me={[s.lat, s.lng]} pins={pins} line={a?.lat ? [[a.lat, a.lng], [s.lat, s.lng]] : undefined} zoom={13} className="map-box" />
      {a && (
        <div className="row gap-12" style={{ background: "rgba(255,255,255,.06)", borderRadius: 16, padding: 14 }}>
          <div className="grow"><b>{a.full_name}</b><div className="small" style={{ color: "#aab5c9" }}>{s.truck || "Usta"} · {a.phone}</div>
            <div className="small mt-4">{s.distance_km != null && <>Masofa: <b>{s.distance_km} km</b> · </>}Narx: <b>{s.price ? money(s.price) : "kelishiladi"}</b></div></div>
          <a className="icon-btn" href={`tel:${a.phone}`} aria-label="Qo'ng'iroq"><Phone size={18} /></a>
          <button className="icon-btn" onClick={chat} aria-label="Chat"><MessageCircle size={18} /></button>
        </div>
      )}
      <div className="steps">
        {FLOW.map(([k, l], i) => <div key={k} className={"step" + (i < idx || s.status === "completed" ? " done" : i === idx ? " now" : "")}><span className="dot">{(i < idx || s.status === "completed") && <Check size={12} />}</span><div className="small">{l}</div></div>)}
      </div>
      {!closed && <button className="btn btn-ghost btn-block" style={{ color: "#fff" }} onClick={shareLoc}><Share2 size={16} />Joylashuvni yaqinlarga yuborish</button>}
      {s.status === "completed" && a && !s.rating && <RateSos s={s} onRated={(r) => setS({ ...s, rating: r })} />}
      {closed ? <button className="btn btn-lg btn-block" onClick={onDone}>Yangi so'rov</button> : ["searching", "accepted"].includes(s.status) && <button className="btn btn-ghost btn-block" style={{ color: "#fff" }} onClick={cancel}>So'rovni bekor qilish</button>}
    </div>
  );
}

function RateSos({ s, onRated }: { s: any; onRated: (r: number) => void }) {
  const toast = useToast();
  const send = async (r: number) => { try { await api.post(`/sos/${s.id}/review/`, { rating: r }); toast("Rahmat! Bahoingiz qabul qilindi.", "success"); onRated(r); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <div style={{ textAlign: "center", background: "rgba(255,255,255,.06)", borderRadius: 16, padding: 14 }}>
      <b className="small">{s.assignee.full_name} xizmatini baholang</b>
      <div className="row gap-8 mt-8" style={{ justifyContent: "center" }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => send(n)} style={{ background: "none", border: 0, fontSize: 30, color: "#f5a623" }} aria-label={`${n} yulduz`}>★</button>)}</div>
    </div>
  );
}
