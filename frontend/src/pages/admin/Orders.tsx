import { useEffect, useState } from "react";
import { api } from "../../api";
import { Spinner, StatusBadge } from "../../components/ui";
import { money } from "../../utils";

export default function AdminOrders() {
  const [t, setT] = useState("");
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { setItems(null); api.get("/admin/orders/", { params: { type: t || undefined } }).then((r) => setItems(r.data)); }, [t]);
  return (
    <div className="col gap-16">
      <div className="tabs" style={{ alignSelf: "flex-start" }}>{[["", "Barchasi"], ["booking", "Usta xizmatlari"], ["part", "Ehtiyot qismlar"], ["sos", "SOS / Evakuator"]].map(([k, l]) => <button key={k} className={t === k ? "active" : ""} onClick={() => setT(k)}>{l}</button>)}</div>
      {!items ? <Spinner /> : (
        <div className="card card-tight table-wrap"><table className="table">
          <thead><tr><th>#</th><th>Turi</th><th>Xizmat</th><th>Ijrochi</th><th>Status</th><th>Narx</th><th>Sana</th></tr></thead>
          <tbody>{items.map((o) => <tr key={o.uid}><td className="small bold">{o.code}</td><td className="small">{o.type_label}</td><td className="small">{o.title}</td><td className="small">{o.party}</td><td><StatusBadge status={o.status} label={o.status_label} /></td><td className="small">{money(o.price)}</td><td className="xs muted">{o.date}</td></tr>)}</tbody>
        </table>{items.length === 0 && <p className="small muted" style={{ padding: 16 }}>Buyurtmalar yo'q</p>}</div>
      )}
    </div>
  );
}
