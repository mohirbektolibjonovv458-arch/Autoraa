import { Component, ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, WifiOff } from "lucide-react";
import { Logo } from "./ui";

/** Kutilmagan frontend xatosida butun sahifa oq bo'lib qolmasligi uchun */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("UI xatosi:", error); }
  render() {
    if (!this.state.error) return this.props.children;
    const chunk = /Loading chunk|dynamically imported module|Failed to fetch/i.test(this.state.error.message);
    return (
      <div className="fullscreen-msg">
        <Logo dark size={40} />
        <h2 className="mt-16">{chunk ? "Ilova yangilandi" : "Nimadir noto'g'ri ketdi"}</h2>
        <p className="muted mt-8">{chunk ? "Yangi versiyani yuklash uchun sahifani yangilang." : "Sahifani yangilab ko'ring. Muammo takrorlansa, qo'llab-quvvatlash xizmatiga yozing."}</p>
        <div className="row gap-8 mt-16" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={() => window.location.reload()}><RefreshCw size={16} />Yangilash</button>
          <a className="btn btn-ghost" href="/">Bosh sahifa</a>
        </div>
      </div>
    );
  }
}

/** Internet yo'qligi yoki server xatosi haqida ilova yuqorisida ogohlantirish */
export function NetworkBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [serverErr, setServerErr] = useState(false);
  useEffect(() => {
    const on = () => { setOffline(false); setServerErr(false); };
    const off = () => setOffline(true);
    let t: any;
    const err = () => { if (navigator.onLine) { setServerErr(true); clearTimeout(t); t = setTimeout(() => setServerErr(false), 15000); } };
    window.addEventListener("online", on); window.addEventListener("offline", off); window.addEventListener("ah-net-error", err);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener("ah-net-error", err); clearTimeout(t); };
  }, []);
  if (!offline && !serverErr) return null;
  return (
    <div className="net-banner" role="status">
      <WifiOff size={16} />
      <span className="grow">{offline ? "Internet aloqasi yo'q. Ulanish tiklanganda ma'lumotlar yangilanadi." : "Server bilan aloqa uzildi. Ma'lumotlar to'liq yuklanmagan bo'lishi mumkin."}</span>
      {!offline && <button onClick={() => window.location.reload()}>Qayta yuklash</button>}
    </div>
  );
}

export function NotFound() {
  return (
    <div className="fullscreen-msg">
      <Logo dark size={40} />
      <h1 className="mt-16" style={{ fontSize: 56 }}>404</h1>
      <p className="muted">Bunday sahifa topilmadi yoki o'chirilgan.</p>
      <Link to="/" className="btn mt-16">Bosh sahifaga qaytish</Link>
    </div>
  );
}
