import { useState } from "react";
import { Link } from "react-router-dom";
import { PartyPopper, RotateCw, Volume2 } from "lucide-react";
import { Empty, ErrorState, PageHeader, PageSkeleton, Progress } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { post } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { speak, speechSupport } from "../../lib/speech";

const BTN = [
  { q: 0, label: "Yana", cls: "bg-bad/10 text-bad" }, { q: 1, label: "Qiyin", cls: "bg-warn/15 text-warn" },
  { q: 2, label: "Yaxshi", cls: "bg-brand-soft text-brand" }, { q: 3, label: "Oson", cls: "bg-ok/10 text-ok" },
];

export default function VocabReview() {
  const { data, error, loading, reload } = useApi<any[]>("/learn/vocab/?due=1");
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [again, setAgain] = useState<any[]>([]);
  const toast = useToast();
  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  const queue = [...data, ...again];
  if (!queue.length) return <><PageHeader title="Takrorlash" back="/english/vocab" /><Empty icon={<PartyPopper className="h-7 w-7" />} title="Bugun takrorlash uchun so'z yo'q" text="Yangi so'zlar qo'shing yoki ertaga qayting." action={<Link to="/english/vocab" className="btn-primary">Lug'at</Link>} /></>;
  if (i >= queue.length) return (
    <><PageHeader title="Takrorlash" back="/english/vocab" />
      <div className="card p-8 text-center animate-pop"><PartyPopper className="mx-auto h-12 w-12 text-brand" /><h2 className="mt-3 text-2xl font-extrabold">Barakalla!</h2><p className="mt-1 text-sub">{queue.length} ta karta takrorlandi.</p><Link to="/english" className="btn-primary mt-5">Davom etish</Link></div></>
  );
  const w = queue[i];
  const rate = async (q: number) => {
    try {
      await post(`/learn/vocab/${w.id}/review/`, { quality: q });
      if (q === 0 && !again.some((x) => x.id === w.id)) setAgain([...again, w]);
      setFlip(false);
      setI(i + 1);
    } catch (e: any) { toast(e.message, "bad"); }
  };
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Takrorlash" subtitle={`${i + 1} / ${queue.length}`} back="/english/vocab" />
      <Progress value={(i / queue.length) * 100} />
      <button onClick={() => setFlip(!flip)} className="card mt-6 flex min-h-[280px] w-full flex-col items-center justify-center p-8 text-center transition active:scale-[.99]" aria-label="Kartani aylantirish">
        <p className="text-3xl font-extrabold">{w.word}</p>
        {flip ? (
          <div className="mt-5 animate-fade-up"><p className="text-xl font-semibold text-brand">{w.translation}</p>{w.example && <p className="mt-3 italic text-sub">{w.example}</p>}</div>
        ) : <p className="mt-5 flex items-center gap-2 text-sm text-sub"><RotateCw className="h-4 w-4" /> Tarjimani ko'rish uchun bosing</p>}
      </button>
      {speechSupport.synthesis && <button onClick={() => speak(w.word)} className="btn-ghost mx-auto mt-2 flex"><Volume2 className="h-4 w-4" /> Talaffuz</button>}
      {flip && <div className="mt-4 grid grid-cols-4 gap-2 animate-fade-up">{BTN.map((b) => <button key={b.q} onClick={() => rate(b.q)} className={`btn h-12 ${b.cls}`}>{b.label}</button>)}</div>}
    </div>
  );
}
