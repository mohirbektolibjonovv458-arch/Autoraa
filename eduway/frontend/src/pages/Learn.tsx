import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, Timer, Zap, BookOpen, Brain, LineChart, Mic, PenLine, RefreshCw, Sparkles, Target } from "lucide-react";
import { PageHeader } from "../components/ui";

const ITEMS = [
  { to: "/challenge", icon: Zap, title: "Kunlik challenge", text: "Har kuni 5 ta yangi savol va bonus XP", color: "from-amber-400 to-rose-500" },
  { to: "/focus", icon: Timer, title: "Fokus taymer", text: "Pomodoro: diqqat bilan o'qish vaqtini hisoblash", color: "from-violet-500 to-fuchsia-600" },
  { to: "/english/placement", icon: GraduationCap, title: "Ingliz tili darajasini aniqlash", text: "25 savol — A1 dan C1 gacha", color: "from-sky-500 to-cyan-600" },
  { to: "/plan", icon: Target, title: "O'quv reja", text: "Maqsad, kunlik va haftalik vazifalar", color: "from-indigo-500 to-violet-600" },
  { to: "/english", icon: BookOpen, title: "Ingliz tili va IELTS", text: "Darslar, lug'at, Writing va Speaking", color: "from-sky-500 to-indigo-600" },
  { to: "/practice", icon: Sparkles, title: "Testlar", text: "Fanlar bo'yicha vaqtli testlar va AI generator", color: "from-fuchsia-500 to-violet-600" },
  { to: "/practice/mistakes", icon: RefreshCw, title: "Xatolar ustida ishlash", text: "Oldingi xatolarni qayta yeching", color: "from-rose-500 to-fuchsia-600" },
  { to: "/english/vocab/review", icon: Brain, title: "So'zlarni takrorlash", text: "Intervalli takrorlash usuli", color: "from-emerald-500 to-teal-600" },
  { to: "/english/writing", icon: PenLine, title: "IELTS Writing", text: "Esse yozing va AI tahlilini oling", color: "from-amber-500 to-orange-600" },
  { to: "/ai?mode=speaking", icon: Mic, title: "Speaking mashqi", text: "AI bilan ovozli suhbat", color: "from-pink-500 to-rose-600" },
  { to: "/progress", icon: LineChart, title: "Natijalar va tahlil", text: "Grafiklar, zaif mavzular, yutuqlar", color: "from-blue-500 to-indigo-700" },
];

export default function Learn() {
  return (
    <>
      <PageHeader title="O'qish" subtitle="Bilimingizni oshirish uchun barcha vositalar" />
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((i, n) => (
          <Link key={i.to} to={i.to} className="card group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lift animate-fade-up" style={{ animationDelay: `${n * 0.04}s` }}>
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white ${i.color}`}><i.icon className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1"><p className="font-bold">{i.title}</p><p className="text-sm text-sub">{i.text}</p></div>
            <ArrowRight className="h-5 w-5 text-sub transition group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </>
  );
}
