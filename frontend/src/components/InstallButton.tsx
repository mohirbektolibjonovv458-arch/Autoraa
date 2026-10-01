import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { canPrompt, isStandalone, markedInstalled, onPwaChange } from "../pwa";
import { quickInstall } from "./InstallFlow";

/** «Ilovani o'rnatish» — faqat brauzer haqiqatan o'rnatishga ruxsat berganda va ilova o'rnatilmagan bo'lsa ko'rinadi. */
export default function InstallButton({ className = "", label = "Ilovani o'rnatish" }: { className?: string; label?: string }) {
  const [, force] = useState(0);
  useEffect(() => onPwaChange(() => force((x) => x + 1)), []);
  if (isStandalone() || markedInstalled() || !canPrompt()) return null;
  return <button className={className} onClick={quickInstall}><Download size={16} />{label}</button>;
}
