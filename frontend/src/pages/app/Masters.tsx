import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Wrench, Zap, Cog, Cpu, Disc, Snowflake, Car, CircleDot } from "lucide-react";
import { api } from "../../api";
import { MasterCard } from "../../components/Cards";
import MastersTabs from "../../components/MastersTabs";
import { Empty, Spinner } from "../../components/ui";
import { useGeo } from "../../utils";

export const CAT_ICONS: Record<string, any> = { motor: Cog, elektrik: Zap, hodovoy: Wrench, diagnostika: Cpu, tormoz: Disc, konditsioner: Snowflake, kuzov: Car, shina: CircleDot };
const LABELS: Record<string, string> = { motor: "Motor", elektrik: "Elektrik", hodovoy: "Hodovoy", diagnostika: "Diagnostika", tormoz: "Tormoz", konditsioner: "Konditsioner", kuzov: "Kuzov", shina: "Shina" };

export default function Masters() {
  const [sp, setSp] = useSearchParams();
  const geo = useGeo();
  const [q, setQ] = useState(sp.get("q") || "");
  const [cat, setCat] = useState(sp.get("category") || "");
  const [sort, setSort] = useState(sp.get("sort") || "distance");
  const [openNow, setOpenNow] = useState(false);
  const [online, setOnline] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/masters/", { params: { q: q || undefined, category: cat || undefined, sort, online: online ? 1 : undefined, open_now: openNow ? 1 : undefined, lat: geo.lat, lng: geo.lng } })
        .then((r) => setData(r.data));
    }, 250);
    return () => clearTimeout(t);
  }, [q, cat, sort, online, openNow, geo.lat, geo.lng]);

  return (
    <div className="col gap-16">
      <div className="page-head"><h2 className="page-title">Usta topish</h2><MastersTabs /></div>
      <div className="search"><Search size={18} /><input className="input" value={q} onChange={(e) => { setQ(e.target.value); setSp(e.target.value ? { q: e.target.value } : {}); }} placeholder="Qanday xizmat kerak?" /></div>
      <div className="cat-grid">
        {Object.entries(LABELS).map(([k, v]) => {
          const I = CAT_ICONS[k];
          return <button key={k} className={"cat" + (cat === k ? " active" : "")} onClick={() => setCat(cat === k ? "" : k)}><I size={22} strokeWidth={1.7} />{v}</button>;
        })}
      </div>
      <div className="chips">
        {[["distance", "Yaqinlik"], ["rating", "Reyting"], ["price", "Narx"]].map(([k, v]) => <button key={k} className={"chip" + (sort === k ? " active" : "")} onClick={() => setSort(k)}>{v}</button>)}
        <button className={"chip open-chip" + (openNow ? " active" : "")} onClick={() => setOpenNow((x) => !x)} aria-pressed={openNow}><span className="dot-live" />Hozir ochiq</button>
        <button className={"chip" + (online ? " active" : "")} onClick={() => setOnline(!online)}>Online</button>
      </div>
      <div className="row between"><h3 style={{ fontSize: 17 }}>{q ? `«${q}» bo'yicha` : cat ? LABELS[cat] + " ustalari" : "Sizga yaqin ustalar"}</h3>{data && <span className="small muted">{data.count} ta</span>}</div>
      {geo.error && sort === "distance" && <p className="xs muted" style={{ marginTop: -10 }}>📍 Aniq masofa uchun brauzerda joylashuvga ruxsat bering.</p>}
      {!data ? <Spinner /> : data.results.length === 0 ? <Empty title="Usta topilmadi" text="Filtrlarni o'zgartirib ko'ring." /> : (
        <div className="grid g2 stack-sm">{data.results.map((m: any) => <MasterCard key={m.id} m={m} />)}</div>
      )}
    </div>
  );
}
