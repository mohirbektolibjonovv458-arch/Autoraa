import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Bell, Search as SearchIcon, BookOpen, Bot, Compass, Crown, GraduationCap, Home, LayoutDashboard, LineChart, LogOut, Moon, Settings, Sparkles, Sun, Target, User as UserIcon } from "lucide-react";
import { useAuth } from "../lib/auth";
import { get } from "../lib/api";
import { useTheme } from "../lib/theme";
import { Logo } from "./Logo";
import { cx } from "./ui";
import { SearchModal } from "./Search";
import { syncPush } from "../lib/pwa";

const TABS = [
  { to: "/home", label: "Bosh sahifa", icon: Home, match: ["/home"] },
  { to: "/learn", label: "O'qish", icon: BookOpen, match: ["/learn", "/english", "/practice", "/plan"] },
  { to: "/ai", label: "AI", icon: Bot, match: ["/ai"], center: true },
  { to: "/future", label: "Kelajak", icon: Compass, match: ["/future", "/career", "/universities", "/grants"] },
  { to: "/profile", label: "Profil", icon: UserIcon, match: ["/profile", "/progress", "/premium", "/notifications", "/settings"] },
];

const SIDE = [
  { to: "/home", label: "Bosh sahifa", icon: Home },
  { to: "/ai", label: "BilimAI yordamchi", icon: Bot },
  { to: "/plan", label: "O'quv reja", icon: Target },
  { to: "/english", label: "Ingliz tili va IELTS", icon: BookOpen },
  { to: "/practice", label: "Testlar", icon: Sparkles },
  { to: "/career", label: "Kasb tanlash", icon: Compass },
  { to: "/universities", label: "Universitetlar", icon: GraduationCap },
  { to: "/grants", label: "Grantlar", icon: Crown },
  { to: "/progress", label: "Natijalar", icon: LineChart },
];

export function useUnread() {
  const [n, setN] = useState(0);
  const loc = useLocation();
  useEffect(() => {
    let alive = true;
    get("/notifications/").then((l: any[]) => alive && setN(l.filter((x) => !x.read).length)).catch(() => {});
    return () => { alive = false; };
  }, [loc.pathname]);
  return n;
}

function ThemeButton() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} aria-label="Mavzuni almashtirish" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface hover:bg-muted">
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

function BellButton() {
  const unread = useUnread();
  return (
    <Link to="/notifications" aria-label="Bildirishnomalar" className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface hover:bg-muted">
      <Bell className="h-5 w-5" />
      {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1 text-[11px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
    </Link>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  const fullBleed = loc.pathname.startsWith("/ai");
  const [search, setSearch] = useState(false);
  useEffect(() => { syncPush(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-line bg-surface/60 p-5 backdrop-blur lg:flex">
        <Link to="/home"><Logo /></Link>
        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
          {SIDE.map((s) => (
            <NavLink key={s.to} to={s.to} className={({ isActive }) => cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition", isActive ? "bg-brand-soft text-brand" : "text-sub hover:bg-muted hover:text-ink")}>
              <s.icon className="h-5 w-5" /> {s.label}
            </NavLink>
          ))}
          {user?.is_admin && (
            <NavLink to="/admin" className={({ isActive }) => cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition", isActive ? "bg-brand-soft text-brand" : "text-sub hover:bg-muted hover:text-ink")}>
              <LayoutDashboard className="h-5 w-5" /> Admin panel
            </NavLink>
          )}
        </nav>
        {user && !user.is_premium && (
          <Link to="/premium" className="mb-4 block rounded-2xl gradient-hero p-4 text-white shadow-lift">
            <p className="flex items-center gap-2 font-bold"><Crown className="h-4 w-4" /> Premium</p>
            <p className="mt-1 text-sm text-white/80">Ko'proq AI, IELTS Writing tahlili va shaxsiy reja</p>
          </Link>
        )}
        <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
          <Link to="/profile" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft font-bold text-brand">{user?.first_name?.[0]?.toUpperCase() || "?"}</Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user?.full_name}</p>
            <p className="truncate text-xs text-sub">{user?.is_premium ? "Premium" : "Bepul tarif"}</p>
          </div>
          <Link to="/settings" aria-label="Sozlamalar" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"><Settings className="h-[18px] w-[18px]" /></Link>
          <button aria-label="Chiqish" onClick={logout} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"><LogOut className="h-[18px] w-[18px]" /></button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link to="/home" className="lg:hidden"><Logo /></Link>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <button onClick={() => setSearch(true)} aria-label="Qidirish" className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sub hover:bg-muted">
                <SearchIcon className="h-5 w-5" /><span className="hidden text-sm sm:inline">Qidirish</span><kbd className="hidden rounded-md bg-muted px-1.5 text-[11px] font-semibold lg:inline">Ctrl K</kbd>
              </button>
              <ThemeButton />
              <BellButton />
            </div>
          </div>
        </header>
        <main className={cx("mx-auto max-w-5xl px-4 sm:px-6", fullBleed ? "pb-24 pt-3 lg:pb-6" : "pb-28 pt-5 lg:pb-12")}>
          {children ?? <Outlet />}
        </main>
      </div>

      <SearchModal open={search} onClose={() => setSearch(false)} />
      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/90 backdrop-blur-xl lg:hidden safe-bottom" aria-label="Asosiy menyu">
        <div className="mx-auto grid max-w-lg grid-cols-5 px-2 pt-1.5 pb-1.5">
          {TABS.map((t) => {
            const active = t.match.some((m) => loc.pathname.startsWith(m));
            if (t.center) {
              return (
                <Link key={t.to} to={t.to} className="flex flex-col items-center" aria-label="AI yordamchi">
                  <span className={cx("-mt-6 grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lift transition gradient-hero", active && "ring-4 ring-brand/25")}>
                    <t.icon className="h-6 w-6" />
                  </span>
                  <span className={cx("mt-0.5 text-[11px] font-semibold", active ? "text-brand" : "text-sub")}>{t.label}</span>
                </Link>
              );
            }
            return (
              <Link key={t.to} to={t.to} className={cx("flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition", active ? "text-brand" : "text-sub")}>
                <t.icon className={cx("h-6 w-6 transition", active && "scale-110")} strokeWidth={active ? 2.4 : 2} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
