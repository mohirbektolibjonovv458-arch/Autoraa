import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, MessageCircle, Phone, Store } from "lucide-react";
import { api, media } from "../../api";
import { CartButton, useCart } from "../../components/cart";
import { ProductCard } from "../../components/Cards";
import { Empty, Spinner } from "../../components/ui";

export default function ShopPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { add } = useCart();
  const [d, setD] = useState<any>(undefined);
  const [q, setQ] = useState("");
  useEffect(() => { api.get(`/shops/${id}/`).then((r) => setD(r.data)).catch(() => setD(null)); }, [id]);
  if (d === undefined) return <Spinner />;
  if (d === null) return <Empty title="Do'kon topilmadi yoki yopiq" action={<Link to="/app/parts" className="btn">Ehtiyot qismlar</Link>} />;
  const s = d.shop;
  const chat = async () => { const r = await api.post("/chat/start/", { user_id: d.owner_id }); nav(`/app/chat/${r.data.id}`); };
  const list = d.products.filter((p: any) => !q || (p.name + p.brand + p.compatible).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="col gap-16">
      <div className="page-head"><button className="icon-btn" onClick={() => nav(-1)} aria-label="Orqaga"><ArrowLeft size={18} /></button><div className="grow" /><CartButton /></div>
      <div className="card row gap-16" style={{ alignItems: "flex-start" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--blue-soft)", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>{s.logo ? <img src={media(s.logo)} alt="" /> : <Store size={28} color="var(--blue)" />}</div>
        <div className="grow col gap-4">
          <h2 style={{ fontSize: 21 }}>{s.name}</h2>
          {s.address && <div className="small muted row gap-4"><MapPin size={14} />{s.address}</div>}
          {s.description && <p className="small">{s.description}</p>}
          <div className="row gap-8 mt-8 wrap">
            <button className="btn btn-sm" onClick={chat}><MessageCircle size={15} />Yozish</button>
            {s.phone && <a className="btn btn-sm btn-ghost" href={`tel:${s.phone}`}><Phone size={15} />{s.phone}</a>}
          </div>
        </div>
      </div>
      <input className="input" placeholder={`${d.products.length} ta mahsulot ichidan qidirish…`} value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 ? <Empty title="Mahsulot topilmadi" /> : <div className="grid g2 stack-sm">{list.map((p: any) => <ProductCard key={p.id} p={p} onAdd={(pp) => add(pp)} />)}</div>}
    </div>
  );
}
