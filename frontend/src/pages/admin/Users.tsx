import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api, errMsg } from "../../api";
import { ROLE_LABEL } from "../../auth";
import { Avatar, Spinner, useToast } from "../../components/ui";
import { shortDate } from "../../utils";

export default function Users() {
  const toast = useToast();
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[] | null>(null);
  const load = () => api.get("/admin/users/", { params: { role: role || undefined, q: q || undefined } }).then((r) => setItems(r.data));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [role, q]);
  const patch = async (u: any, data: any, msg: string) => { try { await api.patch(`/admin/users/${u.id}/`, data); toast(msg, "success"); load(); } catch (e) { toast(errMsg(e), "error"); } };
  const premium = (u: any) => { const d = prompt("Necha kun Premium berilsin? (0 — bekor qilish)", "30"); if (d !== null) patch(u, { premium_days: Number(d) }, "Premium yangilandi"); };

  return (
    <div className="col gap-16">
      <div className="row gap-8 wrap">
        <div className="search grow"><Search size={18} /><input className="input" placeholder="Ism yoki telefon" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="tabs">{[["", "Barchasi"], ["user", "Foydalanuvchi"], ["usta", "Usta"], ["evakuator", "Evakuator"], ["admin", "Admin"]].map(([k, l]) => <button key={k} className={role === k ? "active" : ""} onClick={() => setRole(k)}>{l}</button>)}</div>
      </div>
      {!items ? <Spinner /> : (
        <div className="card card-tight table-wrap"><table className="table">
          <thead><tr><th>Foydalanuvchi</th><th>Telefon</th><th>Rol</th><th>Telegram</th><th>Premium</th><th>Ro'yxatdan</th><th>Holat</th><th></th></tr></thead>
          <tbody>{items.map((u) => (
            <tr key={u.id}>
              <td><div className="row gap-8"><Avatar name={u.full_name} src={u.avatar} /><b className="small">{u.full_name}</b></div></td>
              <td className="small">{u.phone}</td><td className="small">{ROLE_LABEL[u.role]}</td>
              <td>{u.telegram_linked ? <span className="badge green">Ulangan</span> : <span className="badge">Yo'q</span>}</td>
              <td className="small">{u.is_premium ? <span className="badge amber">{shortDate(u.premium_until)}</span> : "—"}</td>
              <td className="xs muted">{shortDate(u.date_joined)}</td>
              <td>{u.is_active ? <span className="badge green">Faol</span> : <span className="badge red">Bloklangan</span>}</td>
              <td><div className="row gap-4">
                {u.role === "usta" && <button className="btn btn-sm btn-ghost" onClick={() => premium(u)}>Premium</button>}
                {u.role !== "admin" && <button className={"btn btn-sm " + (u.is_active ? "btn-danger-soft" : "btn-soft")} onClick={() => patch(u, { is_active: !u.is_active }, u.is_active ? "Bloklandi" : "Faollashtirildi")}>{u.is_active ? "Bloklash" : "Ochish"}</button>}
              </div></td>
            </tr>
          ))}</tbody></table></div>
      )}
    </div>
  );
}
