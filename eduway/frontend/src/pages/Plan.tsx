import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Bot, CheckCircle2, ChevronLeft, ChevronRight, Circle, Flag, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { Badge, cx, Empty, ErrorState, Field, Modal, PageHeader, PageSkeleton, Progress, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";
import { del, patch, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { addDays, fmtDate, isoDate, WEEKDAYS } from "../lib/format";

const KINDS: [string, string][] = [["ielts", "IELTS"], ["english", "Ingliz tili"], ["programming", "Dasturlash"], ["math", "Matematika"], ["university", "Universitetga kirish"], ["grant", "Grant yutish"], ["custom", "Boshqa"]];

function GoalModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const [f, setF] = useState({ title: "", kind: "ielts", target: "", current_level: "", deadline: "", minutes_per_day: user?.daily_minutes || 30 });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const g = await post("/learn/goals/", { ...f, deadline: f.deadline || null });
      await post(`/learn/goals/${g.id}/generate/`);
      toast("Maqsad qo'shildi va 7 kunlik reja tuzildi");
      onSaved();
      onClose();
    } catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Yangi maqsad">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">{KINDS.map(([k, v]) => <button key={k} onClick={() => setF({ ...f, kind: k, title: f.title || (k === "ielts" ? "IELTS 7.0 olish" : "") })} className={cx("chip", f.kind === k && "chip-on")}>{v}</button>)}</div>
        <Field label="Maqsad"><input className="input" value={f.title} maxLength={160} placeholder="Masalan: IELTS 7.0 olish" onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hozirgi daraja"><input className="input" value={f.current_level} maxLength={80} placeholder="Masalan: 5.5" onChange={(e) => setF({ ...f, current_level: e.target.value })} /></Field>
          <Field label="Maqsad ko'rsatkich"><input className="input" value={f.target} maxLength={160} placeholder="Masalan: 7.0" onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
        </div>
        <Field label="Muddat (ixtiyoriy)"><input type="date" className="input" min={isoDate()} value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
        <div><span className="label">Kuniga: <b className="text-brand">{f.minutes_per_day} daqiqa</b></span><input type="range" min={10} max={240} step={5} value={f.minutes_per_day} onChange={(e) => setF({ ...f, minutes_per_day: +e.target.value })} className="w-full accent-[rgb(var(--brand))]" /></div>
        <button className="btn-primary w-full" disabled={busy || !f.title.trim()} onClick={save}>{busy ? <Spinner /> : "Saqlash va reja tuzish"}</button>
      </div>
    </Modal>
  );
}

