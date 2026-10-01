import { useState } from "react";
import { Link } from "react-router-dom";
import { Map as MapIcon, Phone, Bell, Camera, Car, ChevronRight, ClipboardList, Crown, FileText, Heart, LogOut, MessageCircle, Package, Send, Store, User as UserIcon, Wrench, Truck , Globe, Moon, Navigation } from "lucide-react";
import { api, errMsg, tokens } from "../../api";
import { useAuth, ROLE_LABEL } from "../../auth";
import InstallApp from "../../components/InstallApp";
import EnablePush from "../../components/EnablePush";
import { useSite } from "../../site";
import { Avatar, Modal, useToast } from "../../components/ui";
import { shortDate } from "../../utils";
import LangSwitch from "../../components/LangSwitch";
import { ThemeSegment } from "../../components/ThemeToggle";

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const site = useSite();
  if (!user) return null;

  const deleteAccount = async () => {
    if (!confirm("Hisobingiz butunlay o'chiriladi: ism, raqam, avtomobillar va hujjatlar. Buni qaytarib bo'lmaydi. Davom etasizmi?")) return;
    if (prompt("Tasdiqlash uchun «O'CHIRISH» deb yozing") !== "O'CHIRISH") return;
    try { await api.delete("/auth/me/"); tokens.clear(); window.location.href = "/"; } catch (e) { toast(errMsg(e), "error"); }
  };

  const upload = async (f?: File) => {
    if (!f) return;
    const fd = new FormData(); fd.append("avatar", f);
    try { const r = await api.patch("/auth/me/", fd); setUser(r.data); toast("Rasm yangilandi", "success"); } catch (e) { toast(errMsg(e), "error"); }
  };

  const menu: [string, string, any][] = user.role === "usta" ? [
    ["/app/usta/orders", "Buyurtmalar", ClipboardList], ["/app/usta/services", "Xizmatlar va narxlar", Wrench], ["/app/usta/shop", "Zapchast do'konim", Store],
    ["/app/usta/premium", "Premium obuna", Crown], ["/app/usta/sos", "Tezkor so'rovlar", Truck], ["/app/chat", "Xabarlar", MessageCircle], ["/app/notifications", "Bildirishnomalar", Bell],
  ] : user.role === "evakuator" ? [
    ["/app/evak", "Buyurtmalar va profil", Truck], ["/app/chat", "Xabarlar", MessageCircle], ["/app/notifications", "Bildirishnomalar", Bell],
  ] : [
    ["/app/cars", "Mening avtomobillarim", Car], ["/app/safar", "Safarlarim (SAFAR)", Navigation], ["/app/orders", "Buyurtmalarim", ClipboardList], ["/app/favorites", "Sevimli ustalar", Heart], ["/app/map", "Xaritada ustalar", MapIcon],
    ["/app/parts", "Ehtiyot qismlar", Package], ["/app/chat", "Xabarlar", MessageCircle], ["/app/notifications", "Bildirishnomalar", Bell],
  ];

  return (
    <div className="col gap-16" style={{ maxWidth: 720 }}>
      <div className="card row gap-16">
        <label style={{ position: "relative", cursor: "pointer" }}>
          <Avatar name={user.full_name} src={user.avatar} size="xl" />
          <span className="icon-btn" style={{ position: "absolute", right: -4, bottom: -4, width: 30, height: 30 }}><Camera size={14} /></span>
          <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        <div className="grow">
          <h2 style={{ fontSize: 21 }}>{user.full_name}</h2>
          <div className="small muted">{user.phone}{user.email && ` · ${user.email}`}</div>
          <div className="row gap-8 mt-8 wrap">
            <span className="badge blue">{ROLE_LABEL[user.role]}</span>
            {user.is_premium && <span className="badge amber"><Crown size={12} /> Premium · {shortDate(user.premium_until || "")} gacha</span>}
            <span className={`badge ${user.telegram_linked ? "green" : "red"}`}><Send size={12} /> Telegram {user.telegram_linked ? "ulangan" : "ulanmagan"}</span>
          </div>
        </div>
      </div>
      <button className="btn btn-soft btn-block" onClick={() => setEdit(true)}><UserIcon size={16} />Profilni tahrirlash</button>
      <div className="card row gap-12" style={{ alignItems: "center" }}>
        <span className="ico"><Globe size={18} /></span>
        <div className="grow"><b className="small">Interfeys tili</b><div className="xs muted" translate="no">O'zbekcha · Русский</div></div>
        <LangSwitch dark logged />
      </div>
      <div className="card row gap-12" style={{ alignItems: "center" }}>
        <span className="ico"><Moon size={18} /></span>
        <div className="grow"><b className="small">Rejim</b><div className="xs muted">Kun · Tun · Avto</div></div>
        <ThemeSegment />
      </div>
      <InstallApp compact />
      <EnablePush />
      <div className="card card-tight list">
        {menu.map(([to, label, I]) => (
          <Link key={to} to={to} className="list-row"><span className="ico"><I size={17} /></span><span className="grow small bold">{label}</span><ChevronRight size={17} className="muted" /></Link>
        ))}
        {site.support_phone && <a href={`tel:${site.support_phone.replace(/\s/g, "")}`} className="list-row"><span className="ico"><Phone size={17} /></span><span className="grow small bold">Qo'llab-quvvatlash</span><span className="small muted">{site.support_phone}</span></a>}
        <Link to="/blog" className="list-row"><span className="ico"><FileText size={17} /></span><span className="grow small bold">Blog va yangiliklar</span><ChevronRight size={17} className="muted" /></Link>
        <button className="list-row" onClick={logout} style={{ background: "none", border: 0, width: "100%", textAlign: "left", color: "var(--red)" }}><span className="ico"><LogOut size={17} /></span><span className="grow small bold">Chiqish</span></button>
      </div>
      {user.role !== "admin" && <button className="small muted" style={{ background: "none", border: 0, alignSelf: "center", textDecoration: "underline" }} onClick={deleteAccount}>Hisobni o'chirish</button>}
      <Link to="/terms" className="xs muted" style={{ alignSelf: "center" }}>Foydalanish shartlari va maxfiylik siyosati</Link>
      {edit && <EditModal onClose={() => setEdit(false)} />}
    </div>
  );
}

function EditModal({ onClose }: { onClose: () => void }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ first_name: user!.first_name, last_name: user!.last_name, email: user!.email || "", city: user!.city || "" });
  const [err, setErr] = useState("");
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { const r = await api.patch("/auth/me/", f); setUser(r.data); toast("Saqlandi", "success"); onClose(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <Modal title="Shaxsiy ma'lumotlar" onClose={onClose}>
      <div className="col gap-12">
        <div className="grid g2">
          <label className="field"><span>Ism</span><input className="input" value={f.first_name} onChange={set("first_name")} /></label>
          <label className="field"><span>Familiya</span><input className="input" value={f.last_name} onChange={set("last_name")} /></label>
        </div>
        <label className="field"><span>Email</span><input className="input" type="email" value={f.email} onChange={set("email")} /></label>
        <label className="field"><span>Shahar</span><input className="input" value={f.city} onChange={set("city")} /></label>
        <p className="xs muted">Telefon raqami Telegram orqali tasdiqlangan, uni o'zgartirib bo'lmaydi.</p>
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-block" onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}
