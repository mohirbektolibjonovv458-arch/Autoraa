import { useState } from "react";
import { AlertTriangle, CheckCircle2, History, PenLine } from "lucide-react";
import { cx, ErrorState, Field, PageHeader, PageSkeleton, PremiumLock, Ring, Segmented, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { post } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useApi } from "../../lib/hooks";
import { fmtDate } from "../../lib/format";
import { Markdown } from "../../lib/markdown";

const PROMPTS = [
  "Some people believe that university education should be free for everyone. To what extent do you agree or disagree?",
  "Many young people spend a lot of time on social media. What are the advantages and disadvantages of this?",
  "Some think that studying abroad is the best way to learn a foreign language. Discuss both views and give your opinion.",
];

function Result({ r }: { r: any }) {
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="card flex items-center gap-5 p-5">
        <Ring value={(r.overall / 9) * 100} size={88} stroke={9}><div><p className="text-2xl font-extrabold">{r.overall}</p><p className="text-[10px] text-sub">taxminiy</p></div></Ring>
        <div className="flex-1">
          <p className="font-bold">Taxminiy band</p>
          <p className="text-sm text-sub">{r.word_count} so'z · bu rasmiy IELTS balli emas</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {r.criteria.map((c: any) => <div key={c.name} className="card p-4"><div className="flex justify-between"><p className="font-semibold">{c.name}</p><b className="text-brand">{c.band}</b></div><p className="mt-1 text-sm text-sub">{c.comment}</p></div>)}
      </div>
      {r.strengths.length > 0 && <div className="card p-5"><h3 className="font-bold">Kuchli tomonlar</h3><ul className="mt-2 space-y-1.5 text-sm">{r.strengths.map((s: string) => <li key={s} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" />{s}</li>)}</ul></div>}
      {r.mistakes.length > 0 && (
        <div className="card p-5"><h3 className="font-bold">Xatolar va tuzatishlar</h3>
          <ul className="mt-3 space-y-3">{r.mistakes.map((m: any, i: number) => (
            <li key={i} className="rounded-xl bg-muted p-3 text-sm"><p><span className="text-bad line-through">{m.original}</span> → <span className="font-semibold text-ok">{m.correction}</span></p><p className="mt-1 text-sub">{m.explanation}</p></li>
          ))}</ul>
        </div>
      )}
      {r.next_steps.length > 0 && <div className="card p-5"><h3 className="font-bold">Keyingi qadamlar</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{r.next_steps.map((s: string) => <li key={s}>{s}</li>)}</ul></div>}
      <div className="card p-5"><h3 className="font-bold">Yaxshilangan variant</h3><div className="mt-2"><Markdown text={r.improved_version} /></div></div>
    </div>
  );
}

export default function Writing() {
  const { user } = useAuth();
  const premium = user?.is_premium || user?.is_admin;
  const history = useApi<any[]>("/ai/writing/");
  const toast = useToast();
  const [task, setTask] = useState<"task2" | "task1" | "general">("task2");
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [tab, setTab] = useState<"write" | "history">("write");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const target = task === "task1" ? 150 : 250;

  const submit = async () => {
    setBusy(true);
    try { const r = await post("/ai/writing/", { task_type: task, prompt, text }); setResult(r.result); history.reload(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="IELTS Writing" subtitle="Esse yozing — AI mezonlar bo'yicha tahlil qiladi" back="/english" />
      <Segmented value={tab} onChange={setTab} options={[{ value: "write", label: "Yozish" }, { value: "history", label: "Tarix" }]} />
      {tab === "history" ? (
        <div className="mt-4 space-y-3">
          {history.loading ? <PageSkeleton /> : history.error ? <ErrorState error={history.error} /> : !history.data?.length ? <p className="text-center text-sm text-sub">Hali tekshiruvlar yo'q.</p> : history.data.map((h) => (
            <details key={h.id} className="card p-4"><summary className="flex cursor-pointer items-center justify-between gap-3 font-semibold"><span className="flex items-center gap-2"><History className="h-4 w-4 text-brand" /> {fmtDate(h.created)} · {h.task_type}</span><b className="text-brand">{h.result.overall}</b></summary><div className="mt-4"><Result r={h.result} /></div></details>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {result && <Result r={result} />}
          {!premium && <PremiumLock text="AI Writing tahlili Premium tarifda. Bepul tarifda esse yozib, strukturani darsdan o'rganishingiz mumkin." compact />}
          <div className="card space-y-4 p-5">
            <Segmented value={task} onChange={setTask} options={[{ value: "task2", label: "Task 2" }, { value: "task1", label: "Task 1" }, { value: "general", label: "Erkin" }]} />
            <Field label="Topshiriq">
              <textarea className="input min-h-[84px] py-3" value={prompt} maxLength={1500} onChange={(e) => setPrompt(e.target.value)} />
            </Field>
            {task === "task2" && <div className="flex flex-wrap gap-2">{PROMPTS.map((p, i) => <button key={i} onClick={() => setPrompt(p)} className={cx("chip h-8 text-xs", prompt === p && "chip-on")}>Mavzu {i + 1}</button>)}</div>}
            <Field label="Sizning javobingiz">
              <textarea className="input min-h-[280px] py-3 leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your essay here..." spellCheck={false} />
            </Field>
            <div className="flex items-center justify-between text-sm">
              <span className={cx("font-semibold", words >= target ? "text-ok" : "text-sub")}>{words} / {target}+ so'z</span>
              {words > 0 && words < 50 && <span className="flex items-center gap-1 text-warn"><AlertTriangle className="h-4 w-4" /> Kamida 50 so'z</span>}
            </div>
            <button className="btn-primary w-full" disabled={!premium || busy || words < 50 || words > 700} onClick={submit}>{busy ? <><Spinner /> Tahlil qilinmoqda...</> : <><PenLine className="h-4 w-4" /> AI tahlilini olish</>}</button>
            <p className="text-xs text-sub">Natija IELTS band deskriptorlari asosidagi taxminiy baho. Rasmiy natijani faqat IELTS imtihon markazi beradi.</p>
          </div>
        </div>
      )}
    </>
  );
}
