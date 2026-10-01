import { Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3, ClipboardList, CreditCard, FileText, Fuel, LayoutDashboard, LogOut, Map, Menu, Settings, Store, Users, Wrench, X,
} from "lucide-react";
import { useAuth } from "../auth";
import { Avatar, Logo, Spinner } from "./ui";

const ITEMS = [
  { to: "/admin", label: "Dashboard", short: "Asosiy", icon: LayoutDashboard, end: true, group: "Asosiy" },
  { to: "/admin/payments", label: "Premium to'lovlar", short: "To'lovlar", icon: CreditCard, group: "Asosiy" },
  { to: "/admin/orders", label: "Buyurtmalar", short: "Buyurtma", icon: ClipboardList, group: "Asosiy" },
  { to: "/admin/users", label: "Foydalanuvchilar", short: "Odamlar", icon: Users, group: "Boshqaruv" },
  { to: "/admin/masters", label: "Ustalar", short: "Ustalar", icon: Wrench, group: "Boshqaruv" },
  { to: "/admin/shops", label: "Do'konlar", short: "Do'konlar", icon: Store, group: "Boshqaruv" },
  { to: "/admin/fuel", label: "Yoqilg'i shoxobchalari", short: "Yoqilg'i", icon: Fuel, group: "Boshqaruv" },
  { to: "/admin/map", label: "Xarita va kuzatuv", short: "Xarita", icon: Map, group: "Tahlil" },
  { to: "/admin/analytics", label: "Statistika", short: "Statistika", icon: BarChart3, group: "Tahlil" },
  { to: "/admin/blog", label: "Blog va xabarlar", short: "Blog", icon: FileText, group: "Kontent" },
  { to: "/admin/settings", label: "Sayt sozlamalari", short: "Sozlama", icon: Settings, group: "Kontent" },
];
const BOTTOM = ["/admin", "/admin/payments", "/admin/orders", "/admin/users"];

/** Jadvallar telefonda kartochka ko'rinishida chiqishi uchun har bir katakka ustun nomini yozib qo'yadi. */
function useTableLabels(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => el.querySelectorAll("table.table").forEach((t) => {
      const heads = [...t.querySelectorAll("thead th")].map((th) => th.textContent?.trim() || "");
      t.querySelectorAll("tbody tr").forEach((tr) => [...tr.children].forEach((td, i) => {
        if (heads[i] !== undefined && (td as HTMLElement).dataset.label !== heads[i]) (td as HTMLElement).dataset.label = heads[i];
      }));
    });
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
}

export default function AdminShell() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  useTableLabels(mainRef);
  useEffect(() => setMenu(false), [loc.pathname]);
  const cur = ITEMS.find((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to)));
  const groups = [...new Set(ITEMS.map((i) => i.group))];

  return (
    <div className="shell admin">
      <aside className="side">
        <div className="logo"><Logo /></div>
        <nav>
          {groups.map((g) => (
            <div key={g} className="side-group">
              <div className="side-label">{g}</div>
              {ITEMS.filter((i) => i.group === g).map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? "active" : "")}><i.icon size={18} />{i.label}</NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot"><a onClick={logout} style={{ cursor: "pointer" }}><LogOut size={18} />Chiqish</a></div>
      </aside>
      <div className="main">
        <header className="topbar admin-top">
          <button className="icon-btn mobile-only" onClick={() => setMenu(true)} aria-label="Menyu"><Menu size={20} /></button>
          <h1 className="grow admin-title">{cur?.label || "Admin panel"}</h1>
          <span className="small muted desktop-only">{user?.full_name}</span>
          <Avatar name={user?.full_name} />
        </header>
        <main ref={mainRef} className="content admin-content" style={{ maxWidth: 1320 }}><Suspense fallback={<Spinner />}><Outlet /></Suspense></main>
      </div>

      {/* telefon: eng ko'p ishlatiladigan 4 bo'lim + «Menyu» */}
      <nav className="bottom-nav admin-bottom mobile-only" aria-label="Admin menyu">
        {BOTTOM.map((to) => { const i = ITEMS.find((x) => x.to === to)!; return (
          <NavLink key={to} to={to} end={i.end} className={({ isActive }) => (isActive ? "active" : "")}><i.icon size={21} /><span>{i.short}</span></NavLink>
        ); })}
        <button className={menu || !BOTTOM.includes(cur?.to || "") ? "active" : ""} onClick={() => setMenu(true)}><Menu size={21} /><span>Menyu</span></button>
      </nav>

      {menu && createPortal(
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setMenu(false)}>
          <div className="modal admin-sheet" role="dialog" aria-modal="true" aria-label="Admin menyu">
            <div className="modal-head"><div className="row gap-8"><Logo dark size={24} /><b className="small muted">Admin</b></div>
              <button className="icon-btn" onClick={() => setMenu(false)} aria-label="Yopish"><X size={18} /></button></div>
            {groups.map((g) => (
              <div key={g} className="sheet-group">
                <div className="side-label dark">{g}</div>
                <div className="sheet-grid">
                  {ITEMS.filter((i) => i.group === g).map((i) => (
                    <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => "sheet-item" + (isActive ? " active" : "")}><i.icon size={20} /><span>{i.label}</span></NavLink>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn btn-ghost btn-block mt-12" onClick={logout}><LogOut size={16} />Chiqish</button>
          </div>
        </div>, document.body)}
    </div>
  );
}
