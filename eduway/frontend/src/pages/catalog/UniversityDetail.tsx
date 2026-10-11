import { Link, useParams } from "react-router-dom";
import { AlertTriangle, CalendarDays, ExternalLink, FileText, Globe, GraduationCap, Languages, MapPin, Wallet } from "lucide-react";
import { Badge, ErrorState, PageHeader, PageSkeleton, VerifiedBadge } from "../../components/ui";
import { useApi } from "../../lib/hooks";
import { FIELD_LABEL, fmtDate, fmtMoney } from "../../lib/format";
import { FavButton } from "./Universities";

const DEG: Record<string, string> = { bachelor: "Bakalavr", master: "Magistratura", phd: "Doktorantura" };

export default function UniversityDetail() {
  const { id } = useParams();
  const { data: u, error, loading, reload, setData } = useApi<any>(`/universities/${id}/`);
  if (loading) return <PageSkeleton />;
  if (error || !u) return <ErrorState error={error} onRetry={reload} />;
  const Row = ({ icon: I, label, children }: any) => (
    <div className="flex gap-3 py-3"><I className="mt-0.5 h-5 w-5 shrink-0 text-brand" /><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-sub">{label}</p><div className="mt-0.5 text-[15px]">{children}</div></div></div>
  );
  return (
    <>
      <PageHeader title={u.short_name || "Universitet"} back action={<FavButton u={u} onChange={(v) => setData({ ...u, is_favorite: v })} />} />
      <section className="relative overflow-hidden rounded-3xl gradient-hero p-6 text-white shadow-lift animate-fade-up">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-400/30 blur-2xl" />
        <h2 className="relative text-2xl font-extrabold leading-tight">{u.name}</h2>
        <p className="relative mt-2 flex items-center gap-1 text-white/80"><MapPin className="h-4 w-4" /> {u.city}, {u.country}</p>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <a href={u.website} target="_blank" rel="noopener noreferrer" className="btn btn-sm bg-white text-navy"><Globe className="h-4 w-4" /> Rasmiy sayt</a>
        </div>
      </section>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <VerifiedBadge verified={u.verified} date={u.last_verified ? fmtDate(u.last_verified) : null} />
        <span className="text-xs text-sub">Yangilangan: {fmtDate(u.updated)}</span>
      </div>
      {!u.verified && (
        <div className="mt-3 flex gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
          <p>Bu sahifadagi ma'lumotlar hali administrator tomonidan rasmiy manba bilan tasdiqlanmagan. Qabul talablari, narxlar va muddatlar har yili o'zgaradi — hujjat topshirishdan oldin <a className="font-semibold text-brand underline" href={u.source_url || u.website} target="_blank" rel="noopener noreferrer">rasmiy saytdan</a> tekshiring.</p>
        </div>
      )}
      {u.description && <p className="mt-4 text-[15px] leading-relaxed">{u.description}</p>}

      <div className="card mt-4 divide-y divide-line px-5">
        <Row icon={Languages} label="O'qish tili">{u.languages.join(", ") || "—"}</Row>
        <Row icon={Wallet} label="Kontrakt narxi">{u.tuition_min ? <>{fmtMoney(u.tuition_min, u.tuition_currency)}{u.tuition_max && u.tuition_max !== u.tuition_min ? ` — ${fmtMoney(u.tuition_max, u.tuition_currency)}` : ""} / yil</> : <span className="text-sub">Ko'rsatilmagan</span>}{u.tuition_note && <p className="text-xs text-sub">{u.tuition_note}</p>}</Row>
        <Row icon={FileText} label="Til sertifikati">{u.ielts_min ? `IELTS ${u.ielts_min} yoki ekvivalenti` : <span className="text-sub">Ko'rsatilmagan — rasmiy saytdan tekshiring</span>}</Row>
        <Row icon={GraduationCap} label="Qabul talablari">{u.admission_requirements || "—"}</Row>
        <Row icon={CalendarDays} label="Hujjat topshirish">{u.application_end ? `${u.application_start ? fmtDate(u.application_start) + " — " : ""}${fmtDate(u.application_end)}` : u.deadline_note || "—"}</Row>
        <Row icon={Wallet} label="Grant imkoniyatlari">{u.has_grants === true ? "Mavjud" : u.has_grants === false ? "Yo'q" : "Ma'lumot yo'q"}{u.grant_note && <p className="text-xs text-sub">{u.grant_note}</p>}</Row>
      </div>

      <section className="mt-4">
        <h2 className="mb-3 text-lg font-bold">Ta'lim yo'nalishlari</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {u.programs.map((p: any) => (
            <div key={p.id} className="card p-4">
              <p className="font-semibold">{p.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="muted">{DEG[p.degree]}</Badge>
                <Badge tone="muted">{FIELD_LABEL[p.field] || p.field}</Badge>
                {p.duration_years && <Badge tone="muted">{Number(p.duration_years)} yil</Badge>}
                {p.language && <Badge tone="muted">{p.language}</Badge>}
              </div>
              {p.tuition && <p className="mt-2 text-sm text-sub">{fmtMoney(p.tuition)}</p>}
            </div>
          ))}
        </div>
      </section>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <a href={u.source_url || u.website} target="_blank" rel="noopener noreferrer" className="btn-outline"><ExternalLink className="h-4 w-4" /> Rasmiy manba</a>
        <Link to={`/ai?mode=career`} className="btn-primary">AI bilan maslahatlashish</Link>
      </div>
    </>
  );
}
