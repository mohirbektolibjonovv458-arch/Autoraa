import { ClipboardEvent, FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Send, ShieldCheck } from "lucide-react";
import { LogoMark } from "../../components/Logo";
import { InstallButton } from "../../components/Install";
import { cx, Spinner } from "../../components/ui";
import { ApiError, get, post, tokens } from "../../lib/api";
import { useAuth } from "../../lib/auth";

type Mode = "login" | "register";
type Flow = { mode?: Mode; phone: string; token: string; status: "need_bot" | "code_sent"; bot_url: string | null; resend_in: number; ts: number };
const KEY = "eduway-login-flow";

// Botga o'tib qaytguncha holat telefonda saqlanadi: brauzer sahifani qayta yuklasa ham kod oynasi o'zi ochiladi
const saveFlow = (f: Flow | null) => { try { f ? localStorage.setItem(KEY, JSON.stringify(f)) : localStorage.removeItem(KEY); } catch { /* ignore */ } };
const loadFlow = (): Flow | null => {
  try {
    const f = JSON.parse(localStorage.getItem(KEY) || "null");
    return f && Date.now() - f.ts < 10 * 60 * 1000 ? f : null;
  } catch { return null; }
};

function formatPhone(digits: string) {
  const d = digits.slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}

function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

function CodeBoxes({ value, onChange, disabled, error }: { value: string; onChange: (v: string) => void; disabled?: boolean; error?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (i: number, ch: string) => {
    const arr = value.padEnd(4, " ").split("");
    arr[i] = ch || " ";
    onChange(arr.join("").replace(/\s+$/, "").replace(/ /g, ""));
  };
  const onKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) { refs.current[i - 1]?.focus(); set(i - 1, ""); e.preventDefault(); }
  };
  const onPaste = (e: ClipboardEvent) => {
    const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (d) { e.preventDefault(); onChange(d); refs.current[Math.min(3, d.length)]?.focus(); }
  };
  return (
    <div className="flex justify-center gap-3" onPaste={onPaste}>
      {[0, 1, 2, 3].map((i) => (
        <input key={i} ref={(el) => (refs.current[i] = el)} value={value[i] || ""} disabled={disabled}
          inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} pattern="[0-9]*" maxLength={i === 0 ? 4 : 1} aria-label={`${i + 1}-raqam`}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "");
            if (d.length > 1) { onChange(d.slice(0, 4)); refs.current[Math.min(3, d.length)]?.focus(); return; }
            set(i, d);
            if (d && i < 3) refs.current[i + 1]?.focus();
          }}
          onKeyDown={onKey(i)} onFocus={(e) => e.target.select()}
          className={cx("h-16 w-14 shrink-0 rounded-2xl border-2 bg-white/10 text-center text-[28px] font-bold text-white outline-none transition focus:border-white focus:bg-white/20",
            error ? "border-rose-400 animate-[shake_.3s]" : value[i] ? "border-white/70" : "border-white/25")} />
      ))}
    </div>
  );
}

