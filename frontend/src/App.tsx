import { lazy, ReactNode, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { homeFor, useAuth } from "./auth";
import AppShell from "./components/AppShell";
const AdminShell = lazy(() => import("./components/AdminShell"));
import { Empty, Logo, Spinner } from "./components/ui";
import { NotFound } from "./components/Resilience";
import InstallBanner from "./components/InstallBanner";
import IntroSplash from "./components/IntroSplash";
import InstallFlow, { UpdateBanner } from "./components/InstallFlow";
import { useEffect } from "react";
import { useSite } from "./site";

import Landing from "./pages/public/Landing";
import Login from "./pages/public/Login";
const Register = lazy(() => import("./pages/public/Register"));
const AdminLogin = lazy(() => import("./pages/public/AdminLogin"));
const Terms = lazy(() => import("./pages/public/Terms"));
const FuelPublic = lazy(() => import("./pages/public/FuelPublic"));
const FuelPage = lazy(() => import("./pages/app/FuelPage"));
const AdminFuel = lazy(() => import("./pages/admin/Fuel"));
const Blog = lazy(() => import("./pages/public/Blog"));

import Home from "./pages/app/Home";
const Masters = lazy(() => import("./pages/app/Masters"));
const MasterDetail = lazy(() => import("./pages/app/MasterDetail"));
const Parts = lazy(() => import("./pages/app/Parts"));
const Cars = lazy(() => import("./pages/app/Cars"));
const Safar = lazy(() => import("./pages/app/Safar"));
const Orders = lazy(() => import("./pages/app/Orders"));
const Sos = lazy(() => import("./pages/app/Sos"));
const MapPage = lazy(() => import("./pages/app/MapPage"));
const Chats = lazy(() => import("./pages/app/Chats"));
const Notifications = lazy(() => import("./pages/app/Notifications"));
const Profile = lazy(() => import("./pages/app/Profile"));
const Favorites = lazy(() => import("./pages/app/Favorites"));
const Search = lazy(() => import("./pages/app/Search"));
const ProductDetail = lazy(() => import("./pages/app/ProductDetail"));
const ShopPage = lazy(() => import("./pages/app/ShopPage"));

const UstaHome = lazy(() => import("./pages/usta/UstaHome"));
const UstaOrders = lazy(() => import("./pages/usta/UstaOrders"));
const UstaServices = lazy(() => import("./pages/usta/UstaServices"));
const UstaShop = lazy(() => import("./pages/usta/UstaShop"));
const UstaPremium = lazy(() => import("./pages/usta/UstaPremium"));
const UstaSos = lazy(() => import("./pages/usta/UstaSos"));
const EvakHome = lazy(() => import("./pages/evak/EvakHome"));

const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Users = lazy(() => import("./pages/admin/Users"));
const AdminMasters = lazy(() => import("./pages/admin/Masters"));
const AdminOrders = lazy(() => import("./pages/admin/Orders"));
const Payments = lazy(() => import("./pages/admin/Payments"));
const Shops = lazy(() => import("./pages/admin/Shops"));
const LiveMap = lazy(() => import("./pages/admin/LiveMap"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const AdminBlog = lazy(() => import("./pages/admin/Blog"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));

function RequireAuth({ children, roles, login = "/login" }: { children: ReactNode; roles?: string[]; login?: string }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div style={{ padding: 60 }}><Spinner /></div>;
  if (!user) return <Navigate to={login} state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

/** /app ga kirganda rolga mos bosh sahifa */
function AppIndex() {
  const { user } = useAuth();
  if (user?.role === "usta") return <Navigate to="/app/usta" replace />;
  if (user?.role === "evakuator") return <Navigate to="/app/evak" replace />;
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  return <Home />;
}

function Maintenance() {
  const site = useSite();
  return (
    <div className="auth-page" style={{ display: "grid", placeItems: "center", minHeight: "100%", padding: 24, textAlign: "center" }}>
      <div className="col gap-12" style={{ maxWidth: 420, alignItems: "center", color: "#fff" }}>
        <Logo size={44} />
        <h2 className="mt-12">Texnik ishlar olib borilmoqda</h2>
        <p style={{ color: "#aab5c9" }}>Sayt tez orada qayta ishga tushadi. Noqulaylik uchun uzr so'raymiz.</p>
        {site.support_phone && <a className="btn btn-red mt-8" href={`tel:${site.support_phone.replace(/\s/g, "")}`}>Favqulodda holatda: {site.support_phone}</a>}
      </div>
    </div>
  );
}

/** Telefon status-bar rangi sahifa foniga mos: ichki bo'limlar och, ochiq sahifalar to'q */
function useThemeColor(path: string) {
  useEffect(() => {
    const light = /^\/(app|admin)(\/|$)/.test(path) && !/^\/admin\/login/.test(path);
    const dark = document.documentElement.dataset.theme === "dark";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light && !dark ? "#f3f5f9" : light ? "#0b111c" : "#0a1424");
  }, [path]);
}

export default function App() {
  const site = useSite();
  const { user } = useAuth();
  const loc = useLocation();
  useThemeColor(loc.pathname);
  if (site.maintenance && user?.role !== "admin" && !loc.pathname.startsWith("/admin")) return <Maintenance />;
  return (
    <>
    <IntroSplash />
    <InstallBanner />
    <InstallFlow />
    <UpdateBanner />
    {/* sahifalar kerak bo'lganda yuklanadi — bosh sahifa tezroq ochiladi (ayniqsa mobil internetda) */}
    <Suspense fallback={<div style={{ padding: 60 }}><Spinner /></div>}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:id" element={<Blog />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/yoqilgi" element={<FuelPublic />} />

      <Route path="/app" element={<RequireAuth roles={["user", "usta", "evakuator"]}><AppShell /></RequireAuth>}>
        <Route index element={<AppIndex />} />
        <Route path="masters" element={<Masters />} />
        <Route path="masters/:id" element={<MasterDetail />} />
        <Route path="parts" element={<Parts />} />
        <Route path="parts/:id" element={<ProductDetail />} />
        <Route path="shops/:id" element={<ShopPage />} />
        <Route path="search" element={<Search />} />
        <Route path="fuel" element={<FuelPage />} />
        <Route path="cars" element={<Cars />} />
        <Route path="safar" element={<Safar />} />
        <Route path="orders" element={<Orders />} />
        <Route path="sos" element={<Sos />} />
        <Route path="map" element={<MapPage />} />
        <Route path="chat" element={<Chats />} />
        <Route path="chat/:id" element={<Chats />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route path="favorites" element={<Favorites />} />
        <Route path="usta" element={<RequireAuth roles={["usta"]}><UstaHome /></RequireAuth>} />
        <Route path="usta/orders" element={<RequireAuth roles={["usta"]}><UstaOrders /></RequireAuth>} />
        <Route path="usta/services" element={<RequireAuth roles={["usta"]}><UstaServices /></RequireAuth>} />
        <Route path="usta/shop" element={<RequireAuth roles={["usta"]}><UstaShop /></RequireAuth>} />
        <Route path="usta/premium" element={<RequireAuth roles={["usta"]}><UstaPremium /></RequireAuth>} />
        <Route path="usta/sos" element={<RequireAuth roles={["usta"]}><UstaSos /></RequireAuth>} />
        <Route path="evak" element={<RequireAuth roles={["evakuator"]}><EvakHome /></RequireAuth>} />
        <Route path="*" element={<Empty title="Sahifa topilmadi" text="Havola noto'g'ri yoki sahifa o'chirilgan." />} />
      </Route>

      <Route path="/admin" element={<RequireAuth roles={["admin"]} login="/admin/login"><AdminShell /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="masters" element={<AdminMasters />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="payments" element={<Payments />} />
        <Route path="shops" element={<Shops />} />
        <Route path="map" element={<LiveMap />} />
        <Route path="fuel" element={<AdminFuel />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="blog" element={<AdminBlog />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    </>
  );
}
