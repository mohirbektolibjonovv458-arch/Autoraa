import { useState } from "react";
import { Send } from "lucide-react";
import { api, errMsg } from "../api";
import { isIOS } from "../pwa";
import { useToast } from "./ui";

/**
 * «Sinov xabari» + telefon sozlamalari bo'yicha yo'riqnoma.
 * Ko'p Android telefonlar (ayniqsa Xiaomi/Redmi/POCO, Oppo, Realme, Vivo, Huawei) batareyani tejash uchun
 * Chrome'ni fonda «uxlatib» qo'yadi — shunda xabar faqat ilova ochiq turganda keladi.
 * Buni server yoki sayt tuzata olmaydi: telefonda bir marta ruxsat berish kerak.
 */
const BRANDS: [string, string[]][] = [
  ["Xiaomi / Redmi / POCO", [
    "Sozlamalar → Ilovalar → Ilovalarni boshqarish → Chrome (va «Avtora», agar ro'yxatda bo'lsa).",
    "«Avtomatik ishga tushirish» (Autostart) — YOQING.",
    "«Batareya tejash» (Battery saver) → «Cheklovsiz» (No restrictions) ni tanlang.",
    "«Bildirishnomalar» → hammasiga ruxsat: «Qulf ekranida», «Qalqib chiquvchi» (floating), ovoz.",
    "Oxirgi ilovalar oynasida Chrome/Avtora'ni pastga tortib 🔒 qulflab qo'ying.",
  ]],
  ["Samsung", [
    "Sozlamalar → Ilovalar → Chrome (va «Avtora») → Batareya → «Cheklanmagan» (Unrestricted).",
    "Sozlamalar → Batareya → Fon cheklovlari → «Uxlayotgan ilovalar» ro'yxatidan Chrome/Avtora'ni olib tashlang.",
    "Ilova → Bildirishnomalar → ruxsat bering, «Qalqib chiquvchi» uslubini tanlang.",
  ]],
  ["Huawei / Honor", [
    "Sozlamalar → Batareya → Ilovalarni ishga tushirish → Chrome → «Qo'lda boshqarish»: uchala belgini YOQING.",
    "Sozlamalar → Ilovalar → Chrome → Bildirishnomalar → ruxsat bering.",
  ]],
  ["Oppo / Realme / Vivo / OnePlus", [
    "Sozlamalar → Ilovalar → Chrome → Batareya → «Fonda ishlashga ruxsat» / «Cheklovsiz».",
    "«Avtomatik ishga tushirish» (Auto launch) — YOQING.",
    "Bildirishnomalar → ruxsat bering (qulf ekrani va banner).",
  ]],
  ["Boshqa Android", [
    "Sozlamalar → Ilovalar → Chrome → Batareya → «Cheklanmagan» / «Optimallashtirmaslik».",
    "Sozlamalar → Ilovalar → Chrome → Bildirishnomalar → ruxsat bering.",
    "«Bezovta qilmang» (Do not disturb) rejimi o'chiq ekanini tekshiring.",
  ]],
];

export default function PushHelp() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const test = async () => {
    setBusy(true);
    try {
      const r = await api.post("/push/test/");
      toast(`Sinov xabari ${r.data.delay} soniyadan keyin keladi — hozir ilovadan chiqing (masalan, Instagram'ni oching).`, "success");
    } catch (e) { toast(errMsg(e), "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="col gap-8">
      <button className="btn btn-sm btn-ghost" disabled={busy} onClick={test} style={{ alignSelf: "flex-start" }}><Send size={14} />{busy ? "…" : "Sinov xabarini yuborish"}</button>
      {isIOS() ? (
        <div className="xs muted">iPhone: Sozlamalar → Bildirishnomalar → Avtora → «Ruxsat berish», «Qulf ekrani» va «Bannerlar» yoqilgan bo'lsin. «Fokus» (Do Not Disturb) rejimi o'chiq bo'lsin.</div>
      ) : (
        <details className="push-help">
          <summary className="small"><b>Xabar faqat ilova ochiq turganda kelyaptimi?</b></summary>
          <div className="xs muted mt-4">Telefon batareyani tejash uchun Chrome'ni fonda to'xtatib qo'ygan. Bir marta sozlang — keyin ilova yopiq bo'lsa ham, boshqa ilovada (Instagram, Telegram) o'tirganingizda ham xabar keladi:</div>
          {BRANDS.map(([name, steps]) => (
            <details key={name} className="push-help-brand">
              <summary className="small">{name}</summary>
              <ol className="xs">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </details>
          ))}
          <div className="xs muted mt-4">Sozlagach «Sinov xabarini yuborish» ni bosing va darhol ilovadan chiqing — 10 soniyada xabar kelishi kerak.</div>
        </details>
      )}
    </div>
  );
}
