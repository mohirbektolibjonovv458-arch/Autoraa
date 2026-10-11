import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, Sparkles } from "lucide-react";
import { cx, ErrorState, PageHeader, PageSkeleton, Progress, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { post } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useApi } from "../../lib/hooks";

const DESC: Record<string, string> = {
  A1: "Boshlang'ich: oddiy ibora va gaplarni tushunasiz.",
  A2: "Elementar: kundalik mavzularda qisqa muloqot qila olasiz.",
  B1: "O'rta: tanish mavzularda erkin gapirasiz, asosiy fikrni tushunasiz.",
  B2: "O'rtadan yuqori: murakkab matnlarni tushunasiz, ravon gapirasiz.",
  C1: "Yuqori: akademik va kasbiy muhitda erkin foydalanasiz.",
};

export default function Placement() {
  const { data, error, loading, reload } = useApi<any>("/learn/placement/");
  const { refresh } = useAuth();
  const toast = useToast();
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  const qs = data.questions;

  const submit = async (final: Record<number, string>) => {
    setBusy(true);
    try { const r = await post("/learn/placement/submit/", { answers: final }); setResult(r); refresh(); }
    catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };

  if (result) return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Natija" back="/english" />
      <div className="relative overflow-hidden rounded-[32px] gradient-hero p-8 text-center text-white shadow-lift animate-pop">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-sky-400/30 blur-2xl" />
        <p className="text-white/70">Taxminiy darajangiz</p>
        <p className="mt-1 text-7xl font-extrabold tracking-tight">{result.level}</p>
        <p className="mx-auto mt-3 max-w-sm text-white/85">{DESC[result.level]}</p>
      </div>
      <div className="card space-y-3 p-5">
        {Object.entries(result.breakdown).map(([l, v]: any) => (
          <div key={l}><div className="flex justify-between text-sm"><b>{l}</b><span className="text-sub">{v}%</span></div><Progress value={v} tone={v >= 60 ? "ok" : "brand"} className="mt-1" /></div>
        ))}
        <p className="pt-1 text-xs text-sub">Daraja profilingizga saqlandi. Bu qisqa test asosidagi taxminiy baho — rasmiy sertifikat emas.</p>
      </div>
      <Link to="/english" className="btn-primary w-full">Darajamga mos darslar <ArrowRight className="h-4 w-4" /></Link>
    </div>
  );

  if (!started) return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Darajani aniqlash" back="/english" />
      <div className="card p-6 text-center animate-fade-up">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl gradient-hero text-white shadow-lift"><GraduationCap className="h-10 w-10" /></div>
        <h2 className="mt-5 text-2xl font-extrabold">Ingliz tili darajangiz qanday?</h2>
        <p className="mt-2 text-sub">{qs.length} ta savol, A1 dan C1 gacha. Taxminan 7 daqiqa. Bilmagan savolni o'tkazib yuboring — taxmin qilmang, natija aniqroq chiqadi.</p>
        {data.current && <p className="mt-3 text-sm">Hozirgi darajangiz: <b>{data.current}</b></p>}
        <button className="btn-primary mt-6 h-12 w-full" onClick={() => setStarted(true)}><Sparkles className="h-5 w-5" /> Boshlash</button>
      </div>
    </div>
  );

  const q = qs[i];
  const next = (ans: Record<number, string>) => (i < qs.length - 1 ? setI(i + 1) : submit(ans));
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Darajani aniqlash" subtitle={`${i + 1} / ${qs.length}`} back="/english" />
      <Progress value={((i + 1) / qs.length) * 100} />
      <div key={q.id} className="mt-8 animate-fade-up">
        <h1 className="text-2xl font-bold leading-snug">{q.text}</h1>
        <div className="mt-6 space-y-2.5">
          {q.options.map((o: string, j: number) => (
            <button key={j} disabled={busy} onClick={() => { const a = { ...answers, [q.id]: o }; setAnswers(a); setTimeout(() => next(a), 220); }}
              className={cx("w-full rounded-2xl border p-4 text-left font-medium transition", answers[q.id] === o ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/40")}>{o}</button>
          ))}
        </div>
        <button className="btn-ghost mt-4 w-full text-sub" disabled={busy} onClick={() => { const a = { ...answers, [q.id]: "" }; setAnswers(a); next(a); }}>{busy ? <Spinner /> : "Bilmayman — o'tkazib yuborish"}</button>
      </div>
    </div>
  );
}
