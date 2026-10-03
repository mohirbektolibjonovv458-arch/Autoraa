import { useEffect, useState } from "react";
import StoriesBar from "../../components/Stories";
import { Link } from "react-router-dom";
import { CalendarCheck, Clock, Crown, Siren, Store, Wallet } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Avatar, Stars, StatusBadge, Verified } from "../../components/ui";
import { money, shortDate } from "../../utils";

export default function UstaHome() {
  const { user } = useAuth();
  const [st, setSt] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [today, setToday] = useState<any[]>([]);
  useEffect(() => {
    api.get("/masters/me/stats/").then((r) => setSt(r.data));
    api.get("/masters/me/").then((r) => setMe(r.data));
    api.get("/masters/bookings/").then((r) => setToday(r.data.filter((b: any) => !["completed", "cancelled"].includes(b.status)).slice(0, 6)));
  }, []);

  return (
    <div className="col gap-16">
      <div className="card row gap-16">
        <Avatar name={user?.full_name} src={user?.avatar} size="lg" />
        <div className="grow">
          <div className="row gap-8 wrap"><h2 style={{ fontSize: 20 }}>Salom, {user?.first_name}!</h2>{me?.is_verified && <Verified />}</div>
          {st && <Stars value={st.rating} count={st.reviews} />}
          {me && !me.is_verified && <div className="xs muted mt-4">Profilingiz admin tomonidan tekshirilmoqda.</div>}
        </div>
        {user?.is_premium ? <span className="badge amber"><Crown size={12} />Premium</span> : <Link to="/app/usta/premium" className="btn btn-sm btn-soft"><Crown size={14} />Premium</Link>}
      </div>

      <StoriesBar />
      <div className="grid g4">
        <div className="stat"><div className="ico"><CalendarCheck size={18} /></div><div className="label mt-8">Bugungi buyurtmalar</div><div className="value">{st?.today ?? "—"}</div></div>
        <div className="stat"><div className="ico" style={{ background: "var(--amber-soft)", color: "#b37400" }}><Clock size={18} /></div><div className="label mt-8">Kutilmoqda</div><div className="value">{st?.pending ?? "—"}</div></div>
        <div className="stat"><div className="ico" style={{ background: "var(--green-soft)", color: "var(--green)" }}><Wallet size={18} /></div><div className="label mt-8">Oylik daromad</div><div className="value" style={{ fontSize: 19 }}>{st ? money(st.month_revenue) : "—"}</div></div>
        <div className="stat"><div className="ico"><CalendarCheck size={18} /></div><div className="label mt-8">Bajarilgan</div><div className="value">{st?.completed ?? "—"}</div></div>
      </div>

      <div className="grid g2 stack-sm">
        <Link to="/app/usta/sos" className="tile red" style={{ minHeight: 100 }}><Siren size={26} /><div><b>Tezkor so'rovlar</b><small>SOS chaqiruvlarini qabul qiling</small></div></Link>
        <Link to="/app/usta/shop" className="tile purple" style={{ minHeight: 100 }}><Store size={26} /><div><b>Zapchast do'koni</b><small>{user?.is_premium ? "Mahsulotlarni boshqarish" : "Premium bilan oching — 40 000 so'm/oy"}</small></div></Link>
      </div>

      <div className="section-head"><h3>Yaqin buyurtmalar</h3><Link to="/app/usta/orders" className="link">Barchasi</Link></div>
      <div className="card card-tight list">
        {today.length === 0 && <p className="small muted" style={{ padding: 12 }}>Faol buyurtmalar yo'q. Xizmatlaringiz va narxlaringizni to'ldiring — mijozlar sizni qidiruvda topadi.</p>}
        {today.map((b) => (
          <div key={b.id} className="list-row">
            <Avatar name={b.client.full_name} src={b.client.avatar} />
            <div className="grow"><b className="small">{b.service_name}</b><div className="xs muted">{b.client.full_name}{b.vehicle_title && ` · ${b.vehicle_title}`}</div></div>
            <div style={{ textAlign: "right" }}><div className="small bold">{shortDate(b.date)} {b.time}</div><StatusBadge status={b.status} label={b.status_label} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
