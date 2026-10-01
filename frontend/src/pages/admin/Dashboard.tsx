import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ClipboardList, CreditCard, Siren, Truck, Users, Wallet, Wrench } from "lucide-react";
import { api } from "../../api";
import { Spinner, StatusBadge } from "../../components/ui";
import { money } from "../../utils";

export const PIE_COLORS: Record<string, string> = { pending: "#f5a623", confirmed: "#1f6feb", in_progress: "#7c4dff", completed: "#12a150", cancelled: "#ee2b2f" };
export const B_LABEL: Record<string, string> = { pending: "Kutilmoqda", confirmed: "Tasdiqlangan", in_progress: "Bajarilmoqda", completed: "Bajarildi", cancelled: "Bekor" };

export default function Dashboard() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api.get("/admin/dashboard/").then((r) => setD(r.data)); }, []);
  if (!d) return <Spinner />;
  const cards = [
    ["Foydalanuvchilar", d.users, Users, "#1f6feb"], ["Ustalar", d.masters, Wrench, "#7c4dff"], ["Evakuatorlar", d.evacuators, Truck, "#12a150"],
    ["Buyurtmalar", d.orders, ClipboardList, "#f5a623"], ["Daromad", money(d.revenue), Wallet, "#12a150"], ["Faol SOS", d.active_sos, Siren, "#ee2b2f"],
  ] as const;
  return (
    <div className="col gap-16">
      {!d.support_phone_set && <Link to="/admin/settings" className="alert warn">📞 <b>Qo'llab-quvvatlash telefonini kiriting</b> — mijozlar muammo bo'lsa sizga qayerga qo'ng'iroq qilishini bilishi kerak (Sayt sozlamalari) →</Link>}
      {d.premium_admins === 0 && (
        <div className="alert warn">
          <b>Premium to'lovlarni Telegramda tasdiqlash uchun</b> <a href={`https://t.me/${d.premium_bot}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>@{d.premium_bot}</a> botini oching, /start bosing va «Raqamni ulashish» orqali shu admin akkauntingiz raqamini yuboring. Shundan so'ng har bir chek sizga tugmalar bilan keladi. (To'lovlarni shu paneldagi «Premium to'lovlar» bo'limida ham tasdiqlash mumkin.)
        </div>
      )}
      {d.pending_payments > 0 && <Link to="/admin/payments" className="alert warn row gap-8"><CreditCard size={18} /><b>{d.pending_payments} ta Premium to'lov</b> tasdiqlashni kutmoqda →</Link>}
      <div className="grid g3">
        {cards.map(([l, v, I, c]) => (
          <div key={l} className="stat row gap-12"><div className="ico" style={{ background: c + "1a", color: c }}><I size={18} /></div><div><div className="label">{l}</div><div className="value" style={{ fontSize: 22 }}>{v}</div></div></div>
        ))}
      </div>
      <div className="grid g-2-1">
        <div className="card chart-card">
          <div className="row between"><b>Daromad statistikasi (14 kun)</b><span className="small muted">Premium: {money(d.revenue_parts.premium)}</span></div>
          <div style={{ height: 260 }} className="mt-12">
            <ResponsiveContainer><AreaChart data={d.series}>
              <defs><linearGradient id="rv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f6feb" stopOpacity={.35} /><stop offset="1" stopColor="#1f6feb" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" /><XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
              <Tooltip formatter={(v: any) => money(v)} /><Area type="monotone" dataKey="revenue" stroke="#1f6feb" strokeWidth={2.5} fill="url(#rv)" name="Daromad" />
            </AreaChart></ResponsiveContainer>
          </div>
        </div>
        <div className="card chart-card">
          <b>Buyurtmalar (status)</b>
          <div style={{ height: 200 }}>
            <ResponsiveContainer><PieChart><Pie data={d.booking_status} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {d.booking_status.map((s: any) => <Cell key={s.status} fill={PIE_COLORS[s.status] || "#999"} />)}</Pie><Tooltip formatter={(v: any, n: any) => [v, B_LABEL[n] || n]} /></PieChart></ResponsiveContainer>
          </div>
          <div className="col gap-4">{d.booking_status.map((s: any) => <div key={s.status} className="row between small"><span className="row gap-8"><span className="online-dot" style={{ background: PIE_COLORS[s.status], boxShadow: "none" }} />{B_LABEL[s.status]}</span><b>{s.count}</b></div>)}</div>
        </div>
      </div>
      <div className="card card-tight">
        <div className="row between" style={{ padding: "4px 8px" }}><b>So'nggi buyurtmalar</b><Link className="link" to="/admin/orders">Barchasini ko'rish</Link></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>ID</th><th>Turi</th><th>Xizmat</th><th>Ijrochi</th><th>Status</th><th>Narx</th><th>Sana</th></tr></thead>
          <tbody>{d.latest.map((o: any) => <tr key={o.uid}><td className="small bold">{o.code}</td><td className="small">{o.type_label}</td><td className="small">{o.title}</td><td className="small">{o.party}</td><td><StatusBadge status={o.status} label={o.status_label} /></td><td className="small">{money(o.price)}</td><td className="xs muted">{o.date}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  );
}
