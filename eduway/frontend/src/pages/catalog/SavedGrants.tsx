import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { Badge, Empty, ErrorState, PageHeader, PageSkeleton, Progress } from "../../components/ui";
import { useApi } from "../../lib/hooks";
import { fmtDate } from "../../lib/format";

const ST: Record<string, string> = { interested: "Qiziqaman", preparing: "Tayyorlanmoqda", submitted: "Topshirildi", result: "Natija kutilmoqda" };

export default function SavedGrants() {
  const { data, error, loading, reload } = useApi<any[]>("/grants/saved/");
  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Grantlarim" subtitle="Tayyorgarlik holati va hujjatlar" back="/grants" />
      {data.length === 0 ? <Empty icon={<Bookmark className="h-7 w-7" />} title="Hali grant saqlanmagan" text="Grant sahifasida «Grantlarimga qo'shish» tugmasini bosing — hujjatlar checklisti avtomatik yaratiladi." action={<Link to="/grants" className="btn-primary">Grantlarni ko'rish</Link>} /> : (
        <div className="space-y-3">
          {data.map((s) => (
            <Link key={s.id} to={`/grants/${s.grant.id}`} className="card block p-4 hover:shadow-lift">
              <div className="flex items-start justify-between gap-3"><p className="font-bold">{s.grant.name}</p><Badge>{ST[s.status]}</Badge></div>
              <p className="mt-1 text-sm text-sub">{s.grant.deadline ? `Muddat: ${fmtDate(s.grant.deadline)}` : s.grant.deadline_note}</p>
              <div className="mt-3 flex items-center gap-3"><Progress value={s.progress.total ? (100 * s.progress.done) / s.progress.total : 0} tone="ok" /><span className="shrink-0 text-xs font-semibold text-sub">{s.progress.done}/{s.progress.total}</span></div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
