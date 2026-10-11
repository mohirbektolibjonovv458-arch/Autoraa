import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Bot, BookOpen, ClipboardList, Compass, Crown, GraduationCap, LineChart, ShieldCheck, Target, Timer, Trophy, Zap } from "lucide-react";
import { Logo } from "../components/Logo";
import { InstallButton } from "../components/Install";
import { useAuth } from "../lib/auth";

const SECTIONS = [
  { icon: Compass, title: "Kasb tanlash", where: "Kelajak → Kasb tanlash", text: "Qiziqishlar testini topshirasiz (7–10 daqiqa). Natijada sizga mos kasblar, har birining sababi, kerakli ko'nikmalar va ta'lim yo'nalishlari ko'rsatiladi. Bu yo'l-yo'riq, yakuniy hukm emas." },
  { icon: GraduationCap, title: "Universitetlar", where: "Kelajak → Universitetlar", text: "O'zbekiston va xorijiy universitetlar: yo'nalishlar, o'qish tili, talablar, rasmiy sayt. Sevimlilarga qo'shing va 3 tagacha solishtiring. «Tekshirilmagan» belgisi bor ma'lumotni rasmiy saytdan tasdiqlang." },
  { icon: Trophy, title: "Grantlar", where: "Kelajak → Grantlar", text: "Profilingizga qanchalik mosligi ko'rsatiladi. «Grantlarimga qo'shish» bosilsa, hujjatlar checklisti yaratiladi va muddat yaqinlashganda eslatma keladi." },
  { icon: Target, title: "O'quv reja", where: "O'qish → O'quv reja", text: "Maqsad qo'ying (masalan, IELTS 7.0). Platforma 7 kunlik reja tuzadi, bosh sahifada bugungi vazifalar chiqadi. Bajarilganini belgilang — XP va seriya oshadi." },
  { icon: Zap, title: "Kunlik challenge", where: "Bosh sahifa", text: "Har kuni sizga alohida 5 ta savol. Ertasi kuni yangilari. Bonus XP beradi va seriyani saqlaydi." },
  { icon: ClipboardList, title: "Testlar", where: "O'qish → Testlar", text: "Matematika, fizika, informatika va mantiq testlarida savollar har safar yangi raqamlar bilan yaratiladi. Boshqa testlarda savollar, tartib va variantlar har urinishda almashadi. Xato javoblar «Xatolar ustida ishlash» bo'limiga tushadi." },
  { icon: BookOpen, title: "Ingliz tili va IELTS", where: "O'qish → Ingliz tili", text: "Avval darajangizni aniqlang (25 savol). Keyin darslar, lug'at (intervalli takrorlash), Listening, Writing tahlili va Speaking." },
  { icon: Bot, title: "BilimAI — AI ustoz", where: "Pastdagi markaziy tugma", text: "Savolingizni o'zbek tilida yozing yoki ayting. Matematikani bosqichma-bosqich tushuntiradi, ingliz tilini o'rgatadi, kasb va reja bo'yicha maslahat beradi. AI xato qilishi mumkin — muhim ma'lumotni tekshiring." },
  { icon: Timer, title: "Fokus taymer", where: "O'qish → Fokus taymer", text: "15–60 daqiqalik diqqat sessiyalari. Kunlik o'qish vaqtingiz hisoblanadi." },
  { icon: LineChart, title: "Natijalar", where: "Profil → Natijalar", text: "Faollik grafigi, fanlar bo'yicha o'rtacha, zaif mavzular va yutuqlar." },
  { icon: Bell, title: "Eslatmalar", where: "Profil → Sozlamalar", text: "Ilovani o'rnatib, bildirishnomalarni yoqsangiz: seriya uzilishi oldidan, challenge va grant muddatlari haqida xabar keladi." },
  { icon: Crown, title: "Premium", where: "Profil → Premium", text: "Ko'proq AI so'rovlari, IELTS Writing tahlili, AI shaxsiy reja va test generatori, ovozli Speaking." },
];

export default function About() {
  const nav = useNavigate();
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <button onClick={() => (history.length > 1 ? nav(-1) : nav("/"))} aria-label="Orqaga" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface"><ArrowLeft className="h-5 w-5" /></button>
          <Logo />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Ilova haqida</h1>
        <p className="mt-2 text-sub">EduWay AI — o'quvchilarga kasb va universitet tanlash, grant va imtihonlarga tayyorlanish hamda sun'iy intellekt yordamida bilim oshirishda yordam beradigan platforma. Quyida har bir bo'lim nima qilishi va qayerda joylashgani.</p>
        <div className="mt-6 space-y-3">
          {SECTIONS.map((s) => (
            <div key={s.title} className="card flex gap-4 p-5">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><s.icon className="h-6 w-6" /></div>
              <div><p className="font-bold">{s.title}</p><p className="text-xs font-semibold text-brand">{s.where}</p><p className="mt-1.5 text-sm leading-relaxed text-sub">{s.text}</p></div>
            </div>
          ))}
        </div>
        <div className="card mt-6 flex gap-3 p-5 text-sm">
          <ShieldCheck className="h-6 w-6 shrink-0 text-ok" />
          <p className="text-sub"><b className="text-ink">Ma'lumotlaringiz:</b> profil, natijalar va AI suhbatlari faqat sizning akkauntingizga bog'langan. Ovozli rejimda audio saqlanmaydi. Akkauntni istalgan vaqtda Sozlamalar'dan butunlay o'chirishingiz mumkin.</p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {user ? <Link to="/home" className="btn-primary flex-1">Bosh sahifaga</Link> : <Link to="/register" className="btn-primary flex-1">Bepul boshlash</Link>}
          <InstallButton className="btn-outline flex-1" label="Telefonga o'rnatish" />
        </div>
      </main>
    </div>
  );
}
