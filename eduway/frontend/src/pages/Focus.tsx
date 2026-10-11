import { useEffect, useRef, useState } from "react";
import { Pause, Play, Square, Timer } from "lucide-react";
import { cx, ErrorState, PageHeader, PageSkeleton, Progress, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";
import { get, post } from "../lib/api";
import { useApi } from "../lib/hooks";
import { isoDate, WEEKDAYS } from "../lib/format";

const PRESETS = [15, 25, 45, 60];

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.22);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch { /* ovoz ixtiyoriy */ }
}

export default function Focus() {
  const { data, error, loading, reload } = useApi<any>("/learn/focus/");
  const toast = useToast();
  const [minutes, setMinutes] = useState(25);
  const [label, setLabel] = useState("");
  const [task, setTask] = useState<string>("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const finishing = useRef(false);

  useEffect(() => { get(`/learn/tasks/?date=${isoDate()}`).then((t) => setTasks(t.filter((x: any) => !x.done))).catch(() => {}); }, []);
  useEffect(() => { if (data?.active) setSession(data.active); }, [data]);
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [session]);

  const total = session ? session.planned_minutes * 60 : minutes * 60;
  const elapsed = session ? Math.max(0, Math.floor((now - new Date(session.started_at).getTime()) / 1000)) : 0;
  const left = Math.max(0, total - elapsed);

  const finish = async (complete: boolean) => {
    if (!session || finishing.current) return;
    finishing.current = true;
    setBusy(true);
    try {
      const r = await post(`/learn/focus/${session.id}/finish/`, { complete_task: complete && !!task });
      if (complete) beep();
      toast(r.minutes > 0 ? `Ajoyib! ${r.minutes} daqiqa diqqat · +${r.xp} XP` : "Sessiya to'xtatildi", r.minutes > 0 ? "ok" : "info");
      setSession(null);
      reload();
    } catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); finishing.current = false; }
  };

  useEffect(() => { if (session && left === 0) finish(true); }, [left, session]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.title = session ? `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")} · Fokus` : "EduWay AI";
    return () => { document.title = "EduWay AI"; };
  }, [left, session]);

  const start = async () => {
    setBusy(true);
    try {
      const t = tasks.find((x) => String(x.id) === task);
      const s = await post("/learn/focus/start/", { minutes, label: label || t?.title || "", task: task || null });
      setSession(s);
      setNow(Date.now());
    } catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };

  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  const R = 112, C = 2 * Math.PI * R, pct = session ? Math.min(1, elapsed / total) : 0;
  const maxWeek = Math.max(data.goal, ...data.week.map((w: any) => w.minutes));

  return (
    <>
      <PageHeader title="Fokus taymer" subtitle="Pomodoro usuli: diqqat bilan o'qish, keyin qisqa tanaffus" back="/learn" />
      <section className={cx("relative overflow-hidden rounded-[32px] p-6 text-white shadow-lift transition-all", session ? "bg-navy" : "gradient-hero")}>
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-500/30 blur-3xl animate-float" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-sky-400/25 blur-3xl animate-float [animation-delay:1.2s]" />
        <div className="relative mx-auto grid h-64 w-64 place-items-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 256 256">
            <circle cx="128" cy="128" r={R} stroke="rgba(255,255,255,.15)" strokeWidth="12" fill="none" />
            <circle cx="128" cy="128" r={R} stroke="#fff" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: "stroke-dashoffset .5s linear" }} />
          </svg>
          <div className="text-center">
            <p className="font-mono text-6xl font-bold tabular-nums tracking-tight">{String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}</p>
            <p className="mt-1 text-sm text-white/70">{session ? session.label || "Diqqat bilan o'qing" : "Boshlashga tayyor"}</p>
          </div>
        </div>
        {!session ? (
          <div className="relative mt-4 flex justify-center gap-2">
            {PRESETS.map((m) => <button key={m} onClick={() => setMinutes(m)} className={cx("h-10 rounded-xl px-4 font-semibold transition", minutes === m ? "bg-white text-navy" : "bg-white/15 hover:bg-white/25")}>{m} daq</button>)}
          </div>
        ) : <p className="relative mt-4 text-center text-sm text-white/70">Telefoningizni chetga qo'ying. Sahifani yopsangiz ham vaqt serverda hisoblanadi.</p>}
        <div className="relative mt-5 flex justify-center gap-3">
          {!session ? (
            <button className="btn h-14 rounded-2xl bg-white px-8 text-lg text-navy" disabled={busy} onClick={start}>{busy ? <Spinner /> : <><Play className="h-5 w-5 fill-current" /> Boshlash</>}</button>
          ) : (
            <>
              <button className="btn h-14 rounded-2xl bg-white/15 px-6" disabled={busy} onClick={() => finish(false)}><Square className="h-5 w-5" /> To'xtatish</button>
              <button className="btn h-14 rounded-2xl bg-white px-6 text-navy" disabled={busy} onClick={() => finish(true)}><Pause className="h-5 w-5" /> Yakunlash</button>
            </>
          )}
        </div>
      </section>

      {!session && (
        <section className="card mt-4 space-y-3 p-5">
          <label className="block"><span className="label">Nima ustida ishlaysiz?</span>
            <input className="input" value={label} maxLength={120} placeholder="Masalan: IELTS Reading" onChange={(e) => setLabel(e.target.value)} /></label>
          {tasks.length > 0 && (
            <label className="block"><span className="label">Bugungi vazifaga bog'lash (yakunlanganda bajarildi deb belgilanadi)</span>
              <select className="input" value={task} onChange={(e) => setTask(e.target.value)}><option value="">—</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.title} · {t.minutes} daq</option>)}</select></label>
          )}
        </section>
      )}

      <section className="card mt-4 p-5">
        <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><Timer className="h-5 w-5 text-brand" /> Bugun</h2><span className="text-sm font-semibold">{data.today} / {data.goal} daq</span></div>
        <Progress value={(100 * data.today) / Math.max(1, data.goal)} tone={data.today >= data.goal ? "ok" : "brand"} className="mt-3" />
        <div className="mt-5 flex h-28 items-end gap-2">
          {data.week.map((w: any) => {
            const d = new Date(w.date + "T00:00:00");
            return (
              <div key={w.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-sub">{w.minutes || ""}</span>
                <div className="flex h-20 w-full items-end rounded-lg bg-muted"><div className="w-full rounded-lg bg-gradient-to-t from-brand to-fuchsia-500 transition-all duration-700" style={{ height: `${(100 * w.minutes) / Math.max(1, maxWeek)}%` }} /></div>
                <span className="text-[11px] text-sub">{WEEKDAYS[d.getDay()]}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-sub">Jami fokus vaqti: {Math.floor(data.total / 60)} soat {data.total % 60} daqiqa</p>
      </section>
    </>
  );
}
