import { useEffect, useState } from "react";
import { LocateFixed } from "lucide-react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSite } from "../site";
import { BaseTiles, LayerButton } from "./MapLayers";

export type Pin = { id: string | number; lat: number; lng: number; color?: string; label?: string; title?: string; popup?: React.ReactNode; onClick?: () => void };

const pinIcon = (color = "#ee2b2f", label = "") =>
  L.divIcon({ className: "", html: `<div class="pin" style="background:${safeColor(color)}"><span>${esc(label)}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -30] });
/** HTML satrga qo'yiladigan qiymatlarni zararsizlantirish (XSS himoyasi) */
const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
const safeColor = (c: any) => (/^#[0-9a-fA-F]{3,8}$/.test(String(c)) ? c : "#1f6feb");
const meIcon = L.divIcon({ className: "", html: `<div class="me-dot"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom(), { animate: true }); }, [center[0], center[1]]);
  return null;
}

function ClickPick({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick && onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function MapView({ center, me, pins = [], line, zoom = 12, className = "map-box", onPick, follow = false, locate = true }: {
  center: [number, number]; me?: [number, number] | null; pins?: Pin[]; line?: [number, number][]; zoom?: number;
  className?: string; onPick?: (lat: number, lng: number) => void; follow?: boolean; locate?: boolean;
}) {
  const site = useSite();
  const [myPos, setMyPos] = useState<[number, number] | null>(null);
  const [flyK, setFlyK] = useState(0);
  const pos = me || myPos;
  const locateMe = () => {
    if (me) { setFlyK(Date.now()); return; }
    navigator.geolocation?.getCurrentPosition((p) => { setMyPos([p.coords.latitude, p.coords.longitude]); setFlyK(Date.now()); }, () => {},
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  };
  return (
    <div className={className} style={{ position: "relative" }}>
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <BaseTiles />
        {follow && <Recenter center={center} />}
        <ClickPick onPick={onPick} />
        {me && <Marker position={me} icon={meIcon} title="Siz shu yerdasiz" alt="Siz shu yerdasiz"><Popup>Siz shu yerdasiz</Popup></Marker>}
        {pins.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.color, p.label)} title={p.title || "Belgi"} alt={p.title || "Belgi"} eventHandlers={p.onClick ? { click: p.onClick } : undefined}>
            {p.popup && <Popup>{p.popup}</Popup>}
          </Marker>
        ))}
        {line && line.length > 1 && <Polyline positions={line} pathOptions={{ color: "#1f6feb", weight: 4, dashArray: "8 8" }} />}
        {flyK > 0 && pos && <FlyTo c={pos} k={flyK} />}
        {!me && myPos && <Marker position={myPos} icon={meIcon} title="Siz shu yerdasiz" alt="Siz shu yerdasiz" />}
      </MapContainer>
      <LayerButton />
      {locate && <button type="button" className="map-locate" onClick={locateMe} aria-label="Mening joylashuvim" title="Mening joylashuvim"><LocateFixed size={20} /></button>}
    </div>
  );
}

function FlyTo({ c, k }: { c: [number, number]; k: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo(c, Math.max(map.getZoom(), 15), { duration: 0.8 }); }, [k]);
  return null;
}
