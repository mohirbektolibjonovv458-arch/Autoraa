import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bot, CheckCircle2, Headphones, Pause, Plus, Sparkles } from "lucide-react";
import { Badge, ErrorState, Field, Modal, PageHeader, PageSkeleton, PremiumLock, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { post } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { Markdown } from "../../lib/markdown";
import { speak, speechSupport, stopSpeaking } from "../../lib/speech";
import { SKILLS } from "./English";

export function AddWordModal({ open, onClose, initial = "" }: { open: boolean; onClose: () => void; initial?: string }) {
  const toast = useToast();
  const [f, setF] = useState({ word: initial, translation: "", example: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await post("/learn/vocab/", f); toast("Lug'atga qo'shildi"); setF({ word: "", translation: "", example: "" }); onClose(); }
    catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Yangi so'z">
      <div className="space-y-3">
        <Field label="So'z yoki ibora"><input className="input" value={f.word} maxLength={80} onChange={(e) => setF({ ...f, word: e.target.value })} autoFocus /></Field>
        <Field label="Tarjimasi"><input className="input" value={f.translation} maxLength={200} onChange={(e) => setF({ ...f, translation: e.target.value })} /></Field>
        <Field label="Misol (ixtiyoriy)"><input className="input" value={f.example} maxLength={300} onChange={(e) => setF({ ...f, example: e.target.value })} /></Field>
        <button className="btn-primary w-full" disabled={busy || !f.word.trim() || !f.translation.trim()} onClick={save}>{busy ? <Spinner /> : "Saqlash"}</button>
      </div>
    </Modal>
  );
}

export default function LessonPage() {
  const { id } = useParams();
  const { data: l, error, loading, reload, setData } = useApi<any>(`/learn/lessons/${id}/`);
  const toast = useToast();
  const [playing, setPlaying] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  if (loading) return <PageSkeleton />;
  if (error?.code === "premium_required") return <><PageHeader title="Dars" back /><PremiumLock text="Bu dars Premium tarifda mavjud." /></>;
  if (error || !l) return <ErrorState error={error} onRetry={reload} />;
  const S = SKILLS[l.skill];
  const complete = async () => {
    setBusy(true);
    try { const r = await post(`/learn/lessons/${l.id}/complete/`); setData({ ...l, completed: true }); if (r.new) toast("Dars yakunlandi! +15 XP"); }
    catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };
  const listen = () => {
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    setPlaying(true);
    speak(l.listening_text, "en-US", () => setPlaying(false));
  };
  return (
    <>
      <PageHeader title={l.title} back />
      <div className="flex flex-wrap gap-2"><Badge><S.icon className="h-3.5 w-3.5" /> {S.label}</Badge><Badge tone="muted">{l.level}</Badge>{l.completed && <Badge tone="ok"><CheckCircle2 className="h-3.5 w-3.5" /> Yakunlangan</Badge>}</div>
      {l.listening_text && (
        <div className="card mt-4 flex items-center gap-4 p-4">
          <button onClick={listen} disabled={!speechSupport.synthesis} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl gradient-hero text-white shadow-lift" aria-label="Tinglash">{playing ? <Pause className="h-6 w-6" /> : <Headphones className="h-6 w-6" />}</button>
          <div><p className="font-bold">Audio dialog</p><p className="text-sm text-sub">{speechSupport.synthesis ? "Brauzer ovozi o'qib beradi. Matnni ko'rmasdan tinglang." : "Brauzeringiz ovozli o'qishni qo'llab-quvvatlamaydi."}</p></div>
        </div>
      )}
      <article className="card mt-4 p-5 sm:p-7"><Markdown text={l.content} /></article>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button className={l.completed ? "btn-outline" : "btn-primary"} onClick={complete} disabled={busy || l.completed}>{busy ? <Spinner /> : l.completed ? <><CheckCircle2 className="h-4 w-4" /> Yakunlangan</> : "Darsni yakunlash"}</button>
        {l.quiz && <Link to={`/practice/quiz/${l.quiz}`} className="btn-soft"><Sparkles className="h-4 w-4" /> Mavzu testi</Link>}
        <button className="btn-outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> So'z qo'shish</button>
      </div>
      <Link to={`/ai?mode=english&topic=${encodeURIComponent(l.title)}`} className="btn-ghost mt-2 w-full text-brand"><Bot className="h-4 w-4" /> Tushunmadimmi? AI Coach'dan so'rang</Link>
      <AddWordModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
