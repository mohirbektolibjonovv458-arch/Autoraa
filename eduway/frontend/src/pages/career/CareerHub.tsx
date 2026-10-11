import { Link } from "react-router-dom";
import { ArrowRight, Bookmark, ClipboardList, Search } from "lucide-react";
import { useState } from "react";
import { Badge, ErrorState, PageHeader, PageSkeleton } from "../../components/ui";
import { useApi } from "../../lib/hooks";
import { fmtDate, FIELD_LABEL } from "../../lib/format";
import { careerIcon } from "./icons";

export default function CareerHub() {
  const careers = useApi<any[]>("/career/careers/");
  const results = useApi<any[]>("/career/results/");
  const [q, setQ] = useState("");
  const [onlySaved, setOnlySaved] = useState(false);
  if (careers.loading) return <PageSkeleton />;
  if (careers.error) return <ErrorState error={careers.error} onRetry={careers.reload} />;
  const list = (careers.data || []).filter((c) => (!onlySaved || c.saved) && (c.title.toLowerCase().includes(q.toLowerCase()) || c.summary.toLowerCase().includes(q.toLowerCase())));
  const last = results.data?.[0];

  return (
    <>
      <PageHeader title="Kasb tanlash" subtitle="Tavsiyalar — yo'l-yo'riq, qat'iy hukm emas" back="/future" />
      <div className="relative overflow-hidden rounded-3xl gradient-hero p-6 text-white shadow-lift animate-fade-up">
        <div className="absolute -right-10 -bottom-10 h-44 w-44 rounded-full bg-fuchsia-400/30 blur-2xl" />
        <ClipboardList className="h-8 w-8" />
        <h2 className="mt-3 text-xl font-extrabold">Kasbiy qiziqishlar testi</h2>
        <p className="mt-1 max-w-md text-sm text-white/80">18 ta tasdiq, 3 ta vaziyat va maqsadlar — taxminan 7–10 daqiqa. Natijada sizga mos kasblar va har birining sababi ko'rsatiladi.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/career/test" className="btn bg-white text-navy hover:bg-white/90">{last ? "Qayta topshirish" : "Testni boshlash"} <ArrowRight className="h-4 w-4" /></Link>
          {last && <Link to={`/career/result/${last.id}`} className="btn bg-white/15 text-white hover:bg-white/25">Oxirgi natija · {fmtDate(last.created, false)}</Link>}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-sub" />
          <input className="input pl-11" placeholder="Kasb qidirish..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={() => setOnlySaved(!onlySaved)} className={`chip h-12 ${onlySaved ? "chip-on" : ""}`}><Bookmark className="h-4 w-4" /> Tanlanganlar</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {list.map((c, i) => {
          const Icon = careerIcon(c.icon);
          return (
            <Link key={c.slug} to={`/career/${c.slug}`} className="card flex gap-4 p-4 hover:shadow-lift animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 0.03}s` }}>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon className="h-6 w-6" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2"><p className="font-bold leading-tight">{c.title}</p>{c.saved && <Bookmark className="h-4 w-4 shrink-0 fill-brand text-brand" />}</div>
                <p className="mt-1 line-clamp-2 text-sm text-sub">{c.summary}</p>
                <Badge tone="muted" className="mt-2">{FIELD_LABEL[c.field] || c.field}</Badge>
              </div>
            </Link>
          );
        })}
      </div>
      {list.length === 0 && <p className="mt-6 text-center text-sm text-sub">Hech narsa topilmadi.</p>}
    </>
  );
}
