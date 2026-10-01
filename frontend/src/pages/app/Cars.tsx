import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CircleDot, Droplet, FileText, Gauge, Pencil, Plus, ShieldCheck, Star, Trash2, Wallet, Wrench } from "lucide-react";
import ImagePicker from "../../components/ImagePicker";
import { api, errMsg, media } from "../../api";
import { CarArt, Empty, Modal, Spinner, useToast } from "../../components/ui";
import { money, shortDate } from "../../utils";

// Yangi avtomobil: hech qanday taxminiy qiymat yo'q — foydalanuvchi o'zi kiritadi
const EMPTY = { brand: "", model: "", year: "", engine: "", fuel_type: "", transmission: "", color: "", plate: "", mileage: "", next_service_km: "", oil_change_km: "", tire_km: "", inspection_km: "" };
const NULLABLE = ["year", "next_service_km", "oil_change_km", "tire_km", "inspection_km"];
const carSub = (c: any) => [c.year, c.engine, c.transmission, c.color].filter(Boolean).join(" · ");
const DOC_KINDS: [string, string][] = [["osago", "Sug'urta (OSAGO)"], ["kasko", "KASKO"], ["texosmotr", "Texnik ko'rik"], ["ishonchnoma", "Ishonchnoma"], ["tonirovka", "Tonirovka ruxsatnomasi"], ["gaz", "Gaz ballon guvohnomasi"], ["prava", "Haydovchilik guvohnomasi"], ["boshqa", "Boshqa"]];
const TABS = [["holat", "Holati"], ["hujjat", "Hujjatlar"], ["xarajat", "Xarajat"], ["tarix", "Tarix"]];

