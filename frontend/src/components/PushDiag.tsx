import { useEffect, useState } from "react";
import { api } from "../api";
import { timeAgo } from "../utils";

const STATE: Record<string, [string, string]> = {
  sent: ["✅", "telefonga yuborildi"],
  pending: ["⏳", "navbatda"],
  none: ["❌", "ulangan telefon yo'q edi"],
  failed: ["⚠️", "push xizmati qabul qilmadi"],
};

/** Diagnostika: oxirgi xabarlar telefonga yuborildimi — muammo qayerdaligini foydalanuvchining o'zi ko'radi. */
export default function PushDiag({ localOn }: { localOn: boolean }) {
  const [d, setD] = useState<any>(null);
  const load = () => api.get("/push/status/").then((r) => setD(r.data)).catch(() => {});
  useEffect(() => { load(); }, [localOn]);
  if (!d) return null;
  const recent: any[] = d.recent || [];
  const verdict =
    !d.enabled ? "❌ Serverda push sozlanmagan (VAPID kalitlari)."
    : d.devices === 0 ? "❌ Bu hisobga birorta telefon ulanmagan — xabar telefonga bora olmaydi. Shu telefonda «Yoqish» ni bosing. Diqqat: bitta telefonda boshqa hisobga kirsangiz, bildirishnoma o'sha hisobga o'tib ketadi."
    : !localOn ? "⚠️ Hisobga boshqa telefon ulangan, lekin BU telefonda bildirishnoma yoqilmagan."
    : recent[0]?.push === "failed" ? "⚠️ Oxirgi xabarni push xizmati qabul qilmadi. «O'chirish» → «Yoqish» qilib qayta ulang."
    : recent[0]?.push === "sent" ? "✅ Server xabarlarni telefonga yuboryapti. Ilovadan chiqqanda ko'rinmasa — sabab telefon sozlamalarida (pastdagi yo'riqnoma)."
    : "✅ Telefon ulangan. «Sinov xabarini yuborish» bilan tekshiring.";
  return (
    <details className="push-help">
      <summary className="small"><b>Diagnostika: xabarlar telefonga yetyaptimi?</b></summary>
      <div className="col gap-4 mt-4 xs">
        <b>{verdict}</b>
        {d.last_error && <span style={{ color: "var(--red)" }}>Push xizmatining oxirgi javobi: {d.last_error}{d.last_error_at ? ` (${timeAgo(d.last_error_at)})` : ""}</span>}
        <span className="muted">Ulangan telefonlar: {d.devices}{d.broken_devices ? ` (+${d.broken_devices} ishlamaydigan)` : ""} · Oxirgi muvaffaqiyatli yetkazish: {d.last_success ? timeAgo(d.last_success) : "hali yo'q"} · Telegram: {d.telegram ? "ulangan ✅" : "ulanmagan ❌"}</span>
        {recent.length > 0 && <span className="muted">Oxirgi xabarlar:</span>}
        {recent.map((r, i) => <span key={i}>{(STATE[r.push] || ["•", r.push])[0]} {r.title} — {(STATE[r.push] || ["", r.push])[1]} <span className="muted">({timeAgo(r.at)})</span></span>)}
        <button className="btn btn-sm btn-ghost" style={{ alignSelf: "flex-start" }} onClick={load}>Yangilash</button>
      </div>
    </details>
  );
}
