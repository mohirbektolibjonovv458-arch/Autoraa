import { useEffect, useState } from "react";
import { api } from "../../api";
import { Spinner, useToast } from "../../components/ui";
import { shortDate } from "../../utils";

export default function Shops() {
  const toast = useToast();
  const [items, setItems] = useState<any[] | null>(null);
  const load = () => api.get("/admin/shops/").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  const toggle = async (s: any) => { await api.patch("/admin/shops/", { id: s.id, is_active: !s.is_active }); toast("Yangilandi", "success"); load(); };
  if (!items) return <Spinner />;
  return (
    <div className="card card-tight table-wrap"><table className="table">
      <thead><tr><th>Do'kon</th><th>Egasi</th><th>Mahsulotlar</th><th>Premium muddati</th><th>Holat</th><th></th></tr></thead>
      <tbody>{items.map((s) => (
        <tr key={s.id}><td><b className="small">{s.name}</b><div className="xs muted">{s.address}</div></td><td className="small">{s.owner_name}</td><td className="small">{s.products_count}</td>
          <td className="small">{s.premium_until ? shortDate(s.premium_until) : "—"}</td>
          <td>{s.is_open ? <span className="badge green">Ochiq</span> : !s.is_active ? <span className="badge red">Admin yopgan</span> : <span className="badge amber">Premium tugagan</span>}</td>
          <td><button className={"btn btn-sm " + (s.is_active ? "btn-danger-soft" : "btn-soft")} onClick={() => toggle(s)}>{s.is_active ? "Yopish" : "Ruxsat berish"}</button></td></tr>
      ))}</tbody>
    </table>{items.length === 0 && <p className="small muted" style={{ padding: 16 }}>Hali do'konlar yo'q</p>}</div>
  );
}
