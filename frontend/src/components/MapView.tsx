import { useEffect, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Polyline, Popup, useMap, useMapEvents } from "react-leaflet";
import type { Map as LMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { BaseTiles, MapChrome } from "./MapLayers";
import { markerIcon, MarkerSpec, meIcon } from "../mapMarkers";
import { useToast } from "./ui";
import { accText, geoErrorText, getPreciseLocation } from "../geo";

/** Xarita belgisi. kind — kategoriya ikonkasi (usta, evakuator, zapravka, do'kon, SOS ...), avatar — rasm, rating — ★ baho.
 * Eski chaqiruvlar uchun color + label (matn/emoji) ham ishlaydi. */
export type Pin = MarkerSpec & { id: string | number; lat: number; lng: number; title?: string; popup?: React.ReactNode; onClick?: () => void };

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom(), { animate: true }); }, [center[0], center[1]]);
  return null;
}

function ClickPick({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick && onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function MapView({ center, me, pins = [], line, zoom = 12, className = "map-box", onPick, follow = false, locate = true, accuracy, onLocate, children }: {
  center: [number, number]; me?: [number, number] | null; pins?: Pin[]; line?: [number, number][]; zoom?: number;
  className?: string; onPick?: (lat: number, lng: number) => void; follow?: boolean; locate?: boolean;
  /** «me» nuqtasining aniqligi (metr) — xaritada doira bilan ko'rsatiladi */
  accuracy?: number | null;
  /** «Mening joylashuvim» bosilganda yangi aniq nuqta (ota komponent o'z holatini yangilaydi) */
  onLocate?: (lat: number, lng: number, accuracy: number) => void;
  /** xarita ustidagi qo'shimcha elementlar (masalan, pastdagi tugma) */
  children?: React.ReactNode;
}) {
  const toast = useToast();
  const [map, setMap] = useState<LMap | null>(null);
  const [myPos, setMyPos] = useState<[number, number] | null>(null);
  const [myAcc, setMyAcc] = useState<number | null>(null);
  const [flyK, setFlyK] = useState(0);
  const [busy, setBusy] = useState(false);
  const pos = myPos || me;
  const acc = myPos ? myAcc : accuracy;
  // «Mening joylashuvim»: eskirgan/taxminiy nuqtaga emas — har safar GPS'dan yangi aniq joylashuv olinadi
  const locateMe = () => {
    if (busy) return;
    setBusy(true);
    getPreciseLocation({ desired: 20, maxWait: 12000 })
      .then((f) => {
        if (onLocate) { onLocate(f.lat, f.lng, f.accuracy); setMyPos(null); } else { setMyPos([f.lat, f.lng]); setMyAcc(f.accuracy); }
        setFlyK(Date.now());
        if (f.accuracy > 100) toast(`Joylashuv aniqligi past (${accText(f.accuracy)}). Ochiq joyga chiqing yoki telefonda GPS «Yuqori aniqlik» rejimini yoqing.`, "error");
      })
      .catch((e) => { toast(geoErrorText(e), "error"); if (me) setFlyK(Date.now()); })
      .finally(() => setBusy(false));
  };
  const flyTarget: [number, number] | null | undefined = onLocate ? me : pos;
  // GPS kech aniqlansa (xarita Toshkent markazida ochilgan bo'lsa) — birinchi aniq nuqtaga bir marta o'tamiz
  const firstFix = useRef(false);
  const initCenter = useRef(center);  // MapContainer markazni faqat birinchi renderda oladi
  useEffect(() => {
    if (me && !firstFix.current) {
      firstFix.current = true;
      const c0 = initCenter.current;
      const far = Math.abs(me[0] - c0[0]) > 0.0005 || Math.abs(me[1] - c0[1]) > 0.0005;
      if (far) setFlyK(Date.now());  // shahar ko'rinishidan joyingizga yaqinlashtiriladi
    }
  }, [me?.[0], me?.[1]]);
  return (
    <div className={className} style={{ position: "relative" }}>
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom zoomControl={false} ref={setMap}>
        <BaseTiles />
        {follow && <Recenter center={center} />}
        <ClickPick onPick={onPick} />
        {me && <Marker position={me} icon={meIcon} title="Siz shu yerdasiz" alt="Siz shu yerdasiz"><Popup>Siz shu yerdasiz</Popup></Marker>}
        {pins.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={markerIcon(p)} title={p.title || "Belgi"} alt={p.title || "Belgi"} eventHandlers={p.onClick ? { click: p.onClick } : undefined}>
            {p.popup && <Popup>{p.popup}</Popup>}
          </Marker>
        ))}
        {line && line.length > 1 && <Polyline positions={line} pathOptions={{ color: "#4d9bff", weight: 4, dashArray: "8 8" }} />}
        {flyK > 0 && flyTarget && <FlyTo c={flyTarget} k={flyK} />}
        {pos && acc != null && acc > 15 && acc < 5000 && <Circle center={pos} radius={acc} pathOptions={{ color: "#4d9bff", weight: 1, fillColor: "#4d9bff", fillOpacity: 0.1 }} />}
        {myPos && <Marker position={myPos} icon={meIcon} title="Siz shu yerdasiz" alt="Siz shu yerdasiz" />}
      </MapContainer>
      <MapChrome map={map} onLocate={locateMe} locating={busy} showLocate={locate} />
      {children}
    </div>
  );
}

function FlyTo({ c, k }: { c: [number, number]; k: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo(c, Math.max(map.getZoom(), 15), { duration: 0.8 }); }, [k]);
  return null;
}
