import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../../api";
import { CartButton, useCart } from "../../components/cart";
import { ProductCard } from "../../components/Cards";
import { CarArt, Empty, Spinner } from "../../components/ui";

export default function Parts() {
  const [cats, setCats] = useState<any[]>([]);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("");
  const [inStock, setInStock] = useState(false);
  const [car, setCar] = useState<any>(null);
  const [onlyCar, setOnlyCar] = useState(false);
  const [items, setItems] = useState<any[] | null>(null);
  const { add } = useCart();

  useEffect(() => { api.get("/parts/categories/").then((r) => setCats(r.data)); api.get("/garage/vehicles/").then((r) => setCar(r.data.find((v: any) => v.is_primary) || r.data[0] || null)); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/parts/", { params: { q: q || undefined, category: cat || undefined, sort: sort || undefined, in_stock: inStock ? 1 : undefined, car: onlyCar && car ? car.model || car.brand : undefined } })
        .then((r) => setItems(r.data));
    }, 250);
    return () => clearTimeout(t);
  }, [q, cat, sort, inStock, onlyCar, car?.id]);

  return (
    <div className="col gap-16">
      <div className="page-head">
        <h2 className="page-title">Ehtiyot qismlar</h2>
        <CartButton />
      </div>

      <div className="hero-app" style={{ minHeight: 120, padding: 20 }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <b style={{ fontSize: 18 }}>{car ? [car.brand, car.model, car.year].filter(Boolean).join(" ") : "Avtomobilingizga mos qismlar"}</b>
          <div className="small" style={{ color: "#aab5c9" }}>{car ? "Mos qismlarni ko'rsatish uchun belgilang" : "Garajga avtomobil qo'shing"}</div>
          {car && <label className="row gap-8 small mt-8" style={{ cursor: "pointer" }}><input type="checkbox" checked={onlyCar} onChange={(e) => setOnlyCar(e.target.checked)} /> Faqat mos qismlar</label>}
        </div>
        <CarArt className="car-art" light />
      </div>

      <div className="filter-bar">
        <div className="search"><Search size={18} /><input className="input" placeholder="Qism nomi, brend yoki artikul…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select" aria-label="Saralash" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="">Yangilari</option><option value="price">Arzonroq</option><option value="-price">Qimmatroq</option><option value="popular">Ommabop</option><option value="rating">Reyting</option>
        </select>
        <label className="chip" style={{ cursor: "pointer", justifyContent: "center" }}><input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />Faqat mavjud</label>
      </div>

      <div className="chips">
        <button className={"chip" + (!cat ? " active" : "")} onClick={() => setCat("")}>Barchasi</button>
        {cats.map((c) => <button key={c.key} className={"chip" + (cat === c.key ? " active" : "")} onClick={() => setCat(c.key)}>{c.label}</button>)}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? <Empty title="Mahsulot topilmadi" text="Qidiruv shartlarini o'zgartirib ko'ring." /> : (
        <div className="grid g2 stack-sm">{items.map((p) => <ProductCard key={p.id} p={p} onAdd={add} />)}</div>
      )}

    </div>
  );
}

