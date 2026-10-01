import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Truck, Wallet } from "lucide-react";
import { api, errMsg } from "../../api";
import { useAuth } from "../../auth";
import ProviderJobs from "../../components/ProviderJobs";
import { Avatar, Modal, Stars, useToast } from "../../components/ui";
import { money } from "../../utils";

export default function EvakHome() {
  const { user } = useAuth();
  const [st, setSt] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [edit, setEdit] = useState(false);
  const loadStats = () => api.get("/sos/stats/").then((r) => setSt(r.data));
  const loadMe = () => api.get("/sos/evacuator/me/").then((r) => setMe(r.data));
  useEffect(() => { loadStats(); loadMe(); }, []);

  return (
    <div className="col gap-16" style={{ maxWidth: 960 }}>
      <div className="card row gap-16">
        <Avatar name={user?.full_name} src={user?.avatar} size="lg" />
        <div className="grow">
          <h2 style={{ fontSize: 20 }}>Salom, {user?.first_name}!</h2>
          <div className="small muted">{me ? `${me.truck_model || "Evakuator"} ${me.plate}` : ""}</div>
          {me && <Stars value={me.rating} count={me.reviews_count} />}
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => setEdit(true)}>Tarif va mashina</button>
      </div>
      <div className="grid g4">
        <div className="stat"><div className="ico"><Truck size={18} /></div><div className="label mt-8">Bugungi buyurtmalar</div><div className="value">{st?.today ?? "—"}</div></div>
        <div className="stat"><div className="ico" style={{ background: "var(--green-soft)", color: "var(--green)" }}><Wallet size={18} /></div><div className="label mt-8">Bugungi daromad</div><div className="value" style={{ fontSize: 19 }}>{st ? money(st.today_revenue) : "—"}</div></div>
        <div className="stat"><div className="ico"><CheckCircle2 size={18} /></div><div className="label mt-8">Bajarilgan</div><div className="value">{st?.completed ?? "—"}</div></div>
        <div className="stat"><div className="ico" style={{ background: "var(--amber-soft)", color: "#b37400" }}><Clock size={18} /></div><div className="label mt-8">Kutayotgan SOS</div><div className="value">{st?.waiting ?? "—"}</div></div>
      </div>
      <ProviderJobs onChange={loadStats} />
      {edit && me && <EvakModal me={me} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); loadMe(); }} />}
    </div>
  );
}

function EvakModal({ me, onClose, onSaved }: { me: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ truck_model: me.truck_model, plate: me.plate, base_price: me.base_price, price_per_km: me.price_per_km });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { await api.patch("/sos/evacuator/me/", f); toast("Saqlandi", "success"); onSaved(); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <Modal title="Mashina va tarif" onClose={onClose}>
      <div className="col gap-12">
        <label className="field"><span>Mashina modeli</span><input className="input" value={f.truck_model} onChange={set("truck_model")} placeholder="Isuzu NPR" /></label>
        <label className="field"><span>Davlat raqami</span><input className="input" value={f.plate} onChange={set("plate")} /></label>
        <div className="grid g2">
          <label className="field"><span>Chaqiruv narxi</span><input className="input" type="number" value={f.base_price} onChange={set("base_price")} /></label>
          <label className="field"><span>1 km narxi</span><input className="input" type="number" value={f.price_per_km} onChange={set("price_per_km")} /></label>
        </div>
        <p className="xs muted">Narx avtomatik: chaqiruv + masofa × km narxi. Qabul qilishda o'zingiz ham kiritishingiz mumkin.</p>
        <button className="btn btn-block" onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}
