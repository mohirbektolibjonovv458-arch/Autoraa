import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, BookOpen, Bot, Compass, Copy, History, Lock, Mic, MicOff, Plus, Send, ShieldCheck, Target, ThumbsDown, ThumbsUp, Trash2, Volume2, X } from "lucide-react";
import { cx, Modal, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";
import { ApiError, del, get, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Markdown } from "../lib/markdown";
import { listen, micErrorText, speak, speechSupport, stopSpeaking } from "../lib/speech";
import { timeAgo } from "../lib/format";

type Msg = { id: number | string; role: "user" | "assistant"; content: string; feedback?: string; pending?: boolean; error?: boolean };
type Status = { configured: boolean; used_today: number; limit: number; plan: string; modes: { id: string; label: string; locked: boolean }[] };

const MODE_META: Record<string, { icon: any; hint: string; color: string; examples: string[]; lang: string }> = {
  tutor: { icon: Bot, hint: "Matematika, fizika, kimyo va boshqa fanlar", color: "from-violet-500 to-indigo-600", lang: "uz-UZ",
    examples: ["x² − 5x + 6 = 0 tenglamani bosqichma-bosqich yech", "Fotosintezni sodda tilda tushuntir", "Kasrlar bo'yicha 5 ta test tuzib ber", "Nyutonning 2-qonunini misol bilan tushuntir"] },
  english: { icon: BookOpen, hint: "Grammatika, so'zlar, matnni tekshirish", color: "from-sky-500 to-indigo-600", lang: "en-US",
    examples: ["Present Perfect qachon ishlatiladi?", "Check my sentence: She don't like coffee", "Give me 5 B1 words about education", "IELTS Speaking Part 1 savollarini ber"] },
  career: { icon: Compass, hint: "Kasb va yo'nalish tanlash", color: "from-fuchsia-500 to-violet-600", lang: "uz-UZ",
    examples: ["Dasturchi bo'lish uchun nimalarni o'rganishim kerak?", "Matematikani yoqtiraman, qaysi kasblar mos?", "Shifokor va farmatsevt farqi nima?", "Mening test natijamni tushuntir"] },
  planner: { icon: Target, hint: "Kunlik va haftalik o'quv rejasi", color: "from-indigo-500 to-blue-700", lang: "uz-UZ",
    examples: ["3 oyda IELTS 6.5 uchun reja tuz", "Kuniga 1 soat vaqtim bor, qanday o'qiy?", "Imtihonga 2 hafta qoldi, nima qilay?", "Diqqatimni qanday jamlay?"] },
  speaking: { icon: Mic, hint: "Ingliz tilida ovozli suhbat", color: "from-rose-500 to-fuchsia-600", lang: "en-US",
    examples: ["Let's talk about my hobbies", "Ask me IELTS Speaking Part 1 questions", "Help me practise ordering food", "Let's discuss my future career"] },
};

function PrivacyNote({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Mikrofon va ma'lumotlar">
      <div className="space-y-3 text-sm text-sub">
        <p className="flex gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-ok" /> Ovozli rejimda nutqingizni <b className="text-ink">brauzeringiz</b> matnga aylantiradi (Chrome'da bu Google nutq xizmati orqali ishlaydi).</p>
        <p>EduWay serveriga <b className="text-ink">faqat tanilgan matn</b> yuboriladi va suhbat tarixi sifatida akkauntingizda saqlanadi. Audio yozuvlar EduWay'da saqlanmaydi.</p>
        <p>Mikrofon faqat siz tugmani bosganingizda yoqiladi. Ruxsatni istalgan vaqtda brauzer sozlamalaridan o'chirishingiz mumkin.</p>
        <p>Suhbatlarni istalgan vaqtda «Tarix» bo'limidan o'chirishingiz mumkin.</p>
      </div>
      <button className="btn-primary mt-5 w-full" onClick={onClose}>Tushunarli</button>
    </Modal>
  );
}

export default function AIChat() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [mode, setMode] = useState(sp.get("mode") || "tutor");
  const [conv, setConv] = useState<number | null>(id ? +id : null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState(sp.get("topic") ? `«${sp.get("topic")}» mavzusini menga qaytadan, sodda qilib tushuntir va 3 ta mashq ber.` : "");
  const [busy, setBusy] = useState(false);
  const [loadingConv, setLoadingConv] = useState(!!id);
  const [history, setHistory] = useState<any[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [listening, setListening] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(mode === "speaking");
  const stopRef = useRef<() => void>(() => {});
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { get<Status>("/ai/status/").then(setStatus).catch(() => {}); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);
  useEffect(() => () => { stopRef.current(); stopSpeaking(); }, []);

  useEffect(() => {
    if (!id) { setConv(null); setMsgs([]); setLoadingConv(false); return; }
    setLoadingConv(true);
    get(`/ai/conversations/${id}/`).then((c) => { setConv(c.id); setMode(c.mode); setMsgs(c.messages); }).catch(() => { toast("Suhbat topilmadi", "bad"); nav("/ai", { replace: true }); }).finally(() => setLoadingConv(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = MODE_META[mode] || MODE_META.tutor;
  const locked = status?.modes.find((m) => m.id === mode)?.locked;
  const limitReached = status ? status.used_today >= status.limit : false;

  const pickMode = (m: string) => {
    stopSpeaking();
    setMode(m);
    setAutoSpeak(m === "speaking");
    setSp(m === "tutor" ? {} : { mode: m }, { replace: true });
    if (conv) { setConv(null); setMsgs([]); nav(`/ai${m === "tutor" ? "" : `?mode=${m}`}`); }
    if (m === "speaking") { try { if (!localStorage.getItem("eduway-mic-note")) { setPrivacy(true); localStorage.setItem("eduway-mic-note", "1"); } } catch { setPrivacy(true); } }
  };

  const send = async (raw?: string) => {
    const message = (raw ?? text).trim();
    if (!message || busy) return;
    stopSpeaking();
    setText("");
    const tmp: Msg = { id: `u${Date.now()}`, role: "user", content: message };
    setMsgs((m) => [...m, tmp]);
    setBusy(true);
    try {
      const r = await post("/ai/chat/", conv ? { conversation: conv, message } : { mode, message });
      setMsgs((m) => [...m.filter((x) => x.id !== tmp.id), r.user_message, r.message]);
      if (!conv) { setConv(r.conversation.id); window.history.replaceState(null, "", `/ai/${r.conversation.id}`); }
      setStatus((s) => (s ? { ...s, used_today: r.used_today, limit: r.limit } : s));
      setHistory(null);
      if (autoSpeak && speechSupport.synthesis) speak(r.message.content, mode === "speaking" || mode === "english" ? "en-US" : "uz-UZ");
    } catch (e) {
      const err = e as ApiError;
      setMsgs((m) => [...m.filter((x) => x.id !== tmp.id), { ...tmp, error: true }, { id: `e${Date.now()}`, role: "assistant", content: err.message, error: true }]);
      if (err.code === "ai_limit_reached") setStatus((s) => (s ? { ...s, used_today: s.limit } : s));
      setText(message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const toggleMic = () => {
    if (listening) { stopRef.current(); setListening(false); return; }
    stopSpeaking();
    setListening(true);
    let finalText = "";
    stopRef.current = listen(meta.lang, (t, final) => { setText(t); if (final) finalText = t; }, (err) => {
      setListening(false);
      if (err && err !== "aborted") toast(micErrorText(err), "bad");
      else if (finalText && mode === "speaking") send(finalText);
    });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 768px)").matches) { e.preventDefault(); send(); }
  };

  const feedback = async (m: Msg, value: "good" | "bad") => {
    const v = m.feedback === value ? "" : value;
    setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, feedback: v } : x)));
    try { await post(`/ai/messages/${m.id}/feedback/`, { value: v }); if (v === "bad") toast("Rahmat! Javob ko'rib chiqish uchun belgilandi.", "info"); } catch { /* ignore */ }
  };

  const openHistory = async () => {
    setShowHistory(true);
    if (!history) setHistory(await get("/ai/conversations/").catch(() => []));
  };
  const removeConv = async (cid: number) => {
    await del(`/ai/conversations/${cid}/`);
    setHistory((h) => h?.filter((x) => x.id !== cid) || null);
    if (cid === conv) { setConv(null); setMsgs([]); nav("/ai"); }
    toast("Suhbat o'chirildi");
  };

  return (
    <div className="flex h-[calc(100dvh-4rem-6.5rem)] flex-col lg:h-[calc(100dvh-4rem-2rem)]">
      {/* Rejimlar */}
      <div className="flex items-center gap-2">
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto py-1">
          {Object.entries(MODE_META).map(([m, v]) => {
            const lock = status?.modes.find((x) => x.id === m)?.locked;
            return (
              <button key={m} onClick={() => pickMode(m)} className={cx("chip shrink-0", mode === m && "chip-on")}>
                <v.icon className="h-4 w-4" /> {status?.modes.find((x) => x.id === m)?.label || m}
                {lock && <Lock className="h-3.5 w-3.5 text-warn" />}
              </button>
            );
          })}
        </div>
        <button onClick={openHistory} className="btn-outline btn-sm shrink-0" aria-label="Suhbatlar tarixi"><History className="h-4 w-4" /></button>
        <button onClick={() => { setConv(null); setMsgs([]); nav(`/ai${mode === "tutor" ? "" : `?mode=${mode}`}`); }} className="btn-outline btn-sm shrink-0" aria-label="Yangi suhbat"><Plus className="h-4 w-4" /></button>
      </div>

      {status && !status.configured && (
        <div className="mt-2 flex gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
          <p><b>AI xizmati hali ulanmagan.</b> Administrator serverda <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code> ni sozlashi kerak. {user?.is_admin && <Link to="/admin" className="font-semibold text-brand">Admin panel →</Link>}</p>
        </div>
      )}

      {/* Xabarlar */}
      <div className="mt-2 flex-1 overflow-y-auto rounded-3xl border border-line/70 bg-surface/60 p-3 sm:p-5">
        {loadingConv ? (
          <div className="grid h-full place-items-center"><Spinner className="h-7 w-7 text-brand" /></div>
        ) : msgs.length === 0 ? (
          <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center animate-fade-up">
            <div className={cx("grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-lift", meta.color)}><meta.icon className="h-8 w-8" /></div>
            <h2 className="mt-4 text-xl font-extrabold">{status?.modes.find((x) => x.id === mode)?.label || "BilimAI"}</h2>
            <p className="mt-1 text-sm text-sub">{meta.hint}</p>
            {locked ? (
              <div className="mt-6 w-full max-w-sm rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm">
                <p className="font-bold">Ovozli speaking Premium tarifda</p>
                <p className="mt-1 text-sub">Ingliz tilida AI bilan gaplashib, talaffuz va javoblaringiz bo'yicha fikr-mulohaza oling.</p>
                <Link to="/premium" className="btn-primary btn-sm mt-3">Premium haqida</Link>
              </div>
            ) : (
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {meta.examples.map((e) => (
                  <button key={e} onClick={() => send(e)} disabled={busy || !status?.configured} className="card p-3 text-left text-sm font-medium transition hover:border-brand/50 disabled:opacity-60">{e}</button>
                ))}
              </div>
            )}
            {mode === "speaking" && !locked && (
              <p className="mt-4 text-xs text-sub">Mikrofon tugmasini bosing va inglizcha gapiring. <button className="font-semibold text-brand" onClick={() => setPrivacy(true)}>Ma'lumotlar qanday ishlatiladi?</button></p>
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {msgs.map((m) => (
              <div key={m.id} className={cx("flex gap-2.5 animate-fade-up", m.role === "user" && "justify-end")}>
                {m.role === "assistant" && <div className={cx("mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white", m.error ? "bg-bad" : "gradient-hero")}>{m.error ? <AlertTriangle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</div>}
                <div className={cx("max-w-[85%] rounded-2xl px-4 py-3", m.role === "user" ? "rounded-br-md bg-brand text-brand-ink" : m.error ? "border border-bad/30 bg-bad/5" : "rounded-bl-md border border-line bg-surface")}>
                  {m.role === "user" ? <p className="whitespace-pre-wrap text-[15px]">{m.content}</p> : <Markdown text={m.content} />}
                  {m.role === "assistant" && m.error && /limit/i.test(m.content) && <Link to="/premium" className="btn-soft btn-sm mt-2">Premium</Link>}
                  {m.role === "assistant" && !m.error && typeof m.id === "number" && (
                    <div className="mt-2 flex items-center gap-1 text-sub">
                      <button onClick={() => feedback(m, "good")} aria-label="Foydali" className={cx("grid h-8 w-8 place-items-center rounded-lg hover:bg-muted", m.feedback === "good" && "text-ok")}><ThumbsUp className="h-4 w-4" /></button>
                      <button onClick={() => feedback(m, "bad")} aria-label="Xato yoki foydasiz" className={cx("grid h-8 w-8 place-items-center rounded-lg hover:bg-muted", m.feedback === "bad" && "text-bad")}><ThumbsDown className="h-4 w-4" /></button>
                      <button onClick={() => { navigator.clipboard?.writeText(m.content); toast("Nusxa olindi"); }} aria-label="Nusxa olish" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Copy className="h-4 w-4" /></button>
                      {speechSupport.synthesis && <button onClick={() => speak(m.content, mode === "speaking" || mode === "english" ? "en-US" : "uz-UZ")} aria-label="O'qib berish" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Volume2 className="h-4 w-4" /></button>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex gap-2.5">
                <div className="mt-1 grid h-8 w-8 place-items-center rounded-xl gradient-hero text-white"><Bot className="h-4 w-4" /></div>
                <div className="rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3.5">
                  <div className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-brand/60" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Kiritish */}
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); send(); }} className="mt-2">
        {mode === "speaking" && !locked && msgs.length > 0 && (
          <div className="mb-2 flex items-center justify-between text-xs text-sub">
            <label className="flex items-center gap-2"><input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} className="accent-[rgb(var(--brand))]" /> Javoblarni ovozda o'qish</label>
            <button type="button" className="font-semibold text-brand" onClick={() => setPrivacy(true)}>Maxfiylik</button>
          </div>
        )}
        <div className={cx("flex items-end gap-2 rounded-2xl border bg-surface p-2 shadow-card transition", listening ? "border-bad ring-4 ring-bad/15" : "border-line focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15")}>
          {speechSupport.recognition && (
            <button type="button" onClick={toggleMic} disabled={locked || busy} aria-label={listening ? "To'xtatish" : "Ovoz bilan yozish"} className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl transition", listening ? "bg-bad text-white animate-pulse" : "bg-muted text-sub hover:text-ink")}>
              {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
          <textarea ref={inputRef} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} maxLength={4000}
            disabled={locked} placeholder={listening ? "Tinglayapman..." : locked ? "Premium rejim" : mode === "speaking" ? "Speak or type in English..." : "Savolingizni yozing..."}
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none placeholder:text-sub/70" />
          <button type="submit" disabled={!text.trim() || busy || locked || !status?.configured || limitReached} aria-label="Yuborish" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white transition disabled:opacity-40">
            {busy ? <Spinner /> : <Send className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-sub">
          {status ? `Bugun: ${status.used_today}/${status.limit} so'rov · ` : ""}AI xato qilishi mumkin — muhim ma'lumotlarni (muddat, narx, talablar) rasmiy manbadan tekshiring.
        </p>
      </form>

      {/* Tarix */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end bg-navy/40 backdrop-blur-sm" onClick={() => setShowHistory(false)}>
          <div className="h-full w-full max-w-sm overflow-y-auto bg-surface p-5 animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Suhbatlar</h2><button onClick={() => setShowHistory(false)} aria-label="Yopish" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-muted"><X className="h-5 w-5" /></button></div>
            {!history ? <div className="mt-6 grid place-items-center"><Spinner /></div> : history.length === 0 ? <p className="mt-6 text-sm text-sub">Hali suhbatlar yo'q.</p> : (
              <ul className="mt-4 space-y-2">
                {history.map((c) => {
                  const Icon = (MODE_META[c.mode] || MODE_META.tutor).icon;
                  return (
                    <li key={c.id} className={cx("flex items-center gap-2 rounded-xl border p-2.5", c.id === conv ? "border-brand bg-brand-soft" : "border-line")}>
                      <Link to={`/ai/${c.id}`} onClick={() => setShowHistory(false)} className="flex min-w-0 flex-1 items-center gap-2.5">
                        <Icon className="h-5 w-5 shrink-0 text-brand" />
                        <div className="min-w-0"><p className="truncate text-sm font-semibold">{c.title || "Suhbat"}</p><p className="text-xs text-sub">{timeAgo(c.updated)}</p></div>
                      </Link>
                      <button onClick={() => removeConv(c.id)} aria-label="O'chirish" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sub hover:bg-bad/10 hover:text-bad"><Trash2 className="h-4 w-4" /></button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
      <PrivacyNote open={privacy} onClose={() => setPrivacy(false)} />
    </div>
  );
}
