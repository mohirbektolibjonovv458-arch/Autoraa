import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import { Empty, Modal, useToast } from "./ui";
import { money } from "../utils";

export type CartItem = { p: any; qty: number };
const KEY = "ah_cart";
const read = (): CartItem[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const write = (c: CartItem[]) => { localStorage.setItem(KEY, JSON.stringify(c)); window.dispatchEvent(new Event("ah-cart")); };

/** Savat — barcha sahifalarda bir xil (localStorage + hodisa orqali sinxron) */
export function useCart() {
  const toast = useToast();
  const [cart, setCartState] = useState<CartItem[]>(read);
  useEffect(() => {
    const on = () => setCartState(read());
    window.addEventListener("ah-cart", on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener("ah-cart", on); window.removeEventListener("storage", on); };
  }, []);
  const setCart = (f: CartItem[] | ((c: CartItem[]) => CartItem[])) => write(typeof f === "function" ? (f as any)(read()) : f);
  const add = (p: any, qty = 1) => {
    setCart((c) => {
      const ex = c.find((i) => i.p.id === p.id);
      if (ex) return c.map((i) => (i.p.id === p.id ? { ...i, qty: Math.min(p.stock, i.qty + qty) } : i));
      return [...c, { p, qty: Math.min(p.stock, qty) }];
    });
    toast(`«${p.name}» savatga qo'shildi`, "success");
  };
  const count = cart.reduce((s, i) => s + i.qty, 0);
  return { cart, setCart, add, count };
}

export function CartButton() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)}><ShoppingCart size={18} />Savat{count > 0 && <span className="badge red">{count}</span>}</button>
      {open && <CartModal onClose={() => setOpen(false)} />}
    </>
  );
}

function CartModal({ onClose }: { onClose: () => void }) {
  const { cart, setCart } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const [address, setAddress] = useState(user?.city ? `${user.city}, ` : "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const total = useMemo(() => cart.reduce((s, i) => s + i.p.price * i.qty, 0), [cart]);
  const setQty = (id: number, d: number) => setCart((c: CartItem[]) => c.map((i) => (i.p.id === id ? { ...i, qty: Math.max(1, Math.min(i.p.stock, i.qty + d)) } : i)));
  const remove = (id: number) => setCart((c: CartItem[]) => c.filter((i) => i.p.id !== id));

  const checkout = async () => {
    setErr(""); setBusy(true);
    try {
      await api.post("/parts/orders/", { items: cart.map((i) => ({ product: i.p.id, quantity: i.qty })), address, phone });
      setCart([]); onClose(); toast("Buyurtma qabul qilindi! Sotuvchi tez orada bog'lanadi.", "success");
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Modal title="Savat" onClose={onClose}>
      {cart.length === 0 ? <Empty title="Savat bo'sh" text="Kerakli qismlarni savatga qo'shing." /> : (
        <div className="col gap-12">
          <div className="list">
            {cart.map((i) => (
              <div key={i.p.id} className="list-row">
                <div className="grow"><b className="small">{i.p.name}</b><div className="xs muted">{i.p.shop_name} · {money(i.p.price)}</div></div>
                <div className="row gap-4">
                  <button className="icon-btn" onClick={() => setQty(i.p.id, -1)} aria-label="Kamaytirish"><Minus size={14} /></button>
                  <b style={{ minWidth: 22, textAlign: "center" }}>{i.qty}</b>
                  <button className="icon-btn" onClick={() => setQty(i.p.id, 1)} aria-label="Ko'paytirish"><Plus size={14} /></button>
                  <button className="icon-btn" onClick={() => remove(i.p.id)} aria-label="O'chirish"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <label className="field"><span>Yetkazib berish manzili</span><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Tuman, ko'cha, uy" /></label>
          <label className="field"><span>Telefon</span><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <div className="row between"><span className="muted">Jami (to'lov yetkazilganda)</span><b style={{ fontSize: 20 }}>{money(total)}</b></div>
          {err && <div className="alert error">{err}</div>}
          <button className="btn btn-lg btn-block" disabled={busy || !address.trim()} onClick={checkout}>{busy ? "Yuborilmoqda…" : "Buyurtma berish"}</button>
        </div>
      )}
    </Modal>
  );
}
