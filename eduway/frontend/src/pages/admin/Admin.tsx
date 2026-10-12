import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { Activity, AlertTriangle, ArrowLeft, Bot, BookOpen, Briefcase, CheckCircle2, ClipboardList, Crown, GraduationCap, LayoutDashboard, ShieldAlert, Trophy, Users, XCircle, Mic } from "lucide-react";
import { Badge, cx, ErrorState, PageSkeleton, Spinner } from "../../components/ui";
import { Logo } from "../../components/Logo";
import { useToast } from "../../components/Toast";
import { api, get, post } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { FIELD_LABEL, fmtDate, fmtMoney, SUBJECT_LABEL, timeAgo } from "../../lib/format";
import { Crud, FieldDef, FormFields, yes } from "./Crud";

const NAV = [
  { to: "/admin", label: "Umumiy holat", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Foydalanuvchilar", icon: Users },
  { to: "/admin/premium", label: "Premium so'rovlar", icon: Crown },
  { to: "/admin/universities", label: "Universitetlar", icon: GraduationCap },
  { to: "/admin/grants", label: "Grantlar", icon: Trophy },
  { to: "/admin/careers", label: "Kasblar", icon: Briefcase },
  { to: "/admin/quizzes", label: "Testlar", icon: ClipboardList },
  { to: "/admin/lessons", label: "Darslar", icon: BookOpen },
  { to: "/admin/moderation", label: "AI moderatsiya", icon: ShieldAlert },
  { to: "/admin/speaking", label: "Speaking shikoyatlari", icon: Mic },
  { to: "/admin/errors", label: "Xatolar jurnali", icon: Activity },
];

const opt = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));
const FIELDS = opt(FIELD_LABEL);

