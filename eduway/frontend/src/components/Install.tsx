import { useEffect, useState } from "react";
import { Bell, BellRing, Download, MoreVertical, PlusSquare, Share, Smartphone, X } from "lucide-react";
import { cx, Modal, Spinner } from "./ui";
import { useToast } from "./Toast";
import { LogoMark } from "./Logo";
import { currentSubscription, enablePush, pushSupport, useInstall } from "../lib/pwa";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{n}</span>
      <span className="pt-0.5 text-[15px]">{children}</span>
    </li>
  );
}

/** Qo'llanma: brauzer avtomatik o'rnatish oynasini ko'rsatmaydigan holatlar uchun (iPhone Safari, ba'zi Android brauzerlari). */
export function InstallGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { platform: p } = useInstall();
  return (
    <Modal open={open} onClose={onClose} title={p.mobile ? "Telefonga o'rnatish" : "Kompyuterga o'rnatish"}>
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-muted p-3">
        <LogoMark className="h-12 w-12" />
        <div><p className="font-bold">EduWay AI</p><p className="text-sm text-sub">Bosh ekranda ilova sifatida ochiladi, bildirishnomalar keladi</p></div>
      </div>
      {p.inApp ? (
        <>
          <p className="mb-3 rounded-xl bg-warn/15 p-3 text-sm">Sayt Telegram yoki Instagram ichida ochilgan. U yerda ilovani o'rnatib bo'lmaydi — avval oddiy brauzerda oching.</p>
          <ol className="space-y-3">
            <Step n={1}>Yuqoridagi <b>⋮</b> yoki <b>…</b> menyusini bosing</Step>
            <Step n={2}><b>«Открыть в браузере» / «Open in browser»</b> ni tanlang ({p.ios ? "Safari" : "Chrome"})</Step>
            <Step n={3}>Ochilgan sahifada yana <b>«Yuklab olish»</b> tugmasini bosing</Step>
          </ol>
          <button className="btn-outline mt-4 w-full" onClick={() => { navigator.clipboard?.writeText(location.origin); }}>Havolani nusxalash</button>
        </>
      ) : p.ios ? (
        <>
          {!p.iosSafari && <p className="mb-3 rounded-xl bg-warn/15 p-3 text-sm">iPhone'da o'rnatish uchun saytni <b>Safari</b> brauzerida oching.</p>}
          <ol className="space-y-3">
            <Step n={1}>Pastdagi <b>«Ulashish»</b> tugmasini bosing <Share className="inline h-4 w-4 text-brand" /></Step>
            <Step n={2}>Ro'yxatdan <b>«На экран Домой» / «Add to Home Screen»</b> ni tanlang <PlusSquare className="inline h-4 w-4 text-brand" /></Step>
            <Step n={3}>O'ng yuqoridagi <b>«Добавить» / «Add»</b> ni bosing</Step>
            <Step n={4}>Bosh ekrandagi <b>EduWay AI</b> belgisidan oching va bildirishnomalarni yoqing</Step>
          </ol>
        </>
      ) : p.mobile ? (
        <ol className="space-y-3">
          {p.browser === "samsung" ? (<>
            <Step n={1}>Pastdagi <b>☰ menyu</b> tugmasini bosing</Step>
            <Step n={2}><b>«+ Добавить страницу в» → «Главный экран»</b> (Add page to → Home screen) ni tanlang</Step>
          </>) : p.browser === "yandex" ? (<>
            <Step n={1}>Pastdagi <b>⋮</b> menyusini bosing</Step>
            <Step n={2}><b>«Добавить ярлык»</b> yoki <b>«Установить приложение»</b> ni tanlang</Step>
          </>) : p.browser === "firefox" ? (<>
            <Step n={1}>Brauzer menyusini oching <MoreVertical className="inline h-4 w-4 text-brand" /></Step>
            <Step n={2}><b>«Установить» / «Add to Home screen»</b> ni tanlang</Step>
          </>) : (<>
            <Step n={1}>Brauzer menyusini oching <MoreVertical className="inline h-4 w-4 text-brand" /> (o'ng yuqorida)</Step>
            <Step n={2}><b>«Установить приложение» / «Install app»</b> yoki <b>«Добавить на главный экран»</b> ni tanlang</Step>
          </>)}
          <Step n={3}><b>«Установить» / «Добавить»</b> ni tasdiqlang — EduWay AI telefon ekraningizda paydo bo'ladi</Step>
          <p className="rounded-xl bg-muted p-3 text-xs text-sub">Eng oson yo'l — saytni <b>Google Chrome</b>da ochish: u yerda «Yuklab olish» tugmasi bir bosishda o'rnatadi.</p>
        </ol>
      ) : (
        <ol className="space-y-3">
          {p.browser === "safari" ? (<>
            <Step n={1}>Yuqori menyudan <b>«Файл / File»</b> ni oching</Step>
            <Step n={2}><b>«Добавить в Dock» / «Add to Dock»</b> ni tanlang (macOS Sonoma va yangi)</Step>
          </>) : p.browser === "firefox" ? (<>
            <Step n={1}>Firefox kompyuterda ilova o'rnatishni qo'llab-quvvatlamaydi</Step>
            <Step n={2}>Saytni <b>Google Chrome</b> yoki <b>Microsoft Edge</b>da oching va «Yuklab olish» ni bosing</Step>
          </>) : (<>
            <Step n={1}>Manzil satrining o'ng tomonidagi <b>o'rnatish belgisini</b> <Download className="inline h-4 w-4 text-brand" /> bosing</Step>
            <Step n={2}>Yoki menyu <MoreVertical className="inline h-4 w-4 text-brand" /> → <b>«Установить EduWay AI» / «Install EduWay AI»</b> (Edge'da: «Приложения → Установить»)</Step>
            <Step n={3}><b>«Установить»</b> ni bosing — EduWay AI ish stolida va Pusk menyusida paydo bo'ladi</Step>
          </>)}
        </ol>
      )}
      <button className="btn-primary mt-5 w-full" onClick={onClose}>Tushunarli</button>
    </Modal>
  );
}

/** «Ilovani yuklash» tugmasi: Android/Chrome/Edge'da bitta bosishda o'rnatadi, qolganlarida qo'llanma ochadi. */
export function InstallButton({ className = "btn-primary", label = "Ilovani yuklab olish" }: { className?: string; label?: string }) {
  const inst = useInstall();
  const [guide, setGuide] = useState(false);
  const toast = useToast();
  if (inst.installed) return null;
  const [busy, setBusy] = useState(false);
  const click = async () => {
    setBusy(true);
    try {
      // brauzer o'rnatish oynasini ochadi (tayyor bo'lmasa bir necha soniya kutadi); bo'lmasa — qo'llanma
      const r = await inst.prompt();
      if (r === "accepted") toast("EduWay AI o'rnatildi 🎉 Uni bosh ekrandan oching");
      else if (r === "unavailable") setGuide(true);
    } finally { setBusy(false); }
  };
  return (
    <>
      <button className={className} onClick={click} disabled={busy}>{busy ? <Spinner className="h-5 w-5" /> : <Download className="h-5 w-5" />} {busy ? "Tayyorlanmoqda..." : label}</button>
      <InstallGuide open={guide} onClose={() => setGuide(false)} />
    </>
  );
}

/** Ilova ichidagi yumshoq banner: o'rnatilmagan bo'lsa ko'rsatiladi, yopilsa 7 kun ko'rinmaydi. */
export function InstallBanner() {
  const inst = useInstall();
  const [hidden, setHidden] = useState(() => {
    try { return Date.now() < +(localStorage.getItem("eduway-install-hide") || 0); } catch { return false; }
  });
  if (inst.installed || hidden) return null;
  const hide = () => { try { localStorage.setItem("eduway-install-hide", String(Date.now() + 7 * 864e5)); } catch { /* ignore */ } setHidden(true); };
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-r from-brand-soft to-surface p-3.5 animate-fade-up">
      <LogoMark className="h-11 w-11 shrink-0" />
      <div className="min-w-0 flex-1"><p className="font-bold leading-tight">Ilovani telefoningizga o'rnating</p><p className="text-xs text-sub">Tezroq ochiladi va eslatmalar keladi</p></div>
      <InstallButton className="btn-primary btn-sm" label="O'rnatish" />
      <button onClick={hide} aria-label="Yopish" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-lg text-sub hover:bg-muted"><X className="h-4 w-4" /></button>
    </div>
  );
}

