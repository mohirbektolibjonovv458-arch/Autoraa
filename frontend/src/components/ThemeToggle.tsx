import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { getPref, onTheme, resolved, setPref, ThemePref } from "../theme";

/** Yuqori paneldagi ☀️/🌙 tugma — bir bosishda Kun ↔ Tun */
export function ThemeToggle() {
  const [, force] = useState(0);
  useEffect(() => onTheme(() => force((x) => x + 1)), []);
  const dark = resolved() === "dark";
  return (
    <button className="icon-btn theme-toggle" onClick={() => setPref(dark ? "light" : "dark")} aria-label={dark ? "Kun rejimi" : "Tun rejimi"} title={dark ? "Kun rejimi" : "Tun rejimi"}>
      <span className="sun"><Sun size={18} /></span><span className="moon"><Moon size={18} /></span>
    </button>
  );
}

/** Profil sozlamasi: Kun / Tun / Avto (telefon sozlamasiga ergashadi) */
export function ThemeSegment() {
  const [p, setP] = useState<ThemePref>(getPref());
  useEffect(() => onTheme(() => setP(getPref())), []);
  const opts: [ThemePref, string, any][] = [["light", "Kun", Sun], ["dark", "Tun", Moon], ["system", "Avto", Monitor]];
  return (
    <div className="theme-seg" role="group" aria-label="Rejim">
      {opts.map(([k, l, I]) => <button key={k} className={p === k ? "active" : ""} onClick={() => setPref(k)} aria-pressed={p === k}><I size={13} />{l}</button>)}
    </div>
  );
}
