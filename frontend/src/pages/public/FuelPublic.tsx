import { Link } from "react-router-dom";
import { useAuth, homeFor } from "../../auth";
import FuelView from "../../components/Fuel";
import { Logo } from "../../components/ui";

/** Ro'yxatdan o'tmasdan ham ko'rsa bo'ladigan ochiq yoqilg'i xaritasi (o'sish uchun) */
export default function FuelPublic() {
  const { user } = useAuth();
  return (
    <div style={{ minHeight: "100%", background: "var(--bg)" }}>
      <nav className="pub-nav" style={{ background: "#0a1424" }}>
        <Link to="/"><Logo /></Link><div className="grow" />
        {user ? <Link to={homeFor(user.role)} className="btn btn-red btn-sm">Kabinet</Link> : <Link to="/login?next=%2Fapp%2Ffuel" className="btn btn-red btn-sm">Kirish</Link>}
      </nav>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 16px 40px" }}>
        {!user && <div className="alert mb-12" style={{ marginBottom: 12 }}>⛽ Holatni haydovchilar belgilaydi. Siz ham yordam bering — 30 soniyada Telegram orqali ro'yxatdan o'ting va «gaz keldi» xabarlariga obuna bo'ling.</div>}
        <FuelView publicMode={!user} />
      </div>
    </div>
  );
}
