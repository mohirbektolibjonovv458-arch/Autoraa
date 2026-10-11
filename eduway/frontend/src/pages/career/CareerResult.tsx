import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { Bot, Info, RotateCcw, Sparkles } from "lucide-react";
import { ErrorState, PageHeader, PageSkeleton, Progress, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { post } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { Markdown } from "../../lib/markdown";
import { careerIcon } from "./icons";

export default function CareerResult() {
  const { id } = useParams();
  const { data: r, error, loading, reload, setData } = useApi<any>(`/career/results/${id}/`);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (loading) return <PageSkeleton />;
  if (error || !r) return <ErrorState error={error} onRetry={reload} />;

  const dims = Object.entries(r.scores as Record<string, number>).map(([k, v]) => ({ k, name: r.dimensions[k].name, v }));
  const top = [...dims].sort((a, b) => b.v - a.v).slice(0, 2);

  const askAI = async () => {
    setBusy(true);
    try {
      const d = await post(`/ai/career-advice/${r.id}/`);
      setData({ ...r, ai_advice: d.ai_advice });
    } catch (e: any) {
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Sizning natijangiz" subtitle="Kasbiy qiziqishlar profili (Holland/RIASEC modeli)" back="/career" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="card p-5 animate-fade-up">
          <div className="h-64">
            <ResponsiveContainer>
              <RadarChart data={dims} outerRadius="62%" margin={{ left: 24, right: 24, top: 8, bottom: 8 }}>
                <PolarGrid stroke="rgb(var(--line))" />
                <PolarAngleAxis dataKey="name" tick={{ fill: "rgb(var(--sub))", fontSize: 12, fontWeight: 600 }} />
                <Radar dataKey="v" stroke="rgb(var(--brand))" fill="rgb(var(--brand))" fillOpacity={0.3} strokeWidth={2} isAnimationActive />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-3">
            {top.map((d) => (
              <div key={d.k} className="rounded-2xl bg-brand-soft p-3">
                <p className="font-bold text-brand">{d.name} · {d.v}%</p>
                <p className="text-sm text-sub">{r.dimensions[d.k].desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-brand" /> Sizga mos kelishi mumkin bo'lgan kasblar</h2>
          {r.matches.map((m: any, i: number) => {
            const Icon = careerIcon(m.icon);
            return (
              <Link key={m.slug} to={`/career/${m.slug}`} className="card block p-4 hover:shadow-lift animate-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><p className="font-bold">{m.title}</p><span className="text-sm font-extrabold text-brand">{m.match}%</span></div>
                    <Progress value={m.match} className="mt-1.5" />
                  </div>
                </div>
                {i < 3 && <ul className="mt-3 space-y-1 text-sm text-sub">{m.reasons.map((x: string) => <li key={x}>• {x}</li>)}</ul>}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card mt-4 p-5">
        <h2 className="flex items-center gap-2 font-bold"><Bot className="h-5 w-5 text-brand" /> AI Career Advisor tahlili</h2>
        {r.ai_advice ? <div className="mt-3"><Markdown text={r.ai_advice} /></div> : (
          <>
            <p className="mt-1 text-sm text-sub">AI natijangizni batafsil tushuntiradi: nega bu kasblar mos, qaysi ko'nikmalarni rivojlantirish kerak va keyingi qadamlar.</p>
            <button className="btn-primary mt-3" onClick={askAI} disabled={busy}>{busy ? <Spinner /> : "AI tahlilini olish"}</button>
          </>
        )}
      </div>

      <div className="mt-4 flex gap-3 rounded-2xl border border-line bg-muted/50 p-4 text-sm text-sub">
        <Info className="h-5 w-5 shrink-0 text-brand" />
        <p>Bu natija sizning hozirgi qiziqishlaringizni aks ettiradi va kasbni o'rganish uchun yo'nalish beradi. U qobiliyatingizni o'lchamaydi va yakuniy qaror emas — kasblar haqida ko'proq o'qing, mutaxassislar bilan gaplashing va o'zingizni sinab ko'ring.</p>
      </div>
      <Link to="/career/test" className="btn-outline mt-4 w-full"><RotateCcw className="h-4 w-4" /> Testni qayta topshirish</Link>
    </>
  );
}
