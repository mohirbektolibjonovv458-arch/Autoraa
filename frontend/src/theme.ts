/** Kun / Tun rejimi: foydalanuvchi tanlovi yoki telefon sozlamasi (avto). */
export type ThemePref = "light" | "dark" | "system";
const KEY = "ah_theme";
const mq = () => window.matchMedia?.("(prefers-color-scheme: dark)");
const subs = new Set<() => void>();

export const getPref = (): ThemePref => {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "system"; } catch { return "system"; }
};
export const resolved = (): "light" | "dark" => {
  const p = getPref();
  return p === "system" ? (mq()?.matches ? "dark" : "light") : p;
};
export function applyTheme(animate = false) {
  const root = document.documentElement;
  if (animate) { root.classList.add("theme-anim"); setTimeout(() => root.classList.remove("theme-anim"), 450); }
  root.dataset.theme = resolved();
  subs.forEach((f) => f());
}
export function setPref(p: ThemePref) {
  try { p === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, p); } catch { /* */ }
  applyTheme(true);
}
export const onTheme = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export function startTheme() {
  applyTheme();
  mq()?.addEventListener?.("change", () => { if (getPref() === "system") applyTheme(true); });
}