function Overview() {
  const { data: d, error, loading, reload } = useApi<any>("/admin/overview/");
  if (loading) return <PageSkeleton />;
  if (error || !d) return <ErrorState error={error} onRetry={reload} />;
  const Stat = ({ label, value, sub }: any) => <div className="card p-4"><p className="text-sm text-sub">{label}</p><p className="mt-1 text-2xl font-extrabold">{value}</p>{sub && <p className="text-xs text-sub">{sub}</p>}</div>;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Umumiy holat</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Foydalanuvchilar" value={d.users.total} sub={`+${d.users.new_week} shu hafta`} />
        <Stat label="Premium" value={d.users.premium} />
        <Stat label="Bugun faol" value={d.users.active_today} />
        <Stat label="Kutilayotgan to'lovlar" value={d.billing.pending} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-bold"><Bot className="h-5 w-5 text-brand" /> AI xizmati</h2>
          {d.ai.configured ? (
            <div className="mt-3 space-y-1.5 text-sm">
              <p className="flex items-center gap-2 font-semibold text-ok"><CheckCircle2 className="h-4 w-4" /> Kalit sozlangan · {d.ai.model}</p>
              <p>7 kunda so'rovlar: <b>{d.ai.requests_week}</b> · tokenlar: {d.ai.input_tokens_week.toLocaleString()} kirish / {d.ai.output_tokens_week.toLocaleString()} chiqish</p>
              <p>Limitlar: bepul {d.ai.limits.free}/kun, premium {d.ai.limits.premium}/kun</p>
              <p className={d.ai.errors_24h ? "text-bad" : "text-sub"}>So'nggi 24 soatda AI xatolari: {d.ai.errors_24h}</p>
              <p className="text-xs text-sub">Kalit kalitning haqiqatan ishlashini tekshirish: <code className="rounded bg-muted px-1">python manage.py check_ai</code></p>
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center gap-2 font-semibold text-warn"><XCircle className="h-4 w-4" /> AI ulanmagan — foydalanuvchilarga «sozlanmagan» xabari ko'rsatilmoqda</p>
              <ol className="list-decimal space-y-1 pl-5 text-sub">
                <li><a className="text-brand underline" href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a> da API kalit yarating.</li>
                <li>Serverdagi <code className="rounded bg-muted px-1">backend/.env</code> ga <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY=...</code> yozing.</li>
                <li>Serverni qayta ishga tushiring va <code className="rounded bg-muted px-1">python manage.py check_ai</code> bilan tekshiring.</li>
              </ol>
              <p className="text-xs text-sub">Kalit faqat backendda saqlanadi va brauzerga hech qachon yuborilmaydi.</p>
            </div>
          )}
        </section>
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-bold"><Activity className="h-5 w-5 text-brand" /> Xizmat holati</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between"><span>Telegram bot (kirish kodlari)</span>{d.health.telegram === "ok" ? <Badge tone="ok">Ulangan</Badge> : d.health.telegram === "invalid" ? <Badge tone="bad">Token noto'g'ri</Badge> : <Badge tone="warn">TELEGRAM_BOT_TOKEN yo'q</Badge>}</li>
            <li className="flex justify-between"><span>Ma'lumotlar bazasi</span>{d.health.db ? <Badge tone="ok">Ishlayapti</Badge> : <Badge tone="bad">Xato</Badge>}</li>
            <li className="flex justify-between"><span>Server xatolari (24 soat)</span><Badge tone={d.health.server_errors_24h ? "bad" : "ok"}>{d.health.server_errors_24h}</Badge></li>
            <li className="flex justify-between"><span>DEBUG rejimi</span><Badge tone={d.health.debug ? "warn" : "ok"}>{d.health.debug ? "Yoqilgan" : "O'chiq"}</Badge></li>
            <li className="flex justify-between"><span>To'lov ko'rsatmasi</span><Badge tone={d.billing.payment_configured ? "ok" : "warn"}>{d.billing.payment_configured ? "Sozlangan" : "Sozlanmagan"}</Badge></li>
            <li className="flex justify-between"><span>Onlayn to'lov (Payme/Click)</span><Badge tone="muted">Ulanmagan</Badge></li>
          </ul>
        </section>
      </div>
      <section className="card p-5">
        <h2 className="font-bold">Kontent</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Link to="/admin/universities" className="rounded-xl bg-muted p-3"><b className="text-lg">{d.content.universities}</b><p className="text-sub">universitet{d.content.universities_unverified ? ` · ${d.content.universities_unverified} tekshirilmagan` : ""}</p></Link>
          <Link to="/admin/grants" className="rounded-xl bg-muted p-3"><b className="text-lg">{d.content.grants}</b><p className="text-sub">grant{d.content.grants_unverified ? ` · ${d.content.grants_unverified} tekshirilmagan` : ""}</p></Link>
          <Link to="/admin/quizzes" className="rounded-xl bg-muted p-3"><b className="text-lg">{d.content.quizzes}</b><p className="text-sub">test</p></Link>
          <Link to="/admin/lessons" className="rounded-xl bg-muted p-3"><b className="text-lg">{d.content.lessons}</b><p className="text-sub">dars</p></Link>
        </div>
        {(d.content.universities_unverified > 0 || d.content.grants_unverified > 0) && <p className="mt-3 flex gap-2 text-sm text-warn"><AlertTriangle className="h-4 w-4 shrink-0" /> Tekshirilmagan yozuvlarda narx, muddat va talablarni rasmiy manbadan tekshirib, «Tasdiqlangan» deb belgilang.</p>}
      </section>
      {d.moderation.speak_reports > 0 && <Link to="/admin/speaking" className="card flex items-center gap-3 border-bad/40 p-4"><Mic className="h-5 w-5 text-bad" /> {d.moderation.speak_reports} ta ko'rib chiqilmagan Speaking shikoyati</Link>}
      {d.moderation.flagged_ai > 0 && <Link to="/admin/moderation" className="card flex items-center gap-3 border-warn/40 p-4"><ShieldAlert className="h-5 w-5 text-warn" /> {d.moderation.flagged_ai} ta AI javobi foydalanuvchilar tomonidan belgilangan</Link>}
    </div>
  );
}

function UsersPage() {
  const toast = useToast();
  const [filter, setFilter] = useState("");
  const setPremium = async (u: any, days: number, reload: () => void) => {
    try { await post(`/admin/users/${u.id}/premium/`, { days }); toast(days ? `Premium +${days} kun` : "Premium olib tashlandi"); reload(); } catch (e: any) { toast(e.message, "bad"); }
  };
  const toggleActive = async (u: any, reload: () => void) => {
    try { await api(`/admin/users/${u.id}/`, { method: "PATCH", body: { is_active: !u.is_active } }); reload(); } catch (e: any) { toast(e.message, "bad"); }
  };
  return (
    <>
      <div className="mb-3 flex gap-2">{[["", "Barchasi"], ["plan=premium", "Premium"], ["plan=free", "Bepul"], ["staff=1", "Adminlar"]].map(([v, l]) => <button key={v} onClick={() => setFilter(v)} className={cx("chip", filter === v && "chip-on")}>{l}</button>)}</div>
      <Crud title="Foydalanuvchilar" endpoint="/admin/users/" fields={[]} filters={filter}
        columns={[
          { label: "Foydalanuvchi", render: (u) => <div><p className="font-semibold">{u.first_name} {u.last_name}</p><p className="text-xs text-sub">{u.phone || u.email}</p></div> },
          { label: "Tarif", render: (u) => (u.plan === "premium" ? <Badge tone="warn">Premium · {fmtDate(u.premium_until, false)}</Badge> : <Badge tone="muted">Bepul</Badge>) },
          { label: "Rol", render: (u) => (u.is_staff ? <Badge>Admin</Badge> : "—") },
          { label: "Holat", render: (u) => (u.is_active ? <Badge tone="ok">Faol</Badge> : <Badge tone="bad">Bloklangan</Badge>) },
          { label: "XP", render: (u) => u.xp },
          { label: "Tug'ilgan yil", render: (u) => u.birth_year || "—" },
          { label: "Ro'yxatdan", render: (u) => fmtDate(u.date_joined, false) },
        ]}
        extra={(u, reload) => (
          <span className="mr-1 inline-flex gap-1">
            <button className="btn-soft btn-sm h-8" onClick={() => setPremium(u, 30, reload)}>+30 kun</button>
            {u.plan === "premium" && <button className="btn-outline btn-sm h-8" onClick={() => setPremium(u, 0, reload)}>Premiumni olish</button>}
            <button className="btn-outline btn-sm h-8" onClick={async () => {
              const y = prompt("Tug'ilgan yil (hujjat bo'yicha tekshirilgandan keyin o'zgartiring):", u.birth_year || "");
              if (y === null) return;
              try { await api(`/admin/users/${u.id}/`, { method: "PATCH", body: { birth_year: y ? +y : null } }); toast("Saqlandi"); reload(); } catch (e: any) { toast(e.message, "bad"); }
            }}>Yil</button>
            <button className="btn-outline btn-sm h-8" onClick={() => toggleActive(u, reload)}>{u.is_active ? "Bloklash" : "Faollashtirish"}</button>
          </span>
        )}
      />
    </>
  );
}

function PremiumRequests() {
  const [status, setStatus] = useState("pending");
  const { data, error, loading, reload } = useApi<any[]>(`/admin/premium-requests/?status=${status}`);
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const review = async (r: any, action: string) => {
    const note = action === "reject" ? prompt("Rad etish sababi (foydalanuvchiga ko'rinadi):") || "" : "";
    setBusy(r.id);
    try { await post(`/admin/premium-requests/${r.id}/review/`, { action, note }); toast(action === "approve" ? "Tasdiqlandi — Premium faollashdi" : "Rad etildi"); reload(); }
    catch (e: any) { toast(e.message, "bad"); } finally { setBusy(null); }
  };
  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Premium so'rovlar</h1>
      <p className="mb-4 text-sm text-sub">Onlayn to'lov ulanmagan: to'lov tushganini bank ilovangizda tekshirib, keyin tasdiqlang.</p>
      <div className="mb-4 flex gap-2">{[["pending", "Kutilmoqda"], ["approved", "Tasdiqlangan"], ["rejected", "Rad etilgan"]].map(([v, l]) => <button key={v} onClick={() => setStatus(v)} className={cx("chip", status === v && "chip-on")}>{l}</button>)}</div>
      {loading ? <PageSkeleton /> : error ? <ErrorState error={error} /> : !data?.length ? <p className="text-sub">So'rovlar yo'q.</p> : (
        <div className="space-y-3">{data.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-0 flex-1"><p className="font-semibold">{r.user.name} <span className="font-normal text-sub">· {r.user.email}</span></p>
              <p className="text-sm">{r.months} oy · <b>{fmtMoney(r.amount)}</b> · {fmtDate(r.created)}</p>
              <p className="text-sm text-sub">To'lov ma'lumoti: {r.payment_reference || "—"}</p>{r.admin_note && <p className="text-sm text-sub">Izoh: {r.admin_note}</p>}</div>
            {r.status === "pending" && <div className="flex gap-2"><button className="btn-outline btn-sm" disabled={busy === r.id} onClick={() => review(r, "reject")}>Rad etish</button><button className="btn-primary btn-sm" disabled={busy === r.id} onClick={() => review(r, "approve")}>{busy === r.id ? <Spinner className="h-4 w-4" /> : "Tasdiqlash"}</button></div>}
          </div>
        ))}</div>
      )}
    </div>
  );
}

