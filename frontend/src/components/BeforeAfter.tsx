import { useRef, useState } from "react";

/** «Oldin / keyin» solishtirish: barmoq yoki sichqoncha bilan chiziqni suring. Klaviatura: ← → */
export default function BeforeAfter({ before, after, alt = "" }: { before: string; after: string; alt?: string }) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div ref={box} className="ba" role="slider" aria-label="Oldin / keyin" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos)} tabIndex={0}
      onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === "touch") move(e.clientX); }}
      onKeyDown={(e) => { if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5)); if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5)); }}>
      <img src={after} alt={alt} draggable={false} />
      <div className="ba-before" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}><img src={before} alt="" draggable={false} /></div>
      <span className="ba-tag l">Oldin</span><span className="ba-tag r">Keyin</span>
      <div className="ba-line" style={{ left: `${pos}%` }}><span className="ba-knob">⇆</span></div>
    </div>
  );
}
