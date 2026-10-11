import { Link } from "react-router-dom";
import { Timer, Zap, ArrowRight, BookOpen, Bot, Building2, CalendarClock, CheckCircle2, Circle, Compass, Flame, GraduationCap, Mic, RefreshCw, Sparkles, Target, Trophy, User as UserIcon } from "lucide-react";
import { Badge, cx, ErrorState, PageSkeleton, Progress, Ring } from "../components/ui";
import { useToast } from "../components/Toast";
import { patch } from "../lib/api";
import { useApi } from "../lib/hooks";
import { InstallBanner, PushCard } from "../components/Install";
import { fmtDate, greeting, SUBJECT_LABEL, WEEKDAYS } from "../lib/format";

const REC_ICONS: Record<string, any> = { user: UserIcon, compass: Compass, target: Target, book: BookOpen, refresh: RefreshCw, building: Building2 };

export default function Home() {
  const { data: d, error, loading, reload, setData } = useApi<any>("/dashboard/");
  const toast = useToast();
  if (loading) return <PageSkeleton />;
  if (error || !d) return <ErrorState error={error} onRetry={reload} />;

  const toggle = async (t: any) => {
    const done = !t.done;
    setData({ ...d, today: { ...d.today, tasks: d.today.tasks.map((x: any) => (x.id === t.id ? { ...x, done } : x)), done: d.today.done + (done ? 1 : -1) } });
    try {
      await patch(`/learn/tasks/${t.id}/`, { done });
      if (done) toast("Ajoyib! +10 XP");
      reload();
    } catch (e: any) {
      toast(e.message, "bad");
      reload();
    }
  };
  const pct = d.today.total ? Math.round((100 * d.today.done) / d.today.total) : 0;
  const maxXp = Math.max(20, ...d.week.map((w: any) => w.xp));

  return (
    <div className="space-y-5">
      {/* Salomlashuv */}
      <section className="relative overflow-hidden rounded-3xl gradient-hero p-5 text-white shadow-lift sm:p-7 animate-fade-up">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-fuchsia-400/30 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-white/70">{greeting()},</p>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{d.user.first_name || d.user.full_name} 👋</h1>
            <p className="mt-2 line-clamp-2 max-w-md text-sm text-white/80">{d.user.future_goals || "Bugun ham o'z maqsadingiz sari bir qadam tashlang."}</p>
          </div>
          <div className="flex shrink-0 flex-col items-center rounded-2xl bg-white/15 px-3 py-2 backdrop-blur">
            <Flame className={cx("h-6 w-6", d.streak ? "text-amber-300" : "text-white/50")} />
            <span className="text-xl font-extrabold leading-none">{d.streak}</span>
            <span className="text-[11px] text-white/70">kun seriya</span>
          </div>
        </div>
        <div className="relative mt-5 flex items-end gap-1.5" aria-label="Haftalik faollik">
          {d.week.map((w: any, i: number) => {
            const day = new Date(w.date + "T00:00:00");
            const today = i === d.week.length - 1;
            return (
              <div key={w.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-14 w-full items-end rounded-lg bg-white/10">
                  <div className={cx("w-full rounded-lg transition-all duration-700", w.xp ? "bg-white" : "bg-transparent")} style={{ height: `${Math.max(w.xp ? 12 : 0, (100 * w.xp) / maxXp)}%` }} />
                </div>
                <span className={cx("text-[11px]", today ? "font-bold" : "text-white/60")}>{WEEKDAYS[day.getDay()]}</span>
              </div>
            );
          })}
        </div>
        <div className="relative mt-4 flex items-center justify-between text-sm">
          <span className="text-white/80"><Trophy className="mr-1 inline h-4 w-4" /> {d.xp} XP</span>
          <span className="text-white/80">Bugun: +{d.today.xp} XP</span>
        </div>
      </section>

      {/* Kunlik challenge va fokus */}
      <section className="grid grid-cols-2 gap-3 animate-fade-up [animation-delay:.03s]">
        <Link to="/challenge" className={cx("relative overflow-hidden rounded-3xl p-4 text-white shadow-lift transition hover:-translate-y-0.5", d.challenge_done ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600")}>
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/20 blur-xl" />
          <Zap className="h-7 w-7" />
          <p className="mt-3 text-lg font-extrabold leading-tight">{d.challenge_done ? "Challenge bajarildi" : "Kunlik challenge"}</p>
          <p className="mt-0.5 text-xs text-white/85">{d.challenge_done ? "Ertaga yangi savollar ✨" : "5 savol · bonus XP"}</p>
        </Link>
        <Link to="/focus" className="card relative overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
          <div className="flex items-center justify-between">
            <Timer className="h-7 w-7 text-brand" />
            <Ring value={(100 * d.focus.today) / Math.max(1, d.focus.goal)} size={44} stroke={5}><span className="text-[10px] font-bold">{Math.min(100, Math.round((100 * d.focus.today) / Math.max(1, d.focus.goal)))}%</span></Ring>
          </div>
          <p className="mt-3 text-lg font-extrabold leading-tight">Fokus</p>
          <p className="mt-0.5 text-xs text-sub">{d.focus.today} / {d.focus.goal} daqiqa bugun</p>
        </Link>
      </section>

      <InstallBanner />
      <PushCard compact />

      {/* AI tezkor kirish */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr] animate-fade-up [animation-delay:.05s]">
        <Link to="/ai" className="card group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl gradient-hero text-white"><Bot className="h-7 w-7" /></div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">BilimAI bilan suhbat</p>
            <p className="text-sm text-sub">{d.ai.configured ? `Savolingizni yozing · bugun ${d.ai.used_today}/${d.ai.limit}` : "AI hozircha sozlanmagan"}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-sub transition group-hover:translate-x-1" />
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/ai?mode=english" className="card flex flex-col justify-between p-3.5 hover:shadow-lift"><BookOpen className="h-5 w-5 text-brand" /><span className="mt-2 text-sm font-bold">English Coach</span></Link>
          <Link to="/ai?mode=speaking" className="card flex flex-col justify-between p-3.5 hover:shadow-lift"><Mic className="h-5 w-5 text-fuchsia-500" /><span className="mt-2 text-sm font-bold">Speaking</span></Link>
        </div>
      </section>

      {/* Bugungi reja */}
      <section className="card p-5 animate-fade-up [animation-delay:.1s]">
        <div className="flex items-center gap-4">
          <Ring value={pct} size={60}><span className="text-sm font-extrabold">{pct}%</span></Ring>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Bugungi reja</h2>
            <p className="text-sm text-sub">{d.today.total ? `${d.today.done} / ${d.today.total} vazifa bajarildi` : "Bugun uchun vazifalar yo'q"}</p>
          </div>
          <Link to="/plan" className="btn-soft btn-sm">Reja</Link>
        </div>
        {d.today.tasks.length > 0 ? (
          <ul className="mt-4 divide-y divide-line">
            {d.today.tasks.map((t: any) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <button onClick={() => toggle(t)} aria-label={t.done ? "Bajarilmagan deb belgilash" : "Bajarildi"} className="shrink-0">
                  {t.done ? <CheckCircle2 className="h-6 w-6 text-ok animate-pop" /> : <Circle className="h-6 w-6 text-line" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cx("font-semibold", t.done && "text-sub line-through")}>{t.title}</p>
                  <p className="truncate text-xs text-sub">{t.minutes} daq{t.goal_title ? ` · ${t.goal_title}` : ""}</p>
                </div>
                {t.link && !t.done && <Link to={t.link} className="btn-ghost btn-sm text-brand">Boshlash</Link>}
              </li>
            ))}
          </ul>
        ) : (
          <Link to="/plan" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-line py-4 text-sm font-semibold text-brand">
            <Target className="h-4 w-4" /> Maqsad qo'ying va reja tuzing
          </Link>
        )}
      </section>

      {/* Tavsiyalar */}
      {d.recommendations.length > 0 && (
        <section className="animate-fade-up [animation-delay:.15s]">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-brand" /> Siz uchun</h2>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0">
            {d.recommendations.map((r: any) => {
              const Icon = REC_ICONS[r.icon] || Sparkles;
              return (
                <Link key={r.title} to={r.link} className="card flex w-64 shrink-0 items-center gap-3 p-4 hover:shadow-lift sm:w-auto">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0"><p className="font-bold leading-tight">{r.title}</p><p className="mt-0.5 text-xs text-sub">{r.desc}</p></div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Ingliz tili va maqsadlar */}
      <section className="grid gap-3 sm:grid-cols-2 animate-fade-up [animation-delay:.2s]">
        <Link to="/english" className="card p-5 hover:shadow-lift">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Ingliz tili va IELTS</h3>
            <Badge>{d.english.level || "Daraja?"}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted p-2.5"><p className="text-lg font-extrabold">{d.english.avg != null ? `${d.english.avg}%` : "—"}</p><p className="text-[11px] text-sub">test o'rtachasi</p></div>
            <div className="rounded-xl bg-muted p-2.5"><p className="text-lg font-extrabold">{d.english.words}</p><p className="text-[11px] text-sub">so'z</p></div>
            <div className="rounded-xl bg-muted p-2.5"><p className={cx("text-lg font-extrabold", d.english.due_words > 0 && "text-brand")}>{d.english.due_words}</p><p className="text-[11px] text-sub">takrorlash</p></div>
          </div>
          {d.english.ielts_score && <p className="mt-3 text-xs text-sub">Profildagi IELTS: {d.english.ielts_score}</p>}
        </Link>
        <div className="card p-5">
          <div className="flex items-center justify-between"><h3 className="font-bold">Maqsadlar</h3><Link to="/plan" className="text-sm font-semibold text-brand">Barchasi</Link></div>
          {d.goals.length ? (
            <ul className="mt-3 space-y-3">
              {d.goals.map((g: any) => (
                <li key={g.id}>
                  <div className="flex justify-between text-sm"><span className="font-semibold">{g.title}</span><span className="text-sub">{g.done}/{g.total}</span></div>
                  <Progress value={g.total ? (100 * g.done) / g.total : 0} className="mt-1.5" />
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-sub">Hali maqsad qo'yilmagan.</p>}
        </div>
      </section>

      {/* Kelajak */}
      <section className="animate-fade-up [animation-delay:.25s]">
        <h2 className="mb-3 text-lg font-bold">Kelajagingiz</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link to={d.career.last_result ? `/career/result/${d.career.last_result.id}` : "/career/test"} className="card col-span-2 p-4 hover:shadow-lift sm:col-span-1">
            <Compass className="h-6 w-6 text-brand" />
            <p className="mt-3 font-bold">Kasb tanlash</p>
            <p className="mt-0.5 text-xs text-sub">{d.career.last_result ? `Eng mos: ${d.career.last_result.top[0]?.title}` : "Testni topshiring — 10 daqiqa"}</p>
          </Link>
          <Link to="/universities" className="card p-4 hover:shadow-lift">
            <GraduationCap className="h-6 w-6 text-fuchsia-500" />
            <p className="mt-3 font-bold">Universitetlar</p>
            <p className="mt-0.5 text-xs text-sub">{d.favorites ? `${d.favorites} ta sevimli` : "Katalogni ko'ring"}</p>
          </Link>
          <Link to="/grants" className="card p-4 hover:shadow-lift">
            <Trophy className="h-6 w-6 text-amber-500" />
            <p className="mt-3 font-bold">Grantlar</p>
            <p className="mt-0.5 text-xs text-sub">Mos grantlarni toping</p>
          </Link>
        </div>
      </section>

      {/* Muddatlar */}
      {d.deadlines.length > 0 && (
        <section className="card p-5 animate-fade-up">
          <h2 className="flex items-center gap-2 font-bold"><CalendarClock className="h-5 w-5 text-warn" /> Muhim muddatlar</h2>
          <ul className="mt-3 divide-y divide-line">
            {d.deadlines.map((g: any) => (
              <li key={g.id}><Link to={`/grants/${g.id}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate font-semibold">{g.name}</p><p className="text-xs text-sub">{fmtDate(g.deadline)}{!g.verified && " · tekshirilmagan"}</p></div>
                <Badge tone={g.days <= 7 ? "bad" : g.days <= 30 ? "warn" : "muted"}>{g.days} kun</Badge>
              </Link></li>
            ))}
          </ul>
        </section>
      )}

      {/* Oxirgi natijalar */}
      {d.recent_results.length > 0 && (
        <section className="card p-5 animate-fade-up">
          <div className="flex items-center justify-between"><h2 className="font-bold">Oxirgi natijalar</h2><Link to="/progress" className="text-sm font-semibold text-brand">Tahlil</Link></div>
          <ul className="mt-3 space-y-3">
            {d.recent_results.map((r: any, i: number) => (
              <li key={i} className="flex items-center gap-3">
                <div className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-extrabold", r.percent >= 80 ? "bg-ok/10 text-ok" : r.percent >= 50 ? "bg-warn/15 text-warn" : "bg-bad/10 text-bad")}>{r.percent}%</div>
                <div className="min-w-0"><p className="truncate font-semibold">{r.title}</p><p className="text-xs text-sub">{SUBJECT_LABEL[r.subject] || r.subject} · {fmtDate(r.date, false)}</p></div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
