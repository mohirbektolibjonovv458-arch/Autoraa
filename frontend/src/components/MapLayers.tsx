import { useEffect, useState } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { Layers, Map as MapIcon } from "lucide-react";
import { useSite } from "../site";

export type LayerKind = "std" | "sat";
const KEY = "ah_map_layer";
const subs = new Set<(l: LayerKind) => void>();
export const getLayer = (): LayerKind => { try { return localStorage.getItem(KEY) === "sat" ? "sat" : "std"; } catch { return "std"; } };
export function setLayer(l: LayerKind) { try { localStorage.setItem(KEY, l); } catch { /* */ } subs.forEach((f) => f(l)); }

export function useLayer() {
  const [l, setL] = useState<LayerKind>(getLayer());
  useEffect(() => { subs.add(setL); return () => { subs.delete(setL); }; }, []);
  return l;
}

/** Xarita plitalari: oddiy yoki sun'iy yo'ldosh (uylar, ko'chalar, dalalar) + ko'cha nomlari. Hammasi server orqali. */
export function BaseTiles() {
  const site = useSite();
  const layer = useLayer();
  const map = useMap();
  const sat = layer === "sat" && site.sat_enabled !== false;
  useEffect(() => { map.getContainer().classList.toggle("sat", sat); }, [sat]);
  if (sat) return <>
    <TileLayer key="sat" url="/api/map/sat/{z}/{x}/{y}.img" maxZoom={20} maxNativeZoom={19} attribution={site.sat_attribution || "Tiles © Esri"} />
    <TileLayer key="lab" url="/api/map/labels/{z}/{x}/{y}.img" maxZoom={20} maxNativeZoom={19} opacity={0.9} />
  </>;
  return <TileLayer key="std" attribution={site.map_attribution || "© OpenStreetMap contributors"} url="/api/map/tiles/{z}/{x}/{y}.png" maxZoom={19} />;
}

/** Xarita / Sun'iy yo'ldosh almashtirgich tugmasi */
export function LayerButton() {
  const site = useSite();
  const layer = useLayer();
  if (site.sat_enabled === false) return null;
  const sat = layer === "sat";
  return (
    <button type="button" className={"map-layer" + (sat ? " on" : "")} onClick={() => setLayer(sat ? "std" : "sat")}
      aria-label={sat ? "Oddiy xarita" : "Sun'iy yo'ldosh ko'rinishi"} title={sat ? "Oddiy xarita" : "Sun'iy yo'ldosh ko'rinishi"}>
      {sat ? <MapIcon size={18} /> : <Layers size={18} />}<span>{sat ? "Xarita" : "Sputnik"}</span>
    </button>
  );
}
