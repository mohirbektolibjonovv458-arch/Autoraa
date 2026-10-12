import { useState } from "react";
import { BookmarkPlus, Check, Volume2 } from "lucide-react";
import { post } from "../lib/api";
import { useToast } from "./Toast";
import { cx } from "./ui";

export type Level = { level: number; title: string; icon: string; xp: number; current_min: number; next_min: number | null; next_title: string | null; progress: number; to_next: number };

export const LEVELS: [number, string, string][] = [
  [0, "Yangi boshlovchi", "🌱"], [100, "Izlanuvchi", "🔎"], [250, "Bilimga chanqoq", "📘"], [500, "Faol o'quvchi", "⚡"], [900, "Tirishqoq", "🎯"],
  [1400, "Bilimdon", "🧠"], [2000, "Tadqiqotchi", "🔬"], [2800, "Bilim ustasi", "🏅"], [3800, "Akademik", "🎓"], [5000, "Professor", "👑"], [7000, "Afsona", "🌟"],
];

/** Hero ichidagi (oq fondagi) ixcham daraja paneli */
export function LevelBar({ lv, light }: { lv: Level; light?: boolean }) {
  return (
    <div className={cx("flex items-center gap-3 rounded-2xl p-3", light ? "bg-white/15 backdrop-blur" : "bg-muted")}>
      <div className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl", light ? "bg-white/20" : "bg-surface shadow-card")}>{lv.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="truncate font-bold">{lv.level}-daraja · {lv.title}</span>
          <span className={cx("shrink-0 text-xs", light ? "text-white/75" : "text-sub")}>{lv.xp} XP</span>
        </div>
        <div className={cx("mt-1.5 h-2 overflow-hidden rounded-full", light ? "bg-white/20" : "bg-line")}>
          <div className={cx("h-full rounded-full transition-all duration-1000", light ? "bg-gradient-to-r from-amber-200 to-white" : "bg-gradient-to-r from-brand to-fuchsia-500")} style={{ width: `${lv.progress}%` }} />
        </div>
        <p className={cx("mt-1 text-[11px]", light ? "text-white/70" : "text-sub")}>
          {lv.next_title ? `«${lv.next_title}» darajasigacha ${lv.to_next} XP` : "Eng yuqori daraja — siz afsonasiz!"}
        </p>
      </div>
    </div>
  );
}

/** Profil sahifasidagi daraja zinapoyasi */
export function LevelLadder({ xp }: { xp: number }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {LEVELS.map(([need, title, icon], i) => {
        const reached = xp >= need;
        const current = reached && (i === LEVELS.length - 1 || xp < LEVELS[i + 1][0]);
        return (
          <div key={title} className={cx("flex w-20 shrink-0 flex-col items-center rounded-2xl border p-2 text-center transition",
            current ? "border-brand bg-brand-soft" : reached ? "border-line bg-surface" : "border-dashed border-line opacity-50 grayscale")}>
            <span className="text-2xl">{icon}</span>
            <span className="mt-1 text-[10px] font-bold leading-tight">{title}</span>
            <span className="text-[10px] text-sub">{need} XP</span>
          </div>
        );
      })}
    </div>
  );
}

type Word = { word: string; translation: string; example: string; level: string; saved: boolean };

export function WordOfDay({ w }: { w: Word }) {
  const toast = useToast();
  const [saved, setSaved] = useState(w.saved);
  const [busy, setBusy] = useState(false);
  const speak = () => {
    try {
      const u = new SpeechSynthesisUtterance(w.word);
      u.lang = "en-US";
      u.rate = 0.9;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { toast("Brauzer talaffuzni qo'llab-quvvatlamaydi", "info"); }
  };
  const add = async () => {
    setBusy(true);
    try {
      await post("/learn/vocab/", { word: w.word, translation: w.translation, example: w.example });
      setSaved(true);
      toast("Lug'atga qo'shildi — takrorlashda chiqadi");
    } catch (e: any) {
      if (/bor/.test(e.message)) setSaved(true);
      toast(e.message, "bad");
    } finally { setBusy(false); }
  };
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-sky-500/10 via-surface to-fuchsia-500/10 p-5 animate-fade-up">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-sky-400/20 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-sub">📖 Kun so'zi · {w.level}</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight">{w.word}</p>
          <p className="text-sm font-semibold text-brand">{w.translation}</p>
        </div>
        <button onClick={speak} aria-label="Talaffuzni eshitish" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface shadow-card transition hover:scale-105 active:scale-95">
          <Volume2 className="h-5 w-5 text-brand" />
        </button>
      </div>
      <p className="relative mt-3 text-sm italic text-sub">“{w.example}”</p>
      <button onClick={add} disabled={saved || busy} className={cx("relative mt-4 w-full", saved ? "btn-soft" : "btn-primary")}>
        {saved ? <><Check className="h-4 w-4" /> Lug'atingizda bor</> : <><BookmarkPlus className="h-4 w-4" /> Lug'atga qo'shish</>}
      </button>
    </section>
  );
}
