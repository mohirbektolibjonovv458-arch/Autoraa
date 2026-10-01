import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../api";
import { Spinner } from "../../components/ui";
import { money } from "../../utils";

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState<any>(null);
  useEffect(() => { setD(null); api.get("/admin/dashboard/", { params: { days } }).then((r) => setD(r.data)); }, [days]);
  return (
    <div className="col gap-16">
      <div className="tabs" style={{ alignSelf: "flex-start" }}>{[7, 30, 90].map((n) => <button key={n} className={days === n ? "active" : ""} onClick={() => setDays(n)}>{n} kun</button>)}</div>
      {!d ? <Spinner /> : <>
        <div className="grid g4">
          <div className="stat"><div className="label">Umumiy daromad</div><div className="value" style={{ fontSize: 20 }}>{money(d.revenue)}</div></div>
          <div className="stat"><div className="label">Premium obunachilar</div><div className="value">{d.premium_users}</div></div>
          <div className="stat"><div className="label">Yangi (7 kun)</div><div className="value">{d.new_users_week}</div></div>
          <div className="stat"><div className="label">Jami buyurtmalar</div><div className="value">{d.orders}</div></div>
        </div>
        <div className="grid g-2-1">
          <div className="card chart-card"><b>Buyurtmalar (grafik)</b>
            <div style={{ height: 260 }} className="mt-12"><ResponsiveContainer><LineChart data={d.series}><CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" /><XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="orders" stroke="#ee2b2f" strokeWidth={2.5} dot={false} name="Buyurtmalar" /></LineChart></ResponsiveContainer></div>
          </div>
          <div className="card"><b>Eng ko'p so'ralgan xizmatlar</b>
            <div className="col gap-8 mt-12">{d.top_services.map((s: any) => {
              const max = d.top_services[0]?.c || 1;
              return <div key={s.service_name}><div className="row between small"><span>{s.service_name}</span><b>{s.c}</b></div><div className="progress mt-4"><div style={{ width: `${(s.c / max) * 100}%` }} /></div></div>;
            })}{d.top_services.length === 0 && <p className="small muted">Ma'lumot yo'q</p>}</div>
          </div>
        </div>
        <div className="card chart-card"><b>Daromad manbalari</b>
          <div style={{ height: 240 }} className="mt-12"><ResponsiveContainer><BarChart data={[
            { n: "Usta xizmatlari", v: d.revenue_parts.bookings }, { n: "SOS/Evakuator", v: d.revenue_parts.sos }, { n: "Zapchastlar", v: d.revenue_parts.parts }, { n: "Premium", v: d.revenue_parts.premium },
          ]}><CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" /><XAxis dataKey="n" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} /><Tooltip formatter={(v: any) => money(v)} /><Bar dataKey="v" fill="#1f6feb" radius={[8, 8, 0, 0]} name="Summa" /></BarChart></ResponsiveContainer></div>
        </div>
      </>}
    </div>
  );
}
