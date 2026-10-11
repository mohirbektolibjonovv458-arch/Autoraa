import { Link, useParams } from "react-router-dom";
import { Bookmark, Bot, CheckCircle2, GraduationCap } from "lucide-react";
import { Badge, ErrorState, PageHeader, PageSkeleton } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { del, post } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { FIELD_LABEL } from "../../lib/format";
import { careerIcon } from "./icons";

export default function CareerDetail() {
  const { slug } = useParams();
  const { data: c, error, loading, reload, setData } = useApi<any>(`/career/careers/${slug}/`);
  const toast = useToast();
  if (loading) return <PageSkeleton />;
  if (error || !c) return <ErrorState error={error} onRetry={reload} />;
  const Icon = careerIcon(c.icon);
  const toggle = async () => {
    const r = c.saved ? await del(`/career/careers/${slug}/save/`) : await post(`/career/careers/${slug}/save/`);
    setData({ ...c, saved: r.saved });
    toast(r.saved ? "Tanlangan kasblarga qo'shildi" : "Olib tashlandi");
  };
  return (
    <>
      <PageHeader title={c.title} back action={<button onClick={toggle} aria-label="Saqlash" className={`grid h-10 w-10 place-items-center rounded-xl border ${c.saved ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface"}`}><Bookmark className={`h-5 w-5 ${c.saved ? "fill-brand" : ""}`} /></button>} />
      <div className="card flex gap-4 p-5 animate-fade-up">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl gradient-hero text-white"><Icon className="h-7 w-7" /></div>
        <div>
          <p className="text-[15px]">{c.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge>{FIELD_LABEL[c.field] || c.field}</Badge>
            {Object.entries(c.dimensions).map(([k, d]: any) => <Badge key={k} tone="muted">{d.name}</Badge>)}
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <section className="card p-5"><h2 className="font-bold">Asosiy vazifalar</h2><ul className="mt-2 space-y-2 text-sm">{c.duties.map((d: string) => <li key={d} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" />{d}</li>)}</ul></section>
        <section className="card p-5"><h2 className="font-bold">Zarur ko'nikmalar</h2><div className="mt-3 flex flex-wrap gap-2">{c.skills.map((s: string) => <span key={s} className="chip h-8 text-xs">{s}</span>)}</div></section>
        <section className="card p-5"><h2 className="font-bold">Muhim fanlar</h2><div className="mt-3 flex flex-wrap gap-2">{c.subjects.map((s: string) => <Badge key={s} className="first-letter:uppercase">{s}</Badge>)}</div></section>
        <section className="card p-5"><h2 className="font-bold">Ta'lim yo'nalishlari</h2><ul className="mt-2 space-y-1.5 text-sm">{c.study_directions.map((s: string) => <li key={s} className="flex gap-2"><GraduationCap className="h-4 w-4 shrink-0 text-brand" />{s}</li>)}</ul></section>
      </div>
      <section className="card mt-3 p-5">
        <h2 className="font-bold">Rivojlanish yo'li</h2>
        <ol className="relative mt-4 space-y-4 border-l-2 border-brand/30 pl-5">
          {c.growth_path.map((g: string, i: number) => (
            <li key={g} className="relative"><span className="absolute -left-[31px] grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span><p className="font-semibold">{g}</p></li>
          ))}
        </ol>
      </section>
      {c.universities.length > 0 && (
        <section className="card mt-3 p-5">
          <h2 className="font-bold">Katalogdagi tegishli universitetlar</h2>
          <ul className="mt-2 divide-y divide-line">{c.universities.map((u: any) => <li key={u.id}><Link to={`/universities/${u.id}`} className="flex justify-between py-2.5 text-sm"><span className="font-semibold">{u.name}</span><span className="text-sub">{u.city}</span></Link></li>)}</ul>
          <Link to={`/universities?field=${c.field}`} className="btn-soft btn-sm mt-3">Barchasini ko'rish</Link>
        </section>
      )}
      <Link to="/ai?mode=career" className="btn-primary mt-4 w-full"><Bot className="h-5 w-5" /> Bu kasb haqida AI'dan so'rash</Link>
    </>
  );
}
