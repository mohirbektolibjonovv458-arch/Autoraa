import { useEffect, useRef, useState } from "react";
import { geoErrorText, getPreciseLocation } from "../../geo";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Check, CheckCheck, Copy, ImagePlus, MapPin, Mic, Pause, Pencil, Play, Send, Trash2, X } from "lucide-react";
import { api, errMsg, media } from "../../api";
import { useAuth, ROLE_LABEL } from "../../auth";
import { Avatar, Empty, useToast } from "../../components/ui";
import { hhmm, timeAgo, usePoll } from "../../utils";

export default function Chats() {
  const { id } = useParams();
  const [list, setList] = useState<any[]>([]);
  usePoll(() => { api.get("/chat/").then((r) => setList(r.data)); }, 8000, []);
  return (
    <div className={"chat-wrap" + (id ? " has-room" : "")}>
      <div className="chat-list">
        <div style={{ padding: "16px 16px 8px" }}><b>Xabarlar</b></div>
        {list.length === 0 && <Empty title="Suhbatlar yo'q" text="Usta profilidan «Xabar yozish» tugmasini bosing." />}
        {list.map((c) => (
          <Link key={c.id} to={`/app/chat/${c.id}`} className={"chat-item" + (String(c.id) === id ? " active" : "")}>
            <Avatar name={c.other.full_name} src={c.other.avatar} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row between"><b className="small ellipsis">{c.other.full_name}</b><span className="xs muted">{timeAgo(c.last_at)}</span></div>
              <div className="row between"><span className="xs muted ellipsis">{c.last_message || ROLE_LABEL[c.other.role]}</span>{c.unread > 0 && <span className="badge red">{c.unread}</span>}</div>
            </div>
          </Link>
        ))}
      </div>
      {id ? <Room id={id} key={id} /> : <div className="chat-room"><Empty title="Suhbatni tanlang" /></div>}
    </div>
  );
}

