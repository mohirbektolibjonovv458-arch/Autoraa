import { useEffect, useRef, useState } from "react";
import { geoErrorText, getPreciseLocation } from "../../geo";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, MapPin, Send } from "lucide-react";
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
  const box = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  // active=1 — suhbat ekranda ko'rinib turibdi: server shu suhbatning yangi xabarlari uchun push yubormaydi (oyna o'zi yangilanadi)
  const fetchNew = () => api.get(`/chat/${id}/messages/`, { params: { ...(lastId.current ? { after: lastId.current } : {}), ...(document.visibilityState === "visible" ? { active: 1 } : {}) } }).then((r) => {
    setOther(r.data.other);
    if (r.data.messages.length) { lastId.current = r.data.messages[r.data.messages.length - 1].id; setMsgs((m) => [...m, ...r.data.messages.filter((x: any) => !m.some((y) => y.id === x.id))]); }
  });
  usePoll(() => { fetchNew(); }, 3000, [id]);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [msgs.length]);

  const post = async (data: any) => {
    try { const r = await api.post(`/chat/${id}/messages/`, data); lastId.current = Math.max(lastId.current, r.data.id); setMsgs((m) => [...m, r.data]); }
    catch (e) { toast(errMsg(e), "error"); }
  };
  const send = () => { if (!text.trim()) return; post({ text }); setText(""); };
  const sendImg = (f?: File) => { if (!f) return; const fd = new FormData(); fd.append("image", f); post(fd); };
  const sendLoc = () => {
    if (!navigator.geolocation) { toast("Qurilmangiz joylashuvni aniqlay olmaydi", "error"); return; }
    toast("Joylashuv aniqlanmoqda…");
    getPreciseLocation({ desired: 25, maxWait: 12000 })
      .then((f) => post({ lat: f.lat, lng: f.lng, text: "📍 Mening manzilim" }))
      .catch((e) => toast(geoErrorText(e), "error"));
  };

  return (
    <div className="chat-room">
      <div className="chat-head">
        <button className="icon-btn mobile-only" onClick={() => nav("/app/chat")} aria-label="Orqaga"><ArrowLeft size={18} /></button>
        <Avatar name={other?.full_name} src={other?.avatar} />
        <div className="grow"><b className="small">{other?.full_name}</b><div className="xs" style={{ color: other?.is_online ? "var(--green)" : "var(--muted)" }}>{other?.is_online ? "Online" : ROLE_LABEL[other?.role || "user"]}</div></div>
        {other?.phone && <a className="btn btn-sm btn-ghost" href={`tel:${other.phone}`}>Qo'ng'iroq</a>}
      </div>
      <div className="chat-msgs" ref={box}>
        {msgs.map((m) => (
          <div key={m.id} translate="no" className={"bubble" + (m.sender === user?.id ? " me" : "")}>
            {m.image && <ChatImage src={media(m.image)} />}
            {m.lat && <a href={`https://maps.google.com/?q=${m.lat},${m.lng}`} target="_blank" rel="noreferrer" className="row gap-4" style={{ textDecoration: "underline" }}><MapPin size={14} />Xaritada ochish</a>}
            {m.text && <div>{m.text}</div>}
            <time>{hhmm(m.created_at)}</time>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <label className="icon-btn" aria-label="Rasm" style={{ cursor: "pointer" }}><ImagePlus size={18} /><input type="file" accept="image/*" hidden onChange={(e) => sendImg(e.target.files?.[0])} /></label>
        <button className="icon-btn" onClick={sendLoc} aria-label="Manzil yuborish"><MapPin size={18} /></button>
        <input className="input grow" placeholder="Xabar yozing…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn" onClick={send} aria-label="Yuborish"><Send size={16} /></button>
      </div>
    </div>
  );
}

/** Chat rasmi; fayl serverda topilmasa — buzilgan rasm belgisi o'rniga tushunarli yozuv */
function ChatImage({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="xs muted">🖼 Rasm mavjud emas</span>;
  return <a href={src} target="_blank" rel="noreferrer"><img src={src} alt="" onError={() => setBroken(true)} /></a>;
}
