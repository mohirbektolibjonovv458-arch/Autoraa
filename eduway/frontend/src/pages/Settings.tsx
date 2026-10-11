import { FormEvent, useEffect, useState } from "react";
import { Moon, Sun, Trash2 } from "lucide-react";
import { cx, Field, Modal, PageHeader, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";
import { del, get, patch, post, tokens } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { Chips, LEVELS } from "./auth/Onboarding";

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [opts, setOpts] = useState<any>(null);
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState("");
  useEffect(() => { get("/auth/options/").then(setOpts).catch(() => {}); }, []);
  useEffect(() => { if (user && !f) setF({ ...user, ielts_score: user.ielts_score ?? "", birth_year: user.birth_year ?? "" }); }, [user, f]);
  if (!f) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { first_name: f.first_name, last_name: f.last_name, education_stage: f.education_stage, grade: f.grade || null, region: f.region, interests: f.interests,
        favorite_subjects: f.favorite_subjects, future_goals: f.future_goals, target_countries: f.target_countries, english_level: f.english_level,
        ielts_score: f.ielts_score === "" ? null : f.ielts_score, birth_year: f.birth_year === "" ? null : +f.birth_year, daily_minutes: f.daily_minutes, onboarded: true };
      setUser(await patch("/auth/me/", body));
      toast("Saqlandi");
    } catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };
  const changePw = async () => {
    try { const t = await post("/auth/password/", pw); tokens.save(t.access, t.refresh); setPw({ old_password: "", new_password: "" }); toast("Parol yangilandi"); }
    catch (e: any) { toast(e.message, "bad"); }
  };
  const remove = async () => {
    try { await del("/auth/me/", { password: delPw }); tokens.clear(); await logout(); } catch (e: any) { toast(e.message, "bad"); }
  };
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Sozlamalar" back="/profile" />
      <section className="card p-5">
        <h2 className="font-bold">Ko'rinish</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["light", "dark"] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)} className={cx("flex items-center justify-center gap-2 rounded-2xl border p-4 font-semibold", theme === t ? "border-brand bg-brand-soft text-brand" : "border-line")}>
              {t === "light" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />} {t === "light" ? "Yorug'" : "Qorong'i"}
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={save} className="card mt-4 space-y-4 p-5">
        <h2 className="font-bold">Shaxsiy profil</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ism"><input className="input" value={f.first_name} maxLength={60} onChange={set("first_name")} required /></Field>
          <Field label="Familiya"><input className="input" value={f.last_name} maxLength={60} onChange={set("last_name")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ta'lim bosqichi"><select className="input" value={f.education_stage} onChange={set("education_stage")}><option value="">—</option>{opts?.stages.map((s: any) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
          <Field label="Sinf"><input type="number" min={1} max={11} className="input" value={f.grade ?? ""} onChange={(e) => setF({ ...f, grade: e.target.value ? +e.target.value : null })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hudud"><input className="input" value={f.region} maxLength={80} onChange={set("region")} /></Field>
          <Field label="Tug'ilgan yil"><input type="number" min={1950} max={2022} className="input" value={f.birth_year} onChange={set("birth_year")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ingliz tili darajasi"><select className="input" value={f.english_level} onChange={set("english_level")}><option value="">Noma'lum</option>{LEVELS.map((l) => <option key={l.v} value={l.v}>{l.t}</option>)}</select></Field>
          <Field label="IELTS (bo'lsa)"><input type="number" step={0.5} min={0} max={9} className="input" value={f.ielts_score} onChange={set("ielts_score")} /></Field>
        </div>
        <Field label="Kelajakdagi maqsadlar"><textarea className="input min-h-[90px] py-3" maxLength={1000} value={f.future_goals} onChange={set("future_goals")} /></Field>
        <div><span className="label">Qiziqishlar</span><Chips items={opts?.interests || []} value={f.interests} onChange={(v) => setF({ ...f, interests: v })} /></div>
        <div><span className="label">Yoqtirgan fanlar</span><Chips items={opts?.subjects || []} value={f.favorite_subjects} onChange={(v) => setF({ ...f, favorite_subjects: v })} /></div>
        <div><span className="label">Maqsad davlatlar</span><Chips items={opts?.countries || []} value={f.target_countries} onChange={(v) => setF({ ...f, target_countries: v })} max={8} /></div>
        <div><span className="label">Kunlik o'qish vaqti: <b className="text-brand">{f.daily_minutes} daqiqa</b></span><input type="range" min={10} max={240} step={5} value={f.daily_minutes} onChange={(e) => setF({ ...f, daily_minutes: +e.target.value })} className="w-full accent-[rgb(var(--brand))]" /></div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : "Saqlash"}</button>
      </form>

      <section className="card mt-4 space-y-3 p-5">
        <h2 className="font-bold">Parolni o'zgartirish</h2>
        <Field label="Joriy parol"><input type="password" className="input" value={pw.old_password} autoComplete="current-password" onChange={(e) => setPw({ ...pw, old_password: e.target.value })} /></Field>
        <Field label="Yangi parol"><input type="password" className="input" value={pw.new_password} autoComplete="new-password" minLength={8} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
        <button className="btn-outline w-full" disabled={!pw.old_password || pw.new_password.length < 8} onClick={changePw}>Yangilash</button>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="font-bold">Ma'lumotlar</h2>
        <p className="mt-1 text-sm text-sub">Akkauntni o'chirsangiz, profil, natijalar, reja va AI suhbatlari butunlay o'chiriladi.</p>
        <button className="btn-outline mt-3 w-full text-bad" onClick={() => setDelOpen(true)}><Trash2 className="h-4 w-4" /> Akkauntni o'chirish</button>
      </section>
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Akkauntni o'chirish">
        <p className="text-sm text-sub">Bu amalni qaytarib bo'lmaydi. Tasdiqlash uchun parolingizni kiriting.</p>
        <input type="password" className="input mt-3" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" />
        <button className="btn mt-4 w-full bg-bad text-white" disabled={!delPw} onClick={remove}>O'chirish</button>
      </Modal>
    </>
  );
}
