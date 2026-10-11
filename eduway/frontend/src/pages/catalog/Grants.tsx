import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, CalendarDays, Search, Sparkles } from "lucide-react";
import { Badge, cx, Empty, ErrorState, PageHeader, PageSkeleton } from "../../components/ui";
import { useApi } from "../../lib/hooks";
import { fmtDate } from "../../lib/format";

export const FUNDING: Record<string, string> = { full: "To'liq", partial: "Qisman", tuition: "O'qish to'lovi", stipend: "Stipendiya" };
export const LEVEL: Record<string, string> = { bachelor: "Bakalavr", master: "Magistratura", phd: "PhD", any: "Barcha bosqichlar" };
export const MATCH: Record<string, { label: string; tone: any }> = {
  good: { label: "Sizga mos", tone: "ok" }, partial: { label: "Qisman mos", tone: "warn" }, low: { label: "Kam mos", tone: "bad" }, unknown: { label: "Profilni to'ldiring", tone: "muted" },
};

export default function Grants() {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [level, setLevel] = useState("");
  const path = `/grants/?sort=match${country ? `&country=${encodeURIComponent(country)}` : ""}${level ? `&level=${level}` : ""}`;
  const { data, error, loading, reload } = useApi<any>(path);
  const list = useMemo(() => (data?.results || []).filter((g: any) => (g.name + g.provider + g.country).toLowerCase().includes(q.toLowerCase())), [data, q]);

  return (
    <>
      <PageHeader title="Grantlar va stipendiyalar" subtitle="Profilingiz asosida taxminiy moslik" back="/future" action={<Link to="/grants/saved" className="btn-soft btn-sm"><Bookmark className="h-4 w-4" /> Mening</Link>} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-sub" />
        <input className="input pl-11" placeholder="Grant yoki davlat..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        {Object.entries(LEVEL).filter(([k]) => k !== "any").map(([k, v]) => <button key={k} onClick={() => setLevel(level === k ? "" : k)} className={cx("chip shrink-0", level === k && "chip-on")}>{v}</button>)}
        {(data?.countries || []).map((c: string) => <button key={c} onClick={() => setCountry(country === c ? "" : c)} className={cx("chip shrink-0", country === c && "chip-on")}>{c}</button>)}
      </div>
      <div className="mt-4 space-y-3">
        {loading ? <PageSkeleton /> : error ? <ErrorState error={error} onRetry={reload} /> : list.length === 0 ? <Empty title="Grant topilmadi" /> : list.map((g: any, i: number) => (
          <Link key={g.id} to={`/grants/${g.id}`} className="card block p-4 hover:shadow-lift animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 0.03}s` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="font-bold">{g.name}</p><p className="text-sm text-sub">{g.provider} · {g.country}</p></div>
              {g.saved && <Bookmark className="h-5 w-5 shrink-0 fill-brand text-brand" />}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone={MATCH[g.match.level].tone}><Sparkles className="h-3 w-3" /> {MATCH[g.match.level].label}</Badge>
              <Badge tone="muted">{FUNDING[g.funding]}</Badge>
              {g.levels.map((l: string) => <Badge key={l} tone="muted">{LEVEL[l]}</Badge>)}
              {!g.verified && <Badge tone="warn">Tekshirilmagan</Badge>}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-sub"><CalendarDays className="h-4 w-4" /> {g.deadline ? fmtDate(g.deadline) : g.deadline_note || "Muddat ko'rsatilmagan"}</p>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-sub">Moslik — profilingiz asosidagi taxminiy baho. Yakuniy shartlar faqat grant beruvchining rasmiy sahifasida.</p>
    </>
  );
}
