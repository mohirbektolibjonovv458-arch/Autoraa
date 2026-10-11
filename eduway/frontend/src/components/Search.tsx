import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Briefcase, ClipboardList, GraduationCap, Search as SearchIcon, Trophy, X } from "lucide-react";
import { get } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import { cx, Spinner } from "./ui";

const TYPES: Record<string, { label: string; icon: any; color: string }> = {
  career: { label: "Kasb", icon: Briefcase, color: "text-brand" },
  university: { label: "Universitet", icon: GraduationCap, color: "text-fuchsia-500" },
  grant: { label: "Grant", icon: Trophy, color: "text-amber-500" },
  lesson: { label: "Dars", icon: BookOpen, color: "text-sky-500" },
  quiz: { label: "Test", icon: ClipboardList, color: "text-ok" },
};

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [res, setRes] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setTimeout(() => input.current?.focus(), 50); document.body.style.overflow = "hidden"; } return () => { document.body.style.overflow = ""; }; }, [open]);
  useEffect(() => {
    if (dq.trim().length < 2) { setRes(null); return; }
    setBusy(true);
    get(`/search/?q=${encodeURIComponent(dq.trim())}`).then((d) => { setRes(d.results); setSel(0); }).catch(() => setRes([])).finally(() => setBusy(false));
  }, [dq]);
  if (!open) return null;
  const go = (r: any) => { onClose(); setQ(""); nav(r.link); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy/50 p-3 pt-[8vh] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-surface shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <SearchIcon className="h-5 w-5 text-sub" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kasb, universitet, grant, dars yoki test..."
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (!res?.length) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(res.length - 1, s + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              if (e.key === "Enter") go(res[sel]);
            }}
            className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-sub/70" />
          {busy ? <Spinner className="h-5 w-5 text-brand" /> : <button onClick={onClose} aria-label="Yopish" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-muted"><X className="h-5 w-5" /></button>}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {res === null ? (
            <div className="p-4 text-sm text-sub">
              <p className="mb-2 font-semibold text-ink">Tezkor qidiruv</p>
              <div className="flex flex-wrap gap-2">{["Dasturchi", "IELTS", "Koreya", "Toshkent", "Shifokor", "Matematika"].map((s) => <button key={s} onClick={() => setQ(s)} className="chip h-8 text-xs">{s}</button>)}</div>
            </div>
          ) : res.length === 0 ? <p className="p-6 text-center text-sm text-sub">Hech narsa topilmadi.</p> : res.map((r, i) => {
            const t = TYPES[r.type];
            return (
              <button key={r.link} onClick={() => go(r)} onMouseEnter={() => setSel(i)} className={cx("flex w-full items-center gap-3 rounded-2xl p-3 text-left transition", i === sel ? "bg-brand-soft" : "hover:bg-muted")}>
                <div className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted", t.color)}><t.icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.title}</p><p className="truncate text-xs text-sub">{t.label} · {r.subtitle}</p></div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
