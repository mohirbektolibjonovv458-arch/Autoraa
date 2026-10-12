import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, Flag, Loader2, Mic, MicOff, PhoneOff, ShieldCheck, Star, Users, UserX } from "lucide-react";
import { Badge, cx, ErrorState, Modal, PageHeader, PageSkeleton, Segmented } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { get, patch, post, tokens } from "../../lib/api";
import { useAuth } from "../../lib/auth";

type Phase = "lobby" | "searching" | "connecting" | "call" | "ended";
type Sess = {
  id: string; status: string; level: string; role: "caller" | "callee"; topic: any; matched_at: string | null; ended_at: string | null; server_time: string;
  partner: { id: number; name: string; level: string; rating: { avg: number | null; count: number } } | null; rated: boolean; xp: number;
  signals?: { id: number; kind: string; payload: any }[];
};

const RULES = [
  "Faqat ingliz tilida, o'quv mavzusida gaplashaman.",
  "Telefon raqam, Telegram, Instagram, manzil kabi shaxsiy ma'lumot so'ramayman va bermayman.",
  "Haqorat, odobsiz gap va bezovta qilish taqiqlanadi — buzganlar bloklanadi.",
  "Noqulay vaziyatda darhol «Tugatish» va «Shikoyat» tugmasini bosaman.",
  "Suhbat yozib olinmaydi; ovoz to'g'ridan-to'g'ri sherigimga boradi.",
];
const POLL_MS = 1500;
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function Partner() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [cfg, setCfg] = useState<any>(null);
  const [err, setErr] = useState<any>(null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [level, setLevel] = useState(() => {
    const l = user?.english_level || "B1";
    return l.startsWith("A") ? (l === "A1" ? "A2" : l) : l === "C2" ? "C1" : l;
  });
  const [sess, setSess] = useState<Sess | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [note, setNote] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  // WebRTC holati — render'ga bog'liq emas
  const rt = useRef<{ pc?: RTCPeerConnection; stream?: MediaStream; sid?: string; after: number; out: any[]; pendingIce: any[]; timer?: number; flush?: number; started: number; alive: boolean; connectTimeout?: number }>({ after: 0, out: [], pendingIce: [], started: 0, alive: true });
  const audio = useRef<HTMLAudioElement>(null);

  const load = useCallback(() => get("/speak/config/").then(setCfg).catch(setErr), []);
  useEffect(() => { load(); }, [load]);

  const cleanup = useCallback(() => {
    const r = rt.current;
    window.clearInterval(r.timer); window.clearInterval(r.flush); window.clearTimeout(r.connectTimeout);
    r.pc?.close(); r.pc = undefined;
    r.stream?.getTracks().forEach((t) => t.stop()); r.stream = undefined;
    r.out = []; r.pendingIce = []; r.after = 0;
  }, []);

  // Sahifadan chiqilsa yoki yopilsa — suhbat tugatiladi
  useEffect(() => {
    const leave = () => {
      const sid = rt.current.sid;
      if (!sid) return;
      fetch(`/api/speak/${sid}/end/`, { method: "POST", keepalive: true, headers: { Authorization: `Bearer ${tokens.access()}` } }).catch(() => {});
    };
    window.addEventListener("pagehide", leave);
    return () => { window.removeEventListener("pagehide", leave); rt.current.alive = false; leave(); cleanup(); };
  }, [cleanup]);

  useEffect(() => {
    if (phase !== "call" || !sess?.matched_at) return;
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - rt.current.started) / 1000)), 500);
    return () => window.clearInterval(t);
  }, [phase, sess?.matched_at]);

  const finish = (s: Sess | null, msg?: string) => {
    cleanup();
    rt.current.sid = undefined;
    if (s) setSess(s);
    setPhase("ended");
    if (msg) toast(msg, "info");
  };

  const sendSignal = (kind: string, payload: any) => { rt.current.out.push({ kind, payload }); };
  const flushSignals = async () => {
    const r = rt.current;
    if (!r.sid || !r.out.length) return;
    const batch = r.out.splice(0, 50);
    try { await post(`/speak/${r.sid}/signal/`, { signals: batch }); } catch { /* suhbat tugagan bo'lishi mumkin */ }
  };

  const startRtc = async (s: Sess) => {
    const r = rt.current;
    const pc = new RTCPeerConnection({ iceServers: cfg.ice_servers });
    r.pc = pc;
    r.stream!.getTracks().forEach((t) => pc.addTrack(t, r.stream!));
    pc.ontrack = (e) => { if (audio.current) { audio.current.srcObject = e.streams[0]; audio.current.play().catch(() => {}); } };
    pc.onicecandidate = (e) => { if (e.candidate) sendSignal("ice", e.candidate.toJSON()); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        window.clearTimeout(r.connectTimeout);
        r.started = Date.now();
        setPhase("call");
      } else if (pc.connectionState === "failed") {
        endCall("Ovozli ulanish o'rnatilmadi (tarmoq cheklovi). Qayta urinib ko'ring.");
      }
    };
    r.flush = window.setInterval(flushSignals, 400);
    r.connectTimeout = window.setTimeout(() => { if (pc.connectionState !== "connected") endCall("Sherik bilan ulanib bo'lmadi. Qayta urinib ko'ring."); }, 30000);
    if (s.role === "caller") {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal("offer", { type: offer.type, sdp: offer.sdp });
    }
  };

  const handleSignals = async (list: Sess["signals"]) => {
    const r = rt.current;
    const pc = r.pc;
    if (!pc || !list) return;
    for (const g of list) {
      r.after = Math.max(r.after, g.id);
      try {
        if (g.kind === "offer" && !pc.remoteDescription) {
          await pc.setRemoteDescription(g.payload);
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          sendSignal("answer", { type: ans.type, sdp: ans.sdp });
        } else if (g.kind === "answer" && !pc.remoteDescription) {
          await pc.setRemoteDescription(g.payload);
        } else if (g.kind === "ice") {
          if (pc.remoteDescription) await pc.addIceCandidate(g.payload);
          else r.pendingIce.push(g.payload);
        }
        if (pc.remoteDescription && r.pendingIce.length) {
          for (const c of r.pendingIce.splice(0)) await pc.addIceCandidate(c);
        }
      } catch { /* noto'g'ri signal e'tiborsiz qoldiriladi */ }
    }
  };

  const pollLoop = (sid: string) => {
    const r = rt.current;
    window.clearInterval(r.timer);
    let busy = false;
    let rtcStarted = false;
    r.timer = window.setInterval(async () => {
      if (busy || r.sid !== sid) return;
      busy = true;
      try {
        const s: Sess = await get(`/speak/${sid}/?after=${r.after}`);
        if (r.sid !== sid) return;
        if (s.status === "ended" || s.status === "cancelled") {
          finish(s, s.status === "ended" ? "Suhbat tugadi" : undefined);
          if (s.status === "cancelled") setPhase("lobby");
          return;
        }
        if (s.status === "matched") {
          if (!rtcStarted) {
            rtcStarted = true;
            setSess(s);
            setPhase("connecting");
            if ("vibrate" in navigator) navigator.vibrate?.(120);
            await startRtc(s);
          }
          await handleSignals(s.signals);
        } else {
          setSess(s);
        }
      } catch { /* vaqtinchalik tarmoq xatosi — keyingi so'rovda qayta */ }
      finally { busy = false; }
    }, POLL_MS);
  };

  const search = async () => {
    try {
      rt.current.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      toast("Mikrofonga ruxsat bering: brauzer manzil satridagi 🔒 belgisi → Mikrofon → Ruxsat.", "bad");
      return;
    }
    setMuted(false);
    setElapsed(0);
    setNote("");
    try {
      const s: Sess = await post("/speak/find/", { level });
      rt.current.sid = s.id;
      rt.current.after = 0;
      setSess(s);
      setPhase("searching");
      rt.current.started = Date.now();
      pollLoop(s.id);
    } catch (e: any) {
      cleanup();
      toast(e.message, "bad");
      load();
    }
  };

  const endCall = async (msg?: string) => {
    const sid = rt.current.sid;
    rt.current.sid = undefined;
    cleanup();
    if (!sid) return;
    try {
      const s: Sess = await post(`/speak/${sid}/end/`);
      if (s.status === "cancelled") { setPhase("lobby"); load(); return; }
      finish(s, msg);
    } catch { setPhase("lobby"); }
  };

  const toggleMute = () => {
    const t = rt.current.stream?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setMuted(!t.enabled);
  };

  // Qidiruvdagi kutish vaqti
  const [waitSec, setWaitSec] = useState(0);
  useEffect(() => {
    if (phase !== "searching") { setWaitSec(0); return; }
    const t = window.setInterval(() => setWaitSec((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  if (err) return <ErrorState error={err} onRetry={() => { setErr(null); load(); }} />;
  if (!cfg) return <PageSkeleton />;
  const el = cfg.eligibility;

  return (
    <>
      <PageHeader title="Speaking partner" subtitle="Boshqa o'quvchi bilan jonli ingliz tilida suhbat" back="/english" />
      <audio ref={audio} autoPlay playsInline />

      {!el.ok ? <Gate el={el} cfg={cfg} onDone={load} setUser={setUser} /> : phase === "lobby" ? (
        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-3xl gradient-hero p-5 text-white shadow-lift animate-fade-up">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-400/30 blur-2xl animate-float" />
            <div className="relative flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Users className="h-6 w-6" /></div>
              <div><p className="text-lg font-extrabold">Sherik toping va gapiring</p><p className="text-sm text-white/80">Har suhbatda IELTS uslubidagi mavzu · 10 daqiqa</p></div>
            </div>
            <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/15 p-2.5"><p className="text-lg font-extrabold">{cfg.stats.sessions}</p><p className="text-[11px] text-white/75">suhbat</p></div>
              <div className="rounded-2xl bg-white/15 p-2.5"><p className="text-lg font-extrabold">{cfg.stats.minutes}</p><p className="text-[11px] text-white/75">daqiqa</p></div>
              <div className="rounded-2xl bg-white/15 p-2.5"><p className="text-lg font-extrabold">{cfg.stats.rating.avg ?? "—"}</p><p className="text-[11px] text-white/75">reyting</p></div>
            </div>
          </section>

          <section className="card space-y-4 p-5">
            <div>
              <p className="label">Ingliz tili darajangiz</p>
              <Segmented value={level} onChange={setLevel} options={cfg.levels.map((l: string) => ({ value: l, label: `${l}${cfg.waiting[l] ? ` · ${cfg.waiting[l]}` : ""}` }))} />
              <p className="mt-2 text-xs text-sub">Sizga yaqin darajadagi (±1) va o'z yosh guruhingizdagi sherik tanlanadi. Hozir onlayn: {cfg.online}</p>
            </div>
            <button className="btn-primary h-14 w-full text-base" onClick={search}><Mic className="h-5 w-5" /> Sherik topish</button>
            <p className="flex items-start gap-2 text-xs text-sub"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> Faqat ismingiz ko'rinadi. Suhbat yozib olinmaydi. Har qanday paytda tugatish, shikoyat qilish va bloklash mumkin.</p>
          </section>

          <Link to="/ai?mode=speaking" className="card flex items-center gap-3 p-4 hover:shadow-lift">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><Bot className="h-5 w-5" /></div>
            <div className="flex-1"><p className="font-bold">AI bilan mashq</p><p className="text-xs text-sub">Sherik kutmasdan — AI savol beradi va javobingizni tahlil qiladi</p></div>
          </Link>
        </div>
      ) : phase === "searching" ? (
        <section className="card p-8 text-center animate-fade-up">
          <div className="relative mx-auto grid h-28 w-28 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
            <span className="absolute inset-3 animate-pulse rounded-full bg-brand/20" />
            <div className="relative grid h-16 w-16 place-items-center rounded-full gradient-hero text-white"><Users className="h-7 w-7" /></div>
          </div>
          <p className="mt-5 text-lg font-extrabold">Sherik qidirilmoqda…</p>
          <p className="mt-1 text-sm text-sub">{level} daraja · {fmt(waitSec)}</p>
          {waitSec >= 45 && (
            <div className="mt-5 rounded-2xl bg-muted p-4 text-sm">
              <p>Hozir onlayn sheriklar kam. Kutishda davom etishingiz yoki AI bilan mashq qilishingiz mumkin.</p>
              <button className="btn-soft btn-sm mt-3" onClick={() => { endCall(); nav("/ai?mode=speaking"); }}><Bot className="h-4 w-4" /> AI bilan mashq</button>
            </div>
          )}
          <button className="btn-outline mt-6" onClick={() => endCall()}>Bekor qilish</button>
        </section>
      ) : phase === "connecting" || phase === "call" ? (
        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-3xl gradient-hero p-6 text-center text-white shadow-lift">
            <div className="relative mx-auto grid h-24 w-24 place-items-center">
              {phase === "call" && <span className="absolute inset-0 animate-ping rounded-full bg-white/20 [animation-duration:2s]" />}
              <div className="relative grid h-20 w-20 place-items-center rounded-full bg-white/20 text-3xl font-extrabold">{sess?.partner?.name?.[0]?.toUpperCase() || "?"}</div>
            </div>
            <p className="mt-3 text-xl font-extrabold">{sess?.partner?.name}</p>
            <p className="text-sm text-white/80">{sess?.partner?.level}{sess?.partner?.rating.avg ? ` · ⭐ ${sess.partner.rating.avg}` : ""}</p>
            <p className="mt-3 font-mono text-3xl font-extrabold tabular-nums">{phase === "call" ? fmt(elapsed) : <span className="inline-flex items-center gap-2 text-base"><Loader2 className="h-4 w-4 animate-spin" /> Ulanmoqda…</span>}</p>
            {phase === "call" && <div className="mx-auto mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.min(100, (elapsed / 600) * 100)}%` }} /></div>}
            <div className="mt-5 flex justify-center gap-4">
              <button onClick={toggleMute} aria-label={muted ? "Mikrofonni yoqish" : "Mikrofonni o'chirish"} className={cx("grid h-14 w-14 place-items-center rounded-full transition active:scale-95", muted ? "bg-white text-brand" : "bg-white/20")}>{muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}</button>
              <button onClick={() => endCall("Suhbat tugadi")} aria-label="Tugatish" className="grid h-14 w-14 place-items-center rounded-full bg-rose-500 shadow-lift transition active:scale-95"><PhoneOff className="h-6 w-6" /></button>
              <button onClick={() => setReportOpen(true)} aria-label="Shikoyat" className="grid h-14 w-14 place-items-center rounded-full bg-white/20 transition active:scale-95"><Flag className="h-6 w-6" /></button>
            </div>
          </section>
          {sess?.topic && <TopicCard topic={sess.topic} role={sess.role} partner={sess.partner?.name || "Sherik"} />}
        </div>
      ) : (
        <Ended sess={sess} onAgain={() => { setSess(null); setPhase("lobby"); load(); }} onReport={() => setReportOpen(true)} />
      )}

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Shikoyat qilish">
        <p className="text-sm text-sub">Shikoyatdan so'ng suhbat tugaydi va bu foydalanuvchi siz bilan boshqa juftlashmaydi. Administrator ko'rib chiqadi.</p>
        <textarea className="input mt-3 min-h-20" placeholder="Izoh (ixtiyoriy)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-3 grid gap-2">
          {cfg.reasons.map(([k, label]: [string, string]) => (
            <button key={k} className="btn-outline justify-start" onClick={async () => {
              const sid = sess?.id;
              if (!sid) return;
              try {
                await post(`/speak/${sid}/report/`, { reason: k, note });
                setReportOpen(false);
                rt.current.sid = undefined;
                cleanup();
                const s: Sess = await get(`/speak/${sid}/`);
                finish(s, "Shikoyat yuborildi. Foydalanuvchi bloklandi.");
              } catch (e: any) { toast(e.message, "bad"); }
            }}>{label}</button>
          ))}
        </div>
      </Modal>
    </>
  );
}

function TopicCard({ topic, role, partner }: { topic: any; role: string; partner: string }) {
  const [part, setPart] = useState<"p1" | "p2" | "p3">("p1");
  return (
    <section className="card p-5 animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-sub">Mavzu</p><p className="text-lg font-extrabold">{topic.title}</p></div>
        <Badge>{role === "caller" ? "Siz boshlaysiz" : `${partner} boshlaydi`}</Badge>
      </div>
      <div className="mt-3"><Segmented value={part} onChange={setPart} options={[{ value: "p1", label: "Part 1" }, { value: "p2", label: "Part 2" }, { value: "p3", label: "Part 3" }]} /></div>
      {part === "p2" ? (
        <p className="mt-4 rounded-2xl bg-muted p-4 text-[15px] leading-relaxed">{topic.p2}<span className="mt-2 block text-xs text-sub">1 daqiqa tayyorlaning, 2 daqiqa gapiring. Sherigingiz vaqtni kuzatadi.</span></p>
      ) : (
        <ol className="mt-4 space-y-2">
          {topic[part].map((q: string, i: number) => <li key={q} className="flex gap-3 rounded-xl bg-muted p-3 text-[15px]"><span className="font-bold text-brand">{i + 1}.</span>{q}</li>)}
        </ol>
      )}
      <p className="mt-3 text-xs text-sub">Navbat bilan savol bering. Xato qilishdan qo'rqmang — maqsad gapirish.</p>
    </section>
  );
}

function Ended({ sess, onAgain, onReport }: { sess: Sess | null; onAgain: () => void; onReport: () => void }) {
  const toast = useToast();
  const [stars, setStars] = useState(0);
  const [rated, setRated] = useState(!!sess?.rated);
  const dur = sess?.matched_at && sess?.ended_at ? Math.max(0, Math.round((+new Date(sess.ended_at) - +new Date(sess.matched_at)) / 1000)) : 0;
  const rate = async (n: number) => {
    setStars(n);
    try { await post(`/speak/${sess!.id}/rate/`, { stars: n }); setRated(true); toast("Rahmat! Bahoyingiz saqlandi"); } catch (e: any) { toast(e.message, "bad"); }
  };
  return (
    <section className="card p-6 text-center animate-fade-up">
      <p className="text-4xl">{sess?.xp ? "🎉" : "👋"}</p>
      <p className="mt-2 text-xl font-extrabold">Suhbat tugadi</p>
      <p className="mt-1 text-sm text-sub">{sess?.partner ? `${sess.partner.name} bilan · ${fmt(dur)}` : "Sherik topilmadi"}</p>
      {sess?.xp ? <Badge tone="ok" className="mt-3">+{sess.xp} XP</Badge> : sess?.partner ? <p className="mt-3 text-xs text-sub">XP 2 daqiqadan uzun suhbatlar uchun beriladi.</p> : null}
      {sess?.partner && (
        <div className="mt-5">
          <p className="text-sm font-semibold">Sherigingiz qanday suhbatdosh edi?</p>
          <div className="mt-2 flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} disabled={rated} onClick={() => rate(n)} aria-label={`${n} yulduz`} className="p-1 transition hover:scale-110 disabled:hover:scale-100">
                <Star className={cx("h-8 w-8", n <= stars ? "fill-amber-400 text-amber-400" : "text-line")} />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button className="btn-primary" onClick={onAgain}><Users className="h-4 w-4" /> Yana sherik topish</button>
        {sess?.partner && (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-outline btn-sm" onClick={onReport}><Flag className="h-4 w-4" /> Shikoyat</button>
            <button className="btn-outline btn-sm" onClick={async () => { await post(`/speak/${sess.id}/block/`); toast("Bloklandi — boshqa juftlashmaysiz"); }}><UserX className="h-4 w-4" /> Bloklash</button>
          </div>
        )}
      </div>
    </section>
  );
}

function Gate({ el, cfg, onDone, setUser }: { el: any; cfg: any; onDone: () => void; setUser: (u: any) => void }) {
  const toast = useToast();
  const [year, setYear] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  if (el.reason === "birth_year") {
    return (
      <section className="card space-y-4 p-5 animate-fade-up">
        <p className="font-bold">Tug'ilgan yilingiz</p>
        <p className="text-sm text-sub">{el.detail} Jonli suhbat {cfg.min_age} yoshdan ochiq; 18 yoshgacha bo'lganlar faqat tengdoshlari bilan juftlashadi.</p>
        <input className="input" type="number" inputMode="numeric" placeholder="Masalan: 2008" min={1950} max={2022} value={year} onChange={(e) => setYear(e.target.value)} />
        <p className="text-xs text-warn">Diqqat: tug'ilgan yil bir marta kiritiladi va keyin faqat administrator o'zgartira oladi.</p>
        <button className="btn-primary w-full" disabled={busy || year.length !== 4} onClick={async () => {
          setBusy(true);
          try { setUser(await patch("/auth/me/", { birth_year: +year })); onDone(); } catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
        }}>Saqlash</button>
      </section>
    );
  }
  if (el.reason === "rules") {
    return (
      <section className="card space-y-4 p-5 animate-fade-up">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-ok/10 text-ok"><ShieldCheck className="h-6 w-6" /></div><p className="text-lg font-extrabold">Suhbat qoidalari</p></div>
        <ul className="space-y-2">{RULES.map((r) => <li key={r} className="flex gap-2 rounded-xl bg-muted p-3 text-sm"><span>✅</span><span>{r}</span></li>)}</ul>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-[rgb(var(--brand))]" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> Qoidalarga roziman. Qoidabuzarlik uchun bloklanishim mumkinligini tushunaman.</label>
        <button className="btn-primary w-full" disabled={!agree || busy} onClick={async () => { setBusy(true); try { await post("/speak/rules/"); onDone(); } catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); } }}>Davom etish</button>
      </section>
    );
  }
  return (
    <section className="card p-6 text-center animate-fade-up">
      <p className="text-4xl">{el.reason === "age" ? "🌱" : "⛔"}</p>
      <p className="mt-3 font-semibold">{el.detail}</p>
      <Link to="/ai?mode=speaking" className="btn-primary mt-5"><Bot className="h-4 w-4" /> AI Speaking bilan mashq</Link>
    </section>
  );
}
