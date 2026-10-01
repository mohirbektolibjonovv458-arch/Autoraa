import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Clock, MessageCircle, Phone, StickyNote } from "lucide-react";
import { api, errMsg } from "../../api";
import RescheduleModal from "../../components/RescheduleModal";
import { fmtDay, isoDate } from "../../components/SlotPicker";
import { Avatar, Empty, Spinner, StatusBadge, useToast } from "../../components/ui";
import { money } from "../../utils";

const ACTIVE = ["pending", "confirmed", "in_progress"];
const NEXT: Record<string, [string, string][]> = {
  pending: [["confirmed", "Tasdiqlash"], ["cancelled", "Rad etish"]],
  confirmed: [["in_progress", "Ishni boshlash"], ["cancelled", "Bekor qilish"]],
  in_progress: [["completed", "Yakunlash"]],
};

/** Usta: kun bo'yicha jadval — bugun / ertaga / kelgusi, yangi so'rovlar yuqorida. */
export default function UstaOrders() {
  const toast = useToast();
  const nav = useNavigate();
  const [view, setView] = useState<"today" | "tomorrow" | "upcoming" | "new" | "history">("today");
  const [items, setItems] = useState<any[] | null>(null);
  const [resched, setResched] = useState<any>(null);
  const load = () => api.get("/masters/bookings/").then((r) => setItems(r.data)).catch(() => setItems([]));
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, []);
  useEffect(() => { const f = () => load(); window.addEventListener("avtora-push", f); return () => window.removeEventListener("avtora-push", f); }, []);

  const today = isoDate(new Date());
  const tmr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return isoDate(d); })();
  const all = items || [];
  const byView = useMemo(() => {
    const act = all.filter((b) => ACTIVE.includes(b.status));
    return {
      new: act.filter((b) => b.status === "pending"),
      today: act.filter((b) => b.date === today),
      tomorrow: act.filter((b) => b.date === tmr),
      upcoming: act.filter((b) => b.date > tmr),
      history: all.filter((b) => !ACTIVE.includes(b.status)),
    } as Record<string, any[]>;
  }, [items]);
  // birinchi ochilishda eng kerakli bo'lim: yangi so'rovlar → bugun → ertaga → kelgusi
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    if (!items || picked) return;
    setPicked(true);
    if (new URLSearchParams(window.location.search).get("focus")) return;
    const order: (typeof view)[] = ["new", "today", "tomorrow", "upcoming"];
    const first = order.find((k) => byView[k].length > 0);
    if (first) setView(first);
  }, [items]);
  const focus = new URLSearchParams(window.location.search).get("focus");
  useEffect(() => {
    if (!items || !focus) return;
    const b = all.find((x) => String(x.id) === focus);
    if (b) setView(b.status === "pending" ? "new" : b.date === today ? "today" : b.date === tmr ? "tomorrow" : ACTIVE.includes(b.status) ? "upcoming" : "history");
    setTimeout(() => {
      const el = document.getElementById("bk-" + focus);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("focus-hit"); setTimeout(() => el.classList.remove("focus-hit"), 2500); }
    }, 150);
  }, [items]);

  const set = async (b: any, status: string) => {
    let reason = "";
    if (status === "cancelled") {
      const r = prompt(b.status === "pending" ? "Rad etish sababi (mijozga ko'rinadi):" : "Bekor qilish sababi (mijozga ko'rinadi):", "Bu vaqtda band bo'lib qoldim");
      if (r === null) return;
      reason = r;
    }
    try { await api.post(`/masters/bookings/${b.id}/status/`, { status, reason }); toast("Mijozga xabar yuborildi", "success"); load(); }
    catch (e) { toast(errMsg(e), "error"); }
  };
  const chat = async (uid: number) => { const r = await api.post("/chat/start/", { user_id: uid }); nav(`/app/chat/${r.data.id}`); };

  const list = [...(byView[view] || [])].sort((a, b) => (view === "history" ? (b.date + b.time).localeCompare(a.date + a.time) : (a.date + a.time).localeCompare(b.date + b.time)));
  const groups: [string, any[]][] = [];
  list.forEach((b) => { const g = groups.find((x) => x[0] === b.date); g ? g[1].push(b) : groups.push([b.date, [b]]); });
  const TABS: [typeof view, string][] = [["new", "Yangi"], ["today", "Bugun"], ["tomorrow", "Ertaga"], ["upcoming", "Kelgusi"], ["history", "Tarix"]];
  const dayTotal = byView.today.reduce((s, b) => s + (b.price || 0), 0);

  return (
    <div className="col gap-16" style={{ maxWidth: 900 }}>
      <div className="page-head"><h2 className="page-title">Buyurtmalar</h2>
        {byView.today.length > 0 && <span className="small muted">Bugun: <b>{byView.today.length}</b> ta · {money(dayTotal)}</span>}</div>
      <div className="tabs">{TABS.map(([k, l]) => (
        <button key={k} className={view === k ? "active" : ""} onClick={() => setView(k)}>
          {l}{k !== "history" && byView[k].length > 0 && <span className={"tab-count" + (k === "new" ? " hot" : "")}>{byView[k].length}</span>}
        </button>
      ))}</div>

      {!items ? <Spinner /> : list.length === 0 ? (
        <Empty title={view === "new" ? "Yangi so'rov yo'q" : view === "history" ? "Tarix bo'sh" : "Bu kunga bron yo'q"}
          text={view === "new" ? "Mijoz bron qilishi bilan shu yerda va Telegram'da ko'rasiz." : "Xizmat va narxlaringizni to'ldiring — mijozlar sizni tezroq topadi."} />
      ) : groups.map(([day, rows]) => (
        <div key={day} className="col gap-8">
          {(view === "upcoming" || view === "history" || view === "new") && <div className="day-group">{fmtDay(day)}</div>}
          {rows.map((b) => (
            <div key={b.id} id={`bk-${b.id}`} className="order-card col gap-8">
              <div className="row between"><b className="row gap-8" style={{ fontSize: 17 }}><Clock size={16} />{b.time}</b><StatusBadge status={b.status} label={b.status_label} /></div>
              <div className="row gap-12">
                <Avatar name={b.client.full_name} src={b.client.avatar} />
                <div className="grow"><b>{b.service_name}</b><div className="small muted" translate="no">{b.client.full_name}</div></div>
                <b>{b.price ? money(b.price) : "Kelishiladi"}</b>
              </div>
              {(b.vehicle_title || b.note) && (
                <div className="col gap-4 small">
                  {b.vehicle_title && <span className="row gap-4"><Car size={14} />{b.vehicle_title}</span>}
                  {b.note && <span className="row gap-4 muted" style={{ alignItems: "flex-start" }}><StickyNote size={14} style={{ flexShrink: 0, marginTop: 2 }} />{b.note}</span>}
                </div>
              )}
              <div className="row gap-8 wrap">
                {b.client.phone && <a className="btn btn-sm btn-ghost" href={`tel:${b.client.phone}`} aria-label="Qo'ng'iroq"><Phone size={14} /></a>}
                <button className="btn btn-sm btn-ghost" onClick={() => chat(b.client.id)}><MessageCircle size={14} />Chat</button>
                {["pending", "confirmed"].includes(b.status) && <button className="btn btn-sm btn-ghost" onClick={() => setResched(b)}><Clock size={14} />Vaqt</button>}
                <div className="grow" />
                {(NEXT[b.status] || []).map(([s, l]) => <button key={s} className={"btn btn-sm " + (s === "cancelled" ? "btn-danger-soft" : s === "completed" ? "btn-green" : "")} onClick={() => set(b, s)}>{l}</button>)}
              </div>
            </div>
          ))}
        </div>
      ))}
      {resched && <RescheduleModal booking={resched} masterId={resched.master} onClose={() => setResched(null)} onDone={() => { setResched(null); load(); }} />}
    </div>
  );
}
