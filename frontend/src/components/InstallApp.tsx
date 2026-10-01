import { useEffect, useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { canPrompt, isIOS, isMobile, isStandalone, markedInstalled, onPwaChange } from "../pwa";
import { quickInstall } from "./InstallFlow";

/** Profildagi «Ilovani o'rnatish» — o'rnatilgan bo'lsa holatni ko'rsatadi, aks holda o'rnatish oynasini ochadi. */
export default function InstallApp({ compact = false }: { compact?: boolean }) {
  const [, force] = useState(0);
  useEffect(() => onPwaChange(() => force((x) => x + 1)), []);
  if (isStandalone()) return null; // ilovaning o'zida — kerak emas
  const installed = markedInstalled();
  if (!installed && !canPrompt() && !isIOS() && !isMobile()) return null;
  return (
    <div className="install-card" style={compact ? { padding: 12 } : undefined}>
      <img src="/icons/icon-96.png" alt="" width={42} height={42} style={{ borderRadius: 11 }} />
      <div className="grow">
        <b className="small">{installed ? "Avtora o'rnatilgan" : "Avtora ilovasini o'rnating"}</b>
        <div className="xs" style={{ color: "#aab5c9" }}>{installed ? "Bosh ekrandagi belgidan oching" : "Bosh ekrandan bir bosishda oching — SOS doim qo'l ostida"}</div>
      </div>
      {installed ? <CheckCircle2 size={20} color="#3ddc84" /> : <button className="btn btn-sm btn-light" onClick={quickInstall}><Download size={14} />O'rnatish</button>}
    </div>
  );
}
