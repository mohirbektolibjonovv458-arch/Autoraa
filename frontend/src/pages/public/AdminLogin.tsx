import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { api, errMsg } from "../../api";
import { useAuth } from "../../auth";
import { Logo } from "../../components/ui";
import { formatPhone } from "../../utils";

/** Admin panelga kirish: 1-bosqich — telefon + parol, 2-bosqich — Telegram'ga kelgan kod. */
export default function AdminLogin() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState("+998 ");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  if (user?.role === "admin") return <Navigate to="/admin" replace />;

  const submit = async (e: any) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const r = await api.post("/auth/admin-login/", step === 1 ? { phone, password } : { phone, password, code });
      if (r.data.two_factor) { setStep(2); setInfo(r.data.detail); return; }
      login(r.data); nav("/admin", { replace: true });
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <div className="auth-page">
      <div className="pub-nav"><Link to="/"><Logo /></Link></div>
      <form className="auth-box col gap-16 dark-form" onSubmit={submit} autoComplete="on">
        <h1 className="row gap-8"><ShieldCheck size={26} />Admin panel</h1>
        {step === 1 ? (
          <>
            <label className="field"><span>Telefon</span><input className="input" autoComplete="username" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} /></label>
            <label className="field"><span>Parol</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          </>
        ) : (
          <label className="field"><span>Telegram'ga kelgan 4 xonali kod</span>
            <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={4} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </label>
        )}
        {info && step === 2 && <div className="alert">{info}</div>}
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-red btn-lg" disabled={busy || (step === 1 ? !password : code.length !== 4)}>{busy ? "Tekshirilmoqda…" : step === 1 ? "Davom etish" : "Kirish"}</button>
        {step === 2 && <button type="button" className="link small" style={{ background: "none", border: 0, color: "#8fb4ff" }} onClick={() => { setStep(1); setCode(""); setInfo(""); }}>Orqaga</button>}
      </form>
    </div>
  );
}
