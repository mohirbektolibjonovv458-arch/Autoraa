import { useEffect, useState } from "react";
import StoriesBar from "../../components/Stories";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, Fuel, Cpu, FileText, MapPin, Package, Siren, Truck, Wallet, Wrench , Navigation } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { MasterCard } from "../../components/Cards";
import { FuelBadge } from "../../components/Fuel";
import StartChecklist from "../../components/StartChecklist";
import { CarArt, Mountains, StatusBadge } from "../../components/ui";
import { money, useGeo } from "../../utils";

const TILES = [
  { to: "/app/sos", label: "SOS yordam", sub: "Favqulodda", icon: Siren, tone: "red" },
  { to: "/app/masters", label: "Usta topish", sub: "Yaqin ustalar", icon: Wrench, tone: "blue" },
  { to: "/app/sos?kind=evakuator", label: "Evakuator", sub: "24/7 xizmat", icon: Truck, tone: "green" },
  { to: "/app/parts", label: "Ehtiyot qismlar", sub: "Original va analog", icon: Package, tone: "purple" },
  { to: "/app/fuel", label: "Yoqilg'i", sub: "Metan qayerda bor", icon: Fuel, tone: "orange" },
  { to: "/app/masters?category=diagnostika", label: "Diagnostika", sub: "Kompyuter tekshiruvi", icon: Cpu, tone: "cyan" },
];
const ACTIVE = ["pending", "confirmed", "in_progress", "searching", "accepted", "on_the_way", "arrived", "new", "shipped"];

