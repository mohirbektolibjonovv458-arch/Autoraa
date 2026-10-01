import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { safeNext } from "../../safeNext";
import { api } from "../../api";
import { homeFor, useAuth } from "../../auth";
import PhoneCode from "../../components/PhoneCode";
import { Logo } from "../../components/ui";
import LangSwitch from "../../components/LangSwitch";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const loc = useLocation() as any;
  // qaytish manzili: ?next=... yoki sessiya tugab qayta kirishga yuborilgan sahifa
  const next = safeNext(sp.get("next")) || safeNext(loc.state?.from);
  if (user) return <Navigate to={next || homeFor(user.role)} replace />;

  const onSubmit = async (phone: string, code: string) => {
    const r = await api.post("/auth/login/", { phone, code });
    login(r.data);
    nav(next || homeFor(r.data.user.role), { replace: true });
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
        <PhoneCode purpose="login" submitLabel="Kirish" onSubmit={onSubmit} />
      </div>
    </div>
  );
}