export default function Cars() {
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [cars, setCars] = useState<any[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [rec, setRec] = useState<any>(null);
  const [km, setKm] = useState<any>(null);
  const tab = sp.get("tab") || "holat";
  const load = () => api.get("/garage/vehicles/").then((r) => { setCars(r.data); setSel((s) => (s && r.data.some((c: any) => c.id === s) ? s : r.data[0]?.id ?? null)); });
  useEffect(() => { load(); }, []);

  if (!cars) return <Spinner />;
  const c = cars.find((x) => x.id === sel);
  const del = async () => { if (!confirm(`${c.brand} ${c.model} o'chirilsinmi? Hujjatlar va xarajatlar ham o'chadi.`)) return; await api.delete(`/garage/vehicles/${c.id}/`); toast("O'chirildi"); load(); };
  const primary = async () => { await api.post(`/garage/vehicles/${c.id}/make_primary/`); load(); };

  return (
    <div className="col gap-16" style={{ maxWidth: 900 }}>
      <div className="page-head"><h2 className="page-title">Mening avtomobilim</h2><button className="btn btn-sm" onClick={() => setEdit(EMPTY)}><Plus size={16} />Qo'shish</button></div>
      {cars.length === 0 && <Empty title="Hali avtomobil qo'shilmagan" text="Avtomobil qo'shing — sug'urta va texosmotr muddati, servis va xarajatlarni kuzatib, o'z vaqtida eslatma olasiz." action={<button className="btn" onClick={() => setEdit(EMPTY)}>Avtomobil qo'shish</button>} />}
      {cars.length > 1 && <div className="chips">{cars.map((x) => <button key={x.id} className={"chip" + (x.id === sel ? " active" : "")} onClick={() => setSel(x.id)}>{x.brand} {x.model}{x.documents_due > 0 && " ⚠️"}</button>)}</div>}
      {c && <>
        <div className="card">
          <div className="row-top">
            <div style={{ width: 170, maxWidth: "36%", background: "linear-gradient(180deg,#eef2f7,#dfe5ee)", borderRadius: 16, padding: 6, flexShrink: 0 }}>
              {c.image ? <img src={media(c.image)} alt="" style={{ borderRadius: 12 }} /> : <CarArt light />}
            </div>
            <div className="grow">
              <div className="row gap-8 wrap"><h3 style={{ fontSize: 19 }}>{c.brand} {c.model}</h3>{c.is_primary && <span className="badge blue">Asosiy</span>}</div>
              {carSub(c) && <div className="small muted">{carSub(c)}</div>}
              {c.plate && <div className="mt-8"><span className="badge" style={{ border: "1.5px solid var(--ink)", fontWeight: 800, background: "#fff" }}>{c.plate}</span></div>}
              <button className="small mt-8 row gap-4" style={{ background: "none", border: 0, padding: 0, color: "var(--ink)" }} onClick={() => setKm(c)}><Gauge size={14} />Probeg: <b>{c.mileage.toLocaleString()} km</b><Pencil size={12} className="muted" /></button>
            </div>
          </div>
          <div className="row gap-8 mt-12 wrap">
            <button className="btn btn-sm btn-ghost" onClick={() => setEdit(c)}><Pencil size={14} />Tahrirlash</button>
            {!c.is_primary && <button className="btn btn-sm btn-ghost" onClick={primary}><Star size={14} />Asosiy qilish</button>}
            <button className="btn btn-sm btn-danger-soft" onClick={del} aria-label="O'chirish"><Trash2 size={14} /></button>
          </div>
        </div>
        <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setSp({ tab: k }, { replace: true })}>{l}{k === "hujjat" && c.documents_due > 0 && ` (${c.documents_due})`}</button>)}</div>
        {tab === "holat" && <Health c={c} onKm={() => setKm(c)} onEdit={() => setEdit(c)} />}
        {tab === "hujjat" && <Documents car={c} onChange={load} />}
        {tab === "xarajat" && <Expenses car={c} onChange={load} />}
        {tab === "tarix" && (
          <div className="card">
            <div className="row between"><b>Servis tarixi</b><button className="btn btn-sm btn-soft" onClick={() => setRec(c)}><Plus size={14} />Yozuv</button></div>
            <div className="list mt-8">
              {c.records.length === 0 && <p className="small muted">Hali yozuv yo'q. Usta buyurtmani yakunlaganda avtomatik qo'shiladi.</p>}
              {c.records.map((r: any) => (
                <div key={r.id} className="list-row"><span className="ico"><Wrench size={16} /></span>
                  <div className="grow"><b className="small">{r.title}</b><div className="xs muted">{shortDate(r.date)} · {r.mileage.toLocaleString()} km{r.master_name && ` · ${r.master_name}`}</div></div>
                  <b className="small">{money(r.cost)}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </>}
      {edit && <CarModal car={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); toast("Saqlandi", "success"); }} />}
      {rec && <RecordModal car={rec} onClose={() => setRec(null)} onSaved={() => { setRec(null); load(); }} />}
      {km && <MileageModal car={km} onClose={() => setKm(null)} onSaved={() => { setKm(null); load(); toast("Probeg yangilandi", "success"); }} />}
    </div>
  );
}

export const healthTone = (h: string) => (h === "Yaxshi" ? "green" : h === "O'rtacha" ? "amber" : h === "Servis kerak" ? "red" : "");

function Health({ c, onKm, onEdit }: { c: any; onKm: () => void; onEdit: () => void }) {
  const row = (I: any, label: string, v: number | null, max: number) => {
    const known = v !== null && v !== undefined;
    const pct = known ? Math.min(100, Math.max(0, ((v as number) / max) * 100)) : 0;
    return (
      <div className="list-row"><span className="ico"><I size={16} /></span>
        <div className="grow"><div className="row between small"><span>{label}</span>
          {known ? <b style={{ color: (v as number) <= 500 ? "var(--red)" : undefined }}>{(v as number) <= 0 ? "Vaqti keldi!" : `${(v as number).toLocaleString()} km`}</b> : <span className="muted">Kiritilmagan</span>}</div>
          <div className="progress mt-4"><div style={{ width: `${pct}%`, background: known && (v as number) <= 500 ? "var(--red)" : undefined }} /></div></div></div>
    );
  };
  const empty = [c.next_service_km, c.oil_change_km, c.tire_km, c.inspection_km].every((v) => v === null || v === undefined);
  return (
    <div className="card">
      <div className="row between"><b>Umumiy holat</b><span className={`badge ${healthTone(c.health)}`}>{c.health}</span></div>
      {empty && <div className="alert mt-8" style={{ padding: "10px 12px" }}>Servis ma'lumotlari hali kiritilmagan. Keyingi servis va moy almashtirishgacha necha km qolganini kiriting — shunda holat va eslatmalar ishlaydi. <button className="link" style={{ background: "none", border: 0, padding: 0 }} onClick={onEdit}>Kiritish →</button></div>}
      <div className="list mt-8">
        {row(Wrench, "Keyingi servisgacha", c.next_service_km, 10000)}
        {row(Droplet, "Moy almashtirishgacha", c.oil_change_km, 10000)}
        {row(CircleDot, "Shinalar", c.tire_km, 40000)}
        {row(ShieldCheck, "Texnik ko'rikgacha", c.inspection_km, 20000)}
      </div>
      <p className="xs muted mt-8">Probegni yangilab turing — qolgan km lar avtomatik kamayadi. <button className="link" style={{ background: "none", border: 0, padding: 0 }} onClick={onKm}>Probegni kiritish</button></p>
    </div>
  );
}

function Documents({ car, onChange }: { car: any; onChange: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const load = () => api.get(`/garage/vehicles/${car.id}/documents/`).then((r) => setItems(r.data));
  useEffect(() => { load(); }, [car.id]);
  const del = async (d: any) => { if (!confirm("O'chirilsinmi?")) return; await api.delete(`/garage/documents/${d.id}/`); load(); onChange(); };
  const tone = (d: number) => (d < 0 ? "red" : d <= 7 ? "red" : d <= 30 ? "amber" : "green");
  if (!items) return <Spinner />;
  return (
    <div className="card">
      <div className="row between"><b>Hujjatlar va muddatlar</b><button className="btn btn-sm btn-soft" onClick={() => setEdit({ kind: "osago", title: "", number: "", expires_on: "", note: "" })}><Plus size={14} />Qo'shish</button></div>
      <p className="xs muted mt-4">Muddati tugashidan 30, 7, 3 va 1 kun oldin Telegram orqali eslatamiz.</p>
      <div className="list mt-8">
        {items.length === 0 && <p className="small muted" style={{ padding: "10px 0" }}>Sug'urta, texosmotr, ishonchnoma kabi hujjatlarni qo'shing — muddatini o'tkazib yubormaysiz.</p>}
        {items.map((d) => (
          <div key={d.id} className="list-row"><span className="ico"><FileText size={16} /></span>
            <div className="grow"><b className="small">{d.title || d.kind_label}</b><div className="xs muted">{d.number && `${d.number} · `}{shortDate(d.expires_on)} gacha</div></div>
            <span className={`badge ${tone(d.days_left)}`}>{d.days_left < 0 ? "Tugagan" : d.days_left === 0 ? "Bugun" : `${d.days_left} kun`}</span>
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setEdit(d)} aria-label="Tahrirlash"><Pencil size={13} /></button>
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => del(d)} aria-label="O'chirish"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      {edit && <DocModal car={car} d={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); onChange(); toast("Saqlandi", "success"); }} />}
    </div>
  );
}

function DocModal({ car, d, onClose, onSaved }: { car: any; d: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ ...d });
  const [err, setErr] = useState("");
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { d.id ? await api.patch(`/garage/documents/${d.id}/`, f) : await api.post(`/garage/vehicles/${car.id}/documents/`, f); onSaved(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <Modal title={d.id ? "Hujjatni tahrirlash" : "Hujjat qo'shish"} onClose={onClose}>
      <div className="col gap-12">
        <label className="field"><span>Turi</span><select className="select" value={f.kind} onChange={set("kind")}>{DOC_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        {f.kind === "boshqa" && <label className="field"><span>Nomi</span><input className="input" value={f.title} onChange={set("title")} /></label>}
        <label className="field"><span>Amal qilish muddati (qachongacha)</span><input className="input" type="date" value={f.expires_on} onChange={set("expires_on")} /></label>
        <label className="field"><span>Raqami (ixtiyoriy)</span><input className="input" value={f.number} onChange={set("number")} /></label>
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-block" disabled={!f.expires_on} onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}

function Expenses({ car, onChange }: { car: any; onChange: () => void }) {
  const toast = useToast();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [d, setD] = useState<any>(null);
  const [add, setAdd] = useState(false);
  const load = () => api.get(`/garage/vehicles/${car.id}/expenses/`, { params: { month } }).then((r) => setD(r.data));
  useEffect(() => { load(); }, [car.id, month]);
  const del = async (e: any) => { if (!confirm("O'chirilsinmi?")) return; await api.delete(`/garage/expenses/${e.id}/`); load(); };
  if (!d) return <Spinner />;
  const max = Math.max(1, ...d.months.map((m: any) => m.total));
  const MN = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
  return (
    <div className="col gap-12">
      <div className="card">
        <div className="row between"><div><div className="small muted">Shu oy xarajati</div><b style={{ fontSize: 24 }}>{money(d.total)}</b></div><button className="btn btn-sm" onClick={() => setAdd(true)}><Plus size={15} />Xarajat</button></div>
        <div className="bars mt-16">{d.months.map((m: any) => (
          <button key={m.month} className={"b" + (m.month === month ? " cur" : "")} style={{ background: "none", border: 0 }} onClick={() => setMonth(m.month)} title={money(m.total)}>
            <span style={{ height: `${(m.total / max) * 100}%` }} />{MN[Number(m.month.slice(5)) - 1]}
          </button>
        ))}</div>
        {d.by_category.length > 0 && <div className="row gap-8 wrap mt-12">{d.by_category.map((c: any) => <span key={c.category} className="chip" style={{ padding: "5px 10px" }}>{c.label}: <b>{money(c.total)}</b></span>)}</div>}
      </div>
      <div className="card card-tight list">
        {d.items.length === 0 && <p className="small muted" style={{ padding: 8 }}>Bu oyda xarajat yo'q. Yoqilg'i, yuvish, jarima va boshqalarni yozib boring — oylik hisobot avtomatik tuziladi.</p>}
        {d.items.map((e: any) => (
          <div key={e.id} className="list-row"><span className="ico"><Wallet size={16} /></span>
            <div className="grow"><b className="small">{e.category_label}</b><div className="xs muted">{shortDate(e.date)}{e.liters ? ` · ${e.liters} L` : ""}{e.mileage ? ` · ${e.mileage.toLocaleString()} km` : ""}{e.note && ` · ${e.note}`}</div></div>
            <b className="small">{money(e.amount)}</b>
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => del(e)} aria-label="O'chirish"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      {add && <ExpenseModal car={car} cats={d.categories} onClose={() => setAdd(false)} onSaved={() => { setAdd(false); load(); onChange(); toast("Qo'shildi", "success"); }} />}
    </div>
  );
}

function ExpenseModal({ car, cats, onClose, onSaved }: { car: any; cats: any[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ category: "yoqilgi", amount: "", date: new Date().toISOString().slice(0, 10), mileage: "", liters: "", note: "" });
  const [err, setErr] = useState("");
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const body: any = { ...f }; if (!body.mileage) delete body.mileage; if (!body.liters) delete body.liters;
    try { await api.post(`/garage/vehicles/${car.id}/expenses/`, body); onSaved(); } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <Modal title="Xarajat qo'shish" onClose={onClose}>
      <div className="col gap-12">
        <div className="row gap-8 wrap">{cats.map((c) => <button key={c.key} className={"chip" + (f.category === c.key ? " active" : "")} onClick={() => setF({ ...f, category: c.key })}>{c.label}</button>)}</div>
        <div className="grid g2">
          <label className="field"><span>Summa (so'm)</span><input className="input" type="number" inputMode="numeric" value={f.amount} onChange={set("amount")} autoFocus /></label>
          <label className="field"><span>Sana</span><input className="input" type="date" value={f.date} onChange={set("date")} /></label>
          {f.category === "yoqilgi" && <label className="field"><span>Litr / m³</span><input className="input" type="number" value={f.liters} onChange={set("liters")} /></label>}
          <label className="field"><span>Probeg (ixtiyoriy)</span><input className="input" type="number" placeholder={String(car.mileage)} value={f.mileage} onChange={set("mileage")} /></label>
        </div>
        <label className="field"><span>Izoh</span><input className="input" value={f.note} onChange={set("note")} /></label>
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-block btn-lg" disabled={!f.amount} onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}

function MileageModal({ car, onClose, onSaved }: { car: any; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  const save = async () => {
    if (Number(v) <= car.mileage) { setErr(`Yangi probeg ${car.mileage.toLocaleString()} km dan katta bo'lishi kerak.`); return; }
    try { await api.post(`/garage/vehicles/${car.id}/mileage/`, { mileage: v }); onSaved(); } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <Modal title="Joriy probeg" onClose={onClose}>
      <div className="col gap-12">
        <input className="input" type="number" inputMode="numeric" autoFocus placeholder={`Hozirgi: ${car.mileage.toLocaleString()} km`} value={v} onChange={(e) => setV(e.target.value)} style={{ fontSize: 20 }} />
        <p className="xs muted">Servis, moy va shina uchun qolgan km lar avtomatik qayta hisoblanadi.</p>
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-block" onClick={save} disabled={!v}>Saqlash</button>
      </div>
    </Modal>
  );
}

function CarModal({ car, onClose, onSaved }: { car: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ ...car });
  const [img, setImg] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setErr("");
    const fd = new FormData();
    ["brand", "model", "year", "engine", "fuel_type", "transmission", "color", "plate", "mileage", "next_service_km", "oil_change_km", "tire_km", "inspection_km"].forEach((k) => {
      const v = f[k] ?? "";
      if (v === "" && !NULLABLE.includes(k) && ["mileage"].includes(k)) return; // bo'sh probeg — yuborilmaydi
      fd.append(k, v);
    });
    if (img) fd.append("image", img);
    try { car.id ? await api.patch(`/garage/vehicles/${car.id}/`, fd) : await api.post("/garage/vehicles/", fd); onSaved(); }
    catch (e) { setErr(errMsg(e)); }
  };
  const num = (k: string, label: string, ph = "") => <label className="field"><span>{label}</span><input className="input" type="number" inputMode="numeric" min={0} value={f[k] ?? ""} onChange={set(k)} placeholder={ph} /></label>;
  return (
    <Modal title={car.id ? "Avtomobilni tahrirlash" : "Avtomobil qo'shish"} onClose={onClose}>
      <div className="col gap-12">
        <div className="grid g2">
          <label className="field"><span>Marka</span><input className="input" value={f.brand} onChange={set("brand")} placeholder="Chevrolet" /></label>
          <label className="field"><span>Model</span><input className="input" value={f.model} onChange={set("model")} placeholder="Cobalt" /></label>
          {num("year", "Yil", "2021")}
          <label className="field"><span>Dvigatel</span><input className="input" value={f.engine} onChange={set("engine")} placeholder="1.5L" /></label>
          <label className="field"><span>Yoqilg'i turi</span><select className="select" value={f.fuel_type || ""} onChange={set("fuel_type")}><option value="">Tanlanmagan</option><option value="metan">Metan</option><option value="propan">Propan</option><option value="benzin">Benzin</option><option value="dizel">Dizel</option><option value="elektr">Elektr</option></select></label>
          <label className="field"><span>Uzatma</span><select className="select" value={f.transmission} onChange={set("transmission")}><option value="">Tanlanmagan</option><option>Avtomat</option><option>Mexanika</option><option>Robot</option><option>Variator</option></select></label>
          <label className="field"><span>Rang</span><input className="input" value={f.color} onChange={set("color")} /></label>
          <label className="field"><span>Davlat raqami</span><input className="input" value={f.plate} onChange={set("plate")} placeholder="01 A 123 AA" /></label>
          {num("mileage", "Probeg (km)", "45000")}
        </div>
        <div className="small bold mt-4">Servisgacha qolgan masofa <span className="muted" style={{ fontWeight: 400 }}>— bilmasangiz bo'sh qoldiring</span></div>
        <div className="grid g2">
          {num("next_service_km", "Keyingi servisgacha (km)")}
          {num("oil_change_km", "Moy almashtirishgacha (km)")}
          {num("tire_km", "Shina almashtirishgacha (km)")}
          {num("inspection_km", "Texnik ko'rikgacha (km)")}
        </div>
        <ImagePicker label="Rasm (ixtiyoriy)" file={img} onFile={setImg} current={car?.image} aspect="16 / 9" />
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-lg btn-block" onClick={save} disabled={!f.brand}>Saqlash</button>
      </div>
    </Modal>
  );
}

function RecordModal({ car, onClose, onSaved }: { car: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: "", date: new Date().toISOString().slice(0, 10), mileage: car.mileage, cost: 0, master_name: "", note: "" });
  const [err, setErr] = useState("");
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { await api.post(`/garage/vehicles/${car.id}/records/`, f); onSaved(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <Modal title="Servis yozuvi" onClose={onClose}>
      <div className="col gap-12">
        <label className="field"><span>Xizmat</span><input className="input" value={f.title} onChange={set("title")} placeholder="Moy almashtirish" /></label>
        <div className="grid g2">
          <label className="field"><span>Sana</span><input className="input" type="date" value={f.date} onChange={set("date")} /></label>
          <label className="field"><span>Probeg</span><input className="input" type="number" value={f.mileage} onChange={set("mileage")} /></label>
          <label className="field"><span>Narxi</span><input className="input" type="number" value={f.cost} onChange={set("cost")} /></label>
          <label className="field"><span>Usta</span><input className="input" value={f.master_name} onChange={set("master_name")} /></label>
        </div>
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-block" onClick={save} disabled={!f.title}>Qo'shish</button>
      </div>
    </Modal>
  );
}
