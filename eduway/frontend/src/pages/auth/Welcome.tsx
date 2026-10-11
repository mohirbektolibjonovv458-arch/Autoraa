import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Bell, Bot, BookOpen, Compass, GraduationCap, Mic, Search, Sparkles, Target, Timer, Trophy, UserPlus, Zap } from "lucide-react";
import { Logo, LogoMark } from "../../components/Logo";
import { InstallButton } from "../../components/Install";
import { useAuth } from "../../lib/auth";
import { useInstall } from "../../lib/pwa";

const PILLARS = [
  { icon: Compass, color: "from-violet-500 to-indigo-600", title: "Kasb va universitet tanlash",
    points: ["Qiziqishlar testi — sizga mos kasblar va sababi", "O'zbekiston va xorijiy universitetlar katalogi", "Yo'nalishlar, talablar, solishtirish"] },
  { icon: Trophy, color: "from-amber-400 to-rose-500", title: "Grant va imtihonlarga tayyorgarlik",
    points: ["Profilingizga mos grantlar", "Hujjatlar checklisti va muddatlar eslatmasi", "IELTS: darslar, Writing tahlili, Speaking"] },
  { icon: Bot, color: "from-sky-500 to-indigo-600", title: "AI bilan bilim oshirish",
    points: ["BilimAI — o'zbek tilida ustoz", "Har safar yangi testlar va kunlik challenge", "Shaxsiy reja, fokus taymer, natijalar"] },
];

const STEPS = [
  { icon: UserPlus, title: "Ro'yxatdan o'ting", text: "1 daqiqa, bepul" },
  { icon: Sparkles, title: "Profilni to'ldiring", text: "Sinf, qiziqish, maqsad" },
  { icon: Target, title: "Reja oling", text: "Kunlik vazifalar va testlar" },
  { icon: Trophy, title: "Natijani kuzating", text: "Seriya, XP, grafiklar" },
];

const FEATURES = [
  { icon: Zap, t: "Kunlik challenge" }, { icon: Timer, t: "Fokus taymer" }, { icon: BookOpen, t: "Ingliz tili A1–C1" },
  { icon: Mic, t: "Ovozli Speaking" }, { icon: GraduationCap, t: "18+ universitet" }, { icon: Search, t: "Tezkor qidiruv" },
  { icon: Bell, t: "Eslatmalar" }, { icon: Bot, t: "AI ustoz" },
];

