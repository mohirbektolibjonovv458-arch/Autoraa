import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { api } from "../../api";
import { MasterCard, ProductCard } from "../../components/Cards";
import { Empty, Spinner } from "../../components/ui";

const HINTS = ["Moy almashtirish", "Diagnostika", "Akkumulyator", "Tormoz kolodkasi", "Hodovoy", "Konditsioner"];

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") || "");
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!sp.get("q")) inp.current?.focus(); }, []);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRes(null); return; }
    setBusy(true);
    const t = setTimeout(() => {
      setSp({ q: term }, { replace: true });
      api.get("/search/", { params: { q: term } }).then((r) => setRes(r.data)).finally(() => setBusy(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="col gap-16">
      <div className="search"><SearchIcon size={18} /><input ref={inp} className="input" style={{ padding: "14px 14px 14px 42px", fontSize: 16 }} placeholder="Usta, xizmat yoki ehtiyot qism…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!res && !busy && (
        <div><div className="small muted bold">Ko'p qidiriladi</div>
          <div className="row gap-8 wrap mt-8">{HINTS.map((h) => <button key={h} className="chip" onClick={() => setQ(h)}>{h}</button>)}</div></div>
      )}
      {busy && <Spinner />}
      {res && !busy && (res.masters.length + res.parts.length === 0 ? <Empty title="Hech narsa topilmadi" text="Boshqa so'z bilan qidirib ko'ring." /> : <>
        {res.masters.length > 0 && <><div className="section-head" style={{ margin: 0 }}><h3>Ustalar ({res.masters.length})</h3><Link className="link" to={`/app/masters?q=${encodeURIComponent(q)}`}>Barchasi</Link></div>
          <div className="grid g2 stack-sm">{res.masters.map((m: any) => <MasterCard key={m.id} m={m} />)}</div></>}
        {res.parts.length > 0 && <><div className="section-head" style={{ margin: 0 }}><h3>Ehtiyot qismlar ({res.parts.length})</h3><Link className="link" to="/app/parts">Do'kon</Link></div>
          <div className="grid g2 stack-sm">{res.parts.map((p: any) => <ProductCard key={p.id} p={p} />)}</div></>}
      </>)}
    </div>
  );
}
