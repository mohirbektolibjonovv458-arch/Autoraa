import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, MessageCircle, Package, Phone, RotateCcw, Siren, Star, Wrench } from "lucide-react";
import { api, errMsg } from "../../api";
import RescheduleModal from "../../components/RescheduleModal";
import { fmtDay } from "../../components/SlotPicker";
import { Empty, Modal, Spinner, StatusBadge, useToast } from "../../components/ui";
import { money } from "../../utils";

const TABS = [["", "Barchasi"], ["booking", "Xizmatlar"], ["part", "Ehtiyot qismlar"], ["sos", "SOS / Evakuator"]];
const ICON: Record<string, any> = { booking: Wrench, part: Package, sos: Siren };
const ACTIVE = ["pending", "confirmed", "in_progress", "new", "searching", "accepted", "on_the_way", "arrived", "shipped"];

export default function Orders() {
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState("");
  const [items, setItems] = useState<any[] | null>(null);
  const [review, setReview] = useState<any>(null);
  const [resched, setResched] = useState<any>(null);
  const load = () => api.get("/orders/my/").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  const focus = new URLSearchParams(window.location.search).get("focus"); // bildirishnomadan kelganda
  useEffect(() => {
    if (!items || !focus) return;
    const el = document.getElementById("o-" + focus);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("focus-hit"); setTimeout(() => el.classList.remove("focus-hit"), 2500); }
  }, [items, focus]);

  const cancel = async (o: any) => {
    if (!confirm("Buyurtmani bekor qilasizmi?")) return;
    const url = o.type === "booking" ? `/masters/bookings/${o.id}/status/` : o.type === "sos" ? `/sos/${o.id}/cancel/` : `/parts/orders/${o.id}/cancel/`;
    try { await api.post(url, { status: "cancelled" }); toast("Bekor qilindi"); load(); } catch (e) { toast(errMsg(e), "error"); }
  };
  const chat = async (uid: number) => { const r = await api.post("/chat/start/", { user_id: uid }); nav(`/app/chat/${r.data.id}`); };

  const list = (items || []).filter((o) => !tab || o.type === tab);
  return (
    <div className="col gap-16" style={{ maxWidth: 860 }}>
      <h2 className="page-title">Buyurtmalarim</h2>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      {!items ? <Spinner /> : list.length === 0 ? <Empty title="Buyurtmalar yo'q" text="Usta bron qiling, zapchast xarid qiling yoki SOS chaqiring." /> : list.map((o) => {
        const I = ICON[o.type];
        const cancellable = (o.type === "booking" && ["pending", "confirmed"].includes(o.status)) || (o.type === "part" && o.status === "new") || (o.type === "sos" && ACTIVE.includes(o.status));
        return (
          <div key={o.uid} id={`o-${o.type}-${o.id}`} className="order-card col gap-8">
            <div className="row between"><span className="xs muted bold">{o.code}</span><StatusBadge status={o.status} label={o.status_label} /></div>
            <div className="row gap-8 small muted"><I size={15} />{o.type_label}</div>
            <div className="row between wrap gap-8">
              <div><b>{o.title}</b><div className="small muted">{o.party}</div>
                {o.type === "booking" && o.b_date
                  ? <div className="small row gap-4 mt-4" style={{ fontWeight: 700 }}><Calendar size={13} />{fmtDay(o.b_date)}, {o.b_time}</div>
                  : <div className="xs muted row gap-4 mt-4"><Calendar size={12} />{o.date}</div>}
                {o.type === "booking" && o.address && ["pending", "confirmed", "in_progress"].includes(o.status) && <div className="xs muted row gap-4 mt-4"><MapPin size={12} />{o.address}</div>}
              </div>
              <b>{o.price ? money(o.price) : "—"}</b>
            </div>
            <div className="row gap-8 wrap">
              {o.type === "sos" && ACTIVE.includes(o.status) && <button className="btn btn-sm btn-red" onClick={() => nav(`/app/sos?id=${o.id}`)}><Siren size={14} />Kuzatish</button>}
              {o.party_user_id && <button className="btn btn-sm btn-ghost" onClick={() => chat(o.party_user_id)}><MessageCircle size={14} />Yozish</button>}
              {o.type === "booking" && o.phone && ["pending", "confirmed", "in_progress"].includes(o.status) && <a className="btn btn-sm btn-ghost" href={`tel:${o.phone}`} aria-label="Qo'ng'iroq"><Phone size={14} /></a>}
              {o.type === "booking" && ["pending", "confirmed"].includes(o.status) && o.master_id && <button className="btn btn-sm btn-ghost" onClick={() => setResched(o)}><Clock size={14} />Vaqtni o'zgartirish</button>}
              {!o.rated && (o.status === "completed" || (o.type === "part" && o.status === "delivered")) && <button className="btn btn-sm btn-soft" onClick={() => setReview(o)}><Star size={14} />Baho berish</button>}
              {o.type === "booking" && ["completed", "cancelled"].includes(o.status) && o.master_id && <button className="btn btn-sm btn-ghost" onClick={() => nav(`/app/masters/${o.master_id}?book=1`)}><RotateCcw size={14} />Qayta bron</button>}
              {cancellable && <button className="btn btn-sm btn-danger-soft" onClick={() => cancel(o)}>Bekor qilish</button>}
            </div>
          </div>
        );
      })}
      {review && <ReviewModal order={review} onClose={() => { setReview(null); load(); }} />}
      {resched && <RescheduleModal booking={{ id: resched.id, date: resched.b_date, time: resched.b_time }} masterId={resched.master_id} onClose={() => setResched(null)} onDone={() => { setResched(null); load(); }} />}
    </div>
  );
}

