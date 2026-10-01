import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Lock, Package, Pencil, Plus, ShoppingBag, Store, Trash2, Wallet } from "lucide-react";
import { api, errMsg, media } from "../../api";
import ImagePicker from "../../components/ImagePicker";
import { Empty, Modal, Spinner, StatusBadge, useToast } from "../../components/ui";
import { money, shortDate } from "../../utils";

const OSTAT: [string, string][] = [["new", "Yangi"], ["confirmed", "Tasdiqlangan"], ["shipped", "Yetkazilmoqda"], ["delivered", "Yetkazildi"], ["cancelled", "Bekor qilindi"]];

export default function UstaShop() {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"products" | "orders" | "settings">(() => (new URLSearchParams(window.location.search).get("tab") === "orders" ? "orders" : "products"));
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [cats, setCats] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);

  const load = () => {
    api.get("/shop/me/").then((r) => setData(r.data));
    api.get("/shop/me/products/").then((r) => setProducts(r.data));
    api.get("/shop/me/orders/").then((r) => setOrders(r.data));
    api.get("/shop/me/stats/").then((r) => setStats(r.data));
  };
  useEffect(() => { load(); api.get("/parts/categories/").then((r) => setCats(r.data)); }, []);
  if (!data) return <Spinner />;

  if (!data.is_premium) return (
    <div className="col gap-16" style={{ maxWidth: 640 }}>
      <div className="premium-card" style={{ textAlign: "center" }}>
        <Lock size={40} color="#f5c04a" />
        <h2 className="mt-12">Zapchast do'koni yopiq</h2>
        <p className="small mt-8" style={{ color: "#aab5c9" }}>Ehtiyot qismlar do'konini ochish uchun Premium obuna kerak — oyiga atigi 40 000 so'm. To'lovni admin tasdiqlagach, do'koningiz avtomatik ochiladi.</p>
        {data.shop && <p className="xs mt-8" style={{ color: "#aab5c9" }}>Do'koningiz «{data.shop.name}» saqlangan — obunani yangilasangiz mahsulotlar yana ko'rinadi.</p>}
        <Link to="/app/usta/premium" className="btn btn-lg mt-16" style={{ background: "#f5a623" }}><Crown size={18} />Premium olish</Link>
      </div>
    </div>
  );

  const shop = data.shop || { name: "", description: "", address: "", phone: "" };
  const del = async (p: any) => { if (!confirm(`«${p.name}» o'chirilsinmi?`)) return; await api.delete(`/shop/me/products/${p.id}/`); load(); };
  const setStatus = async (o: any, status: string) => { try { await api.post(`/shop/me/orders/${o.id}/status/`, { status }); load(); toast("Mijozga xabar yuborildi", "success"); } catch (e) { toast(errMsg(e), "error"); } };

  return (
    <div className="col gap-16">
      <div className="page-head">
        <div style={{ marginRight: "auto" }}><h2 className="page-title row gap-8"><Store size={22} />{shop.name || "Mening do'konim"}</h2><div className="xs muted">Premium: {shortDate(data.premium_until)} gacha{data.shop && <> · <Link to={`/app/shops/${data.shop.id}`} className="link">Mijozlar ko'rinishi →</Link></>}</div></div>
        <button className="btn" onClick={() => setEdit({ name: "", brand: "", sku: "", category: "boshqa", compatible: "", condition: "new", price: "", old_price: "", stock: 1, description: "", is_active: true })}><Plus size={16} />Mahsulot</button>
      </div>
      {stats && (
        <div className="grid g4">
          <div className="stat"><div className="ico"><Package size={18} /></div><div className="label mt-8">Mahsulotlar</div><div className="value">{stats.products}</div></div>
          <div className="stat"><div className="ico"><ShoppingBag size={18} /></div><div className="label mt-8">Buyurtmalar</div><div className="value">{stats.orders}</div></div>
          <div className="stat"><div className="ico" style={{ background: "var(--amber-soft)", color: "#b37400" }}><ShoppingBag size={18} /></div><div className="label mt-8">Yangi</div><div className="value">{stats.new_orders}</div></div>
          <div className="stat"><div className="ico" style={{ background: "var(--green-soft)", color: "var(--green)" }}><Wallet size={18} /></div><div className="label mt-8">Savdo</div><div className="value" style={{ fontSize: 19 }}>{money(stats.revenue)}</div></div>
        </div>
      )}
      <div className="tabs" style={{ alignSelf: "flex-start" }}>
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>Mahsulotlar</button>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>Buyurtmalar {stats?.new_orders > 0 && `(${stats.new_orders})`}</button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Do'kon sozlamalari</button>
      </div>

      {tab === "products" && (products.length === 0 ? <Empty title="Mahsulot yo'q" text="Birinchi mahsulotingizni qo'shing." /> : (
        <>
        <div className="m-cards">{products.map((p) => (
          <div key={p.id} className="card card-tight row gap-12">
            <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", background: "#f1f4f9", display: "grid", placeItems: "center", flexShrink: 0 }}>{p.image ? <img src={media(p.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Package size={20} />}</div>
            <div className="grow"><b className="small" translate="no">{p.name}</b><div className="xs muted">{money(p.price)} · qoldiq <b style={{ color: p.stock < 3 ? "var(--red)" : undefined }}>{p.stock}</b> · sotildi {p.sold}</div>{!p.is_active && <span className="badge">Yashirin</span>}</div>
            <button className="icon-btn" onClick={() => setEdit(p)} aria-label="Tahrirlash"><Pencil size={14} /></button>
          </div>
        ))}</div>
        <div className="card card-tight table-wrap d-table">
          <table className="table"><thead><tr><th></th><th>Nomi</th><th>Kategoriya</th><th>Narx</th><th>Qoldiq</th><th>Sotildi</th><th>Holat</th><th></th></tr></thead>
            <tbody>{products.map((p) => (
              <tr key={p.id}>
                <td><div className="pimg" style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", background: "#f1f4f9", display: "grid", placeItems: "center" }}>{p.image ? <img src={media(p.image)} alt="" /> : <Package size={18} />}</div></td>
                <td><b className="small">{p.name}</b><div className="xs muted">{p.brand} {p.compatible && `· ${p.compatible}`}</div></td>
                <td className="small">{p.category_label}</td><td className="small bold">{money(p.price)}</td>
                <td className="small" style={{ color: p.stock < 3 ? "var(--red)" : undefined }}>{p.stock}</td><td className="small">{p.sold}</td>
                <td>{p.is_active ? <span className="badge green">Faol</span> : <span className="badge">Yashirin</span>}</td>
                <td><div className="row gap-4"><button className="icon-btn" onClick={() => setEdit(p)} aria-label="Tahrirlash"><Pencil size={14} /></button><button className="icon-btn" onClick={() => del(p)} aria-label="O'chirish"><Trash2 size={14} /></button></div></td>
              </tr>
            ))}</tbody></table>
        </div>
        </>
      ))}

      {tab === "orders" && (orders.length === 0 ? <Empty title="Buyurtmalar yo'q" /> : orders.map((o) => (
        <div key={o.id} className="order-card col gap-8">
          <div className="row between"><span className="xs muted bold">#AP{100000 + o.id} · {shortDate(o.created_at)}</span><StatusBadge status={o.status} label={o.status_label} /></div>
          <div className="row between wrap"><div><b>{o.product_name} × {o.quantity}</b><div className="small muted">{o.client.full_name} · <a href={`tel:${o.phone}`}>{o.phone}</a></div><div className="small">📍 {o.address}</div></div><b>{money(o.total)}</b></div>
          {!["delivered", "cancelled"].includes(o.status) && (
            <select className="select" style={{ maxWidth: 240 }} value={o.status} onChange={(e) => setStatus(o, e.target.value)}>{OSTAT.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          )}
        </div>
      )))}

      {tab === "settings" && <ShopSettings shop={shop} onSaved={load} />}
      {edit && <ProductModal p={edit} cats={cats} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); toast("Saqlandi", "success"); }} />}
    </div>
  );
}