const UNI_FIELDS: FieldDef[] = [
  { name: "name", label: "Nomi", required: true, full: true }, { name: "short_name", label: "Qisqa nomi" },
  { name: "kind", label: "Turi", type: "select", required: true, options: opt({ state: "Davlat", private: "Xususiy", branch: "Xorijiy filial", foreign: "Xorijiy" }) },
  { name: "country", label: "Davlat", required: true }, { name: "city", label: "Shahar", required: true },
  { name: "website", label: "Rasmiy sayt", type: "url", required: true }, { name: "source_url", label: "Ma'lumot manbasi (URL)", type: "url" },
  { name: "description", label: "Tavsif", type: "textarea" }, { name: "languages", label: "O'qish tillari", type: "lines" },
  { name: "tuition_min", label: "Kontrakt (min)", type: "number" }, { name: "tuition_max", label: "Kontrakt (max)", type: "number" },
  { name: "tuition_currency", label: "Valyuta", type: "select", required: true, options: opt({ UZS: "UZS", USD: "USD", EUR: "EUR", KRW: "KRW", GBP: "GBP" }) },
  { name: "ielts_min", label: "Minimal IELTS", type: "decimal" }, { name: "tuition_note", label: "Narx izohi", full: true },
  { name: "admission_requirements", label: "Qabul talablari", type: "textarea" },
  { name: "application_start", label: "Qabul boshlanishi", type: "date" }, { name: "application_end", label: "Qabul tugashi", type: "date" },
  { name: "deadline_note", label: "Muddat izohi", full: true }, { name: "grant_note", label: "Grant izohi", full: true },
  { name: "verified", label: "Rasmiy manba bilan tasdiqlangan", type: "bool" }, { name: "last_verified", label: "Tekshirilgan sana", type: "date" },
  { name: "is_published", label: "Saytda ko'rinadi", type: "bool" },
];

