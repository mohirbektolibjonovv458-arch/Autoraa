import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, PartyPopper, Zap } from "lucide-react";
import { cx, ErrorState, PageHeader, PageSkeleton, Progress, Ring, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";
import { post } from "../lib/api";
import { useApi } from "../lib/hooks";
import { SUBJECT_LABEL } from "../lib/format";
import { ReviewList } from "./practice/QuizRun";

export default function Challenge() {
  const { data, error, loading, reload } = useApi<any>("/learn/challenge/");
  const toast = useToast();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  const done = result || (data.done ? { score: data.score, total: data.total, items: data.items, count: data.count } : null);
  if (done) {
    const pct = Math.round((100 * done.score) / Math.max(1, done.total));
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title="Kunlik challenge" back="/home" />
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600 p-6 text-center text-white shadow-lift animate-pop">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
          <PartyPopper className="mx-auto h-10 w-10" />
          <h2 className="mt-2 text-2xl font-extrabold">{pct === 100 ? "Mukammal!" : pct >= 60 ? "Zo'r natija!" : "Bugun ham bir qadam oldinga!"}</h2>
          <div className="mx-auto mt-4 w-fit rounded-full bg-white/15 p-2"><Ring value={pct} size={104} stroke={10}><div><p className="text-3xl font-extrabold">{done.score}/{done.total}</p></div></Ring></div>
          {result && <p className="mt-3 font-semibold">+{result.xp} XP</p>}
          <p className="mt-1 text-sm text-white/80">Jami bajarilgan challenge'lar: {done.count}. Ertaga yangi savollar!</p>
        </div>
        <h2 className="pt-2 text-lg font-bold">Javoblar</h2>
        <ReviewList items={done.items} />
        <Link to="/practice/mistakes" className="btn-outline w-full">Xatolar ustida ishlash <ArrowRight className="h-4 w-4" /></Link>
      </div>
    );
  }

  const qs = data.questions;
  if (!qs.length) return <><PageHeader title="Kunlik challenge" back="/home" /><p className="text-sub">Hozircha savollar yo'q.</p></>;
  const q = qs[i];
  const submit = async () => {
    setBusy(true);
    try { setResult(await post("/learn/challenge/submit/", { answers })); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };
  const choose = (j: number) => {
    setAnswers({ ...answers, [q.id]: j });
    if (i < qs.length - 1) setTimeout(() => setI(i + 1), 280);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Kunlik challenge" subtitle="5 ta savol · har kuni yangi · bonus XP" back="/home" />
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white"><Zap className="h-5 w-5" /></div>
        <div className="flex-1"><p className="text-sm font-semibold text-sub">{i + 1} / {qs.length} · {SUBJECT_LABEL[q.subject] || q.subject}</p><Progress value={((i + 1) / qs.length) * 100} className="mt-1.5" /></div>
      </div>
      <div key={q.id} className="mt-6 animate-fade-up">
        <h1 className="whitespace-pre-line text-xl font-bold leading-snug">{q.text}</h1>
        <div className="mt-6 space-y-2.5">
          {q.options.map((o: string, j: number) => (
            <button key={j} onClick={() => choose(j)} className={cx("flex w-full items-center gap-3 rounded-2xl border p-4 text-left font-medium transition", answers[q.id] === j ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/40")}>
              <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold", answers[q.id] === j ? "bg-brand text-white" : "bg-muted text-sub")}>{answers[q.id] === j ? <Check className="h-4 w-4" /> : String.fromCharCode(65 + j)}</span>{o}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        {qs.map((x: any, j: number) => <button key={x.id} onClick={() => setI(j)} aria-label={`${j + 1}-savol`} className={cx("h-2 flex-1 rounded-full transition", j === i ? "bg-brand" : answers[x.id] !== undefined ? "bg-brand/40" : "bg-line")} />)}
      </div>
      <button className="btn-primary mt-6 h-12 w-full" disabled={busy || Object.keys(answers).length < qs.length} onClick={submit}>{busy ? <Spinner /> : `Yakunlash (${Object.keys(answers).length}/${qs.length})`}</button>
    </div>
  );
}
