import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, MessageCircle, Package, Phone, RotateCcw, Siren, Star, Wrench } from "lucide-react";
import { api, errMsg } from "../../api";
import RescheduleModal from "../../components/RescheduleModal";
import { ReviewModal } from "../../components/Review";
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

  // «ishni baholang» bildirishnomasidan kelganda — baho oynasi o'zi ochiladi
  const toRate = new URLSearchParams(window.location.search).get("review");
  useEffect(() => {
    if (!items || !toRate) return;
    const o = items.find((x) => `${x.type}-${x.id}` === toRate);
    if (o && !o.rated && o.status === "completed") setReview(o);
    else if (o) { const el = document.getElementById("o-" + toRate); el?.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }, [items, toRate]);

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
      {review && <ReviewModal order={{ id: review.id, type: review.type, party: review.party, service: review.title }} onClose={() => { setReview(null); load(); }} />}
      {resched && <RescheduleModal booking={{ id: resched.id, date: resched.b_date, time: resched.b_time }} masterId={resched.master_id} onClose={() => setResched(null)} onDone={() => { setResched(null); load(); }} />}
    </div>
  );
}
