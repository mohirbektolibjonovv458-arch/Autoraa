import { useEffect, useState } from "react";
import { BellOff, BellRing, Share } from "lucide-react";
import { disablePush, enablePush, pushState, PushState } from "../push";
import { useToast } from "./ui";

const HIDE_KEY = "ah_push_prompt_hidden_at";

/** «Bildirishnomalarni yoqish» — ruxsat faqat foydalanuvchi tugmani bosganda so'raladi. */
export default function EnablePush({ variant = "card" }: { variant?: "card" | "banner" | "row" }) {
  const toast = useToast();
  const [st, setSt] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(() => {
    const t = Number(localStorage.getItem(HIDE_KEY) || 0);
    return variant === "banner" && Date.now() - t < 14 * 864e5;
  });
  useEffect(() => { pushState().then(setSt); }, []);
  if (!st || hidden) return null;
  if (variant === "banner" && st !== "off") return null; // banner faqat yoqilmagan va yoqish mumkin bo'lganda

  const on = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      setSt(r);
      if (r === "on") toast("Bildirishnomalar yoqildi — ilova yopiq bo'lsa ham xabar keladi", "success");
      else if (r === "denied") toast("Brauzer sozlamalarida bildirishnomalarga ruxsat bering", "error");
      else if (r === "server-off") toast("Bildirishnomalar serverda hali sozlanmagan", "error");
      else if (r === "service-error") toast("Telefonning bildirishnoma xizmati javob bermadi. Internetni tekshirib, qayta urinib ko'ring.", "error");
    } catch (e: any) {
      const http = e?.response?.status;
      toast(http ? "Server obunani qabul qilmadi. Sahifani yangilab, qayta urinib ko'ring." : `Bildirishnomani yoqib bo'lmadi (${e?.name || "xato"}). Sahifani yangilab, qayta urinib ko'ring.`, "error");
    }
    finally { setBusy(false); }
  };
  const off = async () => { await disablePush(); setSt("off"); toast("Bu qurilmada bildirishnomalar o'chirildi"); };

  const text: Record<string, string> = {
    off: "Yangi bron, xabar va SOS haqida ilova yopiq bo'lsa ham darhol xabar oling.",
    on: "Bu qurilmada yoqilgan. Bron, xabar, SOS va buyurtmalar haqida xabar keladi.",
    denied: "Brauzerda ruxsat berilmagan. Sayt sozlamalari (🔒 belgisi) → Bildirishnomalar → Ruxsat berish.",
    "ios-install": "iPhone'da bildirishnomalar faqat bosh ekranga o'rnatilgan ilovada ishlaydi: Safari → Ulashish → «Bosh ekranga qo'shish».",
    unsupported: "Bu brauzer push bildirishnomalarni qo'llamaydi. Chrome, Edge, Firefox yoki Safari'ning yangi versiyasidan foydalaning.",
    "server-off": "Bildirishnomalar serverda hali sozlanmagan.",
    "service-error": "Telefonning bildirishnoma xizmati javob bermadi.",
  };

  if (variant === "banner") {
    return (
      <div className="push-banner">
        <BellRing size={20} />
        <div className="grow"><b className="small">Bildirishnomalarni yoqing</b><div className="xs">{text.off}</div></div>
        <button className="btn btn-sm" disabled={busy} onClick={on}>{busy ? "…" : "Yoqish"}</button>
        <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="Yopish" onClick={() => { localStorage.setItem(HIDE_KEY, String(Date.now())); setHidden(true); }}>×</button>
      </div>
    );
  }
  return (
    <div className={variant === "row" ? "list-row" : "card row gap-12"} style={variant === "row" ? { alignItems: "center" } : undefined}>
      <span className="ico" style={{ color: st === "on" ? "var(--green)" : "var(--muted)" }}>{st === "on" ? <BellRing size={18} /> : st === "ios-install" ? <Share size={18} /> : <BellOff size={18} />}</span>
      <div className="grow"><b className="small">Push bildirishnomalar</b><div className="xs muted">{text[st]}</div></div>
      {st === "off" && <button className="btn btn-sm" disabled={busy} onClick={on}>{busy ? "…" : "Yoqish"}</button>}
      {st === "on" && <button className="btn btn-sm btn-ghost" onClick={off}>O'chirish</button>}
    </div>
  );
}
