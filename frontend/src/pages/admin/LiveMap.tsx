import { useState } from "react";
import { api } from "../../api";
import MapView, { Pin } from "../../components/MapView";
import { StatusBadge } from "../../components/ui";
import { TASHKENT, timeAgo, usePoll } from "../../utils";

export default function LiveMap() {
  const [d, setD] = useState<any>({ providers: [], sos: [] });
  const [sel, setSel] = useState<any>(null);
  usePoll(() => { api.get("/admin/map/").then((r) => setD(r.data)); }, 8000, []);
  const pins: Pin[] = [
    ...d.providers.map((p: any) => ({ id: "p" + p.id, lat: p.lat, lng: p.lng, color: p.role === "evakuator" ? (p.online ? "#12a150" : "#8a96a8") : (p.online ? "#1f6feb" : "#8a96a8"), label: p.role === "evakuator" ? "🚚" : "🔧", popup: <div><b>{p.name}</b><br />{p.role === "evakuator" ? "Evakuator" : "Usta"} · {p.online ? "online" : "offline"}</div> })),
    ...d.sos.map((s: any) => ({ id: "s" + s.id, lat: s.lat, lng: s.lng, color: "#ee2b2f", label: "!", onClick: () => setSel(s) })),
  ];
  const line = sel?.assignee_lat ? [[sel.assignee_lat, sel.assignee_lng], [sel.lat, sel.lng]] as [number, number][] : undefined;
  return (
    <div className="grid g-2-1">
      <MapView center={sel ? [sel.lat, sel.lng] : TASHKENT} pins={pins} line={line} zoom={12} follow={!!sel} className="map-box" />
      <div className="card col gap-8" style={{ maxHeight: 520, overflowY: "auto" }}>
        <b>Jonli kuzatuv</b>
        <div className="row gap-8 wrap xs"><span className="badge blue">Ustalar: {d.providers.filter((p: any) => p.role === "usta").length}</span><span className="badge green">Evakuatorlar: {d.providers.filter((p: any) => p.role === "evakuator").length}</span><span className="badge red">Faol SOS: {d.sos.length}</span></div>
        {d.sos.length === 0 && <p className="small muted">Faol SOS so'rovlar yo'q.</p>}
        {d.sos.map((s: any) => (
          <button key={s.id} className={"order-card col gap-4" + (sel?.id === s.id ? " active" : "")} style={{ textAlign: "left", borderColor: sel?.id === s.id ? "var(--red)" : undefined }} onClick={() => setSel(s)}>
            <div className="row between"><b className="small">#AS{100000 + s.id} · {s.kind}</b><StatusBadge status={s.status} label={s.status_label} /></div>
            <div className="xs">Mijoz: {s.client}</div><div className="xs">Ijrochi: {s.assignee || "—"}</div><div className="xs muted">{s.address} · {timeAgo(s.created_at)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
