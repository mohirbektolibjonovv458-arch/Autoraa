/**
 * Ustalar hikoyalari (story): bosh sahifadagi qator, to'liq ekranli ko'rish oynasi, joylash / tahrirlash.
 * Hikoya — rasm yoki video (60 soniyagacha) + qisqa matn, 24 soatdan keyin o'zi o'chadi. Usta o'z hikoyasini istalgan payt tahrirlaydi yoki o'chiradi.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, ChevronRight, Clock, Eye, Images, Pencil, Plus, RefreshCw, Trash2, Video, Volume2, VolumeX, X } from "lucide-react";
import { api, errMsg, media } from "../api";
import { timeAgo } from "../utils";
import { useAuth } from "../auth";
import { Avatar, Verified, useToast } from "./ui";

type Story = { id: number; image: string | null; video: string | null; kind: "image" | "video"; duration: number | null; caption: string; created_at: string; expires_at: string; seen: boolean; edited: boolean; views?: number };
type Group = { master_id: number; name: string; avatar: string | null; is_verified: boolean; own: boolean; all_seen: boolean; latest_at: string; stories: Story[] };

const DURATION = 6000;  // bitta rasmli hikoya ekranda (ms); video — o'z uzunligicha
const MAX_VIDEO_S = 60, MAX_VIDEO_MB = 100;
let handoff = false;   // ko'rish oynasidan tahrirlashga o'tilmoqda — «orqaga» yozuvi qayta ishlatiladi
let soundOff = false;  // ovozni o'chirgan bo'lsa — keyingi videolarda ham o'chiq qoladi

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
          onEdit={(s) => { handoff = true; setOpen(null); setCompose(s); }}
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
  const [muted, setMuted] = useState(soundOff);
  const [buffering, setBuffering] = useState(false);
  const vid = useRef<HTMLVideoElement>(null);
  const s = g?.stories[si];
  const isVideo = !!s?.video;
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
    elapsed.current = 0; setProgress(0); setLoaded(false); setBuffering(false);
    if (s && !g.own && !s.seen) { api.post(`/masters/stories/${s.id}/view/`).catch(() => {}); onSeen(g.master_id, s.id); }
  }, [gi, si]);
  useEffect(() => {
    if (!loaded || paused) return;
    let last = performance.now(), raf = 0;
    if (isVideo) {  // video: chiziq video vaqtiga qarab, tugashi — onEnded
      const tick = () => {
        const v = vid.current;
        if (v) { const d = v.duration && isFinite(v.duration) ? v.duration : s?.duration || 15; setProgress(Math.min(1, v.currentTime / d)); }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    const tick = (t: number) => {
      elapsed.current += t - last; last = t;
      const p = Math.min(1, elapsed.current / DURATION);
      setProgress(p);
      if (p >= 1) next(); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded, paused, next, isVideo]);
  // video: pauza / davom; brauzer ovozli ijroga ruxsat bermasa — ovozsiz davom etadi
  useEffect(() => {
    const v = vid.current;
    if (!v || !isVideo) return;
    if (paused) { v.pause(); return; }
    v.muted = muted;
    v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}); });
  }, [paused, isVideo, gi, si, muted]);

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
    return () => { window.removeEventListener("popstate", onPop); if (history.state?.avtoraStory && !handoff) history.back(); };
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
          {isVideo && <button type="button" className="sv-x" onClick={() => { soundOff = !muted; setMuted(!muted); }} aria-label={muted ? "Ovozni yoqish" : "Ovozni o'chirish"}>{muted ? <VolumeX size={21} /> : <Volume2 size={21} />}</button>}
          <button type="button" className="sv-x" onClick={close} aria-label="Yopish"><X size={22} /></button>
        </div>
        <div className="sv-media" onPointerDown={down} onPointerUp={up} onPointerCancel={() => { press.current = null; setPaused(false); }}
          onContextMenu={(e) => e.preventDefault()}>
          {(!loaded || buffering) && <span className="im-spin sv-spin" />}
          {isVideo ? (
            <video key={s.id} ref={vid} src={media(s.video!)} poster={s.image ? media(s.image) : undefined} playsInline autoPlay muted={muted} preload="auto"
              onLoadedData={() => setLoaded(true)} onError={() => setLoaded(true)} onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)}
              onEnded={next} disablePictureInPicture controls={false} />
          ) : (
            <img key={s.id} src={media(s.image!)} alt={s.caption || "Hikoya"} draggable={false} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} />
          )}
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

/** Video uzunligi va muqovasi (bitta kadr, JPEG) — muqova hikoya yuklanguncha ko'rinadi. */
function videoMeta(url: string): Promise<{ duration: number | null; poster: Blob | null }> {
  return new Promise((res) => {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    let done = false;
    const dur = () => (v.duration && isFinite(v.duration) ? v.duration : null);
    const finish = (poster: Blob | null) => { if (done) return; done = true; res({ duration: dur(), poster }); v.removeAttribute("src"); v.load(); };
    v.onloadedmetadata = () => { try { v.currentTime = Math.min(0.4, (dur() || 1) / 3); } catch { finish(null); } };
    v.onseeked = () => {
      try {
        const k = Math.min(1, 1080 / Math.max(v.videoWidth || 1, v.videoHeight || 1));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(v.videoWidth * k)); c.height = Math.max(1, Math.round(v.videoHeight * k));
        c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => finish(b), "image/jpeg", 0.82);
      } catch { finish(null); }
    };
    v.onerror = () => finish(null);
    setTimeout(() => finish(null), 8000);
  });
}