export default function Welcome() {
  const { user, ready } = useAuth();
  const inst = useInstall();
  if (ready && user) return <Navigate to="/home" replace />;
  return (
    <div className="min-h-screen bg-bg">
      {/* Yuqori panel */}
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <InstallButton className="btn-soft btn-sm" label="Yuklab olish" />
            <Link to="/login" className="btn-ghost btn-sm">Kirish</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        {/* Hero */}
        <section className="relative mt-4 overflow-hidden rounded-[32px] gradient-hero px-6 py-10 text-white shadow-lift sm:px-10 sm:py-14 lg:grid lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-10">
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-fuchsia-500/30 blur-3xl animate-float" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-sky-400/25 blur-3xl animate-float [animation-delay:1.5s]" />
          <div className="relative animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur"><Sparkles className="h-3.5 w-3.5" /> O'quvchilar uchun aqlli ta'lim platformasi</span>
            <h1 className="mt-4 text-[32px] font-extrabold leading-[1.1] tracking-tight sm:text-5xl">Kelajagingizni tanlang, unga tayyorlaning — AI bilan.</h1>
            <p className="mt-4 max-w-lg text-[15px] text-white/80 sm:text-lg">EduWay AI sizga mos kasb va universitetni topish, grant va IELTS'ga tayyorlanish hamda har kuni bilimingizni oshirishda yordam beradi.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="btn rounded-2xl bg-white px-6 py-3.5 text-[16px] text-navy hover:bg-white/90">Bepul boshlash <ArrowRight className="h-5 w-5" /></Link>
              {!inst.installed && <InstallButton className="btn rounded-2xl border border-white/30 bg-white/10 px-6 py-3.5 text-[16px] text-white backdrop-blur hover:bg-white/20" label="Telefonga o'rnatish" />}
            </div>
            <p className="mt-3 text-xs text-white/60">Bepul · Ro'yxatdan o'tish 1 daqiqa · Telefon va kompyuterda ishlaydi</p>
          </div>
          {/* Telefon maketi */}
          <div className="relative mx-auto mt-10 hidden w-64 animate-fade-up [animation-delay:.2s] sm:block lg:mt-0">
            <div className="rounded-[40px] border-[6px] border-white/20 bg-bg p-3 text-ink shadow-2xl">
              <div className="rounded-3xl gradient-hero p-4 text-white"><p className="text-xs text-white/70">Xayrli tong,</p><p className="text-lg font-extrabold">Malika 👋</p><div className="mt-3 flex items-end gap-1">{[30, 55, 40, 80, 60, 90, 70].map((h, i) => <div key={i} className="flex-1 rounded bg-white/80" style={{ height: h / 3 }} />)}</div></div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 p-3 text-white"><Zap className="h-4 w-4" /><p className="mt-1 text-xs font-bold">Challenge</p></div>
                <div className="rounded-2xl bg-surface p-3 shadow-card"><Timer className="h-4 w-4 text-brand" /><p className="mt-1 text-xs font-bold">Fokus</p></div>
              </div>
              <div className="mt-2 rounded-2xl bg-surface p-3 shadow-card"><p className="text-xs font-bold">Bugungi reja</p><div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full w-2/3 rounded-full bg-brand" /></div></div>
            </div>
          </div>
        </section>

        {/* O'rnatish kartasi */}
        {!inst.installed && (
          <section className="mt-5 flex flex-col items-center gap-4 rounded-3xl border border-brand/25 bg-gradient-to-r from-brand-soft via-surface to-brand-soft p-5 text-center sm:flex-row sm:text-left animate-fade-up">
            <LogoMark className="h-16 w-16 shrink-0 drop-shadow-lg" />
            <div className="flex-1">
              <h2 className="text-lg font-extrabold">EduWay AI'ni telefoningizga o'rnating</h2>
              <p className="text-sm text-sub">Bosh ekrandan bir bosishda ochiladi, internet sekin bo'lsa ham tez ishlaydi, seriya va muddatlar haqida eslatmalar keladi.</p>
            </div>
            <InstallButton className="btn-primary h-12 w-full px-6 sm:w-auto" label="Ilovani yuklab olish" />
          </section>
        )}

        {/* Nima uchun */}
        <section className="mt-12">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">EduWay AI nima qiladi?</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sub">Uchta asosiy vazifa — bitta ilovada</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PILLARS.map((p, i) => (
              <div key={p.title} className="card p-6 animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lift ${p.color}`}><p.icon className="h-7 w-7" /></div>
                <h3 className="mt-4 text-lg font-bold">{p.title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-sub">{p.points.map((x) => <li key={x} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{x}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>

        {/* Qanday ishlaydi */}
        <section className="mt-12">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">Qanday boshlanadi?</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card relative p-5">
                <span className="absolute right-4 top-4 text-3xl font-extrabold text-brand/15">{i + 1}</span>
                <s.icon className="h-6 w-6 text-brand" />
                <p className="mt-3 font-bold">{s.title}</p>
                <p className="text-sm text-sub">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Imkoniyatlar */}
        <section className="mt-12">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">Ichida nimalar bor</h2>
          <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-8">
            {FEATURES.map((f) => (
              <div key={f.t} className="flex flex-col items-center gap-2 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface text-brand shadow-card"><f.icon className="h-6 w-6" /></div>
                <span className="text-[11px] font-semibold leading-tight">{f.t}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Pastki CTA */}
        <section className="mt-12 rounded-[32px] bg-navy p-8 text-center text-white">
          <h2 className="text-2xl font-extrabold">Bugun birinchi qadamni qo'ying</h2>
          <p className="mx-auto mt-2 max-w-md text-white/70">Kasb testini topshiring, maqsad qo'ying va AI ustoz bilan o'qishni boshlang.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register" className="btn-primary h-12 px-8">Ro'yxatdan o'tish</Link>
            <Link to="/login" className="btn h-12 bg-white/10 px-8 text-white hover:bg-white/20">Akkauntim bor</Link>
          </div>
          <Link to="/about" className="mt-5 inline-block text-sm text-white/60 underline underline-offset-4">Ilova haqida batafsil</Link>
        </section>
      </main>
    </div>
  );
}
