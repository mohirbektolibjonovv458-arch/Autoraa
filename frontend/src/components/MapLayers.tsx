import { useEffect, useRef, useState } from "react";
import { TileLayer, useMap } from "react-leaflet";
import type { Map as LMap } from "leaflet";
import { Check, Layers, LocateFixed, Minus, Moon, Plus, Satellite, Sun } from "lucide-react";
import { useSite } from "../site";

/** Xarita uslubi: night — tungi (premium, sukut bo'yicha), std — kunduzgi, sat — sun'iy yo'ldosh. Tanlov eslab qolinadi. */
export type LayerKind = "night" | "std" | "sat";
const KEY = "ah_map_layer";
const subs = new Set<(l: LayerKind) => void>();
export const getLayer = (): LayerKind => {
  try { const v = localStorage.getItem(KEY); return v === "sat" || v === "std" ? v : "night"; } catch { return "night"; }
};
export function setLayer(l: LayerKind) { try { localStorage.setItem(KEY, l); } catch { /* */ } subs.forEach((f) => f(l)); }

export function useLayer() {
  const [l, setL] = useState<LayerKind>(getLayer());
  useEffect(() => { subs.add(setL); return () => { subs.delete(setL); }; }, []);
  return l;
}

/** Tungi uslub filtri (SVG «duotone»): plita yorug'ligi teskari olinib, to'q ko'k palitraga o'tkaziladi —
 * yer to'q dengiz-ko'k, yozuvlar och rangda o'qiladi. Hujjatga bir marta qo'shiladi. */
function ensureNightFilter() {
  if (document.getElementById("avtora-night")) return;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.innerHTML = `<filter id="avtora-night" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix" values="-0.3 -0.59 -0.11 0 1 -0.3 -0.59 -0.11 0 1 -0.3 -0.59 -0.11 0 1 0 0 0 1 0"/>
    <feComponentTransfer>
      <feFuncR type="table" tableValues="0.075 0.12 0.30 0.62 0.86"/>
      <feFuncG type="table" tableValues="0.105 0.17 0.37 0.69 0.90"/>
      <feFuncB type="table" tableValues="0.165 0.26 0.50 0.80 0.96"/>
    </feComponentTransfer>
  </filter>`;
  document.body.appendChild(svg);
}

/** Xarita plitalari (server orqali, keshlanadi). Tungi uslub — o'sha OpenStreetMap plitalari, brauzerda ranglari o'zgartiriladi
 * (qo'shimcha provayder/kalit kerak emas). Sun'iy yo'ldosh + ko'cha nomlari — alohida qatlam. */
export function BaseTiles() {
  const site = useSite();
  const layer = useLayer();
  const map = useMap();
  const sat = layer === "sat" && site.sat_enabled !== false;
  const night = layer === "night";
  const native = night && !!site.map_dark_native;  // serverda tayyor tungi plitalar sozlangan (MAP_DARK_TILE_URL)
  useEffect(() => {
    if (night && !native) ensureNightFilter();
    const c = map.getContainer();
    c.classList.toggle("sat", sat);
    c.classList.toggle("night", night);
    c.classList.toggle("native", native);
  }, [sat, night, native]);
  if (sat) return <>
    <TileLayer key="sat" url="/api/map/sat/{z}/{x}/{y}.img" maxZoom={20} maxNativeZoom={19} attribution={site.sat_attribution || "Tiles © Esri"} />
    <TileLayer key="lab" url="/api/map/labels/{z}/{x}/{y}.img" maxZoom={20} maxNativeZoom={19} opacity={0.9} />
  </>;
  if (native) return <TileLayer key="dark" attribution={site.map_attribution || "© OpenStreetMap contributors"} url="/api/map/dark/{z}/{x}/{y}.img" maxZoom={19} />;
  return <TileLayer key="std" attribution={site.map_attribution || "© OpenStreetMap contributors"} url="/api/map/tiles/{z}/{x}/{y}.png" maxZoom={19} />;
}

const OPTIONS: [LayerKind, string, any][] = [["night", "Tungi", Moon], ["std", "Kunduzgi", Sun], ["sat", "Sputnik", Satellite]];

/** Qatlam tanlash (Tungi / Kunduzgi / Sputnik) — kichik menyu */
export function LayerButton({ inline = false }: { inline?: boolean }) {
  const site = useSite();
  const layer = useLayer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const opts = OPTIONS.filter(([k]) => k !== "sat" || site.sat_enabled !== false);
  return (
    <div className={"map-layer-wrap" + (inline ? " inline" : "")} ref={ref}>
      <button type="button" className="map-ctl" onClick={() => setOpen(!open)} aria-label="Xarita ko'rinishi" aria-expanded={open} title="Xarita ko'rinishi"><Layers size={18} /></button>
      {open && (
        <div className="map-layer-menu" role="menu">
          {opts.map(([k, label, Icon]) => (
            <button key={k} type="button" role="menuitemradio" aria-checked={layer === k} className={layer === k ? "on" : ""} onClick={() => { setLayer(k); setOpen(false); }}>
              <Icon size={16} /><span>{label}</span>{layer === k && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Xarita boshqaruvi (barcha xaritalarda bir xil): o'ng yuqorida «Hozirgi joy», o'ng pastda — ko'rinish, +, −.
 * map — Leaflet xarita obyekti (MapContainer ref).
 */
export function MapChrome({ map, onLocate, locating = false, locateLabel = "Hozirgi joy", locateActive = false, showLocate = true }: {
  map: LMap | null; onLocate?: () => void; locating?: boolean; locateLabel?: string; locateActive?: boolean; showLocate?: boolean;
}) {
  return (
    <>
      {showLocate && onLocate && (
        <button type="button" className={"map-here" + (locating ? " busy" : "") + (locateActive ? " on" : "")} onClick={onLocate} disabled={locating}
          aria-label={locateLabel} title={locateLabel}>
          <LocateFixed size={16} /><span>{locating ? "Aniqlanmoqda…" : locateLabel}</span>
        </button>
      )}
      <div className="map-ctls">
        <LayerButton inline />
        <button type="button" className="map-ctl" onClick={() => map?.zoomIn()} aria-label="Yaqinlashtirish"><Plus size={18} /></button>
        <button type="button" className="map-ctl" onClick={() => map?.zoomOut()} aria-label="Uzoqlashtirish"><Minus size={18} /></button>
      </div>
    </>
  );
}
