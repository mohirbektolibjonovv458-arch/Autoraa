import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Bot, Compass, GraduationCap, Target } from "lucide-react";
import { Logo } from "../../components/Logo";
import { cx } from "../../components/ui";
import { useAuth } from "../../lib/auth";

const SLIDES = [
  { icon: Compass, title: "O'zingizga mos kasbni toping", text: "Qiziqishlar, kuchli tomonlar va maqsadlaringiz asosida kasb yo'nalishlarini o'rganing — har bir tavsiya sababi bilan.", color: "from-violet-500 to-indigo-600" },
  { icon: GraduationCap, title: "Universitet va grantlar bir joyda", text: "O'zbekiston va xorijdagi universitetlar, grantlar, talablar va hujjatlar ro'yxati — rasmiy manbalarga havola bilan.", color: "from-fuchsia-500 to-violet-600" },
  { icon: Bot, title: "BilimAI — o'zbek tilidagi ustozingiz", text: "Matematika, ingliz tili, IELTS va boshqa fanlarni bosqichma-bosqich tushuntiradigan sun'iy intellekt yordamchisi.", color: "from-sky-500 to-indigo-600" },
  { icon: Target, title: "Shaxsiy reja va natijalar", text: "Maqsad qo'ying, kunlik vazifalarni bajaring va rivojlanishingizni grafiklarda kuzating.", color: "from-indigo-500 to-blue-700" },
];

export default function Welcome() {
  const { user, ready } = useAuth();
  const [i, setI] = useState(0);
  if (ready && user) return <Navigate to="/home" replace />;
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden gradient-hero p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo light />
        <div>
          <h1 className="max-w-md text-5xl font-extrabold leading-tight tracking-tight">Kasb tanlashdan universitetgacha — bitta platformada.</h1>
          <p className="mt-4 max-w-md text-lg text-white/75">EduWay AI o'quvchilarga yo'nalish tanlash, grantlarga tayyorlanish va sun'iy intellekt yordamida bilim olishda yordam beradi.</p>
        </div>
        <p className="text-sm text-white/60">© {new Date().getFullYear()} EduWay AI</p>
        <div className="absolute -right-24 top-24 h-96 w-96 rounded-full bg-fuchsia-500/30 blur-3xl" />
      </div>
      <div className="flex min-h-screen flex-col px-6 pb-8 pt-6 safe-bottom">
        <div className="flex items-center justify-between lg:justify-end">
          <span className="lg:hidden"><Logo /></span>
          {!last && <button className="text-sm font-semibold text-sub" onClick={() => setI(SLIDES.length - 1)}>O'tkazib yuborish</button>}
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <div key={i} className="animate-fade-up">
            <div className={cx("mx-auto grid h-40 w-40 place-items-center rounded-[40px] bg-gradient-to-br text-white shadow-lift", s.color)}>
              <s.icon className="h-20 w-20 animate-float" strokeWidth={1.6} />
            </div>
            <h2 className="mt-10 text-center text-3xl font-extrabold tracking-tight">{s.title}</h2>
            <p className="mt-3 text-center text-sub">{s.text}</p>
          </div>
          <div className="mt-8 flex justify-center gap-2">
            {SLIDES.map((_, j) => <button key={j} aria-label={`${j + 1}-slayd`} onClick={() => setI(j)} className={cx("h-2 rounded-full transition-all", j === i ? "w-8 bg-brand" : "w-2 bg-line")} />)}
          </div>
        </div>
        <div className="mx-auto w-full max-w-md space-y-3">
          {last ? (
            <>
              <Link to="/register" className="btn-primary w-full h-12">Boshlash — bepul <ArrowRight className="h-5 w-5" /></Link>
              <Link to="/login" className="btn-outline w-full h-12">Akkauntim bor</Link>
            </>
          ) : (
            <button className="btn-primary w-full h-12" onClick={() => setI(i + 1)}>Davom etish <ArrowRight className="h-5 w-5" /></button>
          )}
        </div>
      </div>
    </div>
  );
}
