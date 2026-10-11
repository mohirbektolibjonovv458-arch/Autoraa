import { FormEvent, ReactNode, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "../../components/Logo";
import { Field, Spinner } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { InstallButton } from "../../components/Install";

function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

function Shell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden overflow-hidden gradient-hero p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo light />
        <div className="max-w-md space-y-4">
          {["Kasb tanlash testi va tavsiyalar", "Universitetlar va grantlar katalogi", "BilimAI: o'zbek tilidagi AI ustoz", "IELTS va ingliz tili mashqlari"].map((t, i) => (
            <div key={t} className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-sm font-bold">{i + 1}</span>{t}
            </div>
          ))}
        </div>
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-fuchsia-500/30 blur-3xl" />
      </div>
      <div className="flex min-h-screen flex-col px-6 py-8">
        <div className="flex items-center justify-between gap-2">
          <Link to="/welcome" className="lg:hidden"><Logo /></Link>
          <span className="hidden lg:block" />
          <InstallButton className="btn-soft btn-sm" label="Ilovani yuklab olish" />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center animate-fade-up">
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sub">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-6 text-center text-sm text-sub">{footer}</p>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className="input pr-12" type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required minLength={8} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-sub hover:bg-muted">
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

export function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={safeNext(sp.get("next")) || "/home"} replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const u = await login(email.trim(), password);
      nav(safeNext(sp.get("next")) || (u.onboarded ? "/home" : "/onboarding"), { replace: true });
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Xush kelibsiz!" subtitle="Akkauntingizga kiring va o'qishni davom ettiring." footer={<>Akkauntingiz yo'qmi? <Link to="/register" className="font-semibold text-brand">Ro'yxatdan o'ting</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
        <Field label="Parol"><PasswordInput value={password} onChange={setPassword} autoComplete="current-password" /></Field>
        {err && <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm font-medium text-bad">{err}</p>}
        <button className="btn-primary h-12 w-full" disabled={busy}>{busy ? <Spinner /> : "Kirish"}</button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register, user } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/home" replace />;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await register({ ...f, email: f.email.trim() });
      nav("/onboarding", { replace: true });
    } catch (e) {
      const d = (e as ApiError).data || {};
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(d)) out[k] = Array.isArray(v) ? String(v[0]) : String(v);
      if (!Object.keys(out).length) out.detail = (e as ApiError).message;
      if (out.non_field_errors) out.password = out.non_field_errors;
      setErrors(out);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Ro'yxatdan o'tish" subtitle="Bir daqiqada akkaunt yarating — bu bepul." footer={<>Akkauntingiz bormi? <Link to="/login" className="font-semibold text-brand">Kirish</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ism" error={errors.first_name}><input className="input" value={f.first_name} onChange={set("first_name")} autoComplete="given-name" required maxLength={60} /></Field>
          <Field label="Familiya" error={errors.last_name}><input className="input" value={f.last_name} onChange={set("last_name")} autoComplete="family-name" maxLength={60} /></Field>
        </div>
        <Field label="Email" error={errors.email}><input className="input" type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></Field>
        <Field label="Parol" error={errors.password} hint="Kamida 8 belgi; faqat raqamlardan iborat bo'lmasin"><PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" /></Field>
        <label className="flex items-start gap-3 text-sm text-sub">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[rgb(var(--brand))]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>Ma'lumotlarim o'quv natijalarini saqlash va tavsiyalar berish uchun ishlatilishiga roziman. 16 yoshdan kichik bo'lsam, ota-onam roziligini oldim.</span>
        </label>
        {errors.detail && <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm font-medium text-bad">{errors.detail}</p>}
        <button className="btn-primary h-12 w-full" disabled={busy || !agree}>{busy ? <Spinner /> : "Akkaunt yaratish"}</button>
      </form>
    </Shell>
  );
}