function ReviewModal({ order, onClose }: { order: any; onClose: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const canPhoto = order.type === "booking";
  const send = async () => {
    const url = order.type === "booking" ? `/masters/bookings/${order.id}/review/` : order.type === "sos" ? `/sos/${order.id}/review/` : `/parts/orders/${order.id}/review/`;
    setBusy(true); setErr("");
    try {
      if (canPhoto && files.length) {
        const fd = new FormData(); fd.append("rating", String(rating)); fd.append("text", text); files.forEach((f) => fd.append("photos", f));
        await api.post(url, fd);
      } else await api.post(url, { rating, text });
      toast("Rahmat! Bahoingiz qabul qilindi.", "success"); onClose();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title={`${order.party} — baho`} onClose={onClose}>
      <div className="col gap-12">
        <div className="row gap-8" style={{ justifyContent: "center" }}>
          {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRating(n)} style={{ background: "none", border: 0 }} aria-label={`${n} yulduz`}><Star size={34} fill={n <= rating ? "#f5a623" : "none"} color="#f5a623" /></button>)}
        </div>
        {order.type !== "part" && <textarea className="textarea" maxLength={1000} placeholder="Fikringizni yozing (ixtiyoriy)" value={text} onChange={(e) => setText(e.target.value)} />}
        {canPhoto && (
          <div className="field"><span>Ish natijasining rasmlari (5 tagacha)</span>
            <div className="photo-pick">
              {files.map((f, i) => <div key={i} className="pp"><img src={URL.createObjectURL(f)} alt="" /><button onClick={() => setFiles(files.filter((_, k) => k !== i))} aria-label="O'chirish">×</button></div>)}
              {files.length < 5 && <label className="add" aria-label="Rasm qo'shish">+<input type="file" accept="image/*" multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files || [])].slice(0, 5))} /></label>}
            </div>
          </div>
        )}
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-block btn-lg" disabled={busy} onClick={send}>{busy ? "Yuborilmoqda…" : "Yuborish"}</button>
      </div>
    </Modal>
  );
}
