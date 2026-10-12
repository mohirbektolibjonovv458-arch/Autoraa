import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useApi } from "../lib/hooks";
import { cx, Skeleton } from "./ui";
import { fmtDate } from "../lib/format";

const ROWS: [string, string, string][] = [
  ["xp", "XP", "⭐"], ["active_days", "Faol kun", "📅"], ["quizzes", "Test", "✅"],
  ["focus_minutes", "Fokus (daq)", "⏱️"], ["words_reviewed", "So'z takrori", "📖"], ["tasks_done", "Vazifa", "🎯"],
];

export function WeeklyReport() {
  const { data: w, loading } = useApi<any>("/weekly/");
  if (loading) return <Skeleton className="mt-4 h-48" />;
  if (!w) return null;
  const ch = w.xp_change;
  const Trend = ch > 0 ? TrendingUp : ch < 0 ? TrendingDown : Minus;
  return (
    <section className="card mt-4 overflow-hidden animate-fade-up">
      <div className="gradient-hero flex items-center justify-between gap-3 p-5 text-white">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-white/70">Haftalik hisobot</p>
          <p className="mt-0.5 text-sm text-white/85">{fmtDate(w.from, false)} — {fmtDate(w.to, false)}</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur">
          <Trend className="h-5 w-5" />
          <span className="font-extrabold">{ch > 0 ? "+" : ""}{ch} XP</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px bg-line">
        {ROWS.map(([k, label, icon]) => {
          const cur = w.current[k], prev = w.previous[k];
          return (
            <div key={k} className="bg-surface p-3 text-center">
              <p className="text-lg">{icon}</p>
              <p className="text-lg font-extrabold">{cur}</p>
              <p className="text-[11px] text-sub">{label}</p>
              <p className={cx("text-[10px] font-semibold", cur > prev ? "text-ok" : cur < prev ? "text-bad" : "text-sub")}>
                {cur === prev ? "= o'tgan hafta" : `o'tgan hafta: ${prev}`}
              </p>
            </div>
          );
        })}
      </div>
      <p className="p-4 text-sm text-sub">
        {w.current.xp === 0 ? "Bu hafta hali faollik yo'q — bugun kunlik challenge'dan boshlang." :
          w.best_day ? `Eng samarali kuningiz: ${fmtDate(w.best_day.date, false)} (${w.best_day.xp} XP). ` : ""}
        {ch > 0 && "O'tgan haftadan yaxshiroq — zo'r! 🚀"}
        {ch < 0 && w.current.xp > 0 && "O'tgan haftadan biroz kam — har kuni 10 daqiqa ham farq qiladi."}
      </p>
    </section>
  );
}
