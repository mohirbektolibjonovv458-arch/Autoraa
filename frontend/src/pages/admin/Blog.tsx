import { useEffect, useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { api, errMsg } from "../../api";
import { Modal, Spinner, useToast } from "../../components/ui";
import { shortDate } from "../../utils";

const CATS = [["maslahat", "Maslahat"], ["yangilik", "Yangiliklar"], ["texnik", "Texnik xizmat"], ["qonun", "Qonunlar"]];

export default function AdminBlog() {
  const toast = useToast();
  const [items, setItems] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [bc, setBc] = useState({ title: "", body: "", role: "" });
  const load = () => api.get("/admin/blog/").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  const del = async (p: any) => { if (!confirm("O'chirilsinmi?")) return; await api.delete(`/admin/blog/${p.id}/`); load(); };
  const broadcast = async () => { try { const r = await api.post("/admin/broadcast/", { ...bc, role: bc.role || undefined }); toast(`${r.data.sent} ta foydalanuvchiga yuborildi`, "success"); setBc({ title: "", body: "", role: "" }); } catch (e) { toast(errMsg(e), "error"); } };

  return (
    <div className="grid g-2-1">
      <div className="card card-tight">
        <div className="row between" style={{ padding: "4px 8px" }}><b>Blog maqolalari</b><button className="btn btn-sm" onClick={() => setEdit({ title: "", category: "maslahat", excerpt: "", body: "", is_published: true })}><Plus size={15} />Yangi</button></div>
        {!items ? <Spinner /> : <div className="list">{items.map((p) => (
          <div key={p.id} className="list-row" style={{ padding: "12px 8px" }}>
            <div className="grow"><b className="small">{p.title}</b><div className="xs muted">{p.category_label} · {shortDate(p.created_at)} {!p.is_published && "· Qoralama"}</div></div>
            <button className="icon-btn" onClick={() => setEdit(p)} aria-label="Tahrirlash"><Pencil size={14} /></button><button className="icon-btn" onClick={() => del(p)} aria-label="O'chirish"><Trash2 size={14} /></button>
          </div>
        ))}</div>}
      </div>
      <div className="card col gap-12">
        <b className="row gap-8"><Megaphone size={18} />Ommaviy bildirishnoma</b>
        <select className="select" aria-label="Kimga" value={bc.role} onChange={(e) => setBc({ ...bc, role: e.target.value })}><option value="">Barcha foydalanuvchilar</option><option value="user">Mijozlar</option><option value="usta">Ustalar</option><option value="evakuator">Evakuatorlar</option></select>
        <input className="input" placeholder="Sarlavha" value={bc.title} onChange={(e) => setBc({ ...bc, title: e.target.value })} />
        <textarea className="textarea" placeholder="Matn" value={bc.body} onChange={(e) => setBc({ ...bc, body: e.target.value })} />
        <button className="btn" disabled={!bc.title} onClick={broadcast}>Yuborish</button>
      </div>
      {edit && <PostModal p={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function PostModal({ p, onClose, onSaved }: { p: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ ...p });
  const [img, setImg] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async () => {
    const fd = new FormData(); ["title", "category", "excerpt", "body"].forEach((k) => fd.append(k, f[k] || "")); fd.append("is_published", f.is_published ? "true" : "false"); if (img) fd.append("image", img);
    try { p.id ? await api.patch(`/admin/blog/${p.id}/`, fd) : await api.post("/admin/blog/", fd); onSaved(); } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <Modal title={p.id ? "Maqolani tahrirlash" : "Yangi maqola"} onClose={onClose}>
      <div className="col gap-12">
        <input className="input" placeholder="Sarlavha" value={f.title} onChange={set("title")} />
        <select className="select" aria-label="Kategoriya" value={f.category} onChange={set("category")}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input className="input" placeholder="Qisqa tavsif" value={f.excerpt} onChange={set("excerpt")} />
        <textarea className="textarea" style={{ minHeight: 180 }} placeholder="Matn" value={f.body} onChange={set("body")} />
        <label className="field"><span>Rasm</span><input type="file" accept="image/*" onChange={(e) => setImg(e.target.files?.[0] || null)} /></label>
        <label className="row gap-8 small"><input type="checkbox" checked={f.is_published} onChange={set("is_published")} />Chop etish</label>
        {err && <div className="alert error">{err}</div>}
        <button className="btn btn-block" disabled={!f.title || !f.body} onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}
