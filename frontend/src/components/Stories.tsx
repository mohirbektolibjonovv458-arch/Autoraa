/**
 * Ustalar hikoyalari (story): bosh sahifadagi qator, to'liq ekranli ko'rish oynasi, joylash / tahrirlash.
 * Hikoya — rasm + qisqa matn, 24 soatdan keyin o'zi o'chadi. Usta o'z hikoyasini istalgan payt tahrirlaydi yoki o'chiradi.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Camera, ChevronRight, Clock, Eye, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { api, errMsg, media } from "../api";
import { timeAgo } from "../utils";
import { Avatar, Modal, Verified, useToast } from "./ui";

type Story = { id: number; image: string; caption: string; created_at: string; expires_at: string; seen: boolean; edited: boolean; views?: number };
type Group = { master_id: number; name: string; avatar: string | null; is_verified: boolean; own: boolean; all_seen: boolean; latest_at: string; stories: Story[] };

const DURATION = 6000;  // bitta hikoya ekranda (ms)

const leftText = (iso: string) => {
  const h = Math.max(0, (new Date(iso).getTime() - Date.now()) / 3600000);
  return h >= 1 ? `${Math.floor(h)} soat qoldi` : `${Math.max(1, Math.round(h * 60))} daqiqa qoldi`;
};

export default function StoriesBar() {
  const toast = useToast();
  const [data, setData] = useState<{ groups: Group[]; can_post: boolean } | null>(null);
  const [open, setOpen] = useState<number | null>(null);        // ochilgan guruh indeksi
  const [compose, setCompose] = useState<Story | "new" | null>(null);
  const load = useCallback(() => api.get("/masters/stories/").then((r) => setData(r.data)).catch(() => {}), []);
  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  if (!data || (!data.groups.length && !data.can_post)) return null;  // hikoya yo'q — joy egallamaydi
  const markSeen = (gid: number, sid: number) => setData((d) => d && ({ ...d, groups: d.groups.map((g) => g.master_id !== gid ? g : { ...g, stories: g.stories.map((s) => s.id === sid ? { ...s, seen: true } : s) }) }));

  return (
    <section className="stories" aria-label="Ustalar hikoyalari">
      <div className="stories-head">
        <div><b>Ustalar hikoyalari</b><span className="xs muted"> · eng faol ustalar va yangiliklar</span></div>
      </div>
      <div className="stories-row">
        {data.can_post && (
          <button type="button" className="story-tile" onClick={() => setCompose("new")}>
            <span className="story-ring add"><span className="story-add"><Plus size={24} /></span></span>
            <span className="story-name">Hikoya qo'shish</span>
            <span className="story-time">24 soatga</span>
          </button>
        )}
        {data.groups.map((g, i) => {
          const unseen = g.stories.some((s) => !s.seen);
          return (
            <button type="button" key={g.master_id} className="story-tile" onClick={() => setOpen(i)} aria-label={`${g.name} hikoyasi`}>
              <span className={"story-ring" + (g.own ? " own" : unseen ? "" : " seen")}><Avatar name={g.name} src={g.avatar} /></span>
              <span className="story-name">{g.own ? "Sizning hikoyangiz" : g.name}</span>
              <span className="story-time"><i className={unseen && !g.own ? "on" : ""} />{timeAgo(g.latest_at)}</span>
            </button>
          );
        })}
      </div>
      {open !== null && data.groups[open] && (
        <StoryViewer groups={data.groups} start={open} onClose={() => { setOpen(null); load(); }} onSeen={markSeen}
          onEdit={(s) => { setOpen(null); setCompose(s); }}
          onDeleted={() => { toast("Hikoya o'chirildi"); setOpen(null); load(); }} />
      )}
      {compose && <StoryComposer story={compose === "new" ? null : compose} onClose={() => setCompose(null)}
        onDone={(msg) => { setCompose(null); toast(msg, "success"); load(); }} />}
    </section>
  );
}

function StoryViewer({ groups, start, onClose, onSeen, onEdit, onDeleted }: {
  groups: Group[]; start: number; onClose: () => void; onSeen: (gid: number, sid: number) => void;
  onEdit: (s: Story) => void; onDeleted: () => void;
}) {
  const nav = useNavigate();
  const toast = useToast();
  const [gi, setGi] = useState(start);
  const g = groups[gi];
  // guruh ochilganda — birinchi ko'rilmagan hikoyadan
  const firstUnseen = (grp: Group) => Math.max(0, grp.own ? 0 : grp.stories.findIndex((s) => !s.seen));
  const [si, setSi] = useState(() => firstUnseen(groups[start]));
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const s = g?.stories[si];
  const elapsed = useRef(0);
  const press = useRef<{ t: number; x: number; y: number } | null>(null);

  const close = useCallback(() => { onClose(); }, [onClose]);
  const next = useCallback(() => {
    if (si < g.stories.length - 1) { setSi(si + 1); return; }
    if (gi < groups.length - 1) { const ng = groups[gi + 1]; setGi(gi + 1); setSi(firstUnseen(ng)); return; }
    close();
  }, [si, gi, g, groups, close]);
  const prev = useCallback(() => {
    if (si > 0) { setSi(si - 1); return; }
    if (gi > 0) { const pg = groups[gi - 1]; setGi(gi - 1); setSi(pg.stories.length - 1); }
  }, [si, gi, groups]);

  // yangi hikoya: taymer qaytadan, ko'rildi deb belgilash
  useEffect(() => {
    elapsed.current = 0; setProgress(0); setLoaded(false);
    if (s && !g.own && !s.seen) { api.post(`/masters/stories/${s.id}/view/`).catch(() => {}); onSeen(g.master_id, s.id); }
  }, [gi, si]);
  useEffect(() => {
    if (!loaded || paused) return;
    let last = performance.now(), raf = 0;
    const tick = (t: number) => {
      elapsed.current += t - last; last = t;
      const p = Math.min(1, elapsed.current / DURATION);
      setProgress(p);
      if (p >= 1) next(); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded, paused, next]);

  // klaviatura, sahifa aylanishi, telefondagi «orqaga» tugmasi — oynani yopadi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") prev(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [close, next, prev]);
  useEffect(() => {
    history.pushState({ avtoraStory: true }, "");
    const onPop = () => close();
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("popstate", onPop); if (history.state?.avtoraStory) history.back(); };
  }, []);

  if (!g || !s) return null;
  const down = (e: React.PointerEvent) => { press.current = { t: Date.now(), x: e.clientX, y: e.clientY }; setPaused(true); };
  const up = (e: React.PointerEvent) => {
    const p = press.current; press.current = null; setPaused(false);
    if (!p) return;
    if (e.clientY - p.y > 90) { close(); return; }                 // pastga surish — yopish
    if (Date.now() - p.t > 350) return;                             // bosib turish — faqat pauza
    const w = (e.currentTarget as HTMLElement).clientWidth;
    if (e.clientX < w * 0.33) prev(); else next();
  };
  const del = async () => {
    setPaused(true);
    if (!confirm("Hikoya o'chirilsinmi?")) { setPaused(false); return; }
    try { await api.delete(`/masters/stories/${s.id}/`); onDeleted(); } catch (e) { toast(errMsg(e), "error"); setPaused(false); }
  };

  return createPortal(
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label={`${g.name} hikoyasi`}>
      <div className="sv-frame">
        <div className="sv-bars">{g.stories.map((x, i) => <span key={x.id}><i style={{ width: `${i < si ? 100 : i === si ? progress * 100 : 0}%` }} /></span>)}</div>
        <div className="sv-head">
          <Avatar name={g.name} src={g.avatar} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row gap-4"><b className="ellipsis">{g.name}</b>{g.is_verified && <Verified />}</div>
            <div className="xs">{timeAgo(s.created_at)}{s.edited && " · tahrirlangan"}</div>
          </div>
          <button type="button" className="sv-x" onClick={close} aria-label="Yopish"><X size={22} /></button>
        </div>
        <div className="sv-media" onPointerDown={down} onPointerUp={up} onPointerCancel={() => { press.current = null; setPaused(false); }}
          onContextMenu={(e) => e.preventDefault()}>
          {!loaded && <span className="im-spin sv-spin" />}
          <img key={s.id} src={media(s.image)} alt={s.caption || "Hikoya"} draggable={false} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} />
          {s.caption && <div className="sv-caption">{s.caption}</div>}
        </div>
        <div className="sv-foot">
          {g.own ? (
            <>
              <span className="sv-meta"><Eye size={15} />{s.views ?? 0}</span>
              <span className="sv-meta"><Clock size={15} />{leftText(s.expires_at)}</span>
              <span className="grow" />
              <button type="button" className="sv-btn" onClick={() => onEdit(s)}><Pencil size={15} />Tahrirlash</button>
              <button type="button" className="sv-btn danger" onClick={del}><Trash2 size={15} />O'chirish</button>
            </>
          ) : (
            <button type="button" className="sv-btn wide" onClick={() => { close(); nav(`/app/masters/${g.master_id}`); }}>Ustaning profili<ChevronRight size={16} /></button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Katta rasmni yuborishdan oldin kichraytirish (mobil internetda tez yuklansin). HEIC kabi o'qilmaydiganlar — o'zgarishsiz. */
