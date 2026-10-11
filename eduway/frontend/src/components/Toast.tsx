import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cx } from "./ui";

type Tone = "ok" | "bad" | "info";
type T = { id: number; text: string; tone: Tone };
const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, tone: Tone = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx("pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl animate-pop",
            t.tone === "bad" ? "bg-bad text-white" : t.tone === "info" ? "bg-navy text-white" : "bg-ink text-bg")}>
            {t.tone === "bad" ? <XCircle className="h-5 w-5 shrink-0" /> : t.tone === "info" ? <Info className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-ok" />}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
