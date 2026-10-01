import { useEffect, useState } from "react";

const OFF = "ah_intro_off"; // avtomatik testlar uchun o'chirish kaliti

/**
 * Ilova ochilganda 3 soniyalik kirish animatsiyasi: belgi → nom → shior → yumshoq yo'qolish.
 * - Ilova har ochilganda / yangilanganda (ichki sahifalarga o'tishda takrorlanmaydi)
 * - Bosilsa darhol o'tkazib yuboriladi
 * - «Kamroq harakat» sozlamasi yoqilgan bo'lsa — qisqa (0.6 s) va harakatsiz
 * - Ilova orqada yuklanaveradi — animatsiya kutish vaqtini uzaytirmaydi
 */
export default function IntroSplash() {
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem(OFF) !== "1" && !location.pathname.startsWith("/admin"); } catch { return true; }
  });
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!show) return;
    document.body.classList.add("intro-on");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const total = reduced ? 600 : 3000;
    const t1 = setTimeout(() => { setLeaving(true); document.body.classList.remove("intro-on"); }, total - 450);
    const t2 = setTimeout(() => setShow(false), total);
    return () => { clearTimeout(t1); clearTimeout(t2); document.body.classList.remove("intro-on"); };
  }, []);
  if (!show) return null;
  const skip = () => { setLeaving(true); document.body.classList.remove("intro-on"); setTimeout(() => setShow(false), 300); };
  return (
    <div className={"intro" + (leaving ? " out" : "")} onClick={skip} role="presentation" aria-hidden="true">
      <div className="intro-glow" />
      <div className="intro-road" />
      <div className="intro-center">
        <div className="intro-mark"><img src="/brand/mark-light.png" alt="" width={132} height={85} /><span className="intro-shine" /></div>
        <div className="intro-name">{"Avtora".split("").map((ch, i) => <span key={i} style={{ animationDelay: `${0.75 + i * 0.07}s` }}>{ch}</span>)}</div>
        <div className="intro-tag">Avtomobilingiz uchun — hammasi bir joyda</div>
        <div className="intro-line"><i /></div>
      </div>
    </div>
  );
}
