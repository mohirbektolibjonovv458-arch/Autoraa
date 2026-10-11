import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, GitCompare } from "lucide-react";
import { cx, Empty, PageHeader, PageSkeleton } from "../../components/ui";
import { get } from "../../lib/api";
import { FIELD_LABEL, fmtMoney } from "../../lib/format";

export default function Compare() {
  const [sp, setSp] = useSearchParams();
  const ids = sp.get("ids") || "";
  const [items, setItems] = useState<any[] | null>(null);
  const [favs, setFavs] = useState<any[] | null>(null);
  const [pick, setPick] = useState<number[]>([]);

  useEffect(() => {
    if (ids) { setItems(null); get(`/universities/compare/?ids=${ids}`).then(setItems).catch(() => setItems([])); }
    else get("/universities/?favorites=1&page_size=50").then((d) => setFavs(d.results)).catch(() => setFavs([]));
  }, [ids]);

  if (!ids) {
    if (!favs) return <PageSkeleton />;
    return (
      <>
        <PageHeader title="Solishtirish" subtitle="2–3 ta universitetni tanlang" back />
        {favs.length < 2 ? <Empty icon={<GitCompare className="h-7 w-7" />} title="Kamida 2 ta sevimli universitet kerak" text="Katalogdan universitetlarni sevimlilarga qo'shing yoki ro'yxatda «Solishtirish» tugmasini bosing." action={<Link to="/universities" className="btn-primary">Katalog</Link>} /> : (
          <>
            <div className="space-y-2">{favs.map((u) => (
              <button key={u.id} onClick={() => setPick((p) => (p.includes(u.id) ? p.filter((x) => x !== u.id) : p.length < 3 ? [...p, u.id] : p))} className={cx("card flex w-full items-center gap-3 p-4 text-left", pick.includes(u.id) && "border-brand ring-4 ring-brand/15")}>
                <span className={cx("grid h-6 w-6 place-items-center rounded-md border", pick.includes(u.id) ? "border-brand bg-brand text-white" : "border-line")}>{pick.includes(u.id) && <Check className="h-4 w-4" />}</span>
                <span className="font-semibold">{u.name}</span>
              </button>
            ))}</div>
            <button className="btn-primary mt-4 w-full" disabled={pick.length < 2} onClick={() => setSp({ ids: pick.join(",") })}>Solishtirish</button>
          </>
        )}
      </>
    );
  }
  if (!items) return <PageSkeleton />;
  const rows: [string, (u: any) => any][] = [
    ["Joylashuv", (u) => `${u.city}, ${u.country}`],
    ["O'qish tili", (u) => u.languages.join(", ")],
    ["Kontrakt", (u) => (u.tuition_min ? fmtMoney(u.tuition_min, u.tuition_currency) : "Rasmiy saytda")],
    ["IELTS", (u) => (u.ielts_min ? `${u.ielts_min}+` : "—")],
    ["Grant", (u) => (u.has_grants ? "Bor" : u.has_grants === false ? "Yo'q" : "—")],
    ["Yo'nalishlar", (u) => u.fields_list.map((f: string) => FIELD_LABEL[f] || f).join(", ")],
    ["Dasturlar soni", (u) => u.programs.length],
    ["Ma'lumot holati", (u) => (u.verified ? "Tasdiqlangan" : "Tekshirilmagan")],
  ];
  return (
    <>
      <PageHeader title="Solishtirish" back />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="border-b border-line"><th className="w-32 p-3" />{items.map((u) => <th key={u.id} className="p-3 text-left align-top"><Link to={`/universities/${u.id}`} className="font-bold text-brand">{u.name}</Link></th>)}</tr></thead>
          <tbody>{rows.map(([label, fn]) => <tr key={label} className="border-b border-line last:border-0"><td className="p-3 font-semibold text-sub">{label}</td>{items.map((u) => <td key={u.id} className="p-3 align-top">{fn(u)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-sub">Narx va talablar o'zgarishi mumkin. Qaror qabul qilishdan oldin rasmiy saytlardan tekshiring.</p>
    </>
  );
}
