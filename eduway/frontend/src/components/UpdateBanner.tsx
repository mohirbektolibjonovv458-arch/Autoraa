import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/** Serverda yangi versiya chiqqanini aniqlaydi (index.html'dagi asosiy skript nomi o'zgaradi) va yangilashni taklif qiladi.
 * O'rnatilgan ilova (PWA) fonda uzoq ochiq tursa ham yangilanish o'tkazib yuborilmaydi. */
function currentScript() {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return s?.getAttribute("src") || "";
}

export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const mine = currentScript();
    if (!mine) return;
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const html = await (await fetch("/", { cache: "no-store" })).text();
        const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
        if (m && m[1] !== mine) {
          setReady(true);
          navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
        }
      } catch { /* oflayn */ } finally { busy = false; }
    };
    check();
    const t = window.setInterval(check, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, []);
  if (!ready) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-navy p-3 pl-4 text-white shadow-2xl animate-fade-up">
      <RefreshCw className="h-5 w-5 shrink-0 text-amber-300" />
      <p className="flex-1 text-sm"><b>Yangi versiya tayyor.</b> Yangi funksiyalarni ko'rish uchun yangilang.</p>
      <button className="btn-primary btn-sm h-9" onClick={() => location.reload()}>Yangilash</button>
    </div>
  );
}
