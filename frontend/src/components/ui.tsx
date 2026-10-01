import { createPortal } from "react-dom";
import { createContext, ReactNode, useCallback, useContext, useEffect, useId, useState } from "react";
import { Star, X, Inbox, BadgeCheck } from "lucide-react";
import { media } from "../api";
import { STATUS_TONE } from "../utils";

/** Avtora logotipi: belgi (A) + nom. dark=true — och fon uchun (to'q rangli variant). */
export function Logo({ dark = false, size = 30 }: { dark?: boolean; size?: number }) {
  return (
    <span className={"logo" + (dark ? " dark" : "")}>
      {dark ? <>
        {/* och fonda to'q belgi; tun rejimida esa oq belgi ko'rinadi (styles.css) */}
        <img className="logo-l" src="/brand/mark-dark.png" alt="Avtora" width={Math.round(size * 1.55)} height={size} style={{ width: Math.round(size * 1.55), height: size, objectFit: "contain" }} />
        <img className="logo-d" src="/brand/mark-light.png" alt="" aria-hidden width={Math.round(size * 1.55)} height={size} style={{ width: Math.round(size * 1.55), height: size, objectFit: "contain" }} />
      </> : <img src="/brand/mark-light.png" alt="Avtora" width={Math.round(size * 1.55)} height={size} style={{ width: Math.round(size * 1.55), height: size, objectFit: "contain" }} />}
      <span className="logo-text">Avtora</span>
    </span>
  );
}

export function Avatar({ name, src, size = "", className = "" }: { name?: string; src?: string | null; size?: string; className?: string }) {
  const initials = (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return <div className={`avatar ${size} ${className}`}>{src ? <img src={media(src)} alt="" /> : initials}</div>;
}

export function Stars({ value, count }: { value: number; count?: number }) {
  if (!value || count === 0) return <span className="badge" style={{ padding: "2px 8px" }}>Yangi</span>;
  return (
    <span className="stars"><Star size={14} fill="#f5a623" strokeWidth={0} />{(value || 0).toFixed(1)}{count != null && <span>({count} ta sharh)</span>}</span>
  );
}

export function Verified() {
  return <span className="verified" title="Admin tomonidan tekshirilgan"><BadgeCheck size={15} /> Tasdiqlangan</span>;
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`badge ${STATUS_TONE[status] || ""}`}>{label}</span>;
}

export function Empty({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon || <Inbox size={40} />}
      <h4>{title}</h4>
      {text && <p className="small">{text}</p>}
      {action && <div className="mt-12">{action}</div>}
    </div>
  );
}

/** Yuklanish holati. 12 soniyadan oshsa — foydalanuvchiga qayta yuklash imkoniyati beriladi. */
export function Spinner() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 12000); return () => clearTimeout(t); }, []);
  return (
    <div className="col" style={{ alignItems: "center", gap: 10, padding: "24px 0" }} role="status" aria-label="Yuklanmoqda">
      <div className="spinner" style={{ margin: 0 }} />
      {slow && <div className="small muted" style={{ textAlign: "center" }}>Yuklash odatdagidan uzoq davom etmoqda.<br /><button className="btn btn-sm btn-ghost mt-8" onClick={() => window.location.reload()}>Qayta yuklash</button></div>}
    </div>
  );
}

/** Modal oyna — document.body ga «portal» orqali chiqariladi: sahifa animatsiyasi yoki pastki menyu
 *  hech qachon uning ustiga chiqib, tugmalarini yopib qo'ymaydi. Esc bilan yopiladi, orqa fon aylanmaydi. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, []);
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Yopish"><X size={18} /></button></div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

type Toast = { id: number; text: string; tone?: "error" | "success" };
const ToastCtx = createContext<(text: string, tone?: "error" | "success") => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone?: "error" | "success") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">{items.map((t) => <div key={t.id} className={`toast ${t.tone || ""}`}>{t.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/** SVG sedan — rasm bo'lmaganda ishlatiladi */
export function CarArt({ className = "", light = false }: { className?: string; light?: boolean }) {
  const id = (light ? "carL" : "carD") + useId().replace(/:/g, "");
  const glass = light ? "#8fa2bb" : "#0b111b";
  return (
    <svg className={className} viewBox="0 0 520 190" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light ? "#ffffff" : "#4a566b"} />
          <stop offset=".45" stopColor={light ? "#e6eaf0" : "#1b2230"} />
          <stop offset="1" stopColor={light ? "#b9c3d0" : "#0c1119"} />
        </linearGradient>
        <radialGradient id={id + "s"}><stop offset="0" stopColor="#000" stopOpacity=".5" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="260" cy="174" rx="240" ry="14" fill={`url(#${id}s)`} />
      <path d="M28 128c0-18 10-30 30-34l70-12c26-24 62-44 118-46 58-2 104 14 142 40l58 8c26 4 44 16 46 34l2 18c0 8-6 14-14 14H44c-10 0-16-8-16-16z" fill={`url(#${id})`} />
      <path d="M150 82c24-22 56-36 100-38v42H150z" fill={glass} opacity=".92" />
      <path d="M262 44c42 0 80 12 112 36l-4 6H262z" fill={glass} opacity=".92" />
      <path d="M444 104c16 2 30 8 36 18h-26c-6 0-10-8-10-18z" fill="#ffd9a0" />
      <path d="M30 118c6-4 14-6 22-6l-4 14H32z" fill="#ff4b3e" />
      <path d="M250 92v58M150 100h300" stroke={light ? "#b8c3d1" : "#2b3646"} strokeWidth="2" opacity=".7" />
      {[128, 392].map((x) => (
        <g key={x}>
          <circle cx={x} cy="150" r="30" fill="#0a0d12" />
          <circle cx={x} cy="150" r="19" fill={light ? "#c6ccd6" : "#8c96a6"} />
          <circle cx={x} cy="150" r="7" fill="#2a313c" />
          {[0, 72, 144, 216, 288].map((a) => (
            <rect key={a} x={x - 2} y={133} width="4" height="12" rx="2" fill="#4a5361" transform={`rotate(${a} ${x} 150)`} />
          ))}
        </g>
      ))}
    </svg>
  );
}

export function Mountains({ className = "" }: { className?: string }) {
  const u = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={"m1" + u} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d3358" /><stop offset="1" stopColor="#0a1424" /></linearGradient>
        <linearGradient id={"m2" + u} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#13243f" /><stop offset="1" stopColor="#0a1424" /></linearGradient>
        <linearGradient id={"rd" + u} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff8a3d" stopOpacity="0" /><stop offset="1" stopColor="#ff8a3d" stopOpacity=".35" /></linearGradient>
      </defs>
      <path d="M0 230 140 120l110 70 150-140 160 120 120-80 170 110 140-90 210 140V400H0z" fill={`url(#m1${u})`} opacity=".8" />
      <path d="M0 300l180-90 140 60 190-110 170 120 150-60 190 90 180-70V400H0z" fill={`url(#m2${u})`} />
      <path d="M560 400c40-80 110-130 240-170-90 50-140 100-160 170z" fill={`url(#rd${u})`} />
    </svg>
  );
}
