import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Circle, ExternalLink, Pencil, Plus, Store, Trash2, User, Wrench } from "lucide-react";
import { AMENITIES } from "../../components/Servis";
import { api, errMsg, media } from "../../api";
import { Modal, Spinner, useToast } from "../../components/ui";
import { money, SPECIALTIES } from "../../utils";

export default function UstaServices() {
  const toast = useToast();
  const [me, setMe] = useState<any>(null);
  const [svcs, setSvcs] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const loadPhotos = () => api.get("/masters/me/photos/").then((r) => setPhotos(r.data)).catch(() => {});
  const load = () => { api.get("/masters/me/").then((r) => setMe(r.data)); api.get("/masters/me/services/").then((r) => setSvcs(r.data)); loadPhotos(); };
  useEffect(() => { load(); }, []);
  if (!me) return <Spinner />;
  const place = photos.filter((p) => p.kind === "place"), work = photos.filter((p) => p.kind !== "place");
  const isServis = me.kind === "servis";
  const steps: [string, boolean][] = [
    [isServis ? "Servis nomi" : "Ism yoki ustaxona nomi", !!me.title?.trim()],
    ["Manzil", !!me.address?.trim()],
    ["Mutaxassislik tanlangan", me.specialties.length > 0],
    ["Nimalar qilishingiz yozilgan (40+ belgi)", (me.bio || "").trim().length >= 40],
    ["Kamida 3 ta xizmat va narx", svcs.length >= 3],
    [isServis ? "Servis rasmlari (3+)" : "Ustaxona rasmlari (3+)", place.length >= 3],
    ["Ishlardan namuna (1+)", work.length >= 1],
    ["Qulayliklar (2+)", (me.amenities || []).length >= 2],
  ];
  const done = steps.filter(([, ok]) => ok).length, pct = Math.round((done / steps.length) * 100);

  const set = (k: string) => (e: any) => setMe({ ...me, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const toggleSpec = (k: string) => setMe({ ...me, specialties: me.specialties.includes(k) ? me.specialties.filter((x: string) => x !== k) : [...me.specialties, k] });
  const saveProfile = async () => {
    try {
      const { title, specialties, experience_years, address, work_hours, is_24_7, bio, work_days, kind, amenities, staff_count } = me;
      await api.patch("/masters/me/", { title, specialties, experience_years, address, work_hours, is_24_7, bio, work_days, kind, amenities, staff_count: Number(staff_count) || 1 });
      toast("Profil saqlandi", "success");
    } catch (e) { toast(errMsg(e), "error"); }
  };
  const cover = async (f?: File) => { if (!f) return; const fd = new FormData(); fd.append("cover", f); const r = await api.patch("/masters/me/", fd); setMe({ ...me, cover: r.data.cover }); toast("Rasm yuklandi", "success"); };
  const del = async (s: any) => { if (!confirm(`«${s.name}» o'chirilsinmi?`)) return; await api.delete(`/masters/me/services/${s.id}/`); load(); };

  return (
    <div className="col gap-16" style={{ maxWidth: 900 }}>
      <div className="card ready">
        <div className="row between wrap gap-8">
          <div><h3>{pct === 100 ? "Servis sahifangiz tayyor 🎉" : "Servisingizni oching"}</h3>
            <p className="xs muted" style={{ margin: "4px 0 0" }}>To'liq sahifa mijozlar ishonchini oshiradi va qidiruvda yaxshi ko'rinadi.</p></div>
          <Link to={`/app/masters/${me.id}`} className="btn btn-sm btn-ghost"><ExternalLink size={14} />Sahifani ko'rish</Link>
        </div>
        <div className="row gap-8"><div className={"ready-bar grow" + (pct === 100 ? " done" : "")}><i style={{ width: `${pct}%` }} /></div><b className="small">{pct}%</b></div>
        <div className="ready-list">{steps.map(([l, ok]) => <span key={l} className={ok ? "ok" : ""}>{ok ? <Check size={15} color="var(--green)" /> : <Circle size={15} />}{l}</span>)}</div>
      </div>

      <div className="card col gap-12">
        <h3>{isServis ? "Servis profili" : "Ustaxona profili"}</h3>
        <div className="kind-pick" role="radiogroup" aria-label="Turi">
          <button type="button" role="radio" aria-checked={!isServis} className={!isServis ? "on" : ""} onClick={() => setMe({ ...me, kind: "usta" })}><b><User size={16} />Shaxsiy usta</b><span className="xs muted">O'zim ishlayman</span></button>
          <button type="button" role="radio" aria-checked={isServis} className={isServis ? "on" : ""} onClick={() => setMe({ ...me, kind: "servis" })}><b><Store size={16} />Avtoservis</b><span className="xs muted">Ustaxona, bir nechta usta</span></button>
        </div>
        <div className="grid g2 stack-sm">
          <label className="field"><span>{isServis ? "Servis nomi" : "Ustaxona nomi"}</span><input className="input" value={me.title} onChange={set("title")} placeholder="Azizbek Auto Service" /></label>
          <label className="field"><span>Tajriba (yil)</span><input className="input" type="number" value={me.experience_years} onChange={set("experience_years")} /></label>
          {isServis && <label className="field"><span>Ustalar soni</span><input className="input" type="number" min={1} max={200} value={me.staff_count} onChange={set("staff_count")} /></label>}
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
        <label className="field"><span>{isServis ? "Servis haqida: nimalar qilasiz?" : "O'zingiz haqingizda: nimalar qilasiz?"}</span>
          <textarea className="textarea" rows={4} maxLength={2000} value={me.bio} onChange={set("bio")} placeholder="Masalan: Chevrolet va Kia avtomobillari motorini ta'mirlaymiz. Kompyuter diagnostika, moy almashtirish, xodovoy. Ishga 3 oy kafolat beramiz." /></label>
        <div className="field"><span>Qulayliklar</span>
          <div className="amen-grid">
            {Object.entries(AMENITIES).map(([k, [l, I]]) => {
              const on = (me.amenities || []).includes(k);
              return <button key={k} type="button" className={"amen amen-pick" + (on ? " on" : "")} aria-pressed={on}
                onClick={() => setMe({ ...me, amenities: on ? me.amenities.filter((x: string) => x !== k) : [...(me.amenities || []), k] })}><I size={17} />{l}</button>;
            })}
          </div>
        </div>
        <label className="field"><span>Muqova rasmi (ustaxona / ish jarayoni)</span>
          <label className="dropzone">{me.cover ? <img src={media(me.cover)} alt="" /> : "Rasm tanlash uchun bosing"}<input type="file" accept="image/*" hidden onChange={(e) => cover(e.target.files?.[0])} /></label>
        </label>
        <button className="btn" onClick={saveProfile}>Profilni saqlash</button>
      </div>

      <PhotoSection kind="place" items={place} reload={loadPhotos} title={isServis ? "Servis rasmlari" : "Ustaxona rasmlari"}
        hint="Bino tashqarisi, ish joyi, uskunalar, kutish zali — mijoz qayerga kelishini oldindan ko'radi (15 tagacha). Sahifangiz tepasida suriladigan galereya bo'lib chiqadi." />

      <div className="card">
        <div className="row between"><h3>Xizmatlar va narxlar</h3><button className="btn btn-sm" onClick={() => setEdit({ name: "", category: me.specialties[0] || "motor", price: "", duration: "1 soat", description: "", price_from: false })}><Plus size={15} />Qo'shish</button></div>
        <div className="list mt-8">
          {svcs.length === 0 && <p className="small muted">Xizmat qo'shing — mijozlar shu ro'yxatdan tanlab bron qiladi.</p>}
          {svcs.map((s) => (
            <div key={s.id} className="list-row">
              {s.image ? <img src={media(s.image)} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} /> : <span className="im-ic" style={{ width: 44, height: 44 }}><Wrench size={18} /></span>}
              <div className="grow" style={{ minWidth: 0 }}><b className="small">{s.name}</b><div className="xs muted">{SPECIALTIES[s.category]} · {s.duration}</div>{s.description && <div className="xs muted ellipsis">{s.description}</div>}</div>
              <b className="small">{money(s.price)}{s.price_from && <span className="xs muted"> dan</span>}</b>
              <button className="icon-btn" onClick={() => setEdit(s)} aria-label="Tahrirlash"><Pencil size={14} /></button>
              <button className="icon-btn" onClick={() => del(s)} aria-label="O'chirish"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
      <PhotoSection kind="work" items={work} reload={loadPhotos} title="Ishlardan namunalar" hint="«Oldin/keyin» rasmlari mijozlar ishonchini eng ko'p oshiradi (30 tagacha)." />
      {edit && <SvcModal s={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function SvcModal({ s, onClose, onSaved }: { s: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ ...s, description: s.description || "", price_from: !!s.price_from });
  const [img, setImg] = useState<File | null>(null);
  const [drop, setDrop] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const preview = img ? URL.createObjectURL(img) : !drop && s.image ? media(s.image) : null;
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      for (const k of ["name", "category", "price", "duration", "description"]) fd.append(k, String(f[k] ?? ""));
      fd.append("price_from", f.price_from ? "true" : "false");
      if (img) fd.append("image", img); else if (drop) fd.append("remove_image", "1");
      s.id ? await api.patch(`/masters/me/services/${s.id}/`, fd) : await api.post("/masters/me/services/", fd);
      onSaved();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title={s.id ? "Xizmatni tahrirlash" : "Yangi xizmat"} onClose={onClose}>
      <div className="col gap-12">
        <label className="field"><span>Nomi</span><input className="input" value={f.name} onChange={set("name")} placeholder="Motor diagnostikasi" /></label>
        <label className="field"><span>Yo'nalish</span><select className="select" value={f.category} onChange={set("category")}>{Object.entries(SPECIALTIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div className="grid g2">
          <label className="field"><span>Narx (so'm)</span><input className="input" type="number" value={f.price} onChange={set("price")} /></label>
          <label className="field"><span>Davomiyligi</span><input className="input" value={f.duration} onChange={set("duration")} /></label>
        </div>
        <label className="row gap-8 small"><input type="checkbox" checked={f.price_from} onChange={set("price_from")} />Narx «...dan» (aniq narx ko'rikdan keyin)</label>
        <label className="field"><span>Nimalar kiradi (ixtiyoriy)</span><textarea className="textarea" rows={2} maxLength={300} value={f.description} onChange={set("description")} placeholder="Masalan: moy va filtr almashtirish, 20 punkt tekshiruv, kafolat 1 oy" /></label>
        <div className="field"><span>Rasm (ixtiyoriy)</span>
          <div className="row gap-8">
            <label className="dropzone" style={{ width: 120, height: 90, minHeight: 0 }}>{preview ? <img src={preview} alt="" /> : <Plus size={20} />}<input type="file" accept="image/*" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) { setImg(x); setDrop(false); } }} /></label>
            {preview && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setImg(null); setDrop(true); }}><Trash2 size={14} />Olib tashlash</button>}
          </div>
        </div>
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-block" disabled={!f.name || !f.price || busy} onClick={save}>{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
      </div>
    </Modal>
  );
}

function PhotoSection({ kind, items, reload, title, hint }: { kind: "place" | "work"; items: any[]; reload: () => void; title: string; hint: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pair, setPair] = useState(false);
  const max = kind === "place" ? 15 : 30;
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try { for (const f of Array.from(files).slice(0, max - items.length)) { const fd = new FormData(); fd.append("image", f); fd.append("kind", kind); await api.post("/masters/me/photos/", fd); } toast("Rasmlar yuklandi", "success"); }
    catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); reload(); }
  };
  const del = async (id: number) => { if (!confirm("O'chirilsinmi?")) return; await api.delete(`/masters/me/photos/${id}/`); reload(); };
  return (
    <div className="card">
      <div className="row between wrap gap-8"><div className="grow" style={{ minWidth: 200 }}><h3>{title} <span className="muted small">{items.length}/{max}</span></h3><p className="xs muted">{hint}</p></div>
        <div className="row gap-8">
          {kind === "work" && <button className="btn btn-sm" onClick={() => setPair(true)}><Plus size={15} />Oldin / keyin</button>}
          <label className={"btn btn-sm" + (kind === "work" ? " btn-ghost" : "")} style={{ cursor: "pointer" }}><Plus size={15} />{busy ? "Yuklanmoqda…" : kind === "work" ? "Bitta rasm" : "Rasm qo'shish"}<input type="file" accept="image/*" multiple hidden disabled={busy || items.length >= max} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} /></label>
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
      {pair && <PairModal onClose={() => setPair(false)} onDone={() => { setPair(false); reload(); }} />}
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
