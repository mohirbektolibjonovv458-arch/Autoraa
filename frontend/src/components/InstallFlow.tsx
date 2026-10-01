import { useEffect, useState } from "react";
import { APK } from "../site";
import { Check, Copy, MoreVertical, PlusSquare, RefreshCw, Share, X } from "lucide-react";
import {
  androidBrowser, applyUpdate, canPrompt, detectInstalled, inAppBrowser, iosBrowser, isAndroid, isIOS, isStandalone,
  markedInstalled, onPwaChange, onUpdate, promptInstall, updateReady,
} from "../pwa";

/**
 * Ilovani o'rnatish oynasi — faqat platformaning HAQIQIY holatlari ko'rsatiladi:
 * brauzer yuklab olish foizini bermaydi, shuning uchun soxta «70%» yo'q.
 *   confirm → (brauzer oynasi) waiting → installing (appinstalled kutilmoqda) → done
 */
type Step = "confirm" | "waiting" | "installing" | "done" | "dismissed" | "slow" | "guide" | "installed";
let openFn: (() => void) | null = null;
/** Android: shu sahifani Chrome'da ochish (Samsung Internet va boshqa brauzerlardan) */
const chromeIntent = () => `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;
export const openInstall = () => openFn?.();
/** «O'rnatish» tugmasi: brauzer ruxsat bergan bo'lsa — darhol brauzer oynasi, aks holda qisqa yo'riqnoma */
export async function quickInstall() {
  if (isStandalone()) return;
  if (canPrompt()) { const r = await promptInstall(); if (r !== "unavailable") return; }
  // Android (Samsung Internet va boshqalar): ilova faylini darhol yuklab olish — matn va yo'riqnomasiz
  if (isAndroid() && APK.url) {
    const a = document.createElement("a"); a.href = APK.url; a.download = "Avtora.apk"; document.body.appendChild(a); a.click(); a.remove();
    apkToast();
    return;
  }
  openInstall();
}
function apkToast() {
  const el = document.createElement("div");
  el.className = "apk-toast"; el.setAttribute("role", "status");
  el.textContent = "⬇️ Avtora yuklanmoqda — tugagach faylni oching";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

export default function InstallFlow() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("confirm");
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => { if (!waiting) return; const t = setTimeout(() => setWaiting(false), 12000); return () => clearTimeout(t); }, [waiting]);
  const [, force] = useState(0);

  useEffect(() => {
    openFn = () => {
      setCopied(false);
      const st = isStandalone() || markedInstalled() ? "installed" : canPrompt() ? "confirm" : "guide";
      setStep(st);
      // Chrome o'rnatish oynasini sahifa bilan biroz ishlagandan keyin beradi — shu paytgacha kutamiz (12 s), keyin menyu yo'li
      setWaiting(st === "guide" && isAndroid() && androidBrowser() === "chrome" && window.isSecureContext && !import.meta.env.DEV);
      setOpen(true);
    };
    const off = onPwaChange(() => {
      force((x) => x + 1);
      // brauzer ilovani haqiqatan o'rnatib bo'lganda (appinstalled hodisasi)
      if (markedInstalled()) setStep((s) => (s === "installing" || s === "waiting" || s === "slow" ? "done" : s));
      if (canPrompt()) { setWaiting(false); setStep((s) => (s === "guide" ? "confirm" : s)); }
    });
    detectInstalled();
    return () => { openFn = null; off(); };
  }, []);

  useEffect(() => {
    if (step !== "installing") return;
    const t = setTimeout(() => setStep((s) => (s === "installing" ? "slow" : s)), 30000);
    return () => clearTimeout(t);
  }, [step]);

  if (!open) return null;
  const close = () => setOpen(false);
  const install = async () => {
    setStep("waiting");
    const r = await promptInstall();
    if (r === "accepted") setStep(markedInstalled() ? "done" : "installing");
    else if (r === "dismissed") setStep("dismissed");
    else setStep("guide");
  };
  const openApp = () => { window.open("/app?source=pwa", "_blank"); close(); };
  const copy = async () => { try { await navigator.clipboard.writeText(window.location.origin); setCopied(true); } catch { /* */ } };
  const insecure = !window.isSecureContext;

  return (
    <div className="modal-back" style={{ zIndex: 2500 }} onClick={close}>
      <div className="modal install-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Ilovani o'rnatish">
        <button className="icon-btn im-close" onClick={close} aria-label="Yopish"><X size={16} /></button>
        <div className="im-head">
          <img src="/icons/icon-192.png" alt="" width={72} height={72} />
          <div><b>Avtora</b><span>Avtomobil egalari uchun premium platforma</span></div>
        </div>

        {step === "confirm" && <button className="btn btn-red btn-lg btn-block" onClick={install}>O'rnatish</button>}

        {step === "waiting" && <Status spin title="Tasdiqlashingiz kutilmoqda" text="Brauzer oynasida «O'rnatish» tugmasini bosing." />}
        {step === "installing" && <Status spin title="O'rnatilmoqda…" text="Brauzer Avtora'ni qurilmangizga qo'shmoqda. Bu odatda bir necha soniya davom etadi." />}
        {step === "slow" && <Status title="Deyarli tayyor" text="Brauzer o'rnatishni yakunlamoqda. Bosh ekraningizni tekshiring — Avtora belgisi paydo bo'lishi kerak." />}
        {step === "done" && <>
          <Status ok title="Avtora o'rnatildi" text="Ilova bosh ekraningizga qo'shildi. Keyingi safar uni o'sha yerdan oching." />
          <button className="btn btn-red btn-lg btn-block" onClick={openApp}>Ilovani ochish</button>
          <p className="xs muted center mt-8">Agar ilova ochilmasa, bosh ekrandagi Avtora belgisini bosing.</p>
        </>}
        {step === "installed" && <>
          <Status ok title={isStandalone() ? "Siz ilovadasiz" : "Avtora allaqachon o'rnatilgan"} text={isStandalone() ? "Avtora qurilmangizga o'rnatilgan va hozir ilova sifatida ochilgan." : "Bosh ekrandagi Avtora belgisidan oching."} />
          {!isStandalone() && <button className="btn btn-lg btn-block" onClick={openApp}>Ilovani ochish</button>}
        </>}
        {step === "dismissed" && <>
          <Status title="O'rnatish bekor qilindi" text="Istalgan vaqtda Profil → «Ilovani o'rnatish» orqali qayta o'rnatishingiz mumkin." />
          <button className="btn btn-block" onClick={() => setStep("guide")}>Qo'lda o'rnatish yo'riqnomasi</button>
        </>}

        {step === "guide" && (
          <div className="im-guide im-short">
            {import.meta.env.DEV ? <p>Ishlab chiqish rejimida o'rnatilmaydi — <b>localhost:8000</b> ni oching.</p>
              : insecure ? <p>O'rnatish uchun sayt <b>https://</b> orqali ochilishi kerak.</p>
              : inAppBrowser() ? <><p><b>⋯</b> → <b>«Brauzerda ochish»</b></p><button className="btn btn-block btn-ghost" onClick={copy}>{copied ? <><Check size={15} />Nusxalandi</> : <><Copy size={15} />Havolani nusxalash</>}</button></>
              : isIOS() ? (iosBrowser() === "firefox" || iosBrowser() === "other" ? <p><b>Safari</b>'da oching</p>
                : <p><span className="ib-ico"><Share size={15} /></span> → <b>«Bosh ekranga qo'shish»</b></p>)
              : isAndroid() && androidBrowser() === "samsung" ? <>
                  <p><b>≡</b> → <b>«Sahifa qo'shish»</b> → <b>«Bosh ekran»</b></p>
                  <a className="btn btn-red btn-lg btn-block" href={chromeIntent()}>Chrome'da o'rnatish</a>
                </>
              : isAndroid() && waiting ? <div className="row gap-8" style={{ justifyContent: "center" }}><span className="im-spin" /><b>Tayyorlanmoqda…</b></div>
              : isAndroid() ? <p><span className="ib-ico"><MoreVertical size={15} /></span> → <b>«Ilovani o'rnatish»</b></p>
              : <p>Manzil qatoridagi <b>⊕</b> belgisini bosing</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Status({ title, text, spin, ok }: { title: string; text: string; spin?: boolean; ok?: boolean }) {
  return (
    <div className="im-status" role="status" aria-live="polite">
      <div className={"im-ic" + (ok ? " ok" : "")}>{ok ? <Check size={26} /> : spin ? <span className="im-spin" /> : <RefreshCw size={22} />}</div>
      <b>{title}</b><p>{text}</p>
      {spin && <div className="im-bar"><i /></div>}
    </div>
  );
}

/** «Avtora uchun yangi versiya mavjud» — foydalanuvchi bosganda yangilanadi */
export function UpdateBanner() {
  const [ready, setReady] = useState(updateReady());
  useEffect(() => onUpdate(() => setReady(true)), []);
  if (!ready) return null;
  return (
    <div className="update-banner" role="status">
      <RefreshCw size={16} />
      <span className="grow">Avtora uchun yangi versiya mavjud</span>
      <button onClick={applyUpdate}>Yangilash</button>
      <button className="x" onClick={() => setReady(false)} aria-label="Keyinroq">×</button>
    </div>
  );
}