export default function PhoneAuth() {
  const { user, ready, setUser } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [flow, setFlow] = useState<Flow | null>(() => loadFlow());
  const [digits, setDigits] = useState(() => (loadFlow()?.phone || "").replace(/\D/g, "").slice(3));
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resendIn, setResendIn] = useState(flow?.resend_in || 0);
  const [mode, setMode] = useState<Mode>(() => (loadFlow()?.mode || (sp.get("mode") === "register" ? "register" : "login")));
  const [name, setName] = useState("");
  const [errCode, setErrCode] = useState("");
  const [bot, setBot] = useState<{ configured: boolean; ok: boolean } | null>(null);

  useEffect(() => { get("/auth/phone/config/").then(setBot).catch(() => setBot(null)); }, []);
  const update = useCallback((f: Flow | null) => { setFlow(f); saveFlow(f); if (f) setResendIn(f.resend_in); }, []);

  // botdan qaytganda (yoki har 2,5 soniyada) holatni tekshiramiz — kod yuborilganini darhol ko'rsatish uchun
  const refresh = useCallback(async () => {
    const f = loadFlow();
    if (!f || f.status === "code_sent") return;
    try { const s = await get(`/auth/phone/status/?token=${f.token}`); update({ ...f, ...s, ts: f.ts }); }
    catch (e) { if ((e as ApiError).status === 404) update(null); }
  }, [update]);
  useEffect(() => {
    if (!flow || flow.status === "code_sent") return;
    const t = setInterval(refresh, 2500);
    const vis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("focus", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); window.removeEventListener("focus", vis); };
  }, [flow, refresh]);
  useEffect(() => { if (resendIn <= 0) return; const t = setTimeout(() => setResendIn(resendIn - 1), 1000); return () => clearTimeout(t); }, [resendIn]);

  const verify = useCallback(async (c: string) => {
    if (!flow || c.length !== 4 || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await post("/auth/phone/verify/", { token: flow.token, code: c });
      tokens.save(r.access, r.refresh);
      saveFlow(null);
      setUser(r.user);
      nav(r.is_new || !r.user.onboarded ? "/onboarding" : safeNext(sp.get("next")) || "/home", { replace: true });
    } catch (e) {
      setErr((e as ApiError).message);
      setCode("");
      if ((e as ApiError).code === "too_many" || (e as ApiError).code === "expired") setResendIn(0);
    } finally { setBusy(false); }
  }, [flow, busy, nav, setUser, sp]);
  useEffect(() => { if (code.length === 4) verify(code); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ready && user) return <Navigate to={safeNext(sp.get("next")) || "/home"} replace />;

  const start = async (e?: FormEvent) => {
    e?.preventDefault();
    if (mode === "register" && !name.trim()) { setErr("Ismingizni kiriting"); return; }
    if (digits.length !== 9) { setErr("Raqamni to'liq kiriting: 9 ta raqam"); return; }
    setBusy(true);
    setErr("");
    setErrCode("");
    try {
      const r = await post("/auth/phone/start/", { phone: "998" + digits, mode, first_name: name.trim() });
      update({ ...r, mode, ts: Date.now() });
      setCode("");
    } catch (e) { setErr((e as ApiError).message); setErrCode((e as ApiError).code || ""); } finally { setBusy(false); }
  };
  const resend = async () => {
    if (!flow) return;
    setErr("");
    try { const r = await post("/auth/phone/resend/", { token: flow.token }); update({ ...flow, ...r }); }
    catch (e) {
      if ((e as ApiError).status === 404) { update(null); start(); } else setErr((e as ApiError).message);
    }
  };
  const reset = () => { update(null); setCode(""); setErr(""); };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0B1030] text-white">
      {/* Animatsiyali fon */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#6D5DF6]/40 blur-[90px] animate-float" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-fuchsia-500/30 blur-[90px] animate-float [animation-delay:1.2s]" />
        <div className="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-sky-400/20 blur-[90px] animate-float [animation-delay:2.4s]" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-6 safe-bottom">
        {/* Yuqorida faqat o'rnatish tugmasi */}
        <div className="flex h-16 items-center justify-end">
          <InstallButton className="btn btn-sm rounded-full bg-white/15 px-4 text-white backdrop-blur hover:bg-white/25" label="Ilovani o'rnatish" />
        </div>

        {/* Kontent yuqoridan boshlanadi — klaviatura ochilganda joyidan siljimaydi */}
        <div className="pt-[6vh] text-center">
          <div className="mx-auto w-fit animate-pop"><LogoMark className="h-20 w-20 drop-shadow-[0_20px_40px_rgba(109,93,246,.6)]" animated /></div>
          <h1 className="mt-5 text-[32px] font-extrabold tracking-tight animate-fade-up [animation-delay:.15s]">EduWay AI</h1>
          <p className="mt-1 text-white/70 animate-fade-up [animation-delay:.25s]">Kelajagingiz sari aqlli yo'l</p>
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl animate-fade-up [animation-delay:.35s]">
          {!flow ? (
            <form onSubmit={start}>
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/10 p-1">
                {(["login", "register"] as Mode[]).map((m) => (
                  <button key={m} type="button" onClick={() => { setMode(m); setErr(""); setErrCode(""); }}
                    className={cx("h-11 rounded-xl text-[15px] font-bold transition", mode === m ? "bg-white text-[#1B2560] shadow" : "text-white/70 hover:text-white")}>
                    {m === "login" ? "Kirish" : "Ro'yxatdan o'tish"}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm text-white/60">{mode === "login" ? "Ro'yxatdan o'tgan raqamingizni kiriting — kod Telegram orqali keladi." : "Ismingiz va raqamingizni kiriting — tasdiqlash kodi Telegram orqali keladi."}</p>
              {mode === "register" && (
                <input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} maxLength={60} autoComplete="given-name" placeholder="Ismingiz" aria-label="Ism"
                  className="mt-4 h-14 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 text-[17px] font-semibold text-white outline-none transition placeholder:text-white/30 focus:border-white" />
              )}
              <label className="mt-3 flex h-14 items-center gap-2 rounded-2xl border-2 border-white/20 bg-white/10 px-4 transition focus-within:border-white">
                <span className="text-[17px] font-semibold text-white/80">+998</span>
                <input value={formatPhone(digits)} onChange={(e) => { setDigits(e.target.value.replace(/\D/g, "").slice(0, 9)); setErr(""); }}
                  inputMode="tel" autoComplete="tel-national" placeholder="90 123 45 67" aria-label="Telefon raqam"
                  className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-semibold tracking-wide text-white outline-none placeholder:text-white/30" />
              </label>
              <p className="mt-2 min-h-[20px] text-sm text-rose-300">
                {err}
                {errCode === "not_registered" && <button type="button" onClick={() => { setMode("register"); setErr(""); setErrCode(""); }} className="ml-1 font-bold text-white underline">Ro'yxatdan o'tish →</button>}
                {errCode === "already_registered" && <button type="button" onClick={() => { setMode("login"); setErr(""); setErrCode(""); }} className="ml-1 font-bold text-white underline">Kirish →</button>}
              </p>
              <button disabled={busy || digits.length !== 9 || bot?.configured === false} className="btn mt-1 h-14 w-full rounded-2xl bg-white text-[16px] text-[#1B2560] hover:bg-white/90 disabled:opacity-50">
                {busy ? <Spinner /> : <>{mode === "login" ? "Kodni olish" : "Ro'yxatdan o'tish"} <ArrowRight className="h-5 w-5" /></>}
              </button>
              {bot && !bot.configured && <p className="mt-3 rounded-xl bg-amber-400/15 p-3 text-center text-xs text-amber-200">Telegram bot serverga ulanmagan: Railway → Variables'da <b>TELEGRAM_BOT_TOKEN</b> yo'q yoki qo'shilgandan keyin Deploy qilinmagan.</p>}
              {bot && bot.configured && !bot.ok && <p className="mt-3 rounded-xl bg-amber-400/15 p-3 text-center text-xs text-amber-200">Telegram bot tokeni qabul qilinmadi: tokenni @BotFather'dan qayta nusxalab, Railway'ga qo'ying.</p>}
            </form>
          ) : (
            <div>
              <button onClick={reset} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white"><ArrowLeft className="h-4 w-4" /> +998 {formatPhone(flow.phone.slice(4))}</button>
              {flow.status === "need_bot" ? (
                <>
                  <p className="text-lg font-bold">Kodni Telegram'dan oling</p>
                  <ol className="mt-3 space-y-2 text-sm text-white/80">
                    <li className="flex gap-2.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold">1</span><span>Pastdagi tugma bilan botni oching va <b>«Start»</b> ni bosing</span></li>
                    <li className="flex gap-2.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold">2</span><span><b>«📱 Raqamni ulashish»</b> ni bosing</span></li>
                    <li className="flex gap-2.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold">3</span><span>Kelgan 4 xonali kodni shu yerga yozing</span></li>
                  </ol>
                  {flow.bot_url && (
                    <a href={flow.bot_url} target="_blank" rel="noopener noreferrer" className="btn mt-4 h-14 w-full rounded-2xl bg-[#229ED9] text-[16px] text-white hover:brightness-110">
                      <Send className="h-5 w-5" /> Telegram botni ochish
                    </a>
                  )}
                  <p className="mt-3 flex items-center justify-center gap-2 text-xs text-white/50"><Spinner className="h-3.5 w-3.5" /> Bot bilan bog'lanishingizni kutyapmiz...</p>
                </>
              ) : (
                <>
                  <p className="flex items-center gap-2 text-lg font-bold"><span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400 text-[#0B1030]"><Check className="h-4 w-4" /></span> Kod Telegram'ga yuborildi</p>
                  <p className="mt-1 text-sm text-white/60">EduWay AI botidagi 4 xonali kodni kiriting.</p>
                  {flow.bot_url && <a href={flow.bot_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-300"><Send className="h-4 w-4" /> Botni ochish</a>}
                </>
              )}
              <div className="mt-5"><CodeBoxes value={code} onChange={(v) => { setCode(v); setErr(""); }} disabled={busy} error={!!err} /></div>
              <p className="mt-3 min-h-[20px] text-center text-sm text-rose-300">{busy ? <Spinner className="mx-auto h-5 w-5 text-white" /> : err}</p>
              {flow.status === "code_sent" && (
                <p className="mt-1 text-center text-sm text-white/60">
                  {resendIn > 0 ? `Qayta yuborish: ${resendIn} s` : <button onClick={resend} className="font-semibold text-white underline underline-offset-4">Kodni qayta yuborish</button>}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-auto pt-8 text-center text-xs text-white/40">
          <p className="flex items-center justify-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Raqamingiz faqat kirish uchun ishlatiladi</p>
          <Link to="/admin-login" className="mt-2 inline-block hover:text-white/70">Administrator kirishi</Link>
        </div>
      </div>
    </div>
  );
}
