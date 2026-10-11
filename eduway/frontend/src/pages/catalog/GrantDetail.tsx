import { useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Bookmark, CheckCircle2, CircleDashed, ExternalLink, Plus, Trash2, XCircle } from "lucide-react";
import { Badge, cx, ErrorState, PageHeader, PageSkeleton, Progress, VerifiedBadge } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { del, patch, post } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { fmtDate } from "../../lib/format";
import { FUNDING, LEVEL, MATCH } from "./Grants";

const STATUSES = [["interested", "Qiziqaman"], ["preparing", "Tayyorlanmoqda"], ["submitted", "Topshirildi"], ["result", "Natija kutilmoqda"]];

export function Checklist({ saved, onChange }: { saved: any; onChange: (s: any) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const toggle = async (it: any) => {
    const next = { ...saved, checklist: saved.checklist.map((x: any) => (x.id === it.id ? { ...x, done: !x.done } : x)) };
    next.progress = { done: next.checklist.filter((x: any) => x.done).length, total: next.checklist.length };
    onChange(next);
    try { await patch(`/grants/checklist/${it.id}/`, { done: !it.done }); } catch (e: any) { toast(e.message, "bad"); }
  };
  const add = async () => {
    if (!title.trim()) return;
    try {
      const it = await post(`/grants/saved/${saved.id}/checklist/`, { title: title.trim() });
      onChange({ ...saved, checklist: [...saved.checklist, it], progress: { ...saved.progress, total: saved.progress.total + 1 } });
      setTitle("");
    } catch (e: any) { toast(e.message, "bad"); }
  };
  const remove = async (it: any) => {
    await del(`/grants/checklist/${it.id}/`);
    const cl = saved.checklist.filter((x: any) => x.id !== it.id);
    onChange({ ...saved, checklist: cl, progress: { done: cl.filter((x: any) => x.done).length, total: cl.length } });
  };
  return (
    <div>
      <div className="flex items-center justify-between text-sm"><span className="font-semibold">Hujjatlar checklisti</span><span className="text-sub">{saved.progress.done}/{saved.progress.total}</span></div>
      <Progress value={saved.progress.total ? (100 * saved.progress.done) / saved.progress.total : 0} tone="ok" className="mt-2" />
      <ul className="mt-3 space-y-1">
        {saved.checklist.map((it: any) => (
          <li key={it.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted">
            <button onClick={() => toggle(it)} aria-label="Belgilash">{it.done ? <CheckCircle2 className="h-5 w-5 text-ok" /> : <CircleDashed className="h-5 w-5 text-sub" />}</button>
            <span className={cx("flex-1 text-sm", it.done && "text-sub line-through")}>{it.title}</span>
            <button onClick={() => remove(it)} aria-label="O'chirish" className="text-sub opacity-60 hover:text-bad group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input className="input h-10" placeholder="O'z bandingizni qo'shing..." value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn-soft h-10 w-10 !px-0" onClick={add} aria-label="Qo'shish"><Plus className="h-5 w-5" /></button>
      </div>
    </div>
  );
}

export default function GrantDetail() {
  const { id } = useParams();
  const { data: g, error, loading, reload, setData } = useApi<any>(`/grants/${id}/`);
  const toast = useToast();
  if (loading) return <PageSkeleton />;
  if (error || !g) return <ErrorState error={error} onRetry={reload} />;

  const save = async () => {
    try {
      if (g.saved) { await del(`/grants/${g.id}/save/`); setData({ ...g, saved: null }); toast("Ro'yxatdan olib tashlandi"); }
      else { const s = await post(`/grants/${g.id}/save/`); setData({ ...g, saved: s }); toast("Grantlarim ro'yxatiga qo'shildi — checklist tayyor"); }
    } catch (e: any) { toast(e.message, "bad"); }
  };
  const setStatus = async (st: string) => { const s = await patch(`/grants/saved/${g.saved.id}/`, { status: st }); setData({ ...g, saved: { ...g.saved, status: s.status } }); };

  return (
    <>
      <PageHeader title={g.name} subtitle={`${g.provider} · ${g.country}`} back />
      <div className="flex flex-wrap items-center gap-2">
        <VerifiedBadge verified={g.verified} date={g.last_verified ? fmtDate(g.last_verified) : null} />
        <Badge tone="muted">{FUNDING[g.funding]}</Badge>
        {g.levels.map((l: string) => <Badge key={l} tone="muted">{LEVEL[l]}</Badge>)}
      </div>
      {g.description && <p className="mt-4 text-[15px] leading-relaxed">{g.description}</p>}

      <section className="card mt-4 p-5">
        <div className="flex items-center justify-between"><h2 className="font-bold">Sizga mosligi</h2><Badge tone={MATCH[g.match.level].tone}>{MATCH[g.match.level].label}</Badge></div>
        <ul className="mt-3 space-y-2.5">
          {g.match.checks.map((c: any) => (
            <li key={c.label} className="flex gap-3 text-sm">
              {c.ok === true ? <CheckCircle2 className="h-5 w-5 shrink-0 text-ok" /> : c.ok === false ? <XCircle className="h-5 w-5 shrink-0 text-bad" /> : <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />}
              <span><b>{c.label}:</b> {c.detail}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-sub">Bu profilingiz asosidagi taxminiy tekshiruv. Grant beruvchining rasmiy shartlari ustuvor.</p>
      </section>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <section className="card p-5"><h2 className="font-bold">Kimlar ariza topshira oladi</h2><p className="mt-2 text-sm leading-relaxed">{g.eligibility || "—"}</p>
          {(g.min_age || g.max_age) && <p className="mt-2 text-sm text-sub">Yosh: {g.min_age || "—"} – {g.max_age || "—"}</p>}</section>
        <section className="card p-5"><h2 className="font-bold">Til va moliyalashtirish</h2>
          <p className="mt-2 text-sm">{g.ielts_min ? `IELTS ${g.ielts_min}+ ` : ""}{g.language_note || (!g.ielts_min && "Rasmiy saytda ko'rsatilgan")}</p>
          <p className="mt-2 text-sm text-sub">{FUNDING[g.funding]}{g.funding_note ? ` — ${g.funding_note}` : ""}</p></section>
        <section className="card p-5"><h2 className="font-bold">Muddat</h2><p className="mt-2 text-sm">{g.deadline ? fmtDate(g.deadline) : g.deadline_note || "Ko'rsatilmagan"}</p></section>
        <section className="card p-5"><h2 className="font-bold">Talab qilinadigan hujjatlar</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{g.documents.map((d: string) => <li key={d}>{d}</li>)}</ul></section>
      </div>

      {g.saved && (
        <section className="card mt-3 p-5">
          <span className="label">Holat</span>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">{STATUSES.map(([v, l]) => <button key={v} onClick={() => setStatus(v)} className={cx("chip shrink-0", g.saved.status === v && "chip-on")}>{l}</button>)}</div>
          <div className="mt-5"><Checklist saved={g.saved} onChange={(s) => setData({ ...g, saved: s })} /></div>
        </section>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button onClick={save} className={g.saved ? "btn-outline" : "btn-primary"}><Bookmark className={cx("h-4 w-4", g.saved && "fill-current")} /> {g.saved ? "Ro'yxatdan olib tashlash" : "Grantlarimga qo'shish + checklist"}</button>
        <a href={g.official_url} target="_blank" rel="noopener noreferrer" className="btn-outline"><ExternalLink className="h-4 w-4" /> Rasmiy ariza sahifasi</a>
      </div>
    </>
  );
}
