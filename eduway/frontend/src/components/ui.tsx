import { ReactNode, useEffect, useId } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, BadgeCheck, CircleHelp, Crown, Loader2, Lock, X } from "lucide-react";
import { ApiError } from "../lib/api";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={cx("animate-spin", className || "h-5 w-5")} />;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cx("skeleton", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 animate-fade-up">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-32" />
      <div className="grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <Skeleton className="h-40" />
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError | Error | null; onRetry?: () => void }) {
  return (
    <div className="card p-6 text-center animate-fade-up">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-bad/10 text-bad"><AlertTriangle className="h-6 w-6" /></div>
      <p className="font-semibold">{error?.message || "Xatolik yuz berdi"}</p>
      {onRetry && <button className="btn-soft btn-sm mt-4" onClick={onRetry}>Qayta urinish</button>}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card p-8 text-center animate-fade-up">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">{icon || <CircleHelp className="h-7 w-7" />}</div>
      <p className="font-bold">{title}</p>
      {text && <p className="mt-1 text-sm text-sub">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: boolean | string; action?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="mb-5 flex items-start gap-3 animate-fade-up">
      {back && (
        <button aria-label="Orqaga" onClick={() => (typeof back === "string" ? nav(back) : nav(-1))} className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = "brand", className = "" }: { children: ReactNode; tone?: "brand" | "ok" | "warn" | "bad" | "muted"; className?: string }) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    ok: "bg-ok/10 text-ok",
    warn: "bg-warn/15 text-warn",
    bad: "bg-bad/10 text-bad",
    muted: "bg-muted text-sub",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function VerifiedBadge({ verified, date }: { verified: boolean; date?: string | null }) {
  return verified ? (
    <Badge tone="ok"><BadgeCheck className="h-3.5 w-3.5" /> Tasdiqlangan{date ? ` · ${date}` : ""}</Badge>
  ) : (
    <Badge tone="warn"><AlertTriangle className="h-3.5 w-3.5" /> Tekshirilmagan</Badge>
  );
}

export function PremiumBadge() {
  return <Badge tone="warn" className="!bg-gradient-to-r from-amber-400/20 to-fuchsia-400/20"><Crown className="h-3.5 w-3.5" /> Premium</Badge>;
}

export function Progress({ value, className = "", tone = "brand" }: { value: number; className?: string; tone?: "brand" | "ok" }) {
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cx("h-full rounded-full transition-all duration-700", tone === "ok" ? "bg-ok" : "bg-gradient-to-r from-brand to-fuchsia-500")} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const gid = "rg" + useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--muted))" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${gid})`} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)} style={{ transition: "stroke-dashoffset .8s ease" }} />
        <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="rgb(var(--brand))" /><stop offset="1" stopColor="#D946EF" /></linearGradient></defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className={cx("max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl animate-fade-up sm:rounded-3xl safe-bottom", wide ? "sm:max-w-2xl" : "sm:max-w-md")} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button aria-label="Yopish" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PremiumLock({ text, compact }: { text?: string; compact?: boolean }) {
  return (
    <div className={cx("rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-fuchsia-500/5 to-brand/10", compact ? "p-4" : "p-6 text-center")}>
      <div className={cx("flex items-center gap-3", !compact && "flex-col")}>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-fuchsia-500 text-white"><Lock className="h-5 w-5" /></div>
        <div className="flex-1">
          <p className="font-bold">Premium imkoniyat</p>
          <p className="text-sm text-sub">{text || "Bu funksiya Premium tarifda mavjud."}</p>
        </div>
        <Link to="/premium" className="btn-primary btn-sm">Batafsil</Link>
      </div>
    </div>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-sub">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-bad">{error}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={cx("h-9 shrink-0 rounded-lg px-3 text-sm font-semibold transition", value === o.value ? "bg-surface text-ink shadow-card" : "text-sub hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
