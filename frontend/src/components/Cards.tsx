import { Link, useNavigate } from "react-router-dom";
import { Clock, MapPin, Package, ShoppingCart } from "lucide-react";
import { Avatar, Stars, Verified } from "./ui";
import { money, SPECIALTIES } from "../utils";
import { media } from "../api";

export function MasterCard({ m }: { m: any }) {
  const nav = useNavigate();
  return (
    <div className="master-card">
      <div className="row-top">
        <Avatar name={m.name} src={m.cover || m.user.avatar} className="photo sq" />
        <div className="grow">
          <div className="row gap-8 wrap"><b className="ellipsis" translate="no">{m.name}</b>{m.is_verified && <Verified />}{m.user.is_premium && <span className="badge amber" style={{ padding: "1px 7px" }}>★ Premium</span>}</div>
          <div className="row gap-12 mt-4 wrap">
            <Stars value={m.rating} count={m.reviews_count} />
            {m.distance_km != null && <span className="small muted row gap-4"><MapPin size={13} />{m.distance_km} km</span>}
          </div>
          <div className="small muted mt-4 ellipsis">{(m.specialties || []).map((s: string) => SPECIALTIES[s] || s).join(" · ")}</div>
          <div className="row gap-12 mt-4 xs muted wrap">
            <span className="row gap-4"><Clock size={12} />{m.experience_years} yillik tajriba</span>
            {m.open_now === true ? <span className="open-badge on" style={{ marginTop: 0 }}>Hozir ochiq</span> : m.open_now === false ? <span className="open-badge off" style={{ marginTop: 0 }}>Yopiq · {m.work_hours}</span> : null}
            {m.user.is_online ? <span className="row gap-4" style={{ color: "var(--green)" }}><span className="online-dot" />Hozir online</span> : <span>Offline</span>}
          </div>
        </div>
      </div>
      {m.min_price != null && <div className="small"><b>{money(m.min_price)}</b><span className="muted">dan</span></div>}
      <div className="grid g2" style={{ gap: 8 }}>
        <Link to={`/app/masters/${m.id}`} className="btn btn-ghost btn-sm">Profilni ko'rish</Link>
        <button className="btn btn-sm" onClick={() => nav(`/app/masters/${m.id}?book=1`)}>Bron qilish</button>
      </div>
    </div>
  );
}

export function ProductCard({ p, onAdd }: { p: any; onAdd?: (p: any) => void }) {
  return (
    <div className="product">
      <Link to={`/app/parts/${p.id}`} className="pimg" aria-label={p.name}>{p.image ? <img src={media(p.image)} alt="" loading="lazy" decoding="async" /> : <Package size={34} />}</Link>
      <div className="grow">
        <Link to={`/app/parts/${p.id}`} className="small bold" style={{ display: "block" }} translate="no">{p.name}</Link>
        <div className="xs muted ellipsis">{p.compatible || p.brand}</div>
        <div className="row gap-8 mt-4"><b>{money(p.price)}</b>{p.old_price > p.price && <s className="xs muted">{money(p.old_price)}</s>}</div>
        <div className="row gap-8 xs mt-4 wrap">
          {p.reviews > 0 && <Stars value={p.rating} count={p.reviews} />}{p.sold > 0 && <span className="muted">{p.sold} ta sotilgan</span>}
          <span style={{ color: p.stock > 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{p.stock > 0 ? `Mavjud: ${p.stock} dona` : "Tugagan"}</span>
        </div>
        <div className="xs muted">{p.shop_name}</div>
      </div>
      {onAdd && <button className="cart-btn" disabled={p.stock < 1} onClick={() => onAdd(p)} aria-label="Savatga qo'shish"><ShoppingCart size={16} /></button>}
    </div>
  );
}
