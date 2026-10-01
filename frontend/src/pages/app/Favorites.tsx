import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { api } from "../../api";
import { MasterCard } from "../../components/Cards";
import MastersTabs from "../../components/MastersTabs";
import { Empty, Spinner } from "../../components/ui";

export default function Favorites() {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { api.get("/masters/favorites/").then((r) => setItems(r.data)); }, []);
  return (
    <div className="col gap-16">
      <div className="page-head"><h2 className="page-title">Usta topish</h2><MastersTabs /></div>
      {!items ? <Spinner /> : items.length === 0 ? <Empty icon={<Heart size={40} />} title="Sevimli ustalar yo'q" text="Usta profilidagi ♥ belgisini bosing." action={<Link to="/app/masters" className="btn">Usta topish</Link>} /> :
        <div className="grid g2 stack-sm">{items.map((m) => <MasterCard key={m.id} m={m} />)}</div>}
    </div>
  );
}