function Programs({ uni }: { uni: any }) {
  const toast = useToast();
  const [list, setList] = useState<any[]>(uni.programs || []);
  const [f, setF] = useState({ name: "", field: "it", degree: "bachelor", language: "", duration_years: "" });
  const add = async () => {
    try { const p = await post("/admin/programs/", { ...f, university: uni.id, duration_years: f.duration_years || null }); setList([...list, p]); setF({ ...f, name: "" }); }
    catch (e: any) { toast(e.message, "bad"); }
  };
  const remove = async (p: any) => { await api(`/admin/programs/${p.id}/`, { method: "DELETE" }); setList(list.filter((x) => x.id !== p.id)); };
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="font-bold">Ta'lim yo'nalishlari</h3>
      <ul className="mt-2 space-y-1 text-sm">{list.map((p) => <li key={p.id} className="flex justify-between rounded-lg bg-muted px-3 py-2"><span>{p.name} · {FIELD_LABEL[p.field] || p.field} · {p.degree}</span><button className="text-bad" onClick={() => remove(p)}>O'chirish</button></li>)}</ul>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input className="input h-10" placeholder="Yo'nalish nomi" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className="input h-10" value={f.field} onChange={(e) => setF({ ...f, field: e.target.value })}>{FIELDS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <select className="input h-10" value={f.degree} onChange={(e) => setF({ ...f, degree: e.target.value })}><option value="bachelor">Bakalavr</option><option value="master">Magistr</option><option value="phd">PhD</option></select>
        <button className="btn-soft btn-sm h-10" disabled={!f.name.trim()} onClick={add}>Qo'shish</button>
      </div>
    </div>
  );
}

const GRANT_FIELDS: FieldDef[] = [
  { name: "name", label: "Nomi", required: true, full: true }, { name: "provider", label: "Beruvchi", required: true }, { name: "country", label: "Davlat", required: true },
  { name: "levels", label: "Bosqichlar", type: "chips", options: opt({ bachelor: "Bakalavr", master: "Magistratura", phd: "PhD", any: "Barchasi" }) },
  { name: "funding", label: "Moliyalashtirish", type: "select", required: true, options: opt({ full: "To'liq", partial: "Qisman", tuition: "O'qish to'lovi", stipend: "Stipendiya" }) },
  { name: "funding_note", label: "Moliyalashtirish izohi" }, { name: "description", label: "Tavsif", type: "textarea" },
  { name: "eligibility", label: "Kimlar topshira oladi", type: "textarea" }, { name: "min_age", label: "Min yosh", type: "number" }, { name: "max_age", label: "Max yosh", type: "number" },
  { name: "ielts_min", label: "Minimal IELTS", type: "decimal" }, { name: "language_note", label: "Til talabi izohi" },
  { name: "documents", label: "Hujjatlar", type: "lines" }, { name: "fields", label: "Yo'nalishlar (bo'sh = barchasi)", type: "chips", options: FIELDS },
  { name: "deadline", label: "Muddat", type: "date" }, { name: "deadline_note", label: "Muddat izohi" },
  { name: "official_url", label: "Rasmiy ariza sahifasi", type: "url", required: true }, { name: "source_url", label: "Ma'lumot manbasi", type: "url" },
  { name: "verified", label: "Rasmiy manba bilan tasdiqlangan", type: "bool" }, { name: "last_verified", label: "Tekshirilgan sana", type: "date" },
  { name: "is_published", label: "Saytda ko'rinadi", type: "bool" },
];

const CAREER_FIELDS: FieldDef[] = [
  { name: "title", label: "Nomi", required: true }, { name: "slug", label: "Slug (lotin, chiziqcha)", required: true },
  { name: "riasec", label: "RIASEC kodi", required: true, hint: "Masalan: IRC" }, { name: "field", label: "Soha", type: "select", required: true, options: FIELDS },
  { name: "icon", label: "Ikonka kaliti", hint: "code, chart, shield, palette, stethoscope, ..." },
  { name: "summary", label: "Qisqacha", type: "textarea" }, { name: "duties", label: "Vazifalar", type: "lines" }, { name: "skills", label: "Ko'nikmalar", type: "lines" },
  { name: "subjects", label: "Fanlar", type: "lines" }, { name: "interests", label: "Qiziqishlar", type: "lines" },
  { name: "study_directions", label: "Ta'lim yo'nalishlari", type: "lines" }, { name: "growth_path", label: "Rivojlanish yo'li", type: "lines" },
  { name: "is_published", label: "Saytda ko'rinadi", type: "bool" },
];

const QUIZ_FIELDS: FieldDef[] = [
  { name: "title", label: "Nomi", required: true, full: true }, { name: "subject", label: "Fan", type: "select", required: true, options: opt(SUBJECT_LABEL) },
  { name: "level", label: "Daraja", type: "select", required: true, options: opt({ easy: "Oson", medium: "O'rta", hard: "Qiyin", A1: "A1", A2: "A2", B1: "B1", B2: "B2", C1: "C1", C2: "C2" }) },
  { name: "topic", label: "Mavzu" }, { name: "time_limit_seconds", label: "Vaqt (soniya)", type: "number" },
  { name: "description", label: "Tavsif", type: "textarea" }, { name: "is_premium", label: "Premium", type: "bool" }, { name: "is_published", label: "Saytda ko'rinadi", type: "bool" },
];

const Q_FIELDS: FieldDef[] = [
  { name: "text", label: "Savol", type: "textarea", required: true }, { name: "options", label: "Variantlar (har biri alohida qatorda)", type: "lines" },
  { name: "correct_index", label: "To'g'ri javob raqami (0 dan)", type: "number", required: true }, { name: "topic", label: "Mavzu" }, { name: "order", label: "Tartib", type: "number" },
  { name: "explanation", label: "Izoh", type: "textarea" },
];

function Questions({ quiz }: { quiz: any }) {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [form, setForm] = useState<any>({ text: "", options: "", correct_index: 0, topic: "", order: 0, explanation: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const load = () => get(`/admin/questions/?quiz=${quiz.id}&page_size=100`).then((d) => setList(d.results));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async () => {
    try {
      await post("/admin/questions/", { ...form, quiz: quiz.id, options: String(form.options).split("\n").map((s: string) => s.trim()).filter(Boolean), correct_index: +form.correct_index, order: +form.order || (list?.length || 0) });
      setForm({ text: "", options: "", correct_index: 0, topic: "", order: 0, explanation: "" }); setErrors({}); load();
    } catch (e: any) { const d = e.data || {}; setErrors(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : String(v)]))); toast(e.message, "bad"); }
  };
  const remove = async (q: any) => { await api(`/admin/questions/${q.id}/`, { method: "DELETE" }); load(); };
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="font-bold">Savollar ({list?.length ?? "…"})</h3>
      <ol className="mt-2 space-y-2 text-sm">{list?.map((q, i) => <li key={q.id} className="rounded-xl bg-muted p-3"><div className="flex justify-between gap-2"><b>{i + 1}. {q.text}</b><button className="text-bad" onClick={() => remove(q)}>O'chirish</button></div><p className="text-sub">{q.options.map((o: string, j: number) => (j === q.correct_index ? `✓ ${o}` : o)).join(" · ")}</p></li>)}</ol>
      <div className="mt-3 rounded-2xl border border-dashed border-line p-3"><p className="mb-2 text-sm font-semibold">Yangi savol</p><FormFields fields={Q_FIELDS} form={form} setForm={setForm} errors={errors} /><button className="btn-soft btn-sm mt-3" onClick={add}>Savol qo'shish</button></div>
    </div>
  );
}

const LESSON_FIELDS: FieldDef[] = [
  { name: "title", label: "Nomi", required: true, full: true },
  { name: "skill", label: "Ko'nikma", type: "select", required: true, options: opt({ grammar: "Grammar", vocabulary: "Vocabulary", reading: "Reading", listening: "Listening", writing: "Writing", speaking: "Speaking", ielts: "IELTS" }) },
  { name: "level", label: "Daraja", type: "select", required: true, options: opt({ A1: "A1", A2: "A2", B1: "B1", B2: "B2", C1: "C1", C2: "C2" }) },
  { name: "summary", label: "Qisqacha", full: true }, { name: "content", label: "Matn (markdown)", type: "textarea" },
  { name: "listening_text", label: "Listening matni (ovozda o'qiladi)", type: "textarea" }, { name: "quiz", label: "Bog'langan test ID", type: "number" },
  { name: "order", label: "Tartib", type: "number" }, { name: "is_premium", label: "Premium", type: "bool" }, { name: "is_published", label: "Saytda ko'rinadi", type: "bool" },
];

function Moderation() {
  const [all, setAll] = useState(false);
  const { data, error, loading, reload } = useApi<any[]>(`/admin/flagged/${all ? "?all=1" : ""}`);
  const done = async (m: any) => { await post(`/admin/flagged/${m.id}/review/`); reload(); };
  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">AI moderatsiya</h1>
      <p className="mb-4 text-sm text-sub">Foydalanuvchilar «👎» bilan belgilagan AI javoblari. Xato javoblar asosida tizim ko'rsatmalarini yaxshilang.</p>
      <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Ko'rib chiqilganlarni ham ko'rsatish</label>
      {loading ? <PageSkeleton /> : error ? <ErrorState error={error} /> : !data?.length ? <p className="text-sub">Belgilangan javoblar yo'q.</p> : (
        <div className="space-y-3">{data.map((m) => (
          <div key={m.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-sub"><span>{m.user} · {m.mode} · {timeAgo(m.created)}</span>{m.reviewed ? <Badge tone="ok">Ko'rib chiqilgan</Badge> : <button className="btn-soft btn-sm h-8" onClick={() => done(m)}>Ko'rib chiqildi</button>}</div>
            <p className="mt-2 text-sm"><b>Savol:</b> {m.question}</p>
            <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">{m.answer}</p>
            {m.note && <p className="mt-2 text-sm text-warn">Izoh: {m.note}</p>}
          </div>
        ))}</div>
      )}
    </div>
  );
}

