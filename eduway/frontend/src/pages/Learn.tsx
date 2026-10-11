import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Brain, GraduationCap, LineChart, Mic, PenLine, RefreshCw, Sparkles, Target, Timer, Zap } from "lucide-react";
import { PageHeader } from "../components/ui";

const GROUPS = [
  { title: "Har kuni", desc: "Odat shakllantiradigan qisqa mashg'ulotlar", items: [
    { to: "/challenge", icon: Zap, title: "Kunlik challenge", text: "Har kuni sizga alohida 5 ta savol, bonus XP", color: "from-amber-400 to-rose-500" },
    { to: "/plan", icon: Target, title: "O'quv reja", text: "Maqsad → 7 kunlik reja → bugungi vazifalar", color: "from-indigo-500 to-violet-600" },
    { to: "/focus", icon: Timer, title: "Fokus taymer", text: "15–60 daqiqa diqqat bilan o'qish", color: "from-violet-500 to-fuchsia-600" },
  ] },
  { title: "Testlar", desc: "Har urinishda yangi savollar — yodlab bo'lmaydi", items: [
    { to: "/practice", icon: Sparkles, title: "Fanlar bo'yicha testlar", text: "Matematika, fizika, informatika, mantiq, ingliz tili", color: "from-fuchsia-500 to-violet-600" },
    { to: "/practice/mistakes", icon: RefreshCw, title: "Xatolar ustida ishlash", text: "Noto'g'ri javob bergan savollaringizni qayta yeching", color: "from-rose-500 to-fuchsia-600" },
  ] },
  { title: "Ingliz tili va IELTS", desc: "Darajangizni aniqlang va bosqichma-bosqich o'sing", items: [
    { to: "/english/placement", icon: GraduationCap, title: "Darajani aniqlash", text: "25 savol — A1 dan C1 gacha", color: "from-sky-500 to-cyan-600" },
    { to: "/english", icon: BookOpen, title: "Darslar", text: "Grammar, Vocabulary, Reading, Listening, IELTS", color: "from-sky-500 to-indigo-600" },
    { to: "/english/vocab/review", icon: Brain, title: "So'zlarni takrorlash", text: "Intervalli takrorlash — so'zlar unutilmaydi", color: "from-emerald-500 to-teal-600" },
    { to: "/english/writing", icon: PenLine, title: "IELTS Writing", text: "Esse yozing va AI tahlilini oling", color: "from-amber-500 to-orange-600" },
    { to: "/ai?mode=speaking", icon: Mic, title: "Speaking mashqi", text: "AI bilan ovozli suhbat", color: "from-pink-500 to-rose-600" },
  ] },
  { title: "Natijalar", desc: "Rivojlanishingizni kuzating", items: [
    { to: "/progress", icon: LineChart, title: "Natijalar va yutuqlar", text: "Grafiklar, zaif mavzular, badge'lar", color: "from-blue-500 to-indigo-700" },
  ] },
];

export default function Learn() {
  return (
    <>
      <PageHeader title="O'qish" subtitle="Bilimingizni oshirish uchun barcha vositalar — bo'limlarga ajratilgan" />
      <div className="space-y-7">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="text-lg font-bold">{g.title}</h2>
            <p className="mb-3 text-sm text-sub">{g.desc}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.items.map((i, n) => (
                <Link key={i.to} to={i.to} className="card group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lift animate-fade-up" style={{ animationDelay: `${n * 0.04}s` }}>
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white ${i.color}`}><i.icon className="h-6 w-6" /></div>
                  <div className="min-w-0 flex-1"><p className="font-bold">{i.title}</p><p className="text-sm text-sub">{i.text}</p></div>
                  <ArrowRight className="h-5 w-5 text-sub transition group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
