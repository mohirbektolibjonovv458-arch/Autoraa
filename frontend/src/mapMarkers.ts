/** Xarita belgilari (barcha xaritalarda bir xil uslub): rasmli usta + reyting, kategoriya ikonkalari, «men shu yerdaman». */
import L from "leaflet";
import { media } from "./api";
import { MapIconName, svgIcon } from "./mapIcons";

export type PinKind = "usta" | "evakuator" | "fuel" | "shop" | "sos" | "service" | "client" | "place";

/** HTML satrga qo'yiladigan qiymatlarni zararsizlantirish (XSS himoyasi) */
export const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
export const safeColor = (c: any) => (/^#[0-9a-fA-F]{3,8}$/.test(String(c)) ? c : "#2f80ff");

export const KIND: Record<PinKind, { icon: MapIconName; color: string; label: string }> = {
  usta: { icon: "wrench", color: "#2f80ff", label: "Usta" },
  evakuator: { icon: "truck", color: "#ff7a1a", label: "Evakuator" },
  fuel: { icon: "fuel", color: "#e5484d", label: "Zapravka" },
  shop: { icon: "store", color: "#8e5cf7", label: "Do'kon" },
  service: { icon: "gear", color: "#22a06b", label: "Servis" },
  sos: { icon: "alert", color: "#ee2b2f", label: "SOS" },
  client: { icon: "user", color: "#2f80ff", label: "Mijoz" },
  place: { icon: "flag", color: "#2f80ff", label: "Manzil" },
};
const OFFLINE = "#5d6b82";

export type MarkerSpec = { kind?: PinKind; color?: string; label?: string; avatar?: string | null; rating?: number | null; online?: boolean; active?: boolean };

const cache = new Map<string, L.DivIcon>();

export function markerIcon(p: MarkerSpec): L.DivIcon {
  const key = JSON.stringify([p.kind, p.color, p.label, p.avatar, p.rating, p.online, p.active]);
  const hit = cache.get(key);
  if (hit) return hit;
  const rate = p.rating && p.rating > 0 ? `<span class="mk-rate">★ ${esc(p.rating.toFixed(1))}</span>` : "";
  const cls = (p.online === false ? " off" : "") + (p.active ? " active" : "") + (p.kind === "sos" ? " pulse" : "");
  let html: string, size: [number, number], anchor: [number, number];
  if (p.avatar) {
    html = `<div class="mk mk-person${cls}"><div class="mk-ava"><img src="${esc(media(p.avatar))}" alt="" loading="lazy" decoding="async"/></div>${rate}</div>`;
    size = [48, 58]; anchor = [24, 24];
  } else {
    const k = p.kind ? KIND[p.kind] : null;
    const color = p.online === false ? OFFLINE : safeColor(p.color || k?.color);
    const inner = k ? svgIcon(k.icon, 18) : `<b>${esc(p.label || "")}</b>`;
    html = `<div class="mk mk-ico${cls}" style="--c:${color}">${inner}${rate}</div>`;
    size = [40, rate ? 52 : 40]; anchor = [20, 20];
  }
  const icon = L.divIcon({ className: "mk-wrap", html, iconSize: size, iconAnchor: anchor, popupAnchor: [0, -22] });
  cache.set(key, icon);
  return icon;
}

/** «Siz shu yerdasiz» — pulslanuvchi ko'k nuqta */
export const meIcon = L.divIcon({ className: "mk-wrap", html: `<div class="me-dot"><i></i></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