async function shrink(file: File, max = 1920): Promise<Blob> {
  if (file.size < 1.5 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), "image/jpeg", 0.88));
  } catch { return file; }
}

function StoryComposer({ story, onClose, onDone }: { story: Story | null; onClose: () => void; onDone: (msg: string) => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(story ? media(story.image) : null);
  const [caption, setCaption] = useState(story?.caption || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);
  const pick = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/") && !/\.(heic|heif)$/i.test(f.name)) { toast("Faqat rasm tanlang", "error"); return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const submit = async () => {
    if (!story && !file) { toast("Rasm tanlang", "error"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      if (file) fd.append("image", await shrink(file), file.name.replace(/\.(png|webp|heic|heif)$/i, ".jpg"));
      fd.append("caption", caption.trim());
      if (story) await api.patch(`/masters/stories/${story.id}/`, fd); else await api.post("/masters/stories/", fd);
      onDone(story ? "Hikoya yangilandi" : "Hikoya joylandi — 24 soat ko'rinadi");
    } catch (e) { toast(errMsg(e), "error"); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={story ? "Hikoyani tahrirlash" : "Yangi hikoya"} onClose={onClose}>
      <div className="col gap-12">
        <div className="sc-preview">
          {preview ? <img src={preview} alt="" /> : <div className="sc-empty"><ImagePlus size={30} /><span className="small">Ish jarayoni, tayyor mashina, aksiya yoki yangi uskuna rasmi</span></div>}
          {caption && preview && <div className="sv-caption">{caption}</div>}
        </div>
        <div className="row gap-8">
          <label className="btn btn-ghost grow" style={{ cursor: "pointer" }}><Camera size={16} />Kamera<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} /></label>
          <label className="btn btn-ghost grow" style={{ cursor: "pointer" }}><ImagePlus size={16} />Galereya<input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} /></label>
        </div>
        <label className="field"><span>Matn (ixtiyoriy) <em className="muted" style={{ fontStyle: "normal" }}>{caption.length}/200</em></span>
          <textarea className="input" rows={2} maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Masalan: Bugun 20% chegirma — motor diagnostikasi" /></label>
        <p className="xs muted">Hikoya joylangandan keyin 24 soat ko'rinadi, so'ng o'zi o'chadi. Istalgan payt tahrirlash yoki o'chirish mumkin.</p>
        <button className="btn btn-red btn-lg btn-block" disabled={busy || (!story && !file)} onClick={submit}>{busy ? "Yuklanmoqda…" : story ? "Saqlash" : "Joylash"}</button>
      </div>
    </Modal>
  );
}
