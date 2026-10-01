import { useEffect, useState } from "react";
import { BellOff, BellRing, Share } from "lucide-react";
import { disablePush, enablePush, pushState, PushState } from "../push";
import { useToast } from "./ui";
import { useAuth } from "../auth";

const HIDE_KEY = "ah_push_prompt_hidden_at";

/** «Bildirishnomalarni yoqish» — ruxsat faqat foydalanuvchi tugmani bosganda so'raladi. */
export default function EnablePush({ variant = "card" }: { variant?: "card" | "banner" | "row" }) {
  const toast = useToast();
  const [st, setSt] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  // usta/evakuator uchun push — ish quroli (yangi bron, SOS): banner faqat 1 kunga yopiladi, mijozga — 14 kunga
  const worker = user?.role === "usta" || user?.role === "evakuator";
  const [hidden, setHidden] = useState(() => {
    let t = 0;
    try { t = Number(localStorage.getItem(HIDE_KEY) || 0); } catch { /* */ }
    return variant === "banner" && Date.now() - t < (worker ? 1 : 14) * 864e5;
  });
  useEffect(() => { pushState().then(setSt); }, []);
  if (!st || hidden) return null;
  // banner: yoqilmagan bo'lsa; usta/evakuatorga — brauzerda taqiqlangan yoki iPhone'da o'rnatilmagan bo'lsa ham ko'rsatamiz
  if (variant === "banner" && !(st === "off" || (worker && (st === "denied" || st === "ios-install")))) return null;

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
    const msg = worker && st === "off"
      ? "Mijoz bron qilganda telefoningiz qulflangan yoki ilova yopiq bo'lsa ham darhol xabar keladi. Busiz bronlarni o'tkazib yuborasiz."
      : text[st];
    return (
      <div className="push-banner">
        <BellRing size={20} />
        <div className="grow"><b className="small">Bildirishnomalarni yoqing</b><div className="xs">{msg}</div></div>
        {st === "off" && <button className="btn btn-sm" disabled={busy} onClick={on}>{busy ? "…" : "Yoqish"}</button>}
        <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="Yopish" onClick={() => { try { localStorage.setItem(HIDE_KEY, String(Date.now())); } catch { /* */ } setHidden(true); }}>×</button>
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
