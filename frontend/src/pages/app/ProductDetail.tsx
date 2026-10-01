import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, Minus, Package, Plus, ShieldCheck, Store, Truck } from "lucide-react";
import { api, media } from "../../api";
import { useAuth } from "../../auth";
import { CartButton, useCart } from "../../components/cart";
import { ProductCard } from "../../components/Cards";
import { Empty, Spinner, Stars } from "../../components/ui";
import { money } from "../../utils";

export default function ProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { add } = useCart();
  const [p, setP] = useState<any>(undefined);
  const [similar, setSimilar] = useState<any[]>([]);
  const [qty, setQty] = useState(1);
  useEffect(() => {
    setP(undefined); setQty(1);
    api.get(`/parts/${id}/`).then((r) => {
      setP(r.data);
      api.get("/parts/", { params: { category: r.data.category } }).then((x) => setSimilar(x.data.filter((i: any) => i.id !== r.data.id).slice(0, 4)));
    }).catch(() => setP(null));
  }, [id]);
  if (p === undefined) return <Spinner />;
  if (p === null) return <Empty title="Mahsulot topilmadi" text="Sotuvdan olingan bo'lishi mumkin." action={<Link to="/app/parts" className="btn">Do'konga qaytish</Link>} />;
  const chat = async () => { const r = await api.post("/chat/start/", { user_id: p.shop_owner_id }); nav(`/app/chat/${r.data.id}`); };
  const own = user?.id === p.shop_owner_id;

  return (
    <div className="col gap-16" style={{ maxWidth: 960 }}>
      <div className="page-head"><button className="icon-btn" onClick={() => nav(-1)} aria-label="Orqaga"><ArrowLeft size={18} /></button><div className="grow" /><CartButton /></div>
      <div className="grid g2 stack-sm" style={{ alignItems: "start" }}>
        <div className="card" style={{ aspectRatio: "1", display: "grid", placeItems: "center", padding: 10 }}>
          {p.image ? <img src={media(p.image)} alt={p.name} style={{ maxHeight: "100%", objectFit: "contain", borderRadius: 12 }} /> : <Package size={80} color="#b8c2d0" />}
        </div>
        <div className="col gap-12">
          <div className="row gap-8 wrap"><span className="badge blue">{p.category_label}</span><span className="badge">{p.condition === "new" ? "Yangi" : "Ishlatilgan"}</span>{p.brand && <span className="badge">{p.brand}</span>}</div>
          <h2 style={{ fontSize: 24 }} translate="no">{p.name}</h2>
          <div className="row gap-12 wrap">{p.reviews > 0 && <Stars value={p.rating} count={p.reviews} />}{p.sold > 0 && <span className="small muted">{p.sold} ta sotilgan</span>}{p.sku && <span className="small muted">Artikul: {p.sku}</span>}</div>
          <div className="row gap-12"><b style={{ fontSize: 28 }}>{money(p.price)}</b>{p.old_price > p.price && <s className="muted">{money(p.old_price)}</s>}</div>
          {p.compatible && <div className="alert" style={{ padding: "10px 12px" }}>🚗 Mos keladi: <b>{p.compatible}</b></div>}
          <div className="small" style={{ color: p.stock > 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{p.stock > 0 ? `Omborda: ${p.stock} dona` : "Hozircha tugagan"}</div>
          {!own && p.stock > 0 && (
            <div className="row gap-8">
              <div className="row gap-4" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 4, background: "#fff" }}>
                <button className="icon-btn" style={{ border: 0, width: 34, height: 34 }} onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Kamaytirish"><Minus size={14} /></button>
                <b style={{ minWidth: 24, textAlign: "center" }}>{qty}</b>
                <button className="icon-btn" style={{ border: 0, width: 34, height: 34 }} onClick={() => setQty(Math.min(p.stock, qty + 1))} aria-label="Ko'paytirish"><Plus size={14} /></button>
              </div>
              <button className="btn btn-lg grow" onClick={() => add(p, qty)}>Savatga qo'shish</button>
            </div>
          )}
          <div className="card card-tight col gap-8">
            <Link to={`/app/shops/${p.shop}`} className="row gap-8"><span className="ico" style={{ width: 36, height: 36, borderRadius: 10, background: "var(--blue-soft)", color: "var(--blue)", display: "grid", placeItems: "center" }}><Store size={17} /></span><div className="grow"><b className="small">{p.shop_name}</b><div className="xs muted">Do'kon sahifasi →</div></div></Link>
            {!own && <button className="btn btn-sm btn-ghost" onClick={chat}><MessageCircle size={15} />Sotuvchiga savol berish</button>}
          </div>
          <div className="row gap-16 xs muted wrap"><span className="row gap-4"><Truck size={14} />Yetkazib berish sotuvchi bilan kelishiladi</span><span className="row gap-4"><ShieldCheck size={14} />To'lov qabul qilganda</span></div>
        </div>
      </div>
      {p.description && <div className="card"><h3 style={{ fontSize: 16 }}>Tavsif</h3><p className="small mt-8" style={{ whiteSpace: "pre-line" }}>{p.description}</p></div>}
      {similar.length > 0 && <><div className="section-head" style={{ margin: 0 }}><h3>O'xshash mahsulotlar</h3></div><div className="grid g2 stack-sm">{similar.map((x) => <ProductCard key={x.id} p={x} onAdd={(pp) => add(pp)} />)}</div></>}
    </div>
  );
}
