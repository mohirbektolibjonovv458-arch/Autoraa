import { useEffect, useState } from "react";
import { BellOff, BellRing, Share } from "lucide-react";
import { disablePush, enablePush, inAppBrowser, pushState, PushState } from "../push";
import { useToast } from "./ui";
import { useAuth } from "../auth";
import PushHelp from "./PushHelp";
import PushDiag from "./PushDiag";

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
      const detail = e?.response?.data?.detail;
      toast(http ? (detail || "Server obunani qabul qilmadi. Sahifani yangilab, qayta urinib ko'ring.") : `Bildirishnomani yoqib bo'lmadi (${e?.name || "xato"}). Sahifani yangilab, qayta urinib ko'ring.`, "error");
    }
    finally { setBusy(false); }
  };
  const off = async () => { await disablePush(); setSt("off"); toast("Bu qurilmada bildirishnomalar o'chirildi"); };

  const text: Record<string, string> = {
    off: "Yangi bron, xabar va SOS haqida ilova yopiq bo'lsa ham darhol xabar oling.",
    on: "Bu qurilmada yoqilgan. Bron, xabar, SOS va buyurtmalar haqida xabar keladi.",
    denied: "Brauzerda ruxsat berilmagan. Sayt sozlamalari (🔒 belgisi) → Bildirishnomalar → Ruxsat berish.",
    "ios-install": "iPhone'da bildirishnomalar faqat bosh ekranga o'rnatilgan ilovada ishlaydi: Safari → Ulashish → «Bosh ekranga qo'shish».",
    unsupported: inAppBrowser()
      ? "Siz saytni Telegram/Instagram ichidagi brauzerda ochgansiz — u bildirishnomalarni qo'llamaydi. ⋮ menyu → «Chrome'da ochish» (yoki Safari) ni bosing."
      : "Bu brauzer push bildirishnomalarni qo'llamaydi. Chrome, Edge, Firefox yoki Safari'ning yangi versiyasidan foydalaning.",
    "server-off": "Bildirishnomalar serverda hali sozlanmagan.",
    "service-error": "Telefonning bildirishnoma xizmati javob bermadi.",
  };

  if (variant === "banner") {
    const later = () => { try { localStorage.setItem(HIDE_KEY, String(Date.now())); } catch { /* */ } setHidden(true); };
    const msg = st === "off"
      ? (worker ? "Bron, xabar va SOS haqida ilova yopiq yoki boshqa ilovada bo'lsangiz ham darhol xabar oling. Busiz buyurtmalarni o'tkazib yuborasiz."
        : "Bronlar, xabarlar va muhim buyurtmalar haqida bildirishnomalarni oling.")
      : text[st];  // ruxsat berilmagan — qayta so'ramaymiz, sozlamalardan qanday yoqishni ko'rsatamiz
    return (
      <div className="push-banner" role="region" aria-label="Bildirishnomalar">
        <BellRing size={20} />
        <div className="grow"><b className="small">🔔 Muhim xabarlarni o'tkazib yubormang</b><div className="xs">{msg}</div>
          <div className="row gap-8 mt-8">
            {st === "off" && <button className="btn btn-sm" disabled={busy} onClick={on}>{busy ? "…" : "Bildirishnomalarni yoqish"}</button>}
            <button className="btn btn-sm btn-ghost" onClick={later}>Keyinroq</button>
          </div>
        </div>
      </div>
    );
  }
  const row = (
    <div className={variant === "row" ? "list-row" : "row gap-12"} style={variant === "row" ? { alignItems: "center" } : undefined}>
      <span className="ico" style={{ color: st === "on" ? "var(--green)" : "var(--muted)" }}>{st === "on" ? <BellRing size={18} /> : st === "ios-install" ? <Share size={18} /> : <BellOff size={18} />}</span>
      <div className="grow"><b className="small">Push bildirishnomalar</b><div className="xs muted">{text[st]}</div></div>
      {st === "off" && <button className="btn btn-sm" disabled={busy} onClick={on}>{busy ? "…" : "Yoqish"}</button>}
      {st === "on" && <button className="btn btn-sm btn-ghost" onClick={off}>O'chirish</button>}
    </div>
  );
  if (variant === "row") return row;
  // yoqilgan bo'lsa: sinov xabari va telefon sozlamalari yo'riqnomasi (xabar faqat ilova ochiqligida kelsa)
  return <div className="card col gap-12">{row}{st === "on" && <PushHelp />}<PushDiag localOn={st === "on"} /></div>;
}
