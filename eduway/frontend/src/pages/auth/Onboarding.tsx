import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { LogoMark } from "../../components/Logo";
import { cx, Field, Progress, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { get, patch } from "../../lib/api";
import { useAuth } from "../../lib/auth";

type Options = { subjects: string[]; interests: string[]; countries: string[]; stages: { value: string; label: string }[] };

export function Chips({ items, value, onChange, max = 12 }: { items: string[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => {
        const on = value.includes(i);
        return (
          <button type="button" key={i} onClick={() => onChange(on ? value.filter((x) => x !== i) : value.length < max ? [...value, i] : value)} className={cx("chip first-letter:uppercase", on && "chip-on")}>
            {on && <Check className="h-4 w-4" />} {i}
          </button>
        );
      })}
    </div>
  );
}

export const LEVELS = [
  { v: "A1", t: "A1 — boshlang'ich" }, { v: "A2", t: "A2 — elementar" }, { v: "B1", t: "B1 — o'rta" },
  { v: "B2", t: "B2 — o'rtadan yuqori" }, { v: "C1", t: "C1 — yuqori" }, { v: "C2", t: "C2 — mukammal" },
];

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [opts, setOpts] = useState<Options | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    education_stage: user?.education_stage || "", grade: user?.grade ?? null as number | null, region: user?.region || "",
    interests: user?.interests || [], favorite_subjects: user?.favorite_subjects || [], future_goals: user?.future_goals || "",
    target_countries: user?.target_countries || [], english_level: user?.english_level || "", daily_minutes: user?.daily_minutes || 30,
  });
  useEffect(() => { get<Options>("/auth/options/").then(setOpts).catch(() => {}); }, []);

  const steps = ["Ta'lim", "Qiziqishlar", "Fanlar", "Maqsadlar"];
  const canNext = [!!f.education_stage, f.interests.length > 0, f.favorite_subjects.length > 0, true][step];

  const finish = async () => {
    setBusy(true);
    try {
      const u = await patch("/auth/me/", { ...f, grade: f.education_stage === "school" || f.education_stage === "lyceum" ? f.grade : null, onboarded: true });
      setUser(u);
      toast("Profil tayyor! Endi sizga mos tavsiyalar beramiz.");
      nav("/home", { replace: true });
    } catch (e: any) {
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg px-5 py-6 safe-bottom">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-sub">{step + 1}/{steps.length} · {steps[step]}</p>
            <Progress value={((step + 1) / steps.length) * 100} className="mt-1.5" />
          </div>
          <button className="text-sm font-semibold text-sub" onClick={() => nav("/home")}>Keyinroq</button>
        </div>

        <div key={step} className="mt-8 animate-fade-up">
          {step === 0 && (
            <>
              <h1 className="text-2xl font-extrabold">Salom, {user?.first_name}! 👋</h1>
              <p className="mt-1 text-sub">Hozir qayerda o'qiysiz? Bu tavsiyalarni sizga moslashtirishga yordam beradi.</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {(opts?.stages || []).map((s) => (
                  <button key={s.value} onClick={() => setF({ ...f, education_stage: s.value })} className={cx("card p-4 text-left font-semibold transition", f.education_stage === s.value ? "border-brand ring-4 ring-brand/15" : "hover:border-brand/40")}>
                    {s.label}
                  </button>
                ))}
              </div>
              {(f.education_stage === "school" || f.education_stage === "lyceum") && (
                <div className="mt-5">
                  <span className="label">Sinf / kurs</span>
                  <div className="flex flex-wrap gap-2">
                    {[7, 8, 9, 10, 11].map((g) => <button key={g} onClick={() => setF({ ...f, grade: g })} className={cx("chip w-12 justify-center", f.grade === g && "chip-on")}>{g}</button>)}
                  </div>
                </div>
              )}
              <div className="mt-5"><Field label="Hudud (ixtiyoriy)"><input className="input" value={f.region} maxLength={80} onChange={(e) => setF({ ...f, region: e.target.value })} placeholder="Masalan: Toshkent" /></Field></div>
            </>
          )}
          {step === 1 && (
            <>
              <h1 className="text-2xl font-extrabold">Sizni nima qiziqtiradi?</h1>
              <p className="mt-1 text-sub">Bir nechtasini tanlang — keyin o'zgartirish mumkin.</p>
              <div className="mt-6"><Chips items={opts?.interests || []} value={f.interests} onChange={(v) => setF({ ...f, interests: v })} /></div>
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="text-2xl font-extrabold">Qaysi fanlarni yoqtirasiz?</h1>
              <p className="mt-1 text-sub">Kasb tavsiyalarida hisobga olinadi.</p>
              <div className="mt-6"><Chips items={opts?.subjects || []} value={f.favorite_subjects} onChange={(v) => setF({ ...f, favorite_subjects: v })} /></div>
            </>
          )}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold">Kelajak maqsadlaringiz</h1>
                <p className="mt-1 text-sub">AI yordamchi va reja shu asosda moslashadi.</p>
              </div>
              <Field label="Maqsadingizni o'z so'zlaringiz bilan yozing">
                <textarea className="input min-h-[96px] py-3" maxLength={1000} value={f.future_goals} onChange={(e) => setF({ ...f, future_goals: e.target.value })} placeholder="Masalan: IELTS 7.0 olib, Koreyada kompyuter injiniringi bo'yicha grant yutmoqchiman" />
              </Field>
              <div>
                <span className="label">Ingliz tili darajangiz</span>
                <div className="flex flex-wrap gap-2">
                  {LEVELS.map((l) => <button key={l.v} onClick={() => setF({ ...f, english_level: l.v })} className={cx("chip", f.english_level === l.v && "chip-on")}>{l.t}</button>)}
                </div>
              </div>
              <div>
                <span className="label">Qaysi davlatlarda o'qishni o'ylayapsiz?</span>
                <Chips items={opts?.countries || []} value={f.target_countries} onChange={(v) => setF({ ...f, target_countries: v })} max={8} />
              </div>
              <div>
                <span className="label">Kuniga o'qish uchun qancha vaqt ajrata olasiz? <b className="text-brand">{f.daily_minutes} daqiqa</b></span>
                <input type="range" min={10} max={180} step={5} value={f.daily_minutes} onChange={(e) => setF({ ...f, daily_minutes: +e.target.value })} className="w-full accent-[rgb(var(--brand))]" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 flex gap-3">
          {step > 0 && <button className="btn-outline h-12 w-14" aria-label="Orqaga" onClick={() => setStep(step - 1)}><ArrowLeft className="h-5 w-5" /></button>}
          {step < steps.length - 1 ? (
            <button className="btn-primary h-12 flex-1" disabled={!canNext} onClick={() => setStep(step + 1)}>Davom etish <ArrowRight className="h-5 w-5" /></button>
          ) : (
            <button className="btn-primary h-12 flex-1" disabled={busy} onClick={finish}>{busy ? <Spinner /> : <>Tayyor <Check className="h-5 w-5" /></>}</button>
          )}
        </div>
      </div>
    </div>
  );
}
