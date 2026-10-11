import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, PartyPopper } from "lucide-react";
import { cx, Empty, ErrorState, PageHeader, PageSkeleton, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { post } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { SUBJECT_LABEL } from "../../lib/format";
import { ReviewList } from "./QuizRun";

export default function Mistakes() {
  const { data, error, loading, reload } = useApi<any[]>("/learn/mistakes/");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  const batch = data.slice(0, 10);
  const submit = async () => {
    setBusy(true);
    try { setResult(await post("/learn/mistakes/submit/", { answers })); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Xatolar ustida ishlash" subtitle={`${data.length} ta hal qilinmagan savol`} back="/practice" />
      {result ? (
        <div className="space-y-4">
          <div className="card p-6 text-center animate-pop"><CheckCircle2 className="mx-auto h-10 w-10 text-ok" /><p className="mt-2 text-xl font-extrabold">{result.fixed} / {result.total} tuzatildi</p><p className="text-sm text-sub">To'g'ri javob berilgan savollar ro'yxatdan chiqarildi.</p></div>
          <ReviewList items={result.items} />
          <button className="btn-primary w-full" onClick={() => { setResult(null); setAnswers({}); reload(); }}>Davom etish</button>
        </div>
      ) : batch.length === 0 ? (
        <Empty icon={<PartyPopper className="h-7 w-7" />} title="Xatolar yo'q!" text="Testlarni ishlang — noto'g'ri javoblar shu yerda to'planadi va siz ularni qayta yechasiz." action={<Link to="/practice" className="btn-primary">Testlar</Link>} />
      ) : (
        <div className="space-y-3">
          {batch.map((m, i) => (
            <div key={m.id} className="card p-4">
              <p className="text-xs font-semibold text-sub">{SUBJECT_LABEL[m.subject]} · {m.quiz} · {m.times} marta xato</p>
              <p className="mt-1 font-semibold">{i + 1}. {m.question.text}</p>
              <div className="mt-3 grid gap-2">{m.question.options.map((o: string, j: number) => (
                <button key={j} onClick={() => setAnswers({ ...answers, [m.question.id]: j })} className={cx("rounded-xl border px-3 py-2.5 text-left text-sm font-medium", answers[m.question.id] === j ? "border-brand bg-brand-soft" : "border-line hover:border-brand/40")}>{o}</button>
              ))}</div>
            </div>
          ))}
          <button className="btn-primary w-full" disabled={busy || !Object.keys(answers).length} onClick={submit}>{busy ? <Spinner /> : "Tekshirish"}</button>
        </div>
      )}
    </>
  );
}
