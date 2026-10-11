import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { GitCompare, Heart, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { Badge, cx, Empty, ErrorState, Modal, PageHeader, Skeleton } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { del, get, post } from "../../lib/api";
import { useDebounced } from "../../lib/hooks";
import { FIELD_LABEL, fmtMoney } from "../../lib/format";

const KINDS: Record<string, string> = { state: "Davlat", private: "Xususiy", branch: "Xorijiy filial", foreign: "Xorijiy" };

export function FavButton({ u, onChange }: { u: any; onChange: (v: boolean) => void }) {
  const toast = useToast();
  return (
    <button aria-label={u.is_favorite ? "Sevimlilardan olib tashlash" : "Sevimlilarga qo'shish"} onClick={async (e) => {
      e.preventDefault(); e.stopPropagation();
      const next = !u.is_favorite;
      onChange(next);
      try { next ? await post(`/universities/${u.id}/favorite/`) : await del(`/universities/${u.id}/favorite/`); }
      catch (err: any) { onChange(!next); toast(err.message, "bad"); }
    }} className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl transition", u.is_favorite ? "bg-bad/10 text-bad" : "bg-muted text-sub hover:text-bad")}>
      <Heart className={cx("h-5 w-5", u.is_favorite && "fill-current animate-pop")} />
    </button>
  );
}

export default function Universities() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState(sp.get("q") || "");
  const dq = useDebounced(q, 350);
  const [filters, setFilters] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState<number[]>([]);
  const [more, setMore] = useState(false);
  const loadMore = async () => {
    if (!data?.next) return;
    setMore(true);
    try {
      const next = await get(`/universities/${new URL(data.next, location.origin).search}`);
      setData({ ...next, results: [...data.results, ...next.results] });
    } catch { /* ignore */ } finally { setMore(false); }
  };

  useEffect(() => { get("/universities/filters/").then(setFilters).catch(() => {}); }, []);
  useEffect(() => {
    const p = new URLSearchParams(sp);
    if (dq) p.set("q", dq); else p.delete("q");
    setLoading(true);
    setError(null);
    get(`/universities/?${p.toString()}`).then(setData).catch(setError).finally(() => setLoading(false));
  }, [sp, dq]);

  const setF = (k: string, v: string) => { const p = new URLSearchParams(sp); v ? p.set(k, v) : p.delete(k); setSp(p, { replace: true }); };
  const active = ["country", "field", "kind", "language", "max_ielts", "grants", "favorites"].filter((k) => sp.get(k));
  const toggleCompare = (id: number) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 3 ? [...c, id] : c));

  return (
    <>
      <PageHeader title="Universitetlar" subtitle="O'zbekiston va xorijdagi OTMlar katalogi" back="/future" />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-sub" />
          <input className="input pl-11" placeholder="Nomi, shahar yoki yo'nalish..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={() => setOpen(true)} className="btn-outline relative h-12 w-12 !px-0" aria-label="Filtrlar">
          <SlidersHorizontal className="h-5 w-5" />
          {active.length > 0 && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{active.length}</span>}
        </button>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        <button onClick={() => setF("favorites", sp.get("favorites") ? "" : "1")} className={cx("chip shrink-0", sp.get("favorites") && "chip-on")}><Heart className="h-4 w-4" /> Sevimlilar</button>
        {["O'zbekiston", ...(filters?.countries || []).filter((c: string) => c !== "O'zbekiston")].map((c: string) => (
          <button key={c} onClick={() => setF("country", sp.get("country") === c ? "" : c)} className={cx("chip shrink-0", sp.get("country") === c && "chip-on")}>{c}</button>
        ))}
      </div>
      {active.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {active.map((k) => <button key={k} onClick={() => setF(k, "")} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{k === "field" ? FIELD_LABEL[sp.get(k)!] : k === "kind" ? KINDS[sp.get(k)!] : k === "grants" ? "Grant bor" : k === "favorites" ? "Sevimlilar" : k === "max_ielts" ? `IELTS ≤ ${sp.get(k)}` : sp.get(k)} <X className="h-3 w-3" /></button>)}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />) : error ? <ErrorState error={error} /> : data.results.length === 0 ? (
          <Empty title="Universitet topilmadi" text="Filtrlarni o'zgartirib ko'ring." />
        ) : data.results.map((u: any, i: number) => (
          <Link key={u.id} to={`/universities/${u.id}`} className="card block p-4 hover:shadow-lift animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 0.03}s` }}>
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-fuchsia-500 text-sm font-extrabold text-white">{(u.short_name || u.name).slice(0, 4)}</div>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-snug">{u.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-sub"><MapPin className="h-3.5 w-3.5" /> {u.city}, {u.country}</p>
              </div>
              <FavButton u={u} onChange={(v) => setData({ ...data, results: data.results.map((x: any) => (x.id === u.id ? { ...x, is_favorite: v } : x)) })} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="muted">{KINDS[u.kind]}</Badge>
              {u.languages.slice(0, 3).map((l: string) => <Badge key={l} tone="muted">{l}</Badge>)}
              {u.ielts_min && <Badge>IELTS {u.ielts_min}+</Badge>}
              {u.has_grants && <Badge tone="ok">Grant</Badge>}
              {!u.verified && <Badge tone="warn">Tekshirilmagan</Badge>}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 text-sm">
              <span className="text-sub">{u.tuition_min ? `${fmtMoney(u.tuition_min, u.tuition_currency)} dan` : "Narx: rasmiy saytda"}</span>
              <button onClick={(e) => { e.preventDefault(); toggleCompare(u.id); }} className={cx("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold", compare.includes(u.id) ? "bg-brand text-white" : "bg-muted text-sub")}>
                <GitCompare className="h-3.5 w-3.5" /> {compare.includes(u.id) ? "Tanlandi" : "Solishtirish"}
              </button>
            </div>
          </Link>
        ))}
        {data?.next && <button className="btn-outline w-full" disabled={more} onClick={loadMore}>{more ? "Yuklanmoqda..." : `Ko'proq ko'rsatish (${data.count - data.results.length} ta qoldi)`}</button>}
      </div>

      {compare.length > 0 && (
        <div className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-navy p-3 pl-4 text-white shadow-2xl animate-fade-up lg:bottom-6">
          <span className="text-sm font-semibold">{compare.length}/3 tanlandi</span>
          <div className="flex gap-2">
            <button className="btn btn-sm bg-white/10" onClick={() => setCompare([])}>Bekor</button>
            <button className="btn btn-sm bg-white text-navy" disabled={compare.length < 2} onClick={() => nav(`/universities/compare?ids=${compare.join(",")}`)}>Solishtirish</button>
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Filtrlar">
        <div className="space-y-4">
          <div><span className="label">Yo'nalish</span><div className="flex flex-wrap gap-2">{(filters?.fields || []).map((f: string) => <button key={f} onClick={() => setF("field", sp.get("field") === f ? "" : f)} className={cx("chip", sp.get("field") === f && "chip-on")}>{FIELD_LABEL[f] || f}</button>)}</div></div>
          <div><span className="label">Turi</span><div className="flex flex-wrap gap-2">{Object.entries(KINDS).map(([k, v]) => <button key={k} onClick={() => setF("kind", sp.get("kind") === k ? "" : k)} className={cx("chip", sp.get("kind") === k && "chip-on")}>{v}</button>)}</div></div>
          <div><span className="label">O'qish tili</span><div className="flex flex-wrap gap-2">{["o'zbek", "rus", "ingliz"].map((l) => <button key={l} onClick={() => setF("language", sp.get("language") === l ? "" : l)} className={cx("chip", sp.get("language") === l && "chip-on")}>{l}</button>)}</div></div>
          <div><span className="label">Mening IELTS ballim (talab shundan oshmasin)</span><div className="flex flex-wrap gap-2">{["5.5", "6.0", "6.5", "7.0"].map((l) => <button key={l} onClick={() => setF("max_ielts", sp.get("max_ielts") === l ? "" : l)} className={cx("chip", sp.get("max_ielts") === l && "chip-on")}>{l}</button>)}</div></div>
          <label className="flex items-center gap-3 font-semibold"><input type="checkbox" className="h-5 w-5 accent-[rgb(var(--brand))]" checked={sp.get("grants") === "1"} onChange={(e) => setF("grants", e.target.checked ? "1" : "")} /> Faqat grant imkoniyati borlar</label>
          <div className="flex gap-2 pt-2"><button className="btn-outline flex-1" onClick={() => { setSp({}, { replace: true }); setOpen(false); }}>Tozalash</button><button className="btn-primary flex-1" onClick={() => setOpen(false)}>Ko'rsatish{data ? ` (${data.count})` : ""}</button></div>
        </div>
      </Modal>
    </>
  );
}