export default function Home() {
  const { user } = useAuth();
  const geo = useGeo();
  const [car, setCar] = useState<any>(undefined);
  const [sum, setSum] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [masters, setMasters] = useState<any[]>([]);
  const [fuelSt, setFuelSt] = useState<any[] | null>(null);
  const fuelKind = localStorage.getItem("ah_fuel") || "metan";
  useEffect(() => {
    api.get("/garage/vehicles/").then((r) => setCar(r.data[0] || null));
    api.get("/garage/summary/").then((r) => setSum(r.data));
    api.get("/orders/my/").then((r) => setOrders(r.data.filter((o: any) => ACTIVE.includes(o.status)).slice(0, 3)));
  }, []);
  useEffect(() => { api.get("/masters/", { params: { lat: geo.lat, lng: geo.lng, limit: 4 } }).then((r) => setMasters(r.data.results)); }, [geo.lat, geo.lng]);
  useEffect(() => {
    api.get("/fuel/stations/", { params: { lat: geo.lat, lng: geo.lng, fuel: fuelKind, radius: 15, limit: 60 } }).then((r) => {
      const all = r.data.results;
      const avail = all.filter((s: any) => s.status?.[fuelKind]?.available);
      setFuelSt((avail.length ? avail : all).slice(0, 3));
    }).catch(() => setFuelSt([]));
  }, [geo.lat, geo.lng]);
  const hour = new Date().getHours();
  const hello = hour < 11 ? "Xayrli tong" : hour < 18 ? "Xayrli kun" : "Xayrli kech";

  return (
    <div className="col gap-16">
      <section className="hero-app compact">
        <Mountains className="mountains" />
        <CarArt className="car-art" />
        <div className="hero-row">
          <div>
            <p className="small row gap-4" style={{ color: "#aab5c9" }}><MapPin size={14} />{user?.city || "Toshkent"}</p>
            <h2 className="mt-8">{hello}, {user?.first_name}!</h2>
            <p className="small mt-4" style={{ color: "#aab5c9" }}>Avtomobilingiz uchun kerakli xizmat — bir joyda.</p>
          </div>
          {car !== undefined && (car ? (
            <Link to="/app/cars" className="car-card">
              <CarArt light className="car-thumb" />
              <div className="grow"><b>{car.brand} {car.model}</b><div className="xs muted">{[car.year, car.plate, car.mileage ? `${car.mileage.toLocaleString()} km` : ""].filter(Boolean).join(" · ") || "Ma'lumotlarni to'ldiring"}</div>
                <div className="xs mt-4">{car.next_service_km != null
                  ? <><span className={`badge ${car.health === "Yaxshi" ? "green" : car.health === "O'rtacha" ? "amber" : "red"}`}>{car.health}</span> <span className="muted">servisgacha {car.next_service_km.toLocaleString()} km</span></>
                  : <span className="muted">Servis ma'lumotlari kiritilmagan</span>}</div></div>
              <ChevronRight size={18} />
            </Link>
          ) : (
            <Link to="/app/cars" className="car-card"><div className="grow"><b>Avtomobilingizni qo'shing</b><div className="xs muted">Hujjat muddatlari, servis va xarajat eslatmalari uchun</div></div><ChevronRight size={18} /></Link>
          ))}
        </div>
      </section>

      <StoriesBar />

      {sum && (sum.documents.length > 0 || sum.service_due.length > 0) && (
        <div className="col gap-8">
          {sum.documents.map((d: any) => (
            <Link key={d.id} to="/app/cars?tab=hujjat" className={"reminder" + (d.days_left <= 7 ? " red" : "")}>
              <span className="ico"><FileText size={17} /></span>
              <div className="grow"><b>{d.title || d.kind_label}</b> — {d.days_left < 0 ? "muddati tugagan!" : d.days_left === 0 ? "bugun tugaydi!" : `${d.days_left} kun qoldi`}<div className="xs">{d.vehicle_title}</div></div>
              <ChevronRight size={16} />
            </Link>
          ))}
          {sum.service_due.map((v: any) => (
            <Link key={v.id} to="/app/masters?sort=rating" className="reminder">
              <span className="ico"><AlertTriangle size={17} /></span>
              <div className="grow"><b>{v.title}</b> — servisga {v.km <= 0 ? "vaqt keldi" : `${v.km} km qoldi`}. Usta toping</div>
              <ChevronRight size={16} />
            </Link>
          ))}
        </div>
      )}

      <Link to="/app/safar" className="safar-card" aria-label="SAFAR — uzoq yo'lga aqlli tayyorgarlik">
        <span className="sc-ic"><Navigation size={24} /></span>
        <span style={{ position: "relative", zIndex: 1, minWidth: 0 }}><b>SAFAR</b><small>Uzoq yo'lga aqlli tayyorgarlik</small></span>
        <span className="sc-go">Safarni boshlash</span>
      </Link>

      <StartChecklist />

      <div className="tiles">
        {TILES.map((t) => (
          <Link key={t.label} to={t.to} className={`tile ${t.tone}`}><t.icon size={26} strokeWidth={1.8} /><div><b>{t.label}</b><small>{t.sub}</small></div></Link>
        ))}
      </div>

      {orders.length > 0 && (
        <div className="card card-tight">
          <div className="row between" style={{ padding: "2px 4px" }}><b>Faol buyurtmalar</b><Link to="/app/orders" className="link small">Barchasi</Link></div>
          <div className="list">
            {orders.map((o) => (
              <Link key={o.uid} to={o.type === "sos" ? `/app/sos?id=${o.id}` : "/app/orders"} className="list-row">
                <div className="grow"><b className="small">{o.title}</b><div className="xs muted">{o.party} · {o.date}</div></div>
                <StatusBadge status={o.status} label={o.status_label} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {car && sum && (
        <Link to="/app/cars?tab=xarajat" className="card row gap-12">
          <span className="stat" style={{ border: 0, padding: 0 }}><span className="ico" style={{ background: "var(--green-soft)", color: "var(--green)" }}><Wallet size={18} /></span></span>
          <div className="grow"><div className="small muted">Shu oy avtomobil xarajatlari</div><b style={{ fontSize: 19 }}>{money(sum.month_expenses)}</b></div>
          <span className="btn btn-sm btn-soft">+ Qo'shish</span>
        </Link>
      )}

      {fuelSt && fuelSt.length > 0 && (
        <div className="card card-tight">
          <div className="row between" style={{ padding: "2px 4px" }}><b className="row gap-8"><Fuel size={17} color="var(--orange, #ff7a2f)" />Yaqin {fuelKind}</b><Link to="/app/fuel" className="link small">Xarita</Link></div>
          <div className="list">
            {fuelSt.map((s) => (
              <Link key={s.id} to={`/app/fuel?station=${s.id}`} className="list-row">
                <div className="grow" style={{ minWidth: 0 }}><b className="small ellipsis" translate="no">{s.name}</b><div className="xs muted">{s.distance_km} km{s.status?.[fuelKind]?.minutes_ago != null && s.status[fuelKind].status !== "unknown" && ` · ${s.status[fuelKind].minutes_ago} daq. oldin`}</div></div>
                <FuelBadge s={s.status?.[fuelKind]} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="section-head" style={{ margin: "6px 0 0" }}><h3>Sizga yaqin ustalar</h3><Link to="/app/masters" className="link">Barchasi</Link></div>
      <div className="grid g2 stack-sm">{masters.map((m) => <MasterCard key={m.id} m={m} />)}</div>
    </div>
  );
}