function SpeakReports() {
  const [all, setAll] = useState(false);
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any[]>(`/admin/speak-reports/${all ? "?all=1" : ""}`);
  const act = async (r: any, action: string) => {
    try { await post(`/admin/speak-reports/${r.id}/review/`, { action }); toast(action === "suspend" ? "Speaking yopildi" : action === "unsuspend" ? "Qayta ochildi" : "Ko'rib chiqildi"); reload(); }
    catch (e: any) { toast(e.message, "bad"); }
  };
  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Speaking shikoyatlari</h1>
      <p className="mb-4 text-sm text-sub">Jonli suhbatlardagi shikoyatlar. Suhbatlar yozib olinmaydi — qaror shikoyatlar soni va izohlar asosida qabul qilinadi. 30 kunda 3 xil foydalanuvchidan shikoyat olgan akkaunt avtomatik to'xtatiladi.</p>
      <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Ko'rib chiqilganlarni ham ko'rsatish</label>
      {loading ? <PageSkeleton /> : error ? <ErrorState error={error} /> : !data?.length ? <p className="text-sub">Shikoyatlar yo'q.</p> : (
        <div className="space-y-3">{data.map((r) => (
          <div key={r.id} className="card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2"><Badge tone="bad">{r.reason}</Badge><span className="text-xs text-sub">{timeAgo(r.created)}</span>{r.reviewed && <Badge tone="ok">Ko'rib chiqilgan</Badge>}</div>
            <p className="mt-2"><b>Kimga:</b> {r.reported.name} ({r.reported.contact}) · jami shikoyat: {r.reported.reports} {r.reported.suspended && <Badge tone="bad">To'xtatilgan</Badge>}</p>
            <p className="text-sub"><b>Kimdan:</b> {r.reporter.name} ({r.reporter.contact})</p>
            {r.note && <p className="mt-2 rounded-xl bg-muted p-3">{r.note}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {!r.reviewed && <button className="btn-soft btn-sm h-8" onClick={() => act(r, "dismiss")}>Asossiz — yopish</button>}
              {r.reported.suspended ? <button className="btn-outline btn-sm h-8" onClick={() => act(r, "unsuspend")}>Qayta ochish</button>
                : <button className="btn-sm h-8 rounded-xl bg-bad px-3 font-semibold text-white" onClick={() => act(r, "suspend")}>Speaking'ni yopish</button>}
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

function Errors() {
  const { data, error, loading, reload } = useApi<any[]>("/admin/errors/");
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-extrabold">Xatolar jurnali</h1><button className="btn-outline btn-sm" onClick={reload}>Yangilash</button></div>
      {loading ? <PageSkeleton /> : error ? <ErrorState error={error} /> : !data?.length ? <p className="text-sub">Xatolar yo'q 🎉</p> : (
        <div className="card divide-y divide-line">{data.map((e) => (
          <div key={e.id} className="p-4 text-sm"><div className="flex flex-wrap items-center gap-2"><Badge tone={e.source === "ai" ? "warn" : "bad"}>{e.source}</Badge><b>{e.code}</b><span className="text-sub">{timeAgo(e.created)}{e.user ? ` · ${e.user}` : ""}</span></div><p className="mt-1 break-all font-mono text-xs text-sub">{e.message}</p></div>
        ))}</div>
      )}
    </div>
  );
}

export default function Admin() {
  return (
    <div className="min-h-screen bg-bg lg:flex">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between p-4 lg:block lg:p-5">
          <Logo />
          <Link to="/home" className="btn-ghost btn-sm lg:mt-4 lg:w-full lg:justify-start"><ArrowLeft className="h-4 w-4" /> Ilovaga qaytish</Link>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx("flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold", isActive ? "bg-brand-soft text-brand" : "text-sub hover:bg-muted")}>
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="premium" element={<PremiumRequests />} />
          <Route path="universities" element={<Crud title="Universitetlar" endpoint="/admin/universities/" fields={UNI_FIELDS} renderDetail={(u) => <Programs uni={u} />}
            columns={[{ label: "Nomi", render: (u) => <b>{u.name}</b> }, { label: "Joy", render: (u) => `${u.city}, ${u.country}` }, { label: "Tasdiqlangan", render: (u) => yes(u.verified) }, { label: "Ko'rinadi", render: (u) => yes(u.is_published) }, { label: "Yangilangan", render: (u) => fmtDate(u.updated, false) }]} />} />
          <Route path="grants" element={<Crud title="Grantlar" endpoint="/admin/grants/" fields={GRANT_FIELDS}
            columns={[{ label: "Nomi", render: (g) => <b>{g.name}</b> }, { label: "Davlat", render: (g) => g.country }, { label: "Muddat", render: (g) => (g.deadline ? fmtDate(g.deadline) : g.deadline_note || "—") }, { label: "Tasdiqlangan", render: (g) => yes(g.verified) }, { label: "Ko'rinadi", render: (g) => yes(g.is_published) }]} />} />
          <Route path="careers" element={<Crud title="Kasblar" endpoint="/admin/careers/" fields={CAREER_FIELDS}
            columns={[{ label: "Nomi", render: (c) => <b>{c.title}</b> }, { label: "RIASEC", render: (c) => c.riasec }, { label: "Soha", render: (c) => FIELD_LABEL[c.field] || c.field }, { label: "Ko'rinadi", render: (c) => yes(c.is_published) }]} />} />
          <Route path="quizzes" element={<Crud title="Testlar" endpoint="/admin/quizzes/" fields={QUIZ_FIELDS} renderDetail={(q) => <Questions quiz={q} />}
            columns={[{ label: "Nomi", render: (q) => <b>{q.title}</b> }, { label: "Fan", render: (q) => SUBJECT_LABEL[q.subject] }, { label: "Savollar", render: (q) => q.question_count }, { label: "Premium", render: (q) => yes(q.is_premium) }, { label: "Ko'rinadi", render: (q) => yes(q.is_published) }]} />} />
          <Route path="lessons" element={<Crud title="Darslar" endpoint="/admin/lessons/" fields={LESSON_FIELDS}
            columns={[{ label: "Nomi", render: (l) => <b>{l.title}</b> }, { label: "Ko'nikma", render: (l) => l.skill }, { label: "Daraja", render: (l) => l.level }, { label: "Premium", render: (l) => yes(l.is_premium) }, { label: "Ko'rinadi", render: (l) => yes(l.is_published) }]} />} />
          <Route path="moderation" element={<Moderation />} />
          <Route path="speaking" element={<SpeakReports />} />
          <Route path="errors" element={<Errors />} />
        </Routes>
      </main>
    </div>
  );
}
