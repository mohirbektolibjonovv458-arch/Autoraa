import { useState } from "react";
import { ChevronRight, Fuel } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import MapView, { Pin } from "../../components/MapView";
import MastersTabs from "../../components/MastersTabs";
import { Avatar, Stars, Verified } from "../../components/ui";
import { SPECIALTIES, useGeo, usePoll } from "../../utils";

export default function MapPage() {
  const { user } = useAuth();
  const geo = useGeo(true);
  const nav = useNavigate();
  const provider = user?.role !== "user";
  const [filter, setFilter] = useState<"all" | "online" | "verified">("all");
  const [masters, setMasters] = useState<any[]>([]);
  const [sos, setSos] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);

  usePoll(() => {
    api.get("/masters/", { params: { lat: geo.lat, lng: geo.lng, limit: 60, online: filter === "online" ? 1 : undefined } }).then((r) => setMasters(r.data.results));
    if (provider) api.get("/sos/available/").then((r) => setSos(r.data)).catch(() => {});
  }, 20000, [geo.lat, geo.lng, filter]);

  const list = masters.filter((m) => m.user.lat && (filter !== "verified" || m.is_verified));
  const pins: Pin[] = [
    // usta: rasmi (bo'lmasa — kalit ikonkasi) va ★ reytingi; offline — kulrang
    ...list.map((m): Pin => ({ id: "m" + m.id, lat: m.user.lat, lng: m.user.lng, title: m.name, kind: "usta", avatar: m.user.avatar || null,
      rating: m.reviews_count ? Number(m.rating) : null, online: !!m.user.is_online, active: sel?.id === m.id, onClick: () => setSel(m) })),
    ...sos.map((s): Pin => ({ id: "s" + s.id, lat: s.lat, lng: s.lng, kind: "sos", title: "SOS", popup: <div><b>SOS: {s.kind_label}</b><br />{s.client.full_name}<br />{s.distance_km != null && `${s.distance_km} km`}<br /><a onClick={() => nav(user?.role === "evakuator" ? "/app/evak" : "/app/usta/sos")} style={{ cursor: "pointer", color: "#1f6feb" }}>Qabul qilish →</a></div> })),
  ];

  return (
    <div className="col gap-12">
      {!provider && <div className="page-head"><h2 className="page-title">Usta topish</h2><MastersTabs /></div>}
      <div className="row between wrap gap-8">
        {provider && <h2 className="page-title">Xarita</h2>}
        <div className="tabs">{([["all", "Barchasi"], ["online", "Hozir online"], ["verified", "Verified"]] as const).map(([k, l]) => <button key={k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
      </div>
      {geo.error && <p className="xs muted">📍 {geo.error}</p>}
      {provider && sos.length > 0 && <div className="alert error">Yaqin atrofda {sos.length} ta SOS so'rov bor (qizil belgilar).</div>}
      <MapView center={[geo.lat, geo.lng]} me={geo.real ? [geo.lat, geo.lng] : null} accuracy={geo.accuracy} onLocate={geo.set} pins={pins} zoom={12} className="map-box map-premium map-big">
        <Link to="/app/fuel" className="map-chip"><span className="map-chip-ico"><Fuel size={16} /></span><span>Benzin, propan, metan zapravkalar</span><ChevronRight size={16} /></Link>
      </MapView>
      {sel && (
        <div className="card row gap-12">
          <Avatar name={sel.name} src={sel.user.avatar} size="lg" />
          <div className="grow">
            <div className="row gap-8"><b>{sel.name}</b>{sel.is_verified && <Verified />}</div>
            <div className="small muted">{sel.specialties.map((s: string) => SPECIALTIES[s] || s).join(" · ")}</div>
            <div className="row gap-12"><Stars value={sel.rating} count={sel.reviews_count} />{sel.distance_km != null && <span className="small muted">{sel.distance_km} km</span>}</div>
          </div>
          <Link className="btn btn-sm" to={`/app/masters/${sel.id}`}>Profil</Link>
        </div>
      )}
      <p className="xs muted">Rangli — hozir online ustalar, kulrang — offline. ★ — reyting. Belgiga bosing.</p>
    </div>
  );
}
