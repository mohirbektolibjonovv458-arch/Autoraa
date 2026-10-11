import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Clock, Lock, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { Badge, cx, Empty, ErrorState, Field, Modal, PageHeader, PageSkeleton, PremiumLock, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { post } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useApi } from "../../lib/hooks";
import { LEVEL_LABEL, SUBJECT_LABEL } from "../../lib/format";

function Generator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ subject: "math", topic: "", level: "medium", count: 8 });
  const [busy, setBusy] = useState(false);
  const premium = user?.is_premium || user?.is_admin;
  const go = async () => {
    setBusy(true);
    try { const r = await post("/ai/quiz/", f); toast(`Test tayyor: ${r.questions} ta savol`); nav(`/practice/quiz/${r.quiz}`); }
    catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="AI test generatori">
      {!premium ? <PremiumLock text="Istalgan mavzu bo'yicha AI test tuzish Premium tarifda." /> : (
        <div className="space-y-4">
          <div><span className="label">Fan</span><div className="flex flex-wrap gap-2">{Object.entries(SUBJECT_LABEL).map(([k, v]) => <button key={k} onClick={() => setF({ ...f, subject: k })} className={cx("chip", f.subject === k && "chip-on")}>{v}</button>)}</div></div>
          <Field label="Mavzu"><input className="input" value={f.topic} maxLength={120} placeholder="Masalan: Logarifmlar" onChange={(e) => setF({ ...f, topic: e.target.value })} /></Field>
          <div><span className="label">Qiyinlik</span><div className="flex gap-2">{Object.entries(LEVEL_LABEL).map(([k, v]) => <button key={k} onClick={() => setF({ ...f, level: k })} className={cx("chip", f.level === k && "chip-on")}>{v}</button>)}</div></div>
          <div><span className="label">Savollar soni: <b className="text-brand">{f.count}</b></span><input type="range" min={5} max={15} value={f.count} onChange={(e) => setF({ ...f, count: +e.target.value })} className="w-full accent-[rgb(var(--brand))]" /></div>
          <button className="btn-primary w-full" disabled={busy || f.topic.trim().length < 2} onClick={go}>{busy ? <><Spinner /> Tuzilmoqda...</> : <><Wand2 className="h-4 w-4" /> Test tuzish</>}</button>
          <p className="text-xs text-sub">AI yaratgan savollarda xato bo'lishi mumkin. Shubhali javobni AI Tutor'dan qayta so'rang.</p>
        </div>
      )}
    </Modal>
  );
}

export default function Practice() {
  const [sp, setSp] = useSearchParams();
  const subject = sp.get("subject") || "";
  const mine = sp.get("mine") === "1";
  const { data, error, loading, reload } = useApi<any[]>(`/learn/quizzes/?${subject ? `subject=${subject}&` : ""}${mine ? "mine=1" : ""}`);
  const [gen, setGen] = useState(false);
  return (
    <>
      <PageHeader title="Testlar" subtitle="Har urinishda savollar, tartib va variantlar almashadi — yodlab bo'lmaydi" back="/learn" action={<button className="btn-primary btn-sm" onClick={() => setGen(true)}><Wand2 className="h-4 w-4" /> AI test</button>} />
      <Link to="/practice/mistakes" className="card mb-4 flex items-center gap-3 p-4 hover:shadow-lift">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-rose-500/10 text-rose-500"><RefreshCw className="h-5 w-5" /></div>
        <div className="flex-1"><p className="font-bold">Xatolar ustida ishlash</p><p className="text-sm text-sub">Noto'g'ri javob bergan savollaringizni qayta yeching</p></div>
      </Link>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button onClick={() => setSp({})} className={cx("chip shrink-0", !subject && !mine && "chip-on")}>Barchasi</button>
        <button onClick={() => setSp({ mine: "1" })} className={cx("chip shrink-0", mine && "chip-on")}><Sparkles className="h-4 w-4" /> Mening AI testlarim</button>
        {Object.entries(SUBJECT_LABEL).map(([k, v]) => <button key={k} onClick={() => setSp({ subject: k })} className={cx("chip shrink-0", subject === k && "chip-on")}>{v}</button>)}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {loading ? <div className="sm:col-span-2"><PageSkeleton /></div> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? <div className="sm:col-span-2"><Empty title="Testlar topilmadi" /></div> : data.map((q, i) => (
          <Link key={q.id} to={q.locked ? "/premium" : `/practice/quiz/${q.id}`} className="card flex flex-col p-4 hover:shadow-lift animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 0.03}s` }}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold leading-snug">{q.title}</p>
              {q.locked ? <Lock className="h-5 w-5 shrink-0 text-warn" /> : q.best != null && <Badge tone={q.best >= 80 ? "ok" : "warn"}>{q.best}%</Badge>}
            </div>
            {q.description && <p className="mt-1 line-clamp-2 text-sm text-sub">{q.description}</p>}
            <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
              <Badge tone="muted">{SUBJECT_LABEL[q.subject]}</Badge>
              <Badge tone="muted">{LEVEL_LABEL[q.level] || q.level}</Badge>
              <Badge tone="muted">{q.question_count} savol</Badge>
              {q.time_limit_seconds && <Badge tone="muted"><Clock className="h-3 w-3" /> {Math.round(q.time_limit_seconds / 60)} daq</Badge>}
              {q.owner && <Badge>AI</Badge>}
              {q.generator ? <Badge tone="ok">♾ Har safar yangi savollar</Badge> : q.bank_size > q.question_count && <Badge tone="ok">{q.bank_size} savoldan tasodifiy</Badge>}
            </div>
          </Link>
        ))}
      </div>
      <Generator open={gen} onClose={() => setGen(false)} />
    </>
  );
}
