import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Flag, Lightbulb, PartyPopper, RotateCcw, Trophy, XCircle } from "lucide-react";
import { cx, ErrorState, Modal, PageSkeleton, PremiumLock, Progress, Ring, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { ApiError, post } from "../../lib/api";
import { fmtDuration } from "../../lib/format";

export function ReviewList({ items }: { items: any[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={it.question} className={cx("card p-4", it.correct ? "border-ok/30" : "border-bad/30")}>
          <p className="flex gap-2 font-semibold">{it.correct ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-bad" />}<span>{i + 1}. {it.text}</span></p>
          <ul className="mt-2 space-y-1 pl-7 text-sm">
            {it.options.map((o: string, j: number) => (
              <li key={j} className={cx("rounded-lg px-2 py-1", j === it.correct_index ? "bg-ok/10 font-semibold text-ok" : j === it.chosen ? "bg-bad/10 text-bad line-through" : "text-sub")}>{o}</li>
            ))}
          </ul>
          {it.chosen == null && <p className="mt-1 pl-7 text-xs text-warn">Javob berilmagan</p>}
          {it.explanation && <p className="mt-2 flex gap-2 rounded-xl bg-brand-soft/60 p-3 text-sm"><Lightbulb className="h-4 w-4 shrink-0 text-brand" />{it.explanation}</p>}
        </li>
      ))}
    </ul>
  );
}

export default function QuizRun() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [run, setRun] = useState<any>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [left, setLeft] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    post(`/learn/quizzes/${id}/start/`).then((r) => { setRun(r); if (r.quiz.time_limit_seconds) setLeft(r.quiz.time_limit_seconds); }).catch(setError);
  }, [id]);

  const submit = async () => {
    if (busy || result) return;
    setBusy(true);
    setConfirm(false);
    try { setResult(await post(`/learn/attempts/${run.attempt}/submit/`, { answers })); }
    catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };

  useEffect(() => {
    if (left == null || result) return;
    if (left <= 0) { toast("Vaqt tugadi — javoblar yuborildi", "info"); submit(); return; }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left, result]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error?.code === "premium_required") return <PremiumLock text="Bu test Premium tarifda mavjud." />;
  if (error) return <ErrorState error={error} />;
  if (!run) return <PageSkeleton />;

  if (result) {
    const pct = result.percent;
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="relative overflow-hidden rounded-3xl gradient-hero p-6 text-center text-white shadow-lift animate-pop">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-400/30 blur-2xl" />
          {pct >= 80 ? <PartyPopper className="mx-auto h-10 w-10" /> : pct >= 50 ? <Trophy className="mx-auto h-10 w-10" /> : <Flag className="mx-auto h-10 w-10" />}
          <h1 className="mt-2 text-2xl font-extrabold">{pct >= 80 ? "Ajoyib natija!" : pct >= 50 ? "Yaxshi harakat!" : "Mashq qilishda davom eting"}</h1>
          <div className="mx-auto mt-4 w-fit rounded-full bg-white/10 p-2"><Ring value={pct} size={110} stroke={10}><div><p className="text-3xl font-extrabold">{pct}%</p><p className="text-xs text-white/70">{result.score}/{result.total}</p></div></Ring></div>
          <p className="mt-3 text-sm text-white/80"><Clock className="mr-1 inline h-4 w-4" />{fmtDuration(result.duration_seconds)}{result.overtime && " · vaqt chegarasidan oshdi"} · +20 XP</p>
        </div>
        {result.weak_topics.length > 0 && (
          <div className="card p-5"><h2 className="font-bold">Zaif mavzular</h2>
            <ul className="mt-2 space-y-2">{result.weak_topics.map((w: any) => <li key={w.topic}><div className="flex justify-between text-sm"><span>{w.topic}</span><b>{w.accuracy}%</b></div><Progress value={w.accuracy} className="mt-1" /></li>)}</ul></div>
        )}
        {result.recommendations.length > 0 && (
          <div className="card p-5"><h2 className="font-bold">Keyingi qadamlar</h2>
            <div className="mt-3 space-y-2">{result.recommendations.map((r: any) => <Link key={r.title} to={r.link} className="flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm font-semibold hover:bg-brand-soft">{r.title}<ArrowRight className="h-4 w-4" /></Link>)}</div></div>
        )}
        <h2 className="pt-2 text-lg font-bold">Javoblar tahlili</h2>
        <ReviewList items={result.items} />
        <div className="grid grid-cols-2 gap-2 pb-4"><button className="btn-outline" onClick={() => window.location.reload()}><RotateCcw className="h-4 w-4" /> Qayta</button><Link to="/practice" className="btn-primary">Testlar</Link></div>
      </div>
    );
  }

  const qs = run.questions;
  const q = qs[i];
  const answered = Object.keys(answers).length;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} aria-label="Chiqish" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1"><p className="truncate font-bold">{run.quiz.title}</p><p className="text-xs text-sub">{i + 1} / {qs.length} · {answered} ta javob</p></div>
        {left != null && <div className={cx("flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-sm font-bold", left < 60 ? "bg-bad/10 text-bad animate-pulse" : "bg-muted")}><Clock className="h-4 w-4" />{fmtDuration(left)}</div>}
      </div>
      <Progress value={((i + 1) / qs.length) * 100} className="mt-4" />
      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
        {qs.map((x: any, j: number) => <button key={x.id} onClick={() => setI(j)} className={cx("h-8 w-8 shrink-0 rounded-lg text-xs font-bold", j === i ? "bg-brand text-white" : answers[x.id] !== undefined ? "bg-brand-soft text-brand" : "bg-muted text-sub")}>{j + 1}</button>)}
      </div>
      <div key={q.id} className="mt-6 animate-fade-up">
        {q.topic && <p className="text-sm font-semibold text-brand">{q.topic}</p>}
        <h1 className="mt-1 whitespace-pre-line text-xl font-bold leading-snug">{q.text}</h1>
        <div className="mt-6 space-y-2.5">
          {q.options.map((o: string, j: number) => (
            <button key={j} onClick={() => setAnswers({ ...answers, [q.id]: j })} className={cx("flex w-full items-center gap-3 rounded-2xl border p-4 text-left font-medium transition", answers[q.id] === j ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/40")}>
              <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold", answers[q.id] === j ? "bg-brand text-white" : "bg-muted text-sub")}>{String.fromCharCode(65 + j)}</span>{o}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-8 flex gap-3">
        <button className="btn-outline h-12 w-14" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Oldingi"><ArrowLeft className="h-5 w-5" /></button>
        {i < qs.length - 1 ? <button className="btn-primary h-12 flex-1" onClick={() => setI(i + 1)}>Keyingi <ArrowRight className="h-5 w-5" /></button>
          : <button className="btn-primary h-12 flex-1" disabled={busy} onClick={() => (answered < qs.length ? setConfirm(true) : submit())}>{busy ? <Spinner /> : "Yakunlash"}</button>}
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Testni yakunlaysizmi?">
        <p className="text-sub">{qs.length - answered} ta savolga javob berilmagan. Ular noto'g'ri hisoblanadi.</p>
        <div className="mt-5 grid grid-cols-2 gap-2"><button className="btn-outline" onClick={() => setConfirm(false)}>Qaytish</button><button className="btn-primary" onClick={submit}>Yakunlash</button></div>
      </Modal>
    </div>
  );
}
