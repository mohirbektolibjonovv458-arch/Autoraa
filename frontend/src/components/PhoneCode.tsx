import { useEffect, useRef, useState } from "react";
import { Phone, Send } from "lucide-react";
import { api, errMsg } from "../api";

/** Telefon raqam -> Telegram botdan 4 xonali kod -> onSubmit(phone, code) */
export default function PhoneCode({ purpose, submitLabel, onSubmit, disabled }: {
  purpose: "login" | "register"; submitLabel: string; disabled?: boolean;
  onSubmit: (phone: string, code: string) => Promise<void>;
}) {
  const [local, setLocal] = useState(""); // faqat 9 ta raqam: 90 123 45 67
  const phone = "+998" + local;
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState(["", "", "", ""]);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [botUrl, setBotUrl] = useState("");
  const [needLink, setNeedLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // Bot orqali raqam ulanishini kutish
  useEffect(() => {
    if (!needLink) return;
    const id = setInterval(async () => {
      try {
        const r = await api.get("/auth/telegram-status/", { params: { phone } });
        if (r.data.linked) { setNeedLink(false); sendCode(); }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(id);
  }, [needLink]);

  const valid = local.length === 9;
  const onPhone = (v: string) => {
    let d = v.replace(/\D/g, "");
    // to'liq raqam yozilsa yoki joylansa (998901234567 / +998 90 ...) — 998 ni olib tashlaymiz
    if (d.length > 9 && d.startsWith("998")) d = d.slice(3);
    setLocal(d.slice(0, 9));
  };
  const shown = [local.slice(0, 2), local.slice(2, 5), local.slice(5, 7), local.slice(7, 9)].filter(Boolean).join(" ");

  const sendCode = async () => {
    setErr(""); setInfo(""); setBusy(true);
    try {
      const r = await api.post("/auth/send-code/", { phone, purpose });
      setBotUrl(r.data.bot_url);
      if (r.data.code === "telegram_not_linked") { setNeedLink(true); return; }
      setInfo(r.data.detail);
      setStage("code"); setWait(60); setCode(["", "", "", ""]);
      setTimeout(() => refs.current[0]?.focus(), 50);
    } catch (e: any) {
      const d = e?.response?.data;
      if (d?.code === "telegram_not_linked") { setNeedLink(true); setBotUrl(d.bot_url); }
      else { setErr(errMsg(e)); if (d?.wait) setWait(d.wait); }
    } finally { setBusy(false); }
  };

  const setDigit = (i: number, v: string) => {
    const only = v.replace(/\D/g, "");
    if (only.length > 1) {
      const arr = only.slice(0, 4).split("");
      setCode([0, 1, 2, 3].map((k) => arr[k] || ""));
      refs.current[Math.min(arr.length, 3)]?.focus();
      return;
    }
    const next = [...code]; next[i] = only; setCode(next);
    if (only && i < 3) refs.current[i + 1]?.focus();
  };

  const submit = async () => {
    setErr(""); setBusy(true);
    try { await onSubmit(phone, code.join("")); }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="col gap-16 dark-form">
      <label className="field">
        <span>Telefon raqam</span>
        <div className="phone-field"><Phone size={17} /><span className="cc">+998</span>
          <input className="input" inputMode="tel" autoComplete="tel-national" value={shown} disabled={stage === "code"}
            onChange={(e) => onPhone(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && valid && stage === "phone" && !busy && wait <= 0) sendCode(); }}
            placeholder="90 123 45 67" aria-label="Telefon raqam" />
        </div>
      </label>

      {needLink && (
        <div className="tg-box col gap-12">
          <b>Raqamingizni Telegram botga ulang</b>
          <p className="small" style={{ color: "#aab5c9" }}>1. Botni oching va <b>/start</b> bosing. 2. «📱 Raqamni ulashish» tugmasini bosing. 3. Shu sahifaga qayting — kod avtomatik yuboriladi.</p>
          <a className="btn tg-btn btn-block" href={botUrl} target="_blank" rel="noreferrer"><Send size={16} />Telegram botni ochish</a>
          <p className="xs center" style={{ color: "#7d8aa3" }}>Ulanish kutilmoqda…</p>
        </div>
      )}

      {stage === "phone" && !needLink && (
        <button className="btn btn-red btn-lg btn-block" disabled={!valid || busy || disabled || wait > 0} onClick={sendCode}>
          {busy ? "Yuborilmoqda…" : wait > 0 ? `Kutish: ${wait} s` : "Telegram orqali kod olish"}
        </button>
      )}

      {stage === "code" && (
        <>
          <div>
            <p className="small" style={{ color: "#aab5c9", marginBottom: 10 }}>Telegram botga kelgan 4 xonali kodni kiriting</p>
            <div className="code-inputs">
              {code.map((c, i) => (
                <input key={i} ref={(el) => (refs.current[i] = el)} value={c} inputMode="numeric" maxLength={4} aria-label={`Kod ${i + 1}`}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Backspace" && !code[i] && i > 0) refs.current[i - 1]?.focus(); if (e.key === "Enter" && code.join("").length === 4) submit(); }} />
              ))}
            </div>
          </div>
          <button className="btn btn-red btn-lg btn-block" disabled={code.join("").length !== 4 || busy || disabled} onClick={submit}>
            {busy ? "Tekshirilmoqda…" : submitLabel}
          </button>
          <div className="row between small">
            <button className="link" style={{ background: "none", border: 0, color: "#8fb4ff" }} onClick={() => { setStage("phone"); setInfo(""); }}>Raqamni o'zgartirish</button>
            <button className="link" style={{ background: "none", border: 0, color: wait > 0 ? "#6c7b95" : "#8fb4ff" }} disabled={wait > 0} onClick={sendCode}>
              {wait > 0 ? `Qayta yuborish ${wait} s` : "Kodni qayta yuborish"}
            </button>
          </div>
          {botUrl && <a className="xs center" style={{ color: "#7d8aa3" }} href={botUrl} target="_blank" rel="noreferrer">Kod kelmadimi? Botni oching</a>}
        </>
      )}
      {info && <div className="alert">{info}</div>}
      {err && <div className="alert error">{err}</div>}
    </div>
  );
}
