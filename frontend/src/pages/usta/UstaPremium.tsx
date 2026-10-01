import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Clock, Copy, Crown, Send, Upload } from "lucide-react";
import { api, errMsg, media } from "../../api";
import { useAuth } from "../../auth";
import { Spinner, StatusBadge, useToast } from "../../components/ui";
import { money, shortDate, usePoll } from "../../utils";

export default function UstaPremium() {
  const { refresh } = useAuth();
  const toast = useToast();
  const [info, setInfo] = useState<any>(null);
  const [hist, setHist] = useState<any[]>([]);
  const [months, setMonths] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [last4, setLast4] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => {
    api.get("/premium/info/").then((r) => {
      setInfo((old: any) => { if (old?.pending && !r.data.pending) refresh(); return r.data; });
    });
    api.get("/premium/payments/").then((r) => setHist(r.data));
  };
  usePoll(load, 10000, []);
  if (!info) return <Spinner />;

  const copy = () => { navigator.clipboard?.writeText(info.card_raw); toast("Karta raqami nusxalandi", "success"); };
  const pay = async () => {
    setErr("");
    if (!file) { setErr("To'lov chekining skrinshotini yuklang."); return; }
    const fd = new FormData(); fd.append("receipt", file); fd.append("months", String(months)); fd.append("payer_card_last4", last4);
    setBusy(true);
    try { const r = await api.post("/premium/pay/", fd); toast(r.data.detail, "success"); setFile(null); load(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const bot = info.bot_username ? `https://t.me/${info.bot_username.replace("@", "")}` : null;

  return (
    <div className="col gap-16" style={{ maxWidth: 860 }}>
      <div className="premium-card">
        <div className="row gap-8"><Crown size={22} color="#f5c04a" /><b style={{ fontSize: 18 }}>Avtora Premium</b></div>
        <div className="price mt-12">{money(info.price)} <span style={{ fontSize: 15, fontWeight: 600, color: "#aab5c9" }}>/ oy</span></div>
        <div className="col gap-8 mt-12">{info.features.map((f: string) => <div key={f} className="row gap-8 small"><Check size={16} color="#3ddc84" />{f}</div>)}</div>
        {info.is_premium && <div className="alert success mt-16">✅ Premium faol — <b>{shortDate(info.premium_until)}</b> gacha. <Link to="/app/usta/shop" style={{ textDecoration: "underline" }}>Do'konga o'tish →</Link></div>}
      </div>

      {info.pending ? (
        <div className="card col gap-12">
          <div className="row gap-8"><Clock size={20} color="#b37400" /><b>To'lovingiz tekshirilmoqda</b></div>
          <p className="small muted">{money(info.pending.amount)} · {info.pending.months} oy · {shortDate(info.pending.created_at)}. Admin bank ilovasida pul haqiqatan tushganini tekshiradi va Telegram botda tasdiqlaydi — shundan so'ng do'koningiz avtomatik ochiladi va sizga xabar keladi.</p>
          {info.pending.receipt && <img src={media(info.pending.receipt)} alt="Chek" style={{ maxHeight: 220, width: "auto", borderRadius: 12 }} />}
        </div>
      ) : (
        <div className="card col gap-16">
          <h3>{info.is_premium ? "Obunani uzaytirish" : "Premium sotib olish"}</h3>
          <div className="steps" style={{ color: "var(--ink)" }}>
            <div className="step"><span className="dot" style={{ borderColor: "var(--blue)" }}>1</span><div className="small">Muddatni tanlang va summani quyidagi kartaga o'tkazing (Payme, Click, Uzum yoki bank ilovasi orqali).</div></div>
            <div className="step"><span className="dot" style={{ borderColor: "var(--blue)" }}>2</span><div className="small">To'lov chekining skrinshotini yuklang va «Pul soldim» tugmasini bosing.</div></div>
            <div className="step"><span className="dot" style={{ borderColor: "var(--blue)" }}>3</span><div className="small">Admin pul tushganini tekshirib, Telegram botda tasdiqlaydi → do'koningiz ochiladi.</div></div>
          </div>
          <div className="row gap-8 wrap">{[1, 3, 6, 12].map((m) => <button key={m} className={"chip" + (months === m ? " active" : "")} onClick={() => setMonths(m)}>{m} oy · {money(info.price * m)}</button>)}</div>
          <div className="bank-card">
            <div className="row between"><b>To'lov kartasi</b><Crown size={20} /></div>
            <div><div className="num">{info.card_number}</div><div className="small mt-4" style={{ opacity: .85 }}>{info.card_holder}</div></div>
            <div className="row between"><span className="small">To'lov: <b>{money(info.price * months)}</b></span><button className="btn btn-sm btn-light" onClick={copy}><Copy size={14} />Nusxa</button></div>
          </div>
          <label className="dropzone">
            {file ? <img src={URL.createObjectURL(file)} alt="Chek" /> : <div className="col gap-8" style={{ alignItems: "center" }}><Upload size={26} /><b className="small">To'lov cheki skrinshotini yuklang</b><span className="xs">PNG, JPG</span></div>}
            <input type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <label className="field"><span>Siz to'lagan kartaning oxirgi 4 raqami (tekshiruvni tezlashtiradi)</span><input className="input" maxLength={4} inputMode="numeric" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} placeholder="1234" /></label>
          {err && <div className="alert error">{err}</div>}
          <button className="btn btn-green btn-lg btn-block" disabled={busy} onClick={pay}>{busy ? "Yuborilmoqda…" : "✅ Pul soldim"}</button>
          {bot && <a className="btn btn-ghost btn-block" href={bot} target="_blank" rel="noreferrer"><Send size={16} />Yoki Telegram Premium bot orqali to'lash</a>}
        </div>
      )}

      {hist.length > 0 && (
        <div className="card">
          <h3>To'lovlar tarixi</h3>
          <div className="list mt-8">{hist.map((p) => (
            <div key={p.id} className="list-row"><div className="grow"><b className="small">{money(p.amount)} · {p.months} oy</b><div className="xs muted">{shortDate(p.created_at)} · {p.source === "telegram" ? "Telegram bot" : "Sayt"}{p.reject_reason && ` · ${p.reject_reason}`}</div></div><StatusBadge status={p.status} label={p.status_label} /></div>
          ))}</div>
        </div>
      )}
    </div>
  );
}
