import { Link } from "react-router-dom";
import { Info, Bell, Bookmark, ChevronRight, Compass, Crown, Flame, GraduationCap, Heart, LayoutDashboard, LineChart, LogOut, Settings, Target, Trophy } from "lucide-react";
import { Badge, PageHeader } from "../components/ui";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { LevelBar, LevelLadder } from "../components/Level";

const STAGE: Record<string, string> = { school: "Maktab", lyceum: "Litsey / kollej", university: "Universitet", graduate: "Bitiruvchi" };

export default function Profile() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const links = [
    { to: "/progress", icon: LineChart, label: "Natijalar va yutuqlar" },
    { to: "/plan", icon: Target, label: "O'quv reja va maqsadlar" },
    { to: "/career", icon: Compass, label: "Tanlangan kasblar" },
    { to: "/universities?favorites=1", icon: Heart, label: "Sevimli universitetlar" },
    { to: "/grants/saved", icon: Bookmark, label: "Grantlarim" },
    { to: "/notifications", icon: Bell, label: "Bildirishnomalar" },
    { to: "/premium", icon: Crown, label: user.is_premium ? "Premium obuna" : "Premium'ga o'tish" },
    { to: "/settings", icon: Settings, label: "Profil, ilova va bildirishnomalar" },
    { to: "/about", icon: Info, label: "Ilova haqida va yordam" },
    ...(user.is_admin ? [{ to: "/admin", icon: LayoutDashboard, label: "Admin panel" }] : []),
  ];
  return (
    <>
      <PageHeader title="Profil" />
      <section className="card p-5 animate-fade-up">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-3xl gradient-hero text-2xl font-extrabold text-white">{user.first_name?.[0]?.toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-extrabold">{user.full_name}</p>
            <p className="truncate text-sm text-sub">{user.phone || user.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {user.is_premium ? <Badge tone="warn"><Crown className="h-3 w-3" /> Premium</Badge> : <Badge tone="muted">Bepul tarif</Badge>}
              {user.education_stage && <Badge tone="muted"><GraduationCap className="h-3 w-3" /> {STAGE[user.education_stage]}{user.grade ? `, ${user.grade}-sinf` : ""}</Badge>}
              {user.english_level && <Badge>English {user.english_level}</Badge>}
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-muted p-3"><Trophy className="mx-auto h-5 w-5 text-amber-500" /><p className="mt-1 font-extrabold">{user.xp}</p><p className="text-[11px] text-sub">XP</p></div>
          <div className="rounded-2xl bg-muted p-3"><Flame className="mx-auto h-5 w-5 text-orange-500" /><p className="mt-1 font-extrabold">{user.streak}</p><p className="text-[11px] text-sub">kun seriya</p></div>
          <div className="rounded-2xl bg-muted p-3"><Flame className="mx-auto h-5 w-5 text-sub" /><p className="mt-1 font-extrabold">{user.best_streak}</p><p className="text-[11px] text-sub">eng uzun</p></div>
        </div>
        {user.level && (
          <div className="mt-4 space-y-3">
            <LevelBar lv={user.level} />
            <LevelLadder xp={user.xp} />
          </div>
        )}
        {(user.interests.length > 0 || user.future_goals) && (
          <div className="mt-4 space-y-2 text-sm">
            {user.future_goals && <p><b>Maqsad:</b> {user.future_goals}</p>}
            {user.interests.length > 0 && <div className="flex flex-wrap gap-1.5">{user.interests.map((i) => <Badge key={i} tone="muted" className="first-letter:uppercase">{i}</Badge>)}</div>}
          </div>
        )}
        <p className="mt-3 text-xs text-sub">A'zo bo'lgan sana: {fmtDate(user.date_joined)}</p>
      </section>
      <nav className="card mt-4 divide-y divide-line">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/60">
            <l.icon className="h-5 w-5 text-brand" /><span className="flex-1 font-semibold">{l.label}</span><ChevronRight className="h-5 w-5 text-sub" />
          </Link>
        ))}
      </nav>
      <button onClick={logout} className="btn-outline mt-4 w-full text-bad"><LogOut className="h-4 w-4" /> Chiqish</button>
    </>
  );
}
