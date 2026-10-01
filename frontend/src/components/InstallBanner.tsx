import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { quickInstall } from "./InstallFlow";
import { dismissInstall, dismissedRecently, isMobile, isNarrow, isStandalone, markedInstalled, onPwaChange } from "../pwa";

const HIDDEN_ON = [/^\/$/, /^\/login/, /^\/register/, /^\/admin/]; // bosh ekranda o'rnatish tugmasi allaqachon bor
const SESSION_KEY = "ah_install_banner_seen";

/**
 * Telefon foydalanuvchilari uchun «Avtora'ni o'rnating» banneri.
 * Android Chrome: haqiqiy brauzer o'rnatish oynasi (beforeinstallprompt).
 * iPhone va boshqa brauzerlar: platformaga mos aniq ko'rsatma.
 */
export default function InstallBanner() {
  const loc = useLocation();
  const [, force] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => onPwaChange(() => force((x) => x + 1)), []);

  const eligible = (isMobile() || isNarrow()) && !isStandalone() && !markedInstalled() && !dismissedRecently();
  const hiddenHere = HIDDEN_ON.some((r) => r.test(loc.pathname));

  useEffect(() => {
    if (!eligible || hiddenHere || visible) return;
    let seen = false;
    try { seen = sessionStorage.getItem(SESSION_KEY) === "1"; } catch { /* */ }
    if (seen) return;
    // sahifa yuklanib, foydalanuvchi atrofga qarab olsin — keyin yumshoq chiqadi
    const t = setTimeout(() => { setVisible(true); try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* */ } }, 2500);
    return () => clearTimeout(t);
  }, [eligible, hiddenHere]);

  if (!visible || !eligible || hiddenHere) return null;

  const close = () => { dismissInstall(); setVisible(false); };
  const install = () => { setVisible(false); quickInstall(); };  // haqiqiy o'rnatish oynasi (yoki platforma yo'riqnomasi)
  const inAppShell = /^\/app/.test(loc.pathname);

  return (
    <div className={"install-banner" + (inAppShell ? " above-nav" : "")} role="dialog" aria-label="Avtora ilovasini o'rnatish">
      <button className="ib-close" onClick={close} aria-label="Yopish"><X size={16} /></button>
      <div className="ib-row">
        <img src="/icons/icon-192.png" alt="" className="ib-icon" width={52} height={52} />
        <div className="ib-text">
          <b>Avtora'ni telefoningizga o'rnating</b>
          <span>Tezkor kirish uchun Avtora'ni bosh ekranga qo'shing.</span>
        </div>
        <button className="ib-btn" onClick={install}>O'rnatish</button>
      </div>
    </div>
  );
}
