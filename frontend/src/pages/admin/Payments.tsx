import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { api, errMsg, media } from "../../api";
import { Empty, Modal, Spinner, StatusBadge, useToast } from "../../components/ui";
import { money } from "../../utils";

export default function Payments() {
  const toast = useToast();
  const [st, setSt] = useState("pending");
  const [items, setItems] = useState<any[] | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const load = () => api.get("/admin/payments/", { params: { status: st || undefined } }).then((r) => setItems(r.data));
  useEffect(() => { load(); }, [st]);
  const act = async (p: any, action: "approve" | "reject") => {
    let reason = "";
    if (action === "approve" && !confirm(`${money(p.amount)} kartaga haqiqatan tushganini bank ilovasida tekshirdingizmi?`)) return;
    if (action === "reject") { const r = prompt("Rad etish sababi", "Pul kartaga tushmagan"); if (r === null) return; reason = r; }
    try { await api.post(`/admin/payments/${p.id}/${action}/`, { reason }); toast(action === "approve" ? "Tasdiqlandi — do'kon ochildi" : "Rad etildi", "success"); load(); } catch (e) { toast(errMsg(e), "error"); }
  };
  return (
    <div className="col gap-16">
      <div className="alert">Karta-karta o'tkazmasini avtomatik tekshirib bo'lmaydi: bank ilovangizda <b>summa, vaqt va karta oxirgi 4 raqami</b> mosligini tekshirib, so'ng tasdiqlang. Xuddi shu tugmalar Premium Telegram botida ham bor.</div>
      <div className="tabs" style={{ alignSelf: "flex-start" }}>{[["pending", "Kutilmoqda"], ["approved", "Tasdiqlangan"], ["rejected", "Rad etilgan"], ["", "Barchasi"]].map(([k, l]) => <button key={k} className={st === k ? "active" : ""} onClick={() => setSt(k)}>{l}</button>)}</div>
      {!items ? <Spinner /> : items.length === 0 ? <Empty title="To'lovlar yo'q" /> : (
        <div className="card card-tight table-wrap"><table className="table">
          <thead><tr><th>Chek</th><th>Usta</th><th>Summa</th><th>Muddat</th><th>Karta ****</th><th>Manba</th><th>Sana</th><th>Status</th><th></th></tr></thead>
          <tbody>{items.map((p) => (
            <tr key={p.id}>
              <td>{p.receipt ? <img src={media(p.receipt)} alt="Chek" onClick={() => setImg(media(p.receipt))} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, cursor: "zoom-in" }} /> : "—"}</td>
              <td><b className="small">{p.user_name}</b><div className="xs muted">{p.user_phone}</div></td>
              <td className="small bold">{money(p.amount)}</td><td className="small">{p.months} oy</td><td className="small">{p.payer_card_last4 || "—"}</td>
              <td className="small">{p.source === "telegram" ? "Telegram" : "Sayt"}</td><td className="xs muted">{new Date(p.created_at).toLocaleString("ru-RU")}</td>
              <td><StatusBadge status={p.status} label={p.status_label} />{p.reviewed_by && <div className="xs muted">{p.reviewed_by}</div>}</td>
              <td>{p.status === "pending" && <div className="row gap-4"><button className="btn btn-sm btn-green" onClick={() => act(p, "approve")}><Check size={14} />Tasdiqlash</button><button className="btn btn-sm btn-danger-soft" onClick={() => act(p, "reject")}><X size={14} /></button></div>}</td>
            </tr>
          ))}</tbody></table></div>
      )}
      {img && <Modal title="To'lov cheki" onClose={() => setImg(null)}><img src={img} alt="Chek" style={{ borderRadius: 12 }} /></Modal>}
    </div>
  );
}
