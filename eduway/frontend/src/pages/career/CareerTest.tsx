import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cx, ErrorState, PageSkeleton, Progress, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { post } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useApi } from "../../lib/hooks";
import { Chips } from "../auth/Onboarding";

const SCALE = ["Umuman yo'q", "Unchalik", "Bilmadim", "Ha", "Juda ham"];
const SUBJECTS = ["matematika", "fizika", "kimyo", "biologiya", "informatika", "ingliz tili", "ona tili", "adabiyot", "tarix", "geografiya", "iqtisodiyot", "huquq", "san'at", "musiqa"];

export default function CareerTest() {
  const { data: t, error, loading, reload } = useApi<any>("/career/test/");
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [likert, setLikert] = useState<number[]>([]);
  const [style, setStyle] = useState<Record<string, number>>({});
  const [goals, setGoals] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>(user?.favorite_subjects || []);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (t) setLikert(Array(t.statements.length).fill(0)); }, [t]);
  if (loading) return <PageSkeleton />;
  if (error || !t) return <ErrorState error={error} onRetry={reload} />;

  const nS = t.statements.length;
  const total = nS + t.style.length + 1;
  const isLikert = step < nS;
  const isStyle = step >= nS && step < nS + t.style.length;
  const isFinal = step === total - 1;
  const answered = isLikert ? likert[step] > 0 : isStyle ? style[t.style[step - nS].id] !== undefined : true;

  const choose = (fn: () => void) => { fn(); setTimeout(() => setStep((s) => Math.min(s + 1, total - 1)), 220); };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await post("/career/submit/", { statements: likert, style, goals, subjects });
      nav(`/career/result/${r.id}`, { replace: true });
    } catch (e: any) {
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center gap-3">
        <button onClick={() => (step ? setStep(step - 1) : nav(-1))} aria-label="Orqaga" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1">
          <p className="text-sm font-semibold text-sub">{isLikert ? "1-bo'lim · Qiziqishlar" : isStyle ? "2-bo'lim · Ish uslubi" : "3-bo'lim · Maqsadlar"} — {step + 1}/{total}</p>
          <Progress value={((step + 1) / total) * 100} className="mt-1.5" />
        </div>
      </div>

      <div key={step} className="mt-8 animate-fade-up">
        {isLikert && (
          <>
            <p className="text-sm font-semibold text-brand">Bu fikr sizga qanchalik mos?</p>
            <h1 className="mt-2 text-2xl font-extrabold leading-snug">{t.statements[step].text}</h1>
            <div className="mt-8 space-y-2.5">
              {SCALE.map((label, i) => (
                <button key={i} onClick={() => choose(() => setLikert(likert.map((v, j) => (j === step ? i + 1 : v))))}
                  className={cx("flex w-full items-center gap-3 rounded-2xl border p-4 text-left font-semibold transition", likert[step] === i + 1 ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:border-brand/40")}>
                  <span className="flex gap-1">{[0, 1, 2, 3, 4].map((d) => <span key={d} className={cx("h-2.5 w-2.5 rounded-full", d <= i ? "bg-brand" : "bg-line")} />)}</span>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
        {isStyle && (() => {
          const q = t.style[step - nS];
          return (
            <>
              <h1 className="text-2xl font-extrabold leading-snug">{q.text}</h1>
              <div className="mt-8 space-y-2.5">
                {q.options.map((o: string, i: number) => (
                  <button key={i} onClick={() => choose(() => setStyle({ ...style, [q.id]: i }))}
                    className={cx("flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left font-semibold transition", style[q.id] === i ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:border-brand/40")}>
                    {o} {style[q.id] === i && <Check className="h-5 w-5" />}
                  </button>
                ))}
              </div>
            </>
          );
        })()}
        {isFinal && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold">Kelajakda siz uchun nima muhim?</h1>
              <p className="mt-1 text-sub">Bir nechtasini tanlang.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {t.goals.map((g: any) => (
                  <button key={g.id} onClick={() => setGoals(goals.includes(g.id) ? goals.filter((x) => x !== g.id) : [...goals, g.id])} className={cx("chip", goals.includes(g.id) && "chip-on")}>
                    {goals.includes(g.id) && <Check className="h-4 w-4" />} {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold">Yoqtirgan fanlaringiz</h2>
              <div className="mt-3"><Chips items={SUBJECTS} value={subjects} onChange={setSubjects} /></div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-10">
        {isFinal ? (
          <button className="btn-primary h-12 w-full" onClick={submit} disabled={busy}>{busy ? <Spinner /> : "Natijani ko'rish"}</button>
        ) : (
          <button className="btn-outline h-12 w-full" onClick={() => setStep(step + 1)} disabled={!answered}>Keyingi <ArrowRight className="h-5 w-5" /></button>
        )}
      </div>
    </div>
  );
}
