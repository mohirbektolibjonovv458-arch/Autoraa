import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Lock } from "lucide-react";
import { Badge, cx, Empty, ErrorState, PageHeader, PageSkeleton } from "../../components/ui";
import { useApi } from "../../lib/hooks";
import { SKILLS } from "./English";

export default function Lessons() {
  const [sp, setSp] = useSearchParams();
  const skill = sp.get("skill") || "";
  const { data, error, loading, reload } = useApi<any[]>(`/learn/lessons/${skill ? `?skill=${skill}` : ""}`);
  return (
    <>
      <PageHeader title="Darslar" subtitle="A1 dan C1 gacha" back="/english" />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button onClick={() => setSp({})} className={cx("chip shrink-0", !skill && "chip-on")}>Barchasi</button>
        {Object.entries(SKILLS).map(([k, s]) => <button key={k} onClick={() => setSp({ skill: k })} className={cx("chip shrink-0", skill === k && "chip-on")}><s.icon className="h-4 w-4" /> {s.label}</button>)}
      </div>
      <div className="mt-4 space-y-2">
        {loading ? <PageSkeleton /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? <Empty title="Bu bo'limda hali darslar yo'q" /> : data.map((l) => {
          const S = SKILLS[l.skill];
          return (
            <Link key={l.id} to={`/english/lessons/${l.id}`} className="card flex items-center gap-3 p-4 hover:shadow-lift">
              <div className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl", l.completed ? "bg-ok/10 text-ok" : "bg-brand-soft text-brand")}>{l.completed ? <CheckCircle2 className="h-5 w-5" /> : <S.icon className="h-5 w-5" />}</div>
              <div className="min-w-0 flex-1"><p className="font-bold">{l.title}</p><p className="truncate text-sm text-sub">{l.summary}</p></div>
              {l.locked ? <Lock className="h-5 w-5 text-warn" /> : <Badge>{l.level}</Badge>}
            </Link>
          );
        })}
      </div>
    </>
  );
}
