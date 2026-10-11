import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Map, X } from "lucide-react";
import { cx, Progress } from "./ui";
import { currentSubscription, useInstall } from "../lib/pwa";

/** «Boshlash yo'li»: yangi foydalanuvchiga ilovadan qanday foydalanishni bosqichma-bosqich ko'rsatadi. */
export function StartPath({ d }: { d: any }) {
  const inst = useInstall();
  const [push, setPush] = useState(false);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("eduway-startpath") === "hide"; } catch { return false; } });
  useEffect(() => { currentSubscription().then((s) => setPush(!!s)).catch(() => {}); }, []);

  const steps = [
    { done: d.user.onboarded, title: "Profilni to'ldiring", desc: "Sinf, qiziqishlar va maqsad — tavsiyalar shunga moslashadi", link: "/onboarding" },
    { done: !!d.career.last_result, title: "Kasb testini topshiring", desc: "7–10 daqiqa: sizga mos kasblar va sababi", link: "/career/test" },
    { done: !!d.english.level, title: "Ingliz tili darajangizni aniqlang", desc: "25 savol — darslar darajangizga moslashadi", link: "/english/placement" },
    { done: d.goals.length > 0, title: "O'quv maqsadini qo'ying", desc: "Platforma 7 kunlik reja tuzib beradi", link: "/plan" },
    { done: d.challenge_done || d.xp > 0, title: "Birinchi challenge'ni bajaring", desc: "5 ta savol, bonus XP", link: "/challenge" },
    { done: inst.installed, title: "Ilovani telefonga o'rnating", desc: "Bosh ekrandan bir bosishda ochiladi", link: "/settings" },
    { done: push, title: "Eslatmalarni yoqing", desc: "Seriya va muddatlarni o'tkazib yubormaysiz", link: "/settings" },
  ];
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;
  const next = steps.find((s) => !s.done)!;
  const hide = () => { try { localStorage.setItem("eduway-startpath", "hide"); } catch { /* ignore */ } setHidden(true); };

  return (
    <section className="card relative overflow-hidden p-5 animate-fade-up">
      <button onClick={hide} aria-label="Yashirish" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-sub hover:bg-muted"><X className="h-4 w-4" /></button>
      <div className="flex items-center gap-3 pr-8">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-hero text-white"><Map className="h-5 w-5" /></div>
        <div className="flex-1">
          <h2 className="font-bold">Boshlash yo'li</h2>
          <p className="text-xs text-sub">{done} / {steps.length} qadam · ilovadan to'liq foydalanish uchun</p>
        </div>
      </div>
      <Progress value={(100 * done) / steps.length} className="mt-3" />
      <Link to={next.link} className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-soft p-3.5 transition hover:brightness-95">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{steps.indexOf(next) + 1}</span>
        <div className="min-w-0 flex-1"><p className="font-bold text-brand">Keyingi: {next.title}</p><p className="truncate text-xs text-sub">{next.desc}</p></div>
        <ChevronRight className="h-5 w-5 text-brand" />
      </Link>
      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link to={s.link} className={cx("flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm hover:bg-muted", s.done && "text-sub")}>
              <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold", s.done ? "bg-ok text-white" : "border border-line text-sub")}>{s.done ? <Check className="h-3 w-3" /> : i + 1}</span>
              <span className={cx(s.done && "line-through")}>{s.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
