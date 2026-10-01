import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Truck, User, Wrench } from "lucide-react";
import { api } from "../../api";
import { homeFor, useAuth } from "../../auth";
import { safeNext } from "../../safeNext";
import PhoneCode from "../../components/PhoneCode";
import { Logo } from "../../components/ui";
import { SPECIALTIES } from "../../utils";
import LangSwitch from "../../components/LangSwitch";

const ROLES = [
  { key: "user", title: "Foydalanuvchi", sub: "Avtomobil egasi", icon: User },
  { key: "usta", title: "Usta", sub: "Avtoservis mutaxassisi, zapchast sotuvchi", icon: Wrench },
  { key: "evakuator", title: "Evakuator", sub: "Yordam haydovchisi", icon: Truck },
];

export default function Register() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [role, setRole] = useState(sp.get("role") || "user");
  const [step, setStep] = useState(1);
  const [f, setF] = useState<any>({ first_name: "", last_name: "", specialties: [], experience_years: "", address: "", truck_model: "", plate: "", car_brand: "", car_model: "", car_year: "" });
  const [agree, setAgree] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const toggleSpec = (s: string) => set("specialties", f.specialties.includes(s) ? f.specialties.filter((x: string) => x !== s) : [...f.specialties, s]);
  const step2Valid = f.first_name.trim() && (role !== "usta" || f.specialties.length > 0) && (role !== "evakuator" || f.truck_model.trim());

  const onSubmit = async (phone: string, code: string) => {
    const body: any = { phone, code, role, first_name: f.first_name, last_name: f.last_name };
    if (role === "usta") Object.assign(body, { specialties: f.specialties, experience_years: f.experience_years || 0, address: f.address });
    if (role === "evakuator") Object.assign(body, { truck_model: f.truck_model, plate: f.plate });
    if (role === "user" && f.car_brand) body.vehicle = { brand: f.car_brand, model: f.car_model, year: f.car_year || undefined };
    const r = await api.post("/auth/register/", body);
    login(r.data);
    nav(safeNext(sp.get("next")) || homeFor(r.data.user.role), { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="pub-nav"><Link to="/"><Logo /></Link><div className="grow" /><span className="small" style={{ color: "#8e9bb2", marginRight: 10 }}>{step}/3</span><LangSwitch /></div>
      <div className="auth-box col gap-24">
        <div className="seg"><Link to="/login">Kirish</Link><Link to="/register" className="active">Ro'yxatdan o'tish</Link></div>

        {step === 1 && (
          <>
            <div><h1>Ro'yxatdan o'tish</h1><p style={{ color: "#8e9bb2" }} className="mt-4">Avtora'dan kim sifatida foydalanasiz?</p></div>
            <div className="role-pick">
              {ROLES.map((r) => (
                <button key={r.key} className={role === r.key ? "active" : ""} onClick={() => setRole(r.key)} style={r.key === "evakuator" ? { gridColumn: "span 2" } : undefined}>
                  {role === r.key && <span className="check"><Check size={13} /></span>}
                  <r.icon size={24} color="#ff7a2f" />
                  <b>{r.title}</b><small>{r.sub}</small>
                </button>
              ))}
            </div>
            {role === "usta" && <div className="alert" style={{ background: "#132a50", color: "#b9d2ff" }}>Ustalar Premium (oyiga 40 000 so'm) orqali o'z zapchast do'konini ochishi mumkin.</div>}
            <button className="btn btn-red btn-lg btn-block" onClick={() => setStep(2)}>Davom etish</button>
          </>
        )}

        {step === 2 && (
          <div className="col gap-16 dark-form">
            <h1>{ROLES.find((r) => r.key === role)?.title} ma'lumotlari</h1>
            <div className="grid g2">
              <label className="field"><span>Ism</span><input className="input" value={f.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="Ism" /></label>
              <label className="field"><span>Familiya</span><input className="input" value={f.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Familiya" /></label>
            </div>
            {role === "usta" && (
              <>
                <div className="field"><span>Mutaxassislik (bir nechtasini tanlang)</span>
                  <div className="chips wrap" style={{ flexWrap: "wrap" }}>
                    {Object.entries(SPECIALTIES).map(([k, v]) => (
                      <button type="button" key={k} className={"chip" + (f.specialties.includes(k) ? " active" : "")} style={f.specialties.includes(k) ? { background: "#ee2b2f", borderColor: "#ee2b2f" } : { background: "#0f1d33", color: "#c6d0e0", borderColor: "#25385a" }} onClick={() => toggleSpec(k)}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="grid g2">
                  <label className="field"><span>Tajriba (yil)</span><input className="input" inputMode="numeric" value={f.experience_years} onChange={(e) => set("experience_years", e.target.value.replace(/\D/g, ""))} placeholder="5" /></label>
                  <label className="field"><span>Manzil</span><input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Toshkent, Yunusobod" /></label>
                </div>
              </>
            )}
            {role === "evakuator" && (
              <div className="grid g2">
                <label className="field"><span>Evakuator mashinasi</span><input className="input" value={f.truck_model} onChange={(e) => set("truck_model", e.target.value)} placeholder="Hyundai Porter" /></label>
                <label className="field"><span>Davlat raqami</span><input className="input" value={f.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} placeholder="01 A 123 AA" /></label>
              </div>
            )}
            {role === "user" && (
              <>
                <p className="small" style={{ color: "#8e9bb2" }}>Avtomobilingiz (ixtiyoriy)</p>
                <div className="grid g3">
                  <input className="input" value={f.car_brand} onChange={(e) => set("car_brand", e.target.value)} placeholder="Chevrolet" />
                  <input className="input" value={f.car_model} onChange={(e) => set("car_model", e.target.value)} placeholder="Cobalt" />
                  <input className="input" inputMode="numeric" value={f.car_year} onChange={(e) => set("car_year", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2022" />
                </div>
              </>
            )}
            <div className="row gap-8"><button className="btn btn-ghost" style={{ color: "#fff", borderColor: "#25385a" }} onClick={() => setStep(1)}>Orqaga</button>
              <button className="btn btn-red btn-lg grow" disabled={!step2Valid} onClick={() => setStep(3)}>Davom etish</button></div>
          </div>
        )}

        {step === 3 && (
          <>
            <div><h1>Telefonni tasdiqlang</h1><p style={{ color: "#8e9bb2" }} className="mt-4">4 xonali kod Telegram botimiz orqali yuboriladi.</p></div>
            <label className="row gap-8 small" style={{ color: "#aab5c9" }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> <span>Men <Link to="/terms" target="_blank" style={{ color: "#ff8a4c", textDecoration: "underline" }}>foydalanish shartlari va maxfiylik siyosati</Link>ga roziman</span>
            </label>
            <PhoneCode purpose="register" submitLabel="Ro'yxatdan o'tish" onSubmit={onSubmit} disabled={!agree} />
            <button className="btn btn-ghost" style={{ color: "#fff", borderColor: "#25385a" }} onClick={() => setStep(2)}>Orqaga</button>
          </>
        )}
      </div>
    </div>
  );
}
