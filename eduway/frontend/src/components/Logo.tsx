import { useId } from "react";
import { cx } from "./ui";

export function LogoMark({ className = "h-10 w-10", animated }: { className?: string; animated?: boolean }) {
  // har bir nusxaga alohida id: yashirin (display:none) nusxadagi gradient boshqalarini buzmasligi uchun
  const gid = "lg" + useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7C6CFF" /><stop offset="1" stopColor="#3B2FC9" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${gid})`} />
      <path d="M16 46c8 0 10-8 16-14s12-6 16-14" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round"
        strokeDasharray="120" className={animated ? "animate-draw" : ""} />
      <circle cx="16" cy="46" r="4" fill="#fff" />
      <path d="M48 10l2.2 5.8L56 18l-5.8 2.2L48 26l-2.2-5.8L40 18l5.8-2.2z" fill="#C9C2FF" className={animated ? "origin-[48px_18px] animate-pop [animation-delay:.8s]" : ""} />
    </svg>
  );
}

export function Logo({ className = "", light }: { className?: string; light?: boolean }) {
  return (
    <div className={cx("flex items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-9" />
      <span className={cx("text-lg font-extrabold tracking-tight", light && "text-white")}>
        EduWay<span className="ml-1 rounded-md bg-gradient-to-r from-brand to-fuchsia-500 px-1.5 py-0.5 text-xs font-bold text-white align-middle">AI</span>
      </span>
    </div>
  );
}
