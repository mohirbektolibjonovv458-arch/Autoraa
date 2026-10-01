import { Link, Navigate } from "react-router-dom";
import { useSite } from "../../site";
import { homeFor, useAuth } from "../../auth";
import { CarArt, Logo, Mountains } from "../../components/ui";
import InstallButton from "../../components/InstallButton";
import { quickInstall } from "../../components/InstallFlow";
import { canPrompt, isMobile, isNarrow, isStandalone, markedInstalled, onPwaChange } from "../../pwa";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import LangSwitch from "../../components/LangSwitch";

export default function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-page" />;          // sessiya tekshirilmoqda — landing miltillab ko'rinmasin
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  const site = useSite();

  return (
    <div className="landing lp-simple">
      <section className="landing-hero lp">
        <Mountains className="mountains" />
        <nav className="pub-nav">
          <Logo />
          <div className="grow" />
          <InstallButton className="btn btn-sm lp-login desktop-only" label="O'rnatish" />
          <LangSwitch />
          {user && <Link to={homeFor(user.role)} className="btn btn-light btn-sm">Kabinet</Link>}
        </nav>

        <div className="inner lp-inner">
          <h1>{site.tagline}</h1>
          <p className="lead">Usta, evakuator, ehtiyot qismlar va yoqilg'i xaritasi — bitta ilovada.</p>
          {user ? (
            <div className="lp-cta"><Link to={homeFor(user.role)} className="btn btn-red btn-lg">Kabinetga o'tish</Link></div>
          ) : (
            <div className="lp-cta">
              <Link to="/register" className="btn btn-red btn-lg">Ro'yxatdan o'tish</Link>
              <Link to="/login" className="btn btn-lg lp-ghost">Kirish</Link>
            </div>
          )}
          <EntryInstall />
          <Link to="/yoqilgi" className="lp-link">⛽ Yoqilg'i xaritasini kirmasdan ko'rish →</Link>
        </div>
        <CarArt className="hero-car lp-car" />
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} {site.site_name}</span>
        <span className="row gap-16 wrap">
          {site.support_phone && <a href={`tel:${site.support_phone.replace(/\s/g, "")}`}>📞 {site.support_phone}</a>}
          <Link to="/terms">Shartlar</Link>
        </span>
      </footer>
    </div>
  );
}

/** Telefonda birinchi ekranda doim ko'rinadigan «Ilovani o'rnatish» (o'rnatilgan bo'lsa ko'rinmaydi) */
function EntryInstall() {
  const [, force] = useState(0);
  useEffect(() => onPwaChange(() => force((x) => x + 1)), []);
  if (isStandalone() || markedInstalled() || (!isMobile() && !isNarrow() && !canPrompt())) return null;
  return <button className="btn btn-lg lp-install" onClick={quickInstall}><Download size={18} />Ilovani o'rnatish</button>;
}