const isVideoFile = (f: File) => f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/i.test(f.name);
const isImageFile = (f: File) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);

/** Hikoya joylash / tahrirlash — to'liq ekran (Instagram uslubida): media, o'ngda asboblar, pastda izoh va «Hikoyangiz». */
function StoryComposer({ story, onClose, onDone }: { story: Story | null; onClose: () => void; onDone: (msg: string) => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const orig = story ? { kind: story.kind, url: media((story.video || story.image)!), poster: story.image ? media(story.image) : undefined } : null;
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<"image" | "video" | null>(orig?.kind || null);
  const [preview, setPreview] = useState<string | null>(orig?.url || null);
  const [poster, setPoster] = useState<Blob | null>(null);
  const [dur, setDur] = useState<number | null>(story?.duration ?? null);
  const [caption, setCaption] = useState(story?.caption || "");
  const [typing, setTyping] = useState(false);
  const [muted, setMuted] = useState(soundOff);
  const [checking, setChecking] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const pv = useRef<HTMLVideoElement>(null);

  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!handoff) history.pushState({ avtoraStory: true }, "");
    handoff = false;
    const onPop = () => onClose();  // telefonning «orqaga» tugmasi
    window.addEventListener("popstate", onPop);
    return () => { document.body.style.overflow = prevOverflow; window.removeEventListener("popstate", onPop); if (history.state?.avtoraStory) history.back(); };
  }, []);
  useEffect(() => {  // ko'rib chiqishda video ovozli o'ynaydi; brauzer ruxsat bermasa — ovozsiz
    const v = pv.current;
    if (!v) return;
    v.muted = muted;
    v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}); });
  }, [preview, muted]);

  const pick = async (f?: File | null) => {
    if (!f) return;
    const video = isVideoFile(f);
    if (!video && !isImageFile(f)) { toast("Rasm yoki video tanlang", "error"); return; }
    if (video && f.size > MAX_VIDEO_MB * 1024 * 1024) { toast(`Video juda katta (${Math.round(f.size / 1048576)} MB). ${MAX_VIDEO_MB} MB gacha bo'lsin.`, "error"); return; }
    const url = URL.createObjectURL(f);
    if (video) {
      setChecking(true);
      const m = await videoMeta(url);
      setChecking(false);
      if (m.duration && m.duration > MAX_VIDEO_S + 0.5) {
        URL.revokeObjectURL(url);
        toast(`Video ${Math.round(m.duration)} soniya — hikoya ${MAX_VIDEO_S} soniyagacha bo'ladi. Qisqaroq video tanlang.`, "error");
        return;
      }
      setPoster(m.poster); setDur(m.duration ? Math.round(m.duration) : null);
    } else { setPoster(null); setDur(null); }
    setFile(f); setKind(video ? "video" : "image"); setPreview(url);
  };
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; pick(f); };

  const back = () => {
    if (pct !== null) return;
    if (typing) { setTyping(false); return; }
    if (file) {  // tanlangan faylni bekor qilish — oldingi holatga
      setFile(null); setPoster(null);
      setKind(orig?.kind || null); setPreview(orig?.url || null); setDur(story?.duration ?? null);
      return;
    }
    onClose();
  };

  const submit = async () => {
    if (pct !== null) return;
    if (!story && !file) { toast("Rasm yoki video tanlang", "error"); return; }
    setTyping(false); setPct(0);
    try {
      const fd = new FormData();
      if (file && kind === "video") {
        fd.append("video", file, file.name || "video.mp4");
        if (poster) fd.append("image", poster, "poster.jpg");
        if (dur) fd.append("duration", String(dur));
      } else if (file) {
        fd.append("image", await shrink(file), file.name.replace(/\.(png|webp|heic|heif)$/i, ".jpg"));
      }
      fd.append("caption", caption.trim());
      const cfg = { timeout: 0, onUploadProgress: (e: any) => { if (e.total) setPct(Math.min(99, Math.round((e.loaded * 100) / e.total))); } };
      if (story) await api.patch(`/masters/stories/${story.id}/`, fd, cfg); else await api.post("/masters/stories/", fd, cfg);
      onDone(story ? "Hikoya yangilandi" : "Hikoya joylandi — 24 soat ko'rinadi");
    } catch (e) { toast(errMsg(e), "error"); setPct(null); }
  };

  const busy = pct !== null;
  return createPortal(
    <div className="sc-full" role="dialog" aria-modal="true" aria-label={story ? "Hikoyani tahrirlash" : "Yangi hikoya"}>
      <div className="sc-frame">
        {!preview ? (
          <>
            <div className="sc-top">
              <button type="button" className="sc-round" onClick={onClose} aria-label="Yopish"><ArrowLeft size={22} /></button>
              <b>Yangi hikoya</b>
            </div>
            <div className="sc-pick">
              <label className="sc-opt"><span><Camera size={26} /></span>Rasm olish<input type="file" accept="image/*" capture="environment" hidden onChange={onInput} /></label>
              <label className="sc-opt"><span><Video size={26} /></span>Video olish<input type="file" accept="video/*" capture="environment" hidden onChange={onInput} /></label>
              <button type="button" className="sc-opt" onClick={() => gallery.current?.click()}><span><Images size={26} /></span>Galereya</button>
              <p>Rasm yoki {MAX_VIDEO_S} soniyagacha video. Hikoya 24 soat ko'rinadi, istalgan payt tahrirlash yoki o'chirish mumkin.</p>
              {checking && <span className="im-spin" style={{ color: "#fff" }} />}
            </div>
          </>
        ) : (
          <>
            <div className="sc-stage" onClick={() => !busy && setTyping(true)}>
              {kind === "video"
                ? <video ref={pv} src={preview} poster={!file ? orig?.poster : undefined} playsInline autoPlay loop muted={muted} />
                : <img src={preview} alt="" />}
              {caption && !typing && <div className="sv-caption">{caption}</div>}
            </div>
            <button type="button" className="sc-round sc-back" onClick={back} aria-label="Orqaga"><ArrowLeft size={22} /></button>
            <div className="sc-tools">
              <button type="button" className="sc-round" onClick={() => setTyping(true)} aria-label="Matn yozish" title="Matn"><span className="sc-aa">Aa</span></button>
              {kind === "video" && <button type="button" className="sc-round" onClick={() => { soundOff = !muted; setMuted(!muted); }} aria-label={muted ? "Ovozni yoqish" : "Ovozni o'chirish"}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>}
              <button type="button" className="sc-round" onClick={() => gallery.current?.click()} aria-label="Boshqa rasm yoki video" title="Almashtirish"><RefreshCw size={19} /></button>
              {kind === "video" && dur ? <span className="sc-dur">0:{String(dur).padStart(2, "0")}</span> : null}
            </div>
            <div className="sc-bottom">
              <input className="sc-caption" value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} placeholder="Izoh qo'shing…" aria-label="Izoh" />
              <div className="sc-actions">
                <button type="button" className="sc-pill" onClick={submit} disabled={busy}>
                  <Avatar name={user?.full_name || user?.first_name} src={user?.avatar} />{story ? "Saqlash" : "Hikoyangiz"}
                </button>
                <button type="button" className="sc-go" onClick={submit} disabled={busy} aria-label={story ? "Saqlash" : "Joylash"}><ChevronRight size={26} /></button>
              </div>
            </div>
            {typing && (
              <div className="sc-typing" onClick={() => setTyping(false)}>
                <button type="button" className="sc-done" onClick={() => setTyping(false)}>Tayyor</button>
                <textarea autoFocus maxLength={200} value={caption} onClick={(e) => e.stopPropagation()} onChange={(e) => setCaption(e.target.value)} placeholder="Matn yozing…" aria-label="Hikoya matni" />
                <span className="sc-count">{caption.length}/200</span>
              </div>
            )}
            {busy && (
              <div className="sc-upload" role="status">
                <span className="sc-ring" style={{ ["--p" as any]: `${pct}%` }}><b>{pct}%</b></span>
                <span>{kind === "video" && file ? "Video yuklanmoqda…" : "Yuklanmoqda…"}</span>
              </div>
            )}
          </>
        )}
        <input ref={gallery} type="file" accept="image/*,video/*" hidden onChange={onInput} />
      </div>
    </div>,
    document.body,
  );
}
