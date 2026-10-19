/**
 * Baho berish: umumiy yulduz + (usta xizmati uchun) mezonlar, tez teglar, izoh va rasmlar.
 * RatePrompt — ish tugagach ilova ochilganda o'zi «ishni baholang» deb so'raydi (bir marta, «Keyinroq» bilan yopiladi).
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Star } from "lucide-react";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import { Avatar, Modal, useToast } from "./ui";

export const RATE_WORDS = ["", "Juda yomon", "Yomon", "O'rtacha", "Yaxshi", "A'lo!"];
const DEF_TAGS = ["Sifatli ish", "Tez bajarildi", "Halol narx", "Muloyim", "Tushuntirib berdi", "Toza ishladi", "Kafolat berdi", "Vaqtida qabul qildi"];
const DEF_CRIT: Record<string, string> = { quality: "Ish sifati", price_fair: "Narx", on_time: "Vaqtida", politeness: "Muomala" };

function StarRow({ value, onChange, size = 34, label }: { value: number; onChange: (n: number) => void; size?: number; label: string }) {
  return (
    <div className="rate-stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(n)} aria-label={`${label}: ${n}`}>
          <Star size={size} fill={n <= value ? "#f5a623" : "none"} color="#f5a623" strokeWidth={1.6} />
        </button>
      ))}
    </div>
  );
}

export type ReviewTarget = { id: number; type: "booking" | "sos" | "part"; party: string; service?: string; avatar?: string | null };

export function ReviewModal({ order, onClose, onDone }: { order: ReviewTarget; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [crit, setCrit] = useState<Record<string, number>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [opts, setOpts] = useState<{ tags: string[]; criteria: Record<string, string> }>({ tags: DEF_TAGS, criteria: DEF_CRIT });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isBooking = order.type === "booking";
  useEffect(() => { if (isBooking) api.get("/masters/review-options/").then((r) => setOpts(r.data)).catch(() => {}); }, [isBooking]);
  const send = async () => {
    if (!rating) { setErr("Yulduzni tanlang"); return; }
    const url = isBooking ? `/masters/bookings/${order.id}/review/` : order.type === "sos" ? `/sos/${order.id}/review/` : `/parts/orders/${order.id}/review/`;
    setBusy(true); setErr("");
    try {
      if (isBooking) {
        const fd = new FormData();
        fd.append("rating", String(rating)); fd.append("text", text.trim());
        Object.entries(crit).forEach(([k, v]) => fd.append(k, String(v)));
        tags.forEach((t) => fd.append("tags", t));
        files.forEach((f) => fd.append("photos", f));
        await api.post(url, fd);
      } else await api.post(url, { rating, text: text.trim() });
      toast("Rahmat! Bahoingiz qabul qilindi.", "success"); (onDone || onClose)();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Ishni baholang" onClose={onClose}>
      <div className="col gap-16 rate-box">
        <div className="rate-head">
          <Avatar name={order.party} src={order.avatar} />
          <div style={{ minWidth: 0 }}><b className="ellipsis" translate="no">{order.party}</b>{order.service && <div className="xs muted ellipsis">{order.service}</div>}</div>
        </div>
        <div className="col gap-4" style={{ alignItems: "center" }}>
          <StarRow value={rating} onChange={setRating} label="Umumiy baho" />
          <b className={"rate-word" + (rating ? " on" : "")}>{rating ? RATE_WORDS[rating] : "Yulduzlardan birini tanlang"}</b>
        </div>
        {isBooking && rating > 0 && (
          <>
            <div className="rate-crit">
              {Object.entries(opts.criteria).map(([k, label]) => (
                <div key={k} className="rate-crit-row"><span className="small">{label}</span><StarRow value={crit[k] || 0} onChange={(n) => setCrit({ ...crit, [k]: n })} size={22} label={label} /></div>
              ))}
            </div>
            <div className="field"><span>{rating >= 4 ? "Nimasi yoqdi?" : "Nimalar yaxshi edi?"}</span>
              <div className="chips wrap" style={{ margin: 0, flexWrap: "wrap" }}>
                {opts.tags.map((t) => { const on = tags.includes(t); return <button key={t} type="button" className={"chip" + (on ? " active" : "")} aria-pressed={on} onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t].slice(0, 6))}>{t}</button>; })}
              </div>
            </div>
          </>
        )}
        {order.type !== "part" && rating > 0 && <textarea className="textarea" maxLength={1000} placeholder={rating >= 4 ? "Fikringizni yozing — boshqa haydovchilarga yordam beradi (ixtiyoriy)" : "Nima yoqmadi? Usta ham ko'radi (ixtiyoriy)"} value={text} onChange={(e) => setText(e.target.value)} />}
        {isBooking && rating > 0 && (
          <div className="field"><span>Ish natijasining rasmlari (5 tagacha)</span>
            <div className="photo-pick">
              {files.map((f, i) => <div key={i} className="pp"><img src={URL.createObjectURL(f)} alt="" /><button onClick={() => setFiles(files.filter((_, k) => k !== i))} aria-label="O'chirish">×</button></div>)}
              {files.length < 5 && <label className="add" aria-label="Rasm qo'shish">+<input type="file" accept="image/*" multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files || [])].slice(0, 5))} /></label>}
            </div>
          </div>
        )}
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-block btn-lg" disabled={busy || !rating} onClick={send}>{busy ? "Yuborilmoqda…" : "Bahoni yuborish"}</button>
      </div>
    </Modal>
  );
}

const SKIP = "ah_rate_skip_";
/** Mijoz: yaqinda tugagan, baholanmagan ish bo'lsa — bir marta o'zi so'raydi. */
export function RatePrompt() {
  const { user } = useAuth();
  const loc = useLocation();
  const [b, setB] = useState<any>(null);
  useEffect(() => {
    if (user?.role !== "user" || loc.pathname.startsWith("/app/orders") || loc.pathname.startsWith("/app/chat/")) return;
    const t = setTimeout(() => {
      api.get("/masters/bookings/to-review/").then((r) => {
        const x = r.data.booking;
        let skipped = false;
        try { skipped = !!x && !!localStorage.getItem(SKIP + x.id); } catch { /* */ }
        if (x && !skipped) setB(x);
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [user?.id, loc.pathname === "/app"]);
  if (!b) return null;
  const later = () => { try { localStorage.setItem(SKIP + b.id, "1"); } catch { /* */ } setB(null); };
  return <ReviewModal order={{ id: b.id, type: "booking", party: b.master_name, service: b.service_name, avatar: b.avatar }} onClose={later} onDone={() => setB(null)} />;
}
