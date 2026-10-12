import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Award, Mic, Timer, Zap, BookOpen, Bot, Check, CheckCircle2, Compass, Crown, Flag, Flame, Lock, Sparkles, Target, Trophy } from "lucide-react";
import { cx, ErrorState, PageHeader, PageSkeleton, PremiumLock, Progress as Bar2 } from "../components/ui";
import { useApi } from "../lib/hooks";
import { fmtDate, SUBJECT_LABEL } from "../lib/format";
import { WeeklyReport } from "../components/Weekly";

const ICONS: Record<string, any> = { sparkles: Sparkles, compass: Compass, check: Check, trophy: Trophy, flame: Flame, crown: Crown, book: BookOpen, target: Target, bot: Bot, flag: Flag, timer: Timer, zap: Zap, mic: Mic };

const tip = { contentStyle: { background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 12, color: "rgb(var(--ink))" }, labelStyle: { color: "rgb(var(--sub))" } };

export default function ProgressPage() {
  const { data: d, error, loading, reload } = useApi<any>("/learn/stats/");
  if (loading) return <PageSkeleton />;
  if (error || !d) return <ErrorState error={error} onRetry={reload} />;
  const t = d.totals;
  const activity = d.activity.map((a: any) => ({ ...a, label: fmtDate(a.date, false) }));
  const stats = [
    { label: "XP", value: t.xp, icon: Trophy, c: "text-amber-500" },
    { label: "Seriya", value: `${t.streak} kun`, icon: Flame, c: "text-orange-500" },
    { label: "Testlar", value: t.quizzes, icon: CheckCircle2, c: "text-ok" },
    { label: "Vazifalar", value: t.tasks_done, icon: Target, c: "text-brand" },
    { label: "Darslar", value: t.lessons, icon: BookOpen, c: "text-sky-500" },
    { label: "So'zlar", value: t.words, icon: Sparkles, c: "text-fuchsia-500" },
    { label: "Fokus", value: t.focus_minutes >= 60 ? `${Math.floor(t.focus_minutes / 60)} soat` : `${t.focus_minutes} daq`, icon: Timer, c: "text-violet-500" },
  ];
  return (
    <>
      <PageHeader title="Natijalar" subtitle={`So'nggi ${d.range_days} kun`} back="/profile" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        {stats.map((s, i) => (
          <div key={s.label} className="card p-3 text-center animate-fade-up" style={{ animationDelay: `${i * 0.03}s` }}>
            <s.icon className={cx("mx-auto h-5 w-5", s.c)} />
            <p className="mt-1 text-lg font-extrabold">{s.value}</p>
            <p className="text-[11px] text-sub">{s.label}</p>
          </div>
        ))}
      </div>

      <WeeklyReport />

      <section className="card mt-4 p-5">
        <h2 className="font-bold">Faollik (XP)</h2>
        <div className="mt-3 h-52">
          <ResponsiveContainer>
            <AreaChart data={activity} margin={{ left: -24, right: 4, top: 4 }}>
              <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--brand))" stopOpacity={0.4} /><stop offset="1" stopColor="rgb(var(--brand))" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgb(var(--sub))", fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fill: "rgb(var(--sub))", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tip} />
              <Area type="monotone" dataKey="xp" name="XP" stroke="rgb(var(--brand))" strokeWidth={2.5} fill="url(#ga)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {d.subjects.length > 0 && (
        <section className="card mt-4 p-5">
          <h2 className="font-bold">Fanlar bo'yicha o'rtacha natija</h2>
          <div className="mt-3 h-52">
            <ResponsiveContainer>
              <BarChart data={d.subjects.map((s: any) => ({ ...s, name: SUBJECT_LABEL[s.subject] || s.subject }))} margin={{ left: -24, right: 4, top: 4 }}>
                <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "rgb(var(--sub))", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "rgb(var(--sub))", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip {...tip} formatter={(v: any) => [`${v}%`, "O'rtacha"]} />
                <Bar dataKey="avg" radius={[8, 8, 0, 0]} fill="rgb(var(--brand))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="card mt-4 p-5">
        <h2 className="font-bold">Mavzular bo'yicha tahlil</h2>
        {d.topics.length === 0 ? <p className="mt-2 text-sm text-sub">Tahlil uchun ko'proq test ishlang (har mavzuda kamida 3 ta javob).</p> : (
          <ul className="mt-3 space-y-3">{d.topics.map((w: any) => (
            <li key={w.subject + w.topic}><div className="flex justify-between text-sm"><span><b>{w.topic}</b> <span className="text-sub">· {SUBJECT_LABEL[w.subject]}</span></span><b className={w.accuracy < 60 ? "text-bad" : "text-ok"}>{w.accuracy}%</b></div><Bar2 value={w.accuracy} className="mt-1.5" /></li>
          ))}</ul>
        )}
        {!d.premium && d.topics_locked > 0 && <div className="mt-4"><PremiumLock compact text={`Yana ${d.topics_locked} ta mavzu tahlili, 90 kunlik grafik va natijalar trendi Premium'da.`} /></div>}
      </section>

      {d.premium && d.trend?.length > 1 && (
        <section className="card mt-4 p-5">
          <h2 className="font-bold">Test natijalari trendi</h2>
          <div className="mt-3 h-48">
            <ResponsiveContainer>
              <AreaChart data={d.trend.map((x: any, i: number) => ({ ...x, n: i + 1 }))} margin={{ left: -24, right: 4, top: 4 }}>
                <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="n" tick={{ fill: "rgb(var(--sub))", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "rgb(var(--sub))", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip {...tip} formatter={(v: any) => [`${v}%`, "Natija"]} />
                <Area type="monotone" dataKey="percent" stroke="#D946EF" strokeWidth={2.5} fill="#D946EF22" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="mt-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Award className="h-5 w-5 text-amber-500" /> Yutuqlar</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {d.achievements.map((a: any) => {
            const I = ICONS[a.icon] || Award;
            return (
              <div key={a.code} className={cx("card p-4", !a.earned && "opacity-60")}>
                <div className={cx("grid h-11 w-11 place-items-center rounded-2xl", a.earned ? "bg-gradient-to-br from-amber-400 to-fuchsia-500 text-white" : "bg-muted text-sub")}>{a.earned ? <I className="h-5 w-5" /> : <Lock className="h-5 w-5" />}</div>
                <p className="mt-2 font-bold leading-tight">{a.title}</p>
                <p className="text-xs text-sub">{a.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
