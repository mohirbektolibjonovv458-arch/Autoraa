import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Car, Check, ChevronRight, Download, FileText, X } from "lucide-react";
import { api } from "../api";
import { pushState } from "../push";
import { isStandalone, markedInstalled } from "../pwa";
import { quickInstall } from "./InstallFlow";
import EnablePush from "./EnablePush";

const HIDE = "ah_checklist_hidden";

/** Yangi foydalanuvchi uchun «Avtora'ni sozlang» — har bir qadam haqiqiy holatdan hisoblanadi (soxta foiz yo'q). */
export default function StartChecklist() {
  const [st, setSt] = useState<{ car: boolean; doc: boolean; push: boolean; app: boolean } | null>(null);
  const [hidden, setHidden] = useState(() => localStorage.getItem(HIDE) === "1");
  const [pushOpen, setPushOpen] = useState(false);
  useEffect(() => {
    if (hidden) return;
    (async () => {
      const cars = (await api.get("/garage/vehicles/").catch(() => ({ data: [] }))).data as any[];
      let doc = false;
      if (cars[0]) doc = ((await api.get(`/garage/vehicles/${cars[0].id}/documents/`).catch(() => ({ data: [] }))).data as any[]).length > 0;
      const ps = await pushState().catch(() => "unsupported");
      setSt({ car: cars.length > 0, doc, push: ps === "on", app: isStandalone() || markedInstalled() });
    })();
  }, [hidden]);
  if (hidden || !st) return null;
  const steps = [
    { done: st.car, icon: Car, title: "Avtomobilingizni qo'shing", text: "Servis va xarajatlarni kuzatish uchun", to: "/app/cars" },
    { done: st.doc, icon: FileText, title: "Sug'urta yoki texosmotr muddatini kiriting", text: "Tugashidan oldin eslatamiz — jarimadan saqlaning", to: "/app/cars?tab=hujjat" },
    { done: st.push, icon: Bell, title: "Bildirishnomalarni yoqing", text: "Bron, xabar va SOS haqida darhol bilib turing", action: () => setPushOpen(true) },
    { done: st.app, icon: Download, title: "Ilovani o'rnating", text: "Bosh ekrandan bir bosishda", action: quickInstall },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <div className="card start-card">
      <div className="row gap-12">
        <div className="ring" style={{ ["--p" as any]: `${pct}%` }}><span>{done}/{steps.length}</span></div>
        <div className="grow"><b>Avtora'ni sozlang</b><div className="xs muted">Bir necha daqiqa — keyin ilova siz uchun ishlaydi</div></div>
        <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="Yashirish" onClick={() => { localStorage.setItem(HIDE, "1"); setHidden(true); }}><X size={14} /></button>
      </div>
      <div className="list mt-8">
        {steps.map((s) => {
          const inner = <>
            <span className={"ico" + (s.done ? " ok" : "")}>{s.done ? <Check size={16} /> : <s.icon size={16} />}</span>
            <div className="grow"><b className="small" style={{ textDecoration: s.done ? "line-through" : undefined, opacity: s.done ? .55 : 1 }}>{s.title}</b>{!s.done && <div className="xs muted">{s.text}</div>}</div>
            {!s.done && <ChevronRight size={16} className="muted" />}
          </>;
          return s.done ? <div key={s.title} className="list-row">{inner}</div>
            : s.to ? <Link key={s.title} to={s.to} className="list-row">{inner}</Link>
            : <button key={s.title} className="list-row" style={{ background: "none", border: 0, width: "100%", textAlign: "left" }} onClick={s.action}>{inner}</button>;
        })}
      </div>
      {pushOpen && !st.push && <div className="mt-8"><EnablePush /></div>}
    </div>
  );
}
