/** Avtoservis sahifasi bo'laklari: qulayliklar, servis rasmlari galereyasi, reyting statistikasi, sharhga javob. */
import { useRef, useState } from "react";
import { Armchair, Coffee, Cpu, CreditCard, Droplets, Package, ParkingCircle, Reply, ShieldCheck, Star, Truck, Wifi } from "lucide-react";
import { api, errMsg, media } from "../api";
import { useToast } from "./ui";

export const AMENITIES: Record<string, [string, any]> = {
  kutish_zali: ["Kutish zali", Armchair], wifi: ["Wi-Fi", Wifi], choy: ["Choy / qahva", Coffee], kafolat: ["Ish uchun kafolat", ShieldCheck],
  karta: ["Karta orqali to'lov", CreditCard], parking: ["Avtoturargoh", ParkingCircle], zapchast: ["Ehtiyot qismlar joyida", Package],
  uskuna: ["Zamonaviy uskunalar", Cpu], evakuator: ["Evakuator xizmati", Truck], yuvish: ["Avtomoyka", Droplets],
};

export function AmenityList({ items }: { items: string[] }) {
  return (
    <div className="amen-grid">
      {items.filter((k) => AMENITIES[k]).map((k) => { const [l, I] = AMENITIES[k]; return <span key={k} className="amen"><I size={17} />{l}</span>; })}
    </div>
  );
}

/** Servis rasmlari: suriladigan galereya (telefonda barmoq bilan), raqam ko'rsatkichi bilan. */
export function PlaceGallery({ photos, onOpen }: { photos: any[]; onOpen: (p: any) => void }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const onScroll = () => { const el = ref.current; if (el) setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); };
  return (
    <div className="place-gal">
      <div className="place-track" ref={ref} onScroll={onScroll}>
        {photos.map((p) => <button key={p.id} type="button" onClick={() => onOpen(p)} aria-label={p.caption || "Servis rasmi"}><img src={media(p.image)} alt={p.caption || ""} loading="lazy" />{p.caption && <span>{p.caption}</span>}</button>)}
      </div>
      {photos.length > 1 && <b className="place-count">{i + 1} / {photos.length}</b>}
    </div>
  );
}

export function RatingSummary({ rating, s }: { rating: number; s: any }) {
  if (!s?.total) return null;
  const max = Math.max(1, ...Object.values<number>(s.dist));
  return (
    <div className="rs">
      <div className="rs-main">
        <b>{(rating || 0).toFixed(1)}</b>
        <span className="rs-stars">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={15} fill={n <= Math.round(rating) ? "#f5a623" : "none"} color="#f5a623" />)}</span>
        <span className="xs muted">{s.total} ta baho</span>
      </div>
      <div className="rs-bars">
        {["5", "4", "3", "2", "1"].map((k) => (
          <div key={k} className="rs-bar"><span className="xs">{k}</span><i><em style={{ width: `${(s.dist[k] / max) * 100}%` }} /></i><span className="xs muted">{s.dist[k]}</span></div>
        ))}
      </div>
      {Object.keys(s.criteria || {}).length > 0 && (
        <div className="rs-crit">
          {Object.entries<any>(s.criteria).map(([k, c]) => <div key={k}><span className="xs muted">{c.label}</span><b className="small"><Star size={12} fill="#f5a623" strokeWidth={0} /> {c.avg.toFixed(1)}</b></div>)}
        </div>
      )}
      {s.tags?.length > 0 && <div className="rs-tags">{s.tags.map(([t, n]: [string, number]) => <span key={t} className="tag-pill">{t} <em>{n}</em></span>)}</div>}
    </div>
  );
}

/** Ustaning javobi (ko'rsatish) va usta uchun — javob yozish / tahrirlash. */
export function ReviewReply({ r, canReply, onSaved }: { r: any; canReply: boolean; onSaved: (r: any) => void }) {
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(r.reply || "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { const x = await api.post(`/masters/reviews/${r.id}/reply/`, { text: text.trim() }); onSaved(x.data); setEdit(false); toast(text.trim() ? "Javob joylandi" : "Javob o'chirildi", "success"); }
    catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  };
  if (edit) return (
    <div className="col gap-8 mt-8">
      <textarea className="textarea" rows={2} maxLength={600} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Mijozga rahmat ayting yoki vaziyatni tushuntiring" />
      <div className="row gap-8"><button className="btn btn-sm" disabled={busy} onClick={save}>Saqlash</button><button className="btn btn-sm btn-ghost" onClick={() => { setEdit(false); setText(r.reply || ""); }}>Bekor</button></div>
    </div>
  );
  return (
    <>
      {r.reply && <div className="rev-reply"><b className="xs"><Reply size={12} /> Ustaning javobi</b><p className="small" translate="no">{r.reply}</p></div>}
      {canReply && <button className="link xs mt-4" style={{ background: "none", border: 0, padding: 0 }} onClick={() => setEdit(true)}>{r.reply ? "Javobni tahrirlash" : "Javob yozish"}</button>}
    </>
  );
}