function Room({ id }: { id: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [other, setOther] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sel, setSel] = useState<number | null>(null);          // tanlangan xabar (amallar menyusi)
  const [editing, setEditing] = useState<any>(null);            // tahrirlanayotgan xabar
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const lastId = useRef(0);
  const since = useRef<number | null>(null);
  const rec = useVoiceRecorder((msg) => toast(msg, "error"));

  const merge = (incoming: any[]) => setMsgs((m) => {
    if (!incoming.length) return m;
    const byId = new Map(m.map((x) => [x.id, x]));
    incoming.forEach((x) => byId.set(x.id, { ...byId.get(x.id), ...x }));
    return [...byId.values()].sort((a, b) => a.id - b.id);
  });

  // active=1 — suhbat ekranda ko'rinib turibdi: server shu suhbatning yangi xabarlari uchun push yubormaydi (oyna o'zi yangilanadi).
  // since — oxirgi so'rovdan beri tahrirlangan / o'chirilgan / o'qilgan xabarlar ham keladi (ikkala tomonda darhol yangilanadi).
  const fetchNew = () => api.get(`/chat/${id}/messages/`, { params: {
    ...(lastId.current ? { after: lastId.current } : {}),
    ...(lastId.current && since.current ? { since: since.current } : {}),
    ...(document.visibilityState === "visible" ? { active: 1 } : {}),
  } }).then((r) => {
    setOther(r.data.other);
    since.current = r.data.server_time;
    const fresh = r.data.messages as any[];
    if (fresh.length) lastId.current = Math.max(lastId.current, fresh[fresh.length - 1].id);
    merge([...(r.data.changed || []), ...fresh]);
  });
  usePoll(() => { fetchNew(); }, 3000, [id]);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [msgs.length]);

  const post = async (data: any) => {
    try { const r = await api.post(`/chat/${id}/messages/`, data); lastId.current = Math.max(lastId.current, r.data.id); merge([r.data]); return true; }
    catch (e) { toast(errMsg(e), "error"); return false; }
  };
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (editing) {
      try { const r = await api.patch(`/chat/${id}/messages/${editing.id}/`, { text: t }); merge([r.data]); setEditing(null); setText(""); }
      catch (e) { toast(errMsg(e), "error"); }
      return;
    }
    setText(""); post({ text: t });
  };
  const startEdit = (m: any) => { setEditing(m); setText(m.text); setSel(null); setTimeout(() => input.current?.focus(), 0); };
  const cancelEdit = () => { setEditing(null); setText(""); };
  const remove = async (m: any) => {
    setSel(null);
    if (!confirm("Xabar ikkala tomonda ham o'chiriladi. Davom etasizmi?")) return;
    try { const r = await api.delete(`/chat/${id}/messages/${m.id}/`); merge([r.data]); if (editing?.id === m.id) cancelEdit(); }
    catch (e) { toast(errMsg(e), "error"); }
  };
  const copy = async (m: any) => {
    setSel(null);
    try { await navigator.clipboard.writeText(m.text); toast("Nusxa olindi"); } catch { toast("Nusxa olib bo'lmadi", "error"); }
  };
  const sendImg = (f?: File) => { if (!f) return; const fd = new FormData(); fd.append("image", f); post(fd); };
  const sendLoc = () => {
    if (!navigator.geolocation) { toast("Qurilmangiz joylashuvni aniqlay olmaydi", "error"); return; }
    toast("Joylashuv aniqlanmoqda…");
    getPreciseLocation({ desired: 25, maxWait: 12000 })
      .then((f) => post({ lat: f.lat, lng: f.lng, text: "📍 Mening manzilim" }))
      .catch((e) => toast(geoErrorText(e), "error"));
  };
  const sendVoice = async () => {
    const v = await rec.stop();
    if (!v) return;
    if (v.seconds < 1) { toast("Ovozli xabar juda qisqa"); return; }
    const fd = new FormData();
    fd.append("audio", v.blob, "voice" + v.ext);
    fd.append("duration", String(Math.round(v.seconds)));
    post(fd);
  };
  const canEdit = (m: any) => m.sender === user?.id && !m.deleted && !m.audio && m.lat == null && !!m.text
    && Date.now() - new Date(m.created_at).getTime() < 48 * 3600 * 1000;

  return (
    <div className="chat-room" onClick={() => setSel(null)}>
      <div className="chat-head">
        <button className="icon-btn mobile-only" onClick={() => nav("/app/chat")} aria-label="Orqaga"><ArrowLeft size={18} /></button>
        <Avatar name={other?.full_name} src={other?.avatar} />
        <div className="grow"><b className="small">{other?.full_name}</b><div className="xs" style={{ color: other?.is_online ? "var(--green)" : "var(--muted)" }}>{other?.is_online ? "Online" : ROLE_LABEL[other?.role || "user"]}</div></div>
        {other?.phone && <a className="btn btn-sm btn-ghost" href={`tel:${other.phone}`}>Qo'ng'iroq</a>}
      </div>
      <div className="chat-msgs" ref={box}>
        {msgs.map((m) => {
          const mine = m.sender === user?.id;
          return (
            <div key={m.id} className={"msg-row" + (mine ? " me" : "")}>
              <div translate="no" className={"bubble" + (mine ? " me" : "") + (m.deleted ? " deleted" : "") + (sel === m.id ? " sel" : "")}
                onClick={(e) => { e.stopPropagation(); if (!m.deleted) setSel(sel === m.id ? null : m.id); }}>
                {m.deleted ? <span className="row gap-4"><Ban size={14} />Xabar o'chirildi</span> : (
                  <>
                    {m.image && <ChatImage src={media(m.image)} />}
                    {m.audio && <VoicePlayer src={m.audio} seconds={m.audio_duration} mine={mine} />}
                    {m.lat && <a href={`https://maps.google.com/?q=${m.lat},${m.lng}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="row gap-4" style={{ textDecoration: "underline" }}><MapPin size={14} />Xaritada ochish</a>}
                    {m.text && <div className="bubble-text">{m.text}</div>}
                  </>
                )}
                <time>
                  {m.edited && !m.deleted && <span className="edited">tahrirlangan · </span>}
                  {hhmm(m.created_at)}
                  {mine && !m.deleted && (m.is_read ? <CheckCheck size={13} className="tick read" aria-label="O'qildi" /> : <Check size={13} className="tick" aria-label="Yuborildi" />)}
                </time>
              </div>
              {sel === m.id && (
                <div className="msg-actions" onClick={(e) => e.stopPropagation()}>
                  {canEdit(m) && <button onClick={() => startEdit(m)}><Pencil size={14} />Tahrirlash</button>}
                  {m.text && <button onClick={() => copy(m)}><Copy size={14} />Nusxa</button>}
                  {mine && <button className="danger" onClick={() => remove(m)}><Trash2 size={14} />O'chirish</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {editing && (
        <div className="chat-editbar">
          <Pencil size={14} /><div className="grow ellipsis"><b className="xs">Tahrirlanmoqda</b><div className="xs muted ellipsis">{editing.text}</div></div>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={cancelEdit} aria-label="Bekor qilish"><X size={16} /></button>
        </div>
      )}
      {rec.recording ? (
        <div className="chat-input rec-bar">
          <button className="icon-btn" onClick={() => rec.cancel()} aria-label="Bekor qilish"><Trash2 size={18} /></button>
          <span className="rec-dot" /><b className="small grow">{fmtSec(rec.seconds)} <span className="xs muted">· yozilmoqda (ko'pi bilan 3:00)</span></b>
          <button className="btn" onClick={sendVoice} aria-label="Ovozli xabarni yuborish"><Send size={16} /></button>
        </div>
      ) : (
        <div className="chat-input">
          {!editing && <label className="icon-btn" aria-label="Rasm" style={{ cursor: "pointer" }}><ImagePlus size={18} /><input type="file" accept="image/*" hidden onChange={(e) => sendImg(e.target.files?.[0])} /></label>}
          {!editing && <button className="icon-btn" onClick={sendLoc} aria-label="Manzil yuborish"><MapPin size={18} /></button>}
          <input ref={input} className="input grow" placeholder={editing ? "Xabarni tahrirlang…" : "Xabar yozing…"} value={text}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); if (e.key === "Escape" && editing) cancelEdit(); }} />
          {text.trim() || editing
            ? <button className="btn" onClick={send} aria-label={editing ? "Saqlash" : "Yuborish"}>{editing ? <Check size={16} /> : <Send size={16} />}</button>
            : <button className="btn mic-btn" onClick={() => rec.start()} aria-label="Ovozli xabar yozish"><Mic size={16} /></button>}
        </div>
      )}
    </div>
  );
}

const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Ovozli xabar yozish (MediaRecorder). Chrome/Android — WebM/Opus, iPhone — MP4/AAC. Ko'pi bilan 3 daqiqa. */
function useVoiceRecorder(onError: (msg: string) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const timer = useRef<any>(null);
  const done = useRef<((v: { blob: Blob; ext: string; seconds: number } | null) => void) | null>(null);
  const keep = useRef(true);

  const cleanup = () => {
    clearInterval(timer.current);
    mr.current?.stream.getTracks().forEach((t) => t.stop());
    mr.current = null; setRecording(false); setSeconds(0);
  };
  useEffect(() => () => { keep.current = false; if (mr.current?.state === "recording") mr.current.stop(); cleanup(); }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("Bu brauzer ovoz yozishni qo'llamaydi. Chrome yoki Safari'da oching."); return;
    }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e: any) {
      onError(e?.name === "NotAllowedError" ? "Mikrofonga ruxsat bering: brauzer sozlamalari (🔒) → Mikrofon → Ruxsat berish." : "Mikrofon topilmadi yoki band.");
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
    const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = () => {
      const type = r.mimeType || mime || "audio/webm";
      const secs = (Date.now() - started.current) / 1000;
      const ext = type.includes("mp4") ? ".m4a" : type.includes("ogg") ? ".ogg" : ".webm";
      const blob = new Blob(chunks.current, { type });
      cleanup();
      done.current?.(keep.current && blob.size ? { blob, ext, seconds: secs } : null);
      done.current = null;
    };
    mr.current = r;
    keep.current = true;
    started.current = Date.now();
    r.start(250);
    setRecording(true);
    timer.current = setInterval(() => {
      const s = (Date.now() - started.current) / 1000;
      setSeconds(s);
      if (s >= 180 && mr.current?.state === "recording") mr.current.stop();  // 3 daqiqa — avtomatik to'xtaydi
    }, 250);
  };
  const stop = () => new Promise<{ blob: Blob; ext: string; seconds: number } | null>((resolve) => {
    if (!mr.current || mr.current.state !== "recording") { resolve(null); return; }
    done.current = resolve;
    mr.current.stop();
  });
  const cancel = () => { keep.current = false; done.current = null; if (mr.current?.state === "recording") mr.current.stop(); else cleanup(); };
  return { recording, seconds, start, stop, cancel };
}

/** Ovozli xabar pleyeri. Fayl birinchi bosilganda yuklanadi (imzoli havola, keshlanadi). */
function VoicePlayer({ src, seconds, mine }: { src: string; seconds?: number | null; mine: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const total = seconds || 0;
  useEffect(() => () => { audio.current?.pause(); if (audio.current?.src.startsWith("blob:")) URL.revokeObjectURL(audio.current.src); }, []);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (failed) return;
    if (!audio.current) {
      setLoading(true);
      try {
        const r = await fetch(media(src));
        if (!r.ok) throw new Error(String(r.status));
        const a = new Audio(URL.createObjectURL(await r.blob()));
        a.ontimeupdate = () => setPos(a.currentTime);
        a.onended = () => { setPlaying(false); setPos(0); };
        a.onpause = () => setPlaying(false);
        a.onplay = () => setPlaying(true);
        audio.current = a;
      } catch { setFailed(true); setLoading(false); return; }
      setLoading(false);
    }
    const a = audio.current!;
    if (a.paused) a.play().catch(() => setFailed(true)); else a.pause();
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const a = audio.current;
    if (!a || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(total, ((e.clientX - rect.left) / rect.width) * total));
    setPos(a.currentTime);
  };
  if (failed) return <span className="xs">🎤 Ovozli xabarni ochib bo'lmadi</span>;
  const pct = total ? Math.min(100, (pos / total) * 100) : 0;
  return (
    <div className={"voice" + (mine ? " me" : "")}>
      <button className="voice-btn" onClick={toggle} aria-label={playing ? "Pauza" : "Tinglash"}>{loading ? <span className="im-spin" /> : playing ? <Pause size={16} /> : <Play size={16} />}</button>
      <div className="voice-track" onClick={seek}><div className="voice-fill" style={{ width: pct + "%" }} /></div>
      <span className="voice-time">{fmtSec(playing || pos ? pos : total)}</span>
    </div>
  );
}

/** Chat rasmi; fayl serverda topilmasa — buzilgan rasm belgisi o'rniga tushunarli yozuv */
function ChatImage({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="xs muted">🖼 Rasm mavjud emas</span>;
  return <a href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><img src={src} alt="" onError={() => setBroken(true)} /></a>;
}
