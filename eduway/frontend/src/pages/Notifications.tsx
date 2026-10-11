import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Award, Bell, CalendarClock, Compass, Crown, Info, Trophy } from "lucide-react";
import { cx, Empty, ErrorState, PageHeader, PageSkeleton } from "../components/ui";
import { post } from "../lib/api";
import { useApi } from "../lib/hooks";
import { timeAgo } from "../lib/format";

const ICON: Record<string, any> = { achievement: Award, deadline: CalendarClock, career: Compass, premium: Crown, result: Trophy, info: Info };

export default function Notifications() {
  const { data, error, loading, reload } = useApi<any[]>("/notifications/");
  useEffect(() => { if (data?.some((n) => !n.read)) post("/notifications/read/").catch(() => {}); }, [data]);
  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Bildirishnomalar" back />
      {data.length === 0 ? <Empty icon={<Bell className="h-7 w-7" />} title="Hozircha xabar yo'q" text="Yutuqlar, muddatlar va natijalar haqida shu yerda xabar beramiz." /> : (
        <div className="space-y-2">
          {data.map((n) => {
            const I = ICON[n.kind] || Info;
            const body = (
              <div className={cx("card flex gap-3 p-4", !n.read && "border-brand/40 bg-brand-soft/40")}>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><I className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><p className="font-semibold">{n.title}</p>{n.body && <p className="text-sm text-sub">{n.body}</p>}<p className="mt-1 text-xs text-sub">{timeAgo(n.created)}</p></div>
                {!n.read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />}
              </div>
            );
            return n.link ? <Link key={n.id} to={n.link} className="block">{body}</Link> : <div key={n.id}>{body}</div>;
          })}
        </div>
      )}
    </>
  );
}
