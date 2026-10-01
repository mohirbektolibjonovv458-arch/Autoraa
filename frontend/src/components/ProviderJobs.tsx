import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import MapView from "./MapView";
import { Empty, StatusBadge, useToast } from "./ui";
import { money, timeAgo, useGeo, usePoll } from "../utils";

const NEXT: Record<string, [string, string]> = { accepted: ["on_the_way", "Yo'lga chiqdim"], on_the_way: ["arrived", "Yetib keldim"], arrived: ["completed", "Yakunlash"] };

/** Usta va evakuator uchun SOS so'rovlarini qabul qilish va bajarish */
export default function ProviderJobs({ onChange }: { onChange?: () => void }) {
  const { user } = useAuth();
  const geo = useGeo(true);
  const nav = useNavigate();
  const toast = useToast();
  const [avail, setAvail] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<number, string>>({});

  const load = () => {
    api.get("/sos/available/").then((r) => setAvail(r.data)).catch(() => {});
    api.get("/sos/assigned/", { params: { active: 1 } }).then((r) => setActive(r.data)).catch(() => {});
  };
  usePoll(load, 7000, []);

  const accept = async (s: any) => {
    try { await api.post(`/sos/${s.id}/accept/`, prices[s.id] ? { price: prices[s.id] } : {}); toast("Qabul qilindi! Mijozga xabar yuborildi.", "success"); load(); onChange?.(); }
    catch (e) { toast(errMsg(e), "error"); load(); }
  };
  const step = async (s: any, status: string) => {
    if (status === "cancelled" && !confirm("Buyurtmadan voz kechasizmi? U boshqa haydovchilarga qaytadi.")) return;
    try { await api.post(`/sos/${s.id}/status/`, { status }); load(); onChange?.(); } catch (e) { toast(errMsg(e), "error"); }
  };
  const chat = async (uid: number) => { const r = await api.post("/chat/start/", { user_id: uid }); nav(`/app/chat/${r.data.id}`); };

  return (
    <div className="col gap-16">
      {!user?.is_online && <div className="alert warn">Siz hozir <b>offline</b>siz. Yangi SOS so'rovlar haqida xabar olish uchun yuqoridagi «Offline» tugmasini bosib online bo'ling.</div>}

      {active.map((s) => (
        <div key={s.id} className="card col gap-12" style={{ borderColor: "var(--red)" }}>
          <div className="row between"><b>Faol buyurtma · {s.kind_label}</b><StatusBadge status={s.status} label={s.status_label} /></div>
          <MapView center={[s.lat, s.lng]} me={[geo.lat, geo.lng]} pins={[{ id: s.id, lat: s.lat, lng: s.lng, color: "#ee2b2f", label: "!" }]} line={[[geo.lat, geo.lng], [s.lat, s.lng]]} zoom={13} className="map-box" />
          <div className="row gap-12 wrap">
            <div className="grow"><b>{s.client.full_name}</b><div className="small muted">{s.client.phone}</div><div className="small row gap-4 mt-4"><MapPin size={14} />{s.address || `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}</div>
              {s.note && <div className="small mt-4">«{s.note}»</div>}{s.vehicle_title && <div className="xs muted">{s.vehicle_title}</div>}</div>
            <div style={{ textAlign: "right" }}><div className="xs muted">Narx</div><b>{s.price ? money(s.price) : "Kelishiladi"}</b></div>
          </div>
          <div className="row gap-8 wrap">
            <a className="btn btn-sm btn-ghost" href={`tel:${s.client.phone}`}><Phone size={14} />Qo'ng'iroq</a>
            <button className="btn btn-sm btn-ghost" onClick={() => chat(s.client.id)}><MessageCircle size={14} />Chat</button>
            <a className="btn btn-sm btn-ghost" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}><Navigation size={14} />Navigator</a>
            <div className="grow" />
            {["accepted", "on_the_way"].includes(s.status) && <button className="btn btn-sm btn-danger-soft" onClick={() => step(s, "cancelled")}>Rad etish</button>}
            {NEXT[s.status] && <button className={"btn btn-sm " + (s.status === "arrived" ? "btn-green" : "")} onClick={() => step(s, NEXT[s.status][0])}>{NEXT[s.status][1]}</button>}
          </div>
        </div>
      ))}

      <div className="section-head"><h3>Yaqin atrofdagi so'rovlar ({avail.length})</h3></div>
      {avail.length === 0 ? <Empty title="Hozircha so'rov yo'q" text="Yangi SOS kelganda shu yerda va Telegramda ko'rasiz." /> : avail.map((s) => (
        <div key={s.id} className="order-card col gap-8">
          <div className="row between"><b>{s.kind_label}</b><span className="xs muted">{timeAgo(s.created_at)}</span></div>
          <div className="small">{s.client.full_name}{s.vehicle_title && ` · ${s.vehicle_title}`}</div>
          <div className="small muted row gap-4"><MapPin size={13} />{s.address || "Xaritada belgilangan"}{s.distance_km != null && <b style={{ color: "var(--ink)" }}> · {s.distance_km} km</b>}</div>
          {s.note && <div className="small">«{s.note}»</div>}
          <div className="row gap-8">
            <input className="input" style={{ maxWidth: 170 }} type="number" placeholder={user?.role === "evakuator" ? "Narx (avto)" : "Narx, so'm"} value={prices[s.id] || ""} onChange={(e) => setPrices({ ...prices, [s.id]: e.target.value })} />
            <button className="btn btn-green grow" disabled={active.length > 0} onClick={() => accept(s)}>Qabul qilish</button>
          </div>
        </div>
      ))}
    </div>
  );
}
