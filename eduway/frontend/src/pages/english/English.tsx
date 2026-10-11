import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Brain, CheckCircle2, Headphones, Lock, Mic, PenLine, Sparkles, SpellCheck, Trophy } from "lucide-react";
import { Badge, ErrorState, PageHeader, PageSkeleton, Progress } from "../../components/ui";
import { useApi } from "../../lib/hooks";

export const SKILLS: Record<string, { label: string; icon: any }> = {
  grammar: { label: "Grammar", icon: SpellCheck }, vocabulary: { label: "Vocabulary", icon: Brain }, reading: { label: "Reading", icon: BookOpen },
  listening: { label: "Listening", icon: Headphones }, writing: { label: "Writing", icon: PenLine }, speaking: { label: "Speaking", icon: Mic }, ielts: { label: "IELTS", icon: Trophy },
};

export default function English() {
  const { data: d, error, loading, reload } = useApi<any>("/learn/english/");
  if (loading) return <PageSkeleton />;
  if (error || !d) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Ingliz tili va IELTS" subtitle="Darajangizga mos darslar va mashqlar" back="/learn" />
      <section className="relative overflow-hidden rounded-3xl gradient-hero p-6 text-white shadow-lift animate-fade-up">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-sky-400/30 blur-2xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-white/70">Sizning darajangiz</p>
            <p className="text-4xl font-extrabold">{d.level || "—"}</p>
            {!d.level && <Link to="/settings" className="text-sm font-semibold underline">Profilda belgilang</Link>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-white/15 px-3 py-2"><p className="text-xl font-extrabold">{d.total_words}</p><p className="text-[11px] text-white/70">so'z</p></div>
            <div className="rounded-2xl bg-white/15 px-3 py-2"><p className="text-xl font-extrabold">{d.quiz_avg != null ? `${d.quiz_avg}%` : "—"}</p><p className="text-[11px] text-white/70">testlar</p></div>
          </div>
        </div>
        {d.due_words > 0 && <Link to="/english/vocab/review" className="relative mt-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3 font-semibold text-navy"><span><Brain className="mr-2 inline h-5 w-5 text-brand" />{d.due_words} ta so'z takrorlashni kutmoqda</span><ArrowRight className="h-5 w-5" /></Link>}
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-lg font-bold">Ko'nikmalar</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(SKILLS).map(([k, s]) => {
            const st = d.skills[k] || { total: 0, completed: 0 };
            return (
              <Link key={k} to={`/english/lessons?skill=${k}`} className="card p-4 hover:shadow-lift">
                <s.icon className="h-6 w-6 text-brand" />
                <p className="mt-2 font-bold">{s.label}</p>
                <p className="text-xs text-sub">{st.completed}/{st.total} dars</p>
                <Progress value={st.total ? (100 * st.completed) / st.total : 0} className="mt-2" />
              </Link>
            );
          })}
          <Link to="/english/vocab" className="card p-4 hover:shadow-lift"><Brain className="h-6 w-6 text-fuchsia-500" /><p className="mt-2 font-bold">Lug'atim</p><p className="text-xs text-sub">{d.total_words} so'z</p></Link>
        </div>
      </section>

      {d.recommended.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-brand" /> Sizga tavsiya</h2>
          <div className="space-y-2">
            {d.recommended.map((l: any) => {
              const S = SKILLS[l.skill];
              return (
                <Link key={l.id} to={`/english/lessons/${l.id}`} className="card flex items-center gap-3 p-4 hover:shadow-lift">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><S.icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1"><p className="font-bold">{l.title}</p><p className="truncate text-sm text-sub">{l.summary}</p></div>
                  <Badge>{l.level}</Badge>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link to="/english/writing" className="card p-5 hover:shadow-lift"><PenLine className="h-6 w-6 text-amber-500" /><p className="mt-3 font-bold">IELTS Writing tekshiruvi</p><p className="text-sm text-sub">AI taxminiy ball va xatolar tahlili</p></Link>
        <Link to="/ai?mode=speaking" className="card p-5 hover:shadow-lift"><Mic className="h-6 w-6 text-rose-500" /><p className="mt-3 font-bold">Speaking mashqi</p><p className="text-sm text-sub">AI bilan ovozli suhbat</p></Link>
        <Link to="/practice?subject=english,ielts" className="card p-5 hover:shadow-lift"><CheckCircle2 className="h-6 w-6 text-ok" /><p className="mt-3 font-bold">Testlar</p><p className="text-sm text-sub">Grammar, vocabulary, IELTS Reading</p></Link>
      </section>

      {d.recent_quizzes.length > 0 && (
        <section className="card mt-5 p-5">
          <h2 className="font-bold">Natijalar tarixi</h2>
          <ul className="mt-2 divide-y divide-line">{d.recent_quizzes.map((r: any, i: number) => <li key={i} className="flex justify-between py-2.5 text-sm"><span>{r.title}</span><b className={r.percent >= 70 ? "text-ok" : "text-warn"}>{r.percent}%</b></li>)}</ul>
        </section>
      )}
      <p className="mt-5 flex items-center gap-2 text-xs text-sub"><Lock className="h-3.5 w-3.5" /> Platformadagi IELTS mashqlari va AI baholari taxminiy bo'lib, rasmiy IELTS natijasi hisoblanmaydi.</p>
    </>
  );
}
