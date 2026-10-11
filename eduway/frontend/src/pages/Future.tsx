import { Link } from "react-router-dom";
import { ArrowRight, Bookmark, Compass, GitCompare, GraduationCap, Heart, Trophy } from "lucide-react";
import { PageHeader } from "../components/ui";

export default function Future() {
  return (
    <>
      <PageHeader title="Kelajak" subtitle="Kasb, universitet va grantlar — bosqichma-bosqich" />
      <Link to="/career" className="relative block overflow-hidden rounded-3xl gradient-hero p-6 text-white shadow-lift animate-fade-up">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-fuchsia-400/30 blur-2xl" />
        <Compass className="h-9 w-9" />
        <h2 className="mt-4 text-2xl font-extrabold">1. Kasbingizni toping</h2>
        <p className="mt-1 max-w-md text-white/80">Interaktiv test qiziqish va kuchli tomonlaringiz asosida mos yo'nalishlarni ko'rsatadi.</p>
        <span className="mt-4 inline-flex items-center gap-1 font-semibold">Boshlash <ArrowRight className="h-4 w-4" /></span>
      </Link>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Link to="/universities" className="card p-5 hover:shadow-lift animate-fade-up [animation-delay:.05s]">
          <GraduationCap className="h-7 w-7 text-brand" />
          <h3 className="mt-3 text-lg font-bold">2. Universitet tanlang</h3>
          <p className="text-sm text-sub">O'zbekiston va xorijiy OTMlar, yo'nalishlar, talablar</p>
        </Link>
        <Link to="/grants" className="card p-5 hover:shadow-lift animate-fade-up [animation-delay:.1s]">
          <Trophy className="h-7 w-7 text-amber-500" />
          <h3 className="mt-3 text-lg font-bold">3. Grantga tayyorlaning</h3>
          <p className="text-sm text-sub">Mos grantlar, hujjatlar checklisti va muddatlar</p>
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Link to="/universities?favorites=1" className="card flex flex-col items-center gap-2 p-4 text-center text-sm font-semibold hover:shadow-lift"><Heart className="h-5 w-5 text-bad" /> Sevimlilar</Link>
        <Link to="/universities/compare" className="card flex flex-col items-center gap-2 p-4 text-center text-sm font-semibold hover:shadow-lift"><GitCompare className="h-5 w-5 text-brand" /> Solishtirish</Link>
        <Link to="/grants/saved" className="card flex flex-col items-center gap-2 p-4 text-center text-sm font-semibold hover:shadow-lift"><Bookmark className="h-5 w-5 text-amber-500" /> Grantlarim</Link>
      </div>
    </>
  );
}
