import { useState } from "react";
import { Link } from "react-router-dom";
import { Brain, Plus, Search, Trash2, Volume2 } from "lucide-react";
import { Badge, Empty, ErrorState, PageHeader, PageSkeleton } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { del } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { fmtDate, isoDate } from "../../lib/format";
import { speak, speechSupport } from "../../lib/speech";
import { AddWordModal } from "./LessonPage";

export default function Vocab() {
  const { data, error, loading, reload, setData } = useApi<any[]>("/learn/vocab/");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  const today = isoDate();
  const due = data.filter((w) => w.due <= today).length;
  const list = data.filter((w) => (w.word + w.translation).toLowerCase().includes(q.toLowerCase()));
  const remove = async (id: number) => { await del(`/learn/vocab/${id}/`); setData(data.filter((w) => w.id !== id)); toast("O'chirildi"); };
  return (
    <>
      <PageHeader title="Lug'atim" subtitle={`${data.length} ta so'z`} back="/english" action={<button className="btn-primary btn-sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> So'z</button>} />
      <Link to="/english/vocab/review" className="card flex items-center gap-4 p-4 hover:shadow-lift">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white"><Brain className="h-6 w-6" /></div>
        <div className="flex-1"><p className="font-bold">Takrorlash</p><p className="text-sm text-sub">{due ? `${due} ta so'z bugun takrorlanishi kerak` : "Bugun uchun hammasi takrorlangan 🎉"}</p></div>
        {due > 0 && <Badge>{due}</Badge>}
      </Link>
      <div className="relative mt-4"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-sub" /><input className="input pl-11" placeholder="Qidirish..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="mt-3 space-y-2">
        {list.length === 0 ? <Empty title="Lug'at bo'sh" text="Darslardagi yangi so'zlarni qo'shing va intervalli takrorlash bilan yodlang." /> : list.map((w) => (
          <div key={w.id} className="card flex items-center gap-3 p-3.5">
            {speechSupport.synthesis && <button onClick={() => speak(w.word)} aria-label="Talaffuz" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-brand"><Volume2 className="h-5 w-5" /></button>}
            <div className="min-w-0 flex-1"><p className="font-bold">{w.word} <span className="font-normal text-sub">— {w.translation}</span></p>{w.example && <p className="truncate text-sm italic text-sub">{w.example}</p>}<p className="text-[11px] text-sub">Keyingi takror: {w.due <= today ? "bugun" : fmtDate(w.due, false)}</p></div>
            <button onClick={() => remove(w.id)} aria-label="O'chirish" className="grid h-9 w-9 place-items-center rounded-lg text-sub hover:bg-bad/10 hover:text-bad"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <AddWordModal open={adding} onClose={() => { setAdding(false); reload(); }} />
    </>
  );
}