function ShopSettings({ shop, onSaved }: { shop: any; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: shop.name, description: shop.description, address: shop.address, phone: shop.phone });
  const [logo, setLogo] = useState<File | null>(null);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v || "")); if (logo) fd.append("logo", logo);
    try { await api.patch("/shop/me/", fd); toast("Saqlandi", "success"); onSaved(); } catch (e) { toast(errMsg(e), "error"); }
  };
  return (
    <div className="card col gap-12" style={{ maxWidth: 640 }}>
      <label className="field"><span>Do'kon nomi</span><input className="input" value={f.name} onChange={set("name")} /></label>
      <label className="field"><span>Tavsif</span><textarea className="textarea" value={f.description} onChange={set("description")} /></label>
      <div className="grid g2 stack-sm">
        <label className="field"><span>Manzil</span><input className="input" value={f.address} onChange={set("address")} /></label>
        <label className="field"><span>Telefon</span><input className="input" value={f.phone} onChange={set("phone")} /></label>
      </div>
      <ImagePicker label="Logo" file={logo} onFile={setLogo} current={shop?.logo} aspect="3 / 1" />
      <button className="btn" onClick={save}>Saqlash</button>
    </div>
  );
}

function ProductModal({ p, cats, onClose, onSaved }: { p: any; cats: any[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ ...p, old_price: p.old_price ?? "" });
  const [img, setImg] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async () => {
    const fd = new FormData();
    ["name", "brand", "sku", "category", "compatible", "condition", "price", "stock", "description"].forEach((k) => fd.append(k, f[k] ?? ""));
    if (f.old_price !== "" && f.old_price != null) fd.append("old_price", f.old_price);
    fd.append("is_active", f.is_active ? "true" : "false");
    if (img) fd.append("image", img);
    try { p.id ? await api.patch(`/shop/me/products/${p.id}/`, fd) : await api.post("/shop/me/products/", fd); onSaved(); } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <Modal title={p.id ? "Mahsulotni tahrirlash" : "Yangi mahsulot"} onClose={onClose}>
      <div className="col gap-12">
        <label className="field"><span>Nomi</span><input className="input" value={f.name} onChange={set("name")} placeholder="Moy filtri (MANN)" /></label>
        <div className="grid g2">
          <label className="field"><span>Brend</span><input className="input" value={f.brand} onChange={set("brand")} /></label>
          <label className="field"><span>Artikul</span><input className="input" value={f.sku} onChange={set("sku")} /></label>
          <label className="field"><span>Kategoriya</span><select className="select" value={f.category} onChange={set("category")}>{cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
          <label className="field"><span>Holati</span><select className="select" value={f.condition} onChange={set("condition")}><option value="new">Yangi</option><option value="used">Ishlatilgan</option></select></label>
          <label className="field"><span>Narx (so'm)</span><input className="input" type="number" value={f.price} onChange={set("price")} /></label>
          <label className="field"><span>Eski narx (chegirma)</span><input className="input" type="number" value={f.old_price} onChange={set("old_price")} /></label>
          <label className="field"><span>Omborda (dona)</span><input className="input" type="number" value={f.stock} onChange={set("stock")} /></label>
          <label className="field"><span>Mos avtomobillar</span><input className="input" value={f.compatible} onChange={set("compatible")} placeholder="Cobalt, Gentra" /></label>
        </div>
        <label className="field"><span>Tavsif</span><textarea className="textarea" value={f.description} onChange={set("description")} /></label>
        <ImagePicker label="Mahsulot rasmi" file={img} onFile={setImg} current={p?.image} aspect="1 / 1" hint="Mahsulot aniq ko'rinsin — yorug' joyda, oq fonda" />
        <label className="row gap-8 small"><input type="checkbox" checked={f.is_active} onChange={set("is_active")} />Sotuvda ko'rsatish</label>
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-block" disabled={!f.name || !f.price} onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}
