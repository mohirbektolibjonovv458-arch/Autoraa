import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, errMsg, media } from "../../api";
import { Modal, Spinner, useToast } from "../../components/ui";
import { money, SPECIALTIES } from "../../utils";

export default function UstaServices() {
  const toast = useToast();
  const [me, setMe] = useState<any>(null);
  const [svcs, setSvcs] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const load = () => { api.get("/masters/me/").then((r) => setMe(r.data)); api.get("/masters/me/services/").then((r) => setSvcs(r.data)); };
  useEffect(() => { load(); }, []);
  if (!me) return <Spinner />;

  const set = (k: string) => (e: any) => setMe({ ...me, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const toggleSpec = (k: string) => setMe({ ...me, specialties: me.specialties.includes(k) ? me.specialties.filter((x: string) => x !== k) : [...me.specialties, k] });
  const saveProfile = async () => {
    try {
      const { title, specialties, experience_years, address, work_hours, is_24_7, bio, work_days } = me;
      await api.patch("/masters/me/", { title, specialties, experience_years, address, work_hours, is_24_7, bio, work_days });
      toast("Profil saqlandi", "success");
    } catch (e) { toast(errMsg(e), "error"); }
  };
  const cover = async (f?: File) => { if (!f) return; const fd = new FormData(); fd.append("cover", f); const r = await api.patch("/masters/me/", fd); setMe({ ...me, cover: r.data.cover }); toast("Rasm yuklandi", "success"); };
  const del = async (s: any) => { if (!confirm(`«${s.name}» o'chirilsinmi?`)) return; await api.delete(`/masters/me/services/${s.id}/`); load(); };

  return (
    <div className="col gap-16" style={{ maxWidth: 900 }}>
      <div className="card col gap-12">
        <h3>Ustaxona profili</h3>
        <div className="grid g2 stack-sm">
          <label className="field"><span>Ustaxona nomi</span><input className="input" value={me.title} onChange={set("title")} placeholder="Azizbek Auto Service" /></label>
          <label className="field"><span>Tajriba (yil)</span><input className="input" type="number" value={me.experience_years} onChange={set("experience_years")} /></label>
          <label className="field"><span>Manzil</span><input className="input" value={me.address} onChange={set("address")} placeholder="Toshkent, Yunusobod" /></label>
          <label className="field"><span>Ish vaqti</span><input className="input" value={me.work_hours} onChange={set("work_hours")} disabled={me.is_24_7} /></label>
        </div>
        <label className="row gap-8 small"><input type="checkbox" checked={me.is_24_7} onChange={set("is_24_7")} />24/7 ishlayman</label>
        <div className="field"><span>Ish kunlari</span>
          <div className="chips" style={{ margin: 0 }}>
            {["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"].map((d, i) => {
              const days: number[] = me.work_days?.length ? me.work_days : [0, 1, 2, 3, 4, 5, 6];
              const on = days.includes(i);
              return <button key={d} type="button" className={"chip" + (on ? " active" : "")} aria-pressed={on}
                onClick={() => setMe({ ...me, work_days: on ? days.filter((x) => x !== i) : [...days, i].sort() })}>{d}</button>;
            })}
          </div>
          <small className="xs muted">Dam olish kunlari mijozlarga bron uchun ko'rsatilmaydi va «Hozir ochiq» filtrida hisobga olinadi.</small>
        </div>
        <div className="field"><span>Mutaxassislik</span>
          <div className="row gap-8 wrap">{Object.entries(SPECIALTIES).map(([k, l]) => <button key={k} className={"chip" + (me.specialties.includes(k) ? " active" : "")} onClick={() => toggleSpec(k)}>{l}</button>)}</div>
        </div>
        <label className="field"><span>O'zingiz haqingizda</span><textarea className="textarea" value={me.bio} onChange={set("bio")} /></label>
        <label className="field"><span>Muqova rasmi (ustaxona / ish jarayoni)</span>
          <label className="dropzone">{me.cover ? <img src={media(me.cover)} alt="" /> : "Rasm tanlash uchun bosing"}<input type="file" accept="image/*" hidden onChange={(e) => cover(e.target.files?.[0])} /></label>
        </label>
        <button className="btn" onClick={saveProfile}>Profilni saqlash</button>
      </div>

      <div className="card">
        <div className="row between"><h3>Xizmatlar va narxlar</h3><button className="btn btn-sm" onClick={() => setEdit({ name: "", category: me.specialties[0] || "motor", price: "", duration: "1 soat" })}><Plus size={15} />Qo'shish</button></div>
        <div className="list mt-8">
          {svcs.length === 0 && <p className="small muted">Xizmat qo'shing — mijozlar shu ro'yxatdan tanlab bron qiladi.</p>}
          {svcs.map((s) => (
            <div key={s.id} className="list-row">
              <div className="grow"><b className="small">{s.name}</b><div className="xs muted">{SPECIALTIES[s.category]} · {s.duration}</div></div>
              <b className="small">{money(s.price)}</b>
              <button className="icon-btn" onClick={() => setEdit(s)} aria-label="Tahrirlash"><Pencil size={14} /></button>
              <button className="icon-btn" onClick={() => del(s)} aria-label="O'chirish"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
      <Portfolio />
      {edit && <SvcModal s={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function SvcModal({ s, onClose, onSaved }: { s: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ ...s });
  const [err, setErr] = useState("");
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { s.id ? await api.patch(`/masters/me/services/${s.id}/`, f) : await api.post("/masters/me/services/", f); onSaved(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <Modal title={s.id ? "Xizmatni tahrirlash" : "Yangi xizmat"} onClose={onClose}>
      <div className="col gap-12">
        <label className="field"><span>Nomi</span><input className="input" value={f.name} onChange={set("name")} placeholder="Motor diagnostikasi" /></label>
        <label className="field"><span>Yo'nalish</span><select className="select" value={f.category} onChange={set("category")}>{Object.entries(SPECIALTIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div className="grid g2">
          <label className="field"><span>Narx (so'm)</span><input className="input" type="number" value={f.price} onChange={set("price")} /></label>
          <label className="field"><span>Davomiyligi</span><input className="input" value={f.duration} onChange={set("duration")} /></label>
        </div>
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-block" disabled={!f.name || !f.price} onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}

function Portfolio() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [pair, setPair] = useState(false);
  const load = () => api.get("/masters/me/photos/").then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try { for (const f of Array.from(files).slice(0, 10)) { const fd = new FormData(); fd.append("image", f); await api.post("/masters/me/photos/", fd); } toast("Rasmlar yuklandi", "success"); }
    catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); load(); }
  };
  const del = async (id: number) => { if (!confirm("O'chirilsinmi?")) return; await api.delete(`/masters/me/photos/${id}/`); load(); };
  return (
    <div className="card">
      <div className="row between wrap gap-8"><div className="grow" style={{ minWidth: 200 }}><h3>Ishlardan namunalar</h3><p className="xs muted">«Oldin/keyin» rasmlari mijozlar ishonchini eng ko'p oshiradi (30 tagacha).</p></div>
        <div className="row gap-8">
          <button className="btn btn-sm" onClick={() => setPair(true)}><Plus size={15} />Oldin / keyin</button>
          <label className="btn btn-sm btn-ghost" style={{ cursor: "pointer" }}><Plus size={15} />{busy ? "Yuklanmoqda…" : "Bitta rasm"}<input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} /></label>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="gallery mt-12">
          {items.map((p) => (
            <div key={p.id} className="gi">
              {p.before ? <div className="gi-pair"><img src={media(p.before)} alt="" /><img src={media(p.image)} alt="" /><span>Oldin / keyin</span></div> : <img src={media(p.image)} alt="" />}
              <button onClick={() => del(p.id)} aria-label="O'chirish"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      ) : <p className="small muted mt-8">Hali rasm yo'q.</p>}
      {pair && <PairModal onClose={() => setPair(false)} onDone={() => { setPair(false); load(); }} />}
    </div>
  );
}

function PairModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const url = (f: File | null) => (f ? URL.createObjectURL(f) : "");
  const save = async () => {
    if (!before || !after) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("before", before); fd.append("image", after); fd.append("caption", caption);
      await api.post("/masters/me/photos/", fd); toast("Rasm yuklandi", "success"); onDone();
    } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  };
  const Pick = ({ label, file, set }: { label: string; file: File | null; set: (f: File | null) => void }) => (
    <label className="pair-pick">
      {file ? <img src={url(file)} alt="" /> : <span><Plus size={22} /><b className="small">{label}</b></span>}
      <input type="file" accept="image/*" hidden onChange={(e) => set(e.target.files?.[0] || null)} />
    </label>
  );
  return (
    <Modal title="Oldin/keyin rasmi" onClose={onClose}>
      <div className="col gap-12">
        <div className="grid g2" style={{ gap: 10 }}><Pick label="«Oldin» rasmi" file={before} set={setBefore} /><Pick label="«Keyin» rasmi" file={after} set={setAfter} /></div>
        <label className="field"><span>Izoh (ixtiyoriy)</span><input className="input" maxLength={120} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Masalan: Kuzov bo'yoq ishlari, Cobalt" /></label>
        <button className="btn btn-lg btn-block" disabled={!before || !after || busy} onClick={save}>{busy ? "Yuklanmoqda…" : "Saqlash"}</button>
      </div>
    </Modal>
  );
}