function TaskModal({ open, onClose, date, goals, onSaved }: { open: boolean; onClose: () => void; date: string; goals: any[]; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ title: "", details: "", minutes: 20, goal: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await post("/learn/tasks/", { ...f, goal: f.goal || null, date }); setF({ title: "", details: "", minutes: 20, goal: "" }); onSaved(); onClose(); }
    catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Vazifa · ${fmtDate(date, false)}`}>
      <div className="space-y-3">
        <Field label="Vazifa"><input className="input" value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Field>
        <Field label="Tafsilot (ixtiyoriy)"><input className="input" value={f.details} maxLength={500} onChange={(e) => setF({ ...f, details: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Daqiqa"><input type="number" min={5} max={300} className="input" value={f.minutes} onChange={(e) => setF({ ...f, minutes: +e.target.value })} /></Field>
          <Field label="Maqsad"><select className="input" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })}><option value="">—</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field>
        </div>
        <button className="btn-primary w-full" disabled={busy || !f.title.trim()} onClick={save}>{busy ? <Spinner /> : "Qo'shish"}</button>
      </div>
    </Modal>
  );
}

export default function Plan() {
  const { user } = useAuth();
  const toast = useToast();
  const today = isoDate();
  const [weekStart, setWeekStart] = useState(today);
  const [day, setDay] = useState(today);
  const goals = useApi<any>("/learn/goals/");
  const tasks = useApi<any[]>(`/learn/tasks/?from=${weekStart}&to=${addDays(weekStart, 6)}`);
  const [goalOpen, setGoalOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState<number | null>(null);
  const premium = user?.is_premium || user?.is_admin;

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  if (goals.loading) return <PageSkeleton />;
  if (goals.error) return <ErrorState error={goals.error} onRetry={goals.reload} />;
  const active = (goals.data?.results || []).filter((g: any) => g.status === "active");
  const dayTasks = (tasks.data || []).filter((t) => t.date === day);
  const reloadAll = () => { goals.reload(); tasks.reload(); };

  const toggle = async (t: any) => {
    tasks.setData((tasks.data || []).map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)));
    try { await patch(`/learn/tasks/${t.id}/`, { done: !t.done }); if (!t.done) toast("Bajarildi! +10 XP"); goals.reload(); } catch (e: any) { toast(e.message, "bad"); tasks.reload(); }
  };
  const remove = async (t: any) => { await del(`/learn/tasks/${t.id}/`); tasks.reload(); goals.reload(); };
  const regen = async (g: any, ai: boolean) => {
    setAiBusy(g.id);
    try {
      if (ai) { const r = await post(`/ai/plan/${g.id}/`); toast(r.summary ? "AI reja tuzdi" : `${r.created} ta vazifa`); }
      else { await post(`/learn/goals/${g.id}/generate/`); toast("Shablon reja yangilandi"); }
      setWeekStart(today); setDay(today); reloadAll();
    } catch (e: any) { toast(e.message, "bad"); } finally { setAiBusy(null); }
  };
  const archive = async (g: any) => {
    if (g.status === "active" && !confirm(`«${g.title}» maqsadini yakunlangan deb belgilaysizmi? Bajarilmagan kelgusi vazifalari olib tashlanadi.`)) return;
    try { await patch(`/learn/goals/${g.id}/`, { status: g.status === "active" ? "done" : "active" }); if (g.status === "active") toast("Tabriklaymiz! Maqsad yakunlandi"); reloadAll(); }
    catch (e: any) { toast(e.message, "bad"); }
  };

  return (
    <>
      <PageHeader title="O'quv reja" subtitle="Maqsad → haftalik reja → kunlik vazifalar" back="/learn" action={<button className="btn-primary btn-sm" onClick={() => setGoalOpen(true)}><Flag className="h-4 w-4" /> Maqsad</button>} />

      {active.length === 0 ? (
        <Empty icon={<Flag className="h-7 w-7" />} title="Maqsad qo'ying" text="Masalan: IELTS 7.0, matematika, grant yutish. Platforma sizga 7 kunlik reja tuzib beradi." action={<button className="btn-primary" onClick={() => setGoalOpen(true)}>Maqsad qo'shish</button>} />
      ) : (
        <div className="space-y-3">
          {active.map((g: any) => (
            <div key={g.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="font-bold">{g.title}</p><p className="text-xs text-sub">{g.minutes_per_day} daq/kun{g.deadline ? ` · ${fmtDate(g.deadline)} gacha` : ""}{g.target ? ` · maqsad: ${g.target}` : ""}</p></div>
                <button onClick={() => archive(g)} aria-label="Maqsadni yakunlash" title="Maqsadni yakunlash" className="grid h-9 w-9 place-items-center rounded-lg text-sub hover:bg-muted"><Archive className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 flex items-center gap-3"><Progress value={g.progress.total ? (100 * g.progress.done) / g.progress.total : 0} /><span className="shrink-0 text-xs font-semibold text-sub">{g.progress.done}/{g.progress.total}</span></div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-outline btn-sm" disabled={aiBusy === g.id} onClick={() => regen(g, false)}><LayoutTemplate className="h-4 w-4" /> Shablon reja</button>
                {premium ? <button className="btn-soft btn-sm" disabled={aiBusy === g.id} onClick={() => regen(g, true)}>{aiBusy === g.id ? <Spinner className="h-4 w-4" /> : <Bot className="h-4 w-4" />} AI shaxsiy reja</button>
                  : <Link to="/premium" className="btn-soft btn-sm"><Bot className="h-4 w-4" /> AI reja · Premium</Link>}
              </div>
            </div>
          ))}
          <p className="text-xs text-sub">Faol maqsadlar: {active.length}/{goals.data.limit}{!premium && " · Premium bilan 5 tagacha"}</p>
        </div>
      )}

      {/* Hafta */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Hafta</h2>
          <div className="flex gap-1">
            <button className="btn-outline btn-sm w-9 !px-0" aria-label="Oldingi hafta" onClick={() => { setWeekStart(addDays(weekStart, -7)); setDay(addDays(weekStart, -7)); }}><ChevronLeft className="h-4 w-4" /></button>
            <button className="btn-outline btn-sm" onClick={() => { setWeekStart(today); setDay(today); }}>Bugun</button>
            <button className="btn-outline btn-sm w-9 !px-0" aria-label="Keyingi hafta" onClick={() => { setWeekStart(addDays(weekStart, 7)); setDay(addDays(weekStart, 7)); }}><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const ts = (tasks.data || []).filter((t) => t.date === d);
            const done = ts.filter((t) => t.done).length;
            const dt = new Date(d + "T00:00:00");
            return (
              <button key={d} onClick={() => setDay(d)} className={cx("flex flex-col items-center rounded-2xl border py-2 transition", d === day ? "border-brand bg-brand text-white shadow-lift" : "border-line bg-surface")}>
                <span className={cx("text-[11px] font-semibold", d === day ? "text-white/80" : "text-sub")}>{WEEKDAYS[dt.getDay()]}</span>
                <span className="text-lg font-extrabold">{dt.getDate()}</span>
                <span className={cx("mt-0.5 h-1.5 w-1.5 rounded-full", !ts.length ? "bg-transparent" : done === ts.length ? (d === day ? "bg-white" : "bg-ok") : d === day ? "bg-white/60" : "bg-brand")} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="card mt-3 p-4">
        <div className="flex items-center justify-between"><p className="font-bold">{day === today ? "Bugun" : fmtDate(day, false)}</p><button className="btn-soft btn-sm" onClick={() => setTaskOpen(true)}><Plus className="h-4 w-4" /> Vazifa</button></div>
        {tasks.loading ? <div className="py-6 text-center"><Spinner className="mx-auto" /></div> : dayTasks.length === 0 ? <p className="py-6 text-center text-sm text-sub">Bu kunga vazifa yo'q.</p> : (
          <ul className="mt-2 divide-y divide-line">
            {dayTasks.map((t) => (
              <li key={t.id} className="group flex items-center gap-3 py-3">
                <button onClick={() => toggle(t)} aria-label="Belgilash">{t.done ? <CheckCircle2 className="h-6 w-6 text-ok" /> : <Circle className="h-6 w-6 text-line" />}</button>
                <div className="min-w-0 flex-1">
                  <p className={cx("font-semibold", t.done && "text-sub line-through")}>{t.title}</p>
                  <p className="text-xs text-sub">{t.minutes} daq{t.details ? ` · ${t.details}` : ""}</p>
                  <div className="mt-1 flex gap-1">{t.source === "ai" && <Badge>AI</Badge>}{t.goal_title && <Badge tone="muted">{t.goal_title}</Badge>}</div>
                </div>
                {t.link && !t.done && <Link to={t.link} className="btn-ghost btn-sm text-brand">Boshlash</Link>}
                <button onClick={() => remove(t)} aria-label="O'chirish" className="text-sub opacity-50 hover:text-bad group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(goals.data?.results || []).some((g: any) => g.status !== "active") && (
        <section className="mt-6"><h2 className="mb-2 text-sm font-bold text-sub">Yakunlangan maqsadlar</h2>
          <div className="space-y-2">{goals.data.results.filter((g: any) => g.status !== "active").map((g: any) => (
            <div key={g.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm"><span className="text-sub line-through">{g.title}</span><button className="font-semibold text-brand" onClick={() => archive(g)}>Qayta faollashtirish</button></div>
          ))}</div>
        </section>
      )}

      <GoalModal open={goalOpen} onClose={() => setGoalOpen(false)} onSaved={() => { setWeekStart(today); setDay(today); reloadAll(); }} />
      <TaskModal open={taskOpen} onClose={() => setTaskOpen(false)} date={day} goals={active} onSaved={reloadAll} />
    </>
  );
}