/** Push-bildirishnomalarni yoqish kartasi. */
export function PushCard({ compact }: { compact?: boolean }) {
  const toast = useToast();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(false);
  useEffect(() => { currentSubscription().then((s) => setOn(!!s && Notification.permission === "granted")).catch(() => setOn(false)); }, []);
  if (on === null || (on && compact)) return null;
  const s = pushSupport();
  const enable = async () => {
    setBusy(true);
    const r = await enablePush();
    setBusy(false);
    if (r === "ok") { setOn(true); toast("Bildirishnomalar yoqildi 🔔"); }
    else if (r === "ios-install") setGuide(true);
    else if (r === "denied") toast("Ruxsat berilmadi. Brauzer sozlamalaridan bildirishnomalarga ruxsat bering.", "bad");
    else if (r === "unsupported") toast("Bu brauzer bildirishnomalarni qo'llab-quvvatlamaydi. Chrome'dan foydalaning.", "bad");
    else toast("Yoqib bo'lmadi. Keyinroq urinib ko'ring.", "bad");
  };
  if (on) return (
    <div className="flex items-center gap-3 rounded-2xl bg-ok/10 p-3.5 text-sm"><BellRing className="h-5 w-5 text-ok" /> Bildirishnomalar yoqilgan — eslatmalar telefoningizga keladi.</div>
  );
  return (
    <div className={cx("flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 animate-fade-up", compact && "shadow-card")}>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white"><Bell className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-tight">Eslatmalarni yoqing</p>
        <p className="text-xs text-sub">{s.reason === "ios-install" ? "iPhone'da avval ilovani Bosh ekranga o'rnating" : s.reason === "denied" ? "Brauzer sozlamalarida bildirishnomalar bloklangan" : "Seriya, challenge va grant muddatlari — ilova yopiq bo'lsa ham"}</p>
      </div>
      <button className="btn-soft btn-sm" disabled={busy || s.reason === "denied"} onClick={enable}>{busy ? <Spinner className="h-4 w-4" /> : <><Smartphone className="h-4 w-4" /> Yoqish</>}</button>
      <InstallGuide open={guide} onClose={() => setGuide(false)} />
    </div>
  );
}
