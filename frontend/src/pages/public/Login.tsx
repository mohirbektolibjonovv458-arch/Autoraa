import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { safeNext } from "../../safeNext";
import { api, errMsg } from "../../api";
import { homeFor, useAuth } from "../../auth";
import PhoneCode from "../../components/PhoneCode";
import { Logo, useToast } from "../../components/ui";
import GoogleButton, { OrDivider } from "../../components/GoogleButton";
import { clearGoogle, GooglePending, loadGoogle, saveGoogle } from "../../googleAuth";
import { useSite } from "../../site";
import LangSwitch from "../../components/LangSwitch";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const loc = useLocation() as any;
  // qaytish manzili: ?next=... yoki sessiya tugab qayta kirishga yuborilgan sahifa
  const next = safeNext(sp.get("next")) || safeNext(loc.state?.from);
  const toast = useToast();
  const gOn = !!useSite().google_client_id;
  const [g, setG] = useState<GooglePending | null>(() => loadGoogle());
  const [gBusy, setGBusy] = useState(false);
  if (user) return <Navigate to={next || homeFor(user.role)} replace />;
  const regLink = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  const onSubmit = async (phone: string, code: string) => {
    // «Google bilan» boshlangan bo'lsa — telefon tasdiqlangach Google shu hisobga ulanadi
    const r = await api.post("/auth/login/", { phone, code, ...(g ? { google_ticket: g.ticket } : {}) });
    clearGoogle();
    login(r.data);
    nav(next || homeFor(r.data.user.role), { replace: true });
  };

  const onGoogle = async (credential: string) => {
    setGBusy(true);
    try {
      const r = await api.post("/auth/google/", { credential });
      if (r.data.status === "ok") {
        clearGoogle();
        login(r.data);
        nav(next || homeFor(r.data.user.role), { replace: true });
      } else {
        const d = { ticket: r.data.ticket, email: r.data.email, first_name: r.data.first_name, last_name: r.data.last_name };
        saveGoogle(d); setG({ ...d, at: Date.now() });
      }
    } catch (e) { toast(errMsg(e), "error"); }
    finally { setGBusy(false); }
  };

  return (
    <div className="auth-page">
      <div className="pub-nav"><Link to="/"><Logo /></Link><div className="grow" /><LangSwitch /></div>
      <div className="auth-box col gap-24">
        <div className="center col gap-8">
          <h1>Xush kelibsiz!</h1>
          <p style={{ color: "#8e9bb2" }}>Hisobingizga kiring — kod Telegram botga keladi</p>
        </div>
        <div className="seg"><Link to="/login" className="active">Kirish</Link><Link to={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}>Ro'yxatdan o'tish</Link></div>
        {gOn && (g ? (
          <div className="col gap-12">
            <div className="google-linked"><span>✓</span><span>Google: <b>{g.email}</b><br />Bu Google hisob hali Avtora'ga ulanmagan.</span></div>
            <button className="btn btn-red btn-lg btn-block" onClick={() => nav(regLink)}>Yangi hisob ochish</button>
            <p className="xs center" style={{ color: "#8e9bb2" }}>Avtora'da hisobingiz bormi? Pastda telefon raqamingiz bilan bir marta kiring — Google hisobingiz unga ulanadi va keyingi safar bir bosishda kirasiz.</p>
            <button className="btn btn-ghost btn-sm" style={{ color: "#8e9bb2", borderColor: "#25385a", alignSelf: "center" }} onClick={() => { clearGoogle(); setG(null); }}>Boshqa usulda kirish</button>
          </div>
        ) : (
          <>
            {gBusy ? <div className="center small" style={{ color: "#8e9bb2" }}>Google tekshirilmoqda…</div> : <GoogleButton onCredential={onGoogle} text="continue_with" />}
          </>
        ))}
        {gOn && <OrDivider />}
        <PhoneCode purpose="login" submitLabel="Kirish" onSubmit={onSubmit} />
      </div>
    </div>
  );
}
