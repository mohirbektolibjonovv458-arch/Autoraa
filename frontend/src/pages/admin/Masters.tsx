import { useEffect, useState } from "react";
import { api } from "../../api";
import { Avatar, Spinner, Stars, useToast } from "../../components/ui";
import { SPECIALTIES } from "../../utils";

export default function AdminMasters() {
  const toast = useToast();
  const [st, setSt] = useState("");
  const [items, setItems] = useState<any[] | null>(null);
  const load = () => api.get("/admin/masters/", { params: { status: st || undefined } }).then((r) => setItems(r.data));
  useEffect(() => { load(); }, [st]);
  const verify = async (m: any, v: boolean) => { await api.post(`/admin/masters/${m.id}/verify/`, { verified: v }); toast(v ? "Tasdiqlandi — ustaga xabar yuborildi" : "Tasdiq olib tashlandi", "success"); load(); };
  return (
    <div className="col gap-16">
      <div className="tabs" style={{ alignSelf: "flex-start" }}>{[["", "Barchasi"], ["pending", "Tekshirilmoqda"], ["verified", "Tasdiqlangan"]].map(([k, l]) => <button key={k} className={st === k ? "active" : ""} onClick={() => setSt(k)}>{l}</button>)}</div>
      {!items ? <Spinner /> : (
        <div className="card card-tight table-wrap"><table className="table">
          <thead><tr><th>Usta</th><th>Mutaxassislik</th><th>Reyting</th><th>Bajarilgan</th><th>Xizmatlar</th><th>Status</th><th></th></tr></thead>
          <tbody>{items.map((m) => (
            <tr key={m.id}>
              <td><div className="row gap-8"><Avatar name={m.name} src={m.user.avatar} /><div><b className="small">{m.name}</b><div className="xs muted">{m.user.phone} · {m.address}</div></div></div></td>
              <td className="small">{m.specialties.map((s: string) => SPECIALTIES[s] || s).join(", ")}</td>
              <td><Stars value={m.rating} count={m.reviews_count} /></td><td className="small">{m.completed_jobs}</td><td className="small">{m.services.length}</td>
              <td>{m.is_verified ? <span className="badge green">Tasdiqlangan</span> : <span className="badge amber">Kutilmoqda</span>}</td>
              <td>{m.is_verified ? <button className="btn btn-sm btn-ghost" onClick={() => verify(m, false)}>Bekor</button> : <button className="btn btn-sm btn-green" onClick={() => verify(m, true)}>Tasdiqlash</button>}</td>
            </tr>
          ))}</tbody></table></div>
      )}
    </div>
  );
}
