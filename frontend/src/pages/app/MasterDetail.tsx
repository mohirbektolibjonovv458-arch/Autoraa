import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import BeforeAfter from "../../components/BeforeAfter";
import SlotPicker, { fmtDay, isoDate } from "../../components/SlotPicker";
import { ArrowLeft, Briefcase, CalendarPlus, Check, Clock, Heart, MapPin, MessageCircle, Phone, Share2 } from "lucide-react";
import { api, errMsg, media } from "../../api";
import { useAuth } from "../../auth";
import { Avatar, CarArt, Modal, Spinner, Stars, useToast, Verified } from "../../components/ui";
import { money, shortDate, SPECIALTIES, useGeo } from "../../utils";

export default function MasterDetail() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const geo = useGeo();
  const [m, setM] = useState<any>(null);
  const [book, setBook] = useState(sp.get("book") === "1");
  const [pre, setPre] = useState<number | null>(null);
  const [zoom, setZoom] = useState<any>(null);
  const [revFilter, setRevFilter] = useState<"all" | "photo">("all");

  useEffect(() => { api.get(`/masters/${id}/`, { params: { lat: geo.lat, lng: geo.lng } }).then((r) => setM(r.data)); }, [id, geo.lat]);
  if (!m) return <Spinner />;

  const fav = async () => { const r = await api.post(`/masters/${m.id}/favorite/`); setM({ ...m, is_favorite: r.data.is_favorite }); toast(r.data.is_favorite ? "Sevimlilarga qo'shildi" : "Sevimlilardan olib tashlandi"); };
  const share = async () => {
    const url = window.location.origin + `/app/masters/${m.id}`;
    const text = `${m.name} — Avtora'dagi usta`;
    if (navigator.share) { try { await navigator.share({ title: m.name, text, url }); } catch { /* bekor qilindi */ } }
    else { navigator.clipboard?.writeText(url); toast("Havola nusxalandi", "success"); }
  };
  const chat = async () => { const r = await api.post("/chat/start/", { user_id: m.user.id }); nav(`/app/chat/${r.data.id}`); };

  return (
    <div className="col gap-16" style={{ maxWidth: 860 }}>
      <div className="hero-app" style={{ minHeight: 190, padding: 18 }}>
        {m.cover && <img src={media(m.cover)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: .5 }} />}
        {!m.cover && <CarArt className="car-art" />}
        <div className="row between" style={{ position: "relative" }}>
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="Orqaga"><ArrowLeft size={18} /></button>
          <div className="row gap-8"><button className="icon-btn" onClick={share} aria-label="Ulashish"><Share2 size={18} /></button><button className="icon-btn" onClick={fav} aria-label="Sevimli"><Heart size={18} fill={m.is_favorite ? "#ee2b2f" : "none"} color={m.is_favorite ? "#ee2b2f" : "currentColor"} /></button></div>
        </div>
      </div>
      <div className="card" style={{ marginTop: -60, position: "relative" }}>
        <div className="row-top">
          <Avatar name={m.name} src={m.user.avatar} size="xl" />
          <div className="grow">
            <div className="row gap-8 wrap"><h2 style={{ fontSize: 22 }} translate="no">{m.name}</h2>{m.is_verified && <Verified />}{m.user.is_premium && <span className="badge amber">★ Premium</span>}</div>
            <div className="row gap-12 mt-4 wrap"><Stars value={m.rating} count={m.reviews_count} />{m.distance_km != null && <span className="small muted row gap-4"><MapPin size={13} />{m.distance_km} km</span>}</div>
            <div className="chips mt-8 wrap" style={{ flexWrap: "wrap" }}>{m.specialties.map((s: string) => <span key={s} className="chip" style={{ padding: "5px 12px" }}>{SPECIALTIES[s] || s}</span>)}</div>
          </div>
        </div>
        <div className="row gap-16 mt-16 small muted wrap">
          <span className="row gap-4"><Briefcase size={14} />{m.experience_years} yil tajriba</span>
          <span className="row gap-4"><Clock size={14} />{m.is_24_7 ? "24/7 ish vaqti" : m.work_hours}
            {m.work_days?.length > 0 && m.work_days.length < 7 && <span className="muted"> · {m.work_days.map((d: number) => ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"][d]).join(", ")}</span>}
            {m.open_now === true && <b className="open-badge on" style={{ margin: "0 0 0 6px" }}>Hozir ochiq</b>}
            {m.open_now === false && <b className="open-badge off" style={{ margin: "0 0 0 6px" }}>Hozir yopiq</b>}</span>
          <span className="row gap-4"><MapPin size={14} />{m.address || "Toshkent"}</span>
          {m.completed_jobs > 0 && <span>{m.completed_jobs} ta bajarilgan ish</span>}
          {m.user.is_online && <span className="row gap-4" style={{ color: "var(--green)" }}><span className="online-dot" />Hozir online</span>}
        </div>
        {m.bio && <p className="small mt-12">{m.bio}</p>}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 17 }}>Xizmatlar va narxlar</h3>
        <div className="mt-8">
          {m.services.map((s: any) => (
            <div className="svc-line" key={s.id}>
              <b className="small">{s.name}</b>
              <span className="price">{money(s.price)}</span>
              <span className="xs muted">{SPECIALTIES[s.category] || ""} · {s.duration}</span>
              {user?.id !== m.user.id ? <button className="link xs" style={{ background: "none", border: 0, padding: 0, justifySelf: "end" }} onClick={() => { setPre(s.id); setBook(true); }}>Bron qilish →</button> : <span />}
            </div>
          ))}
          {m.services.length === 0 && <p className="small muted">Usta hali xizmat qo'shmagan.</p>}
        </div>
      </div>

      {m.photos?.length > 0 && (() => {
        const pairs = m.photos.filter((ph: any) => ph.before), singles = m.photos.filter((ph: any) => !ph.before);
        return (
          <div className="card">
            <h3 style={{ fontSize: 17 }}>Ishlardan namunalar</h3>
            {pairs.length > 0 && (
              <div className="ba-list mt-12">
                {pairs.map((ph: any) => (
                  <figure key={ph.id} className="ba-item">
                    <BeforeAfter before={media(ph.before)} after={media(ph.image)} alt={ph.caption} />
                    {ph.caption && <figcaption className="small" translate="no">{ph.caption}</figcaption>}
                  </figure>
                ))}
                <div className="xs muted">Solishtirish uchun suring</div>
              </div>
            )}
            {singles.length > 0 && <div className="gallery mt-12">{singles.map((ph: any) => <button key={ph.id} className="gi" onClick={() => setZoom({ src: media(ph.image), caption: ph.caption })}><img src={media(ph.image)} alt={ph.caption || ""} loading="lazy" /></button>)}</div>}
          </div>
        );
      })()}
      {zoom && <Modal title={zoom.caption || "Rasm"} onClose={() => setZoom(null)}><img src={zoom.src} alt="" style={{ borderRadius: 12, width: "100%" }} /></Modal>}

      {m.reviews.length > 0 && (() => {
        const photos = m.reviews.flatMap((r: any) => (r.photos || []).map((u: string) => ({ u, r })));
        const shown = revFilter === "photo" ? m.reviews.filter((r: any) => r.photos?.length) : m.reviews;
        return (
          <div className="card">
            <div className="row between"><h3 style={{ fontSize: 17 }}>Sharhlar <span className="muted" style={{ fontWeight: 600 }}>· {m.reviews_count}</span></h3>
              {photos.length > 0 && <div className="chips" style={{ margin: 0 }}>
                <button className={"chip" + (revFilter === "all" ? " active" : "")} onClick={() => setRevFilter("all")}>Barchasi</button>
                <button className={"chip" + (revFilter === "photo" ? " active" : "")} onClick={() => setRevFilter("photo")}>Rasm bilan</button>
              </div>}
            </div>
            {photos.length > 0 && (
              <div className="rev-strip mt-12" aria-label="Mijozlar rasmlari">
                {photos.slice(0, 12).map((p: any, i: number) => <button key={i} onClick={() => setZoom({ src: media(p.u), caption: p.r.user_name })}><img src={media(p.u)} alt="" loading="lazy" /></button>)}
              </div>
            )}
            <div className="list mt-8">
              {shown.map((r: any) => (
                <div key={r.id} className="list-row" style={{ alignItems: "flex-start" }}>
                  <Avatar name={r.user_name} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row between"><b className="small" translate="no">{r.user_name}</b><span className="xs muted">{shortDate(r.created_at)}</span></div>
                    <div className="row gap-8"><Stars value={r.rating} />{r.service && <span className="xs muted">{r.service}</span>}</div>
                    {r.text && <p className="small mt-4" translate="no">{r.text}</p>}
                    {r.photos?.length > 0 && <div className="rev-photos">{r.photos.map((u: string, i: number) => <button key={i} onClick={() => setZoom({ src: media(u), caption: r.user_name })}><img src={media(u)} alt="" loading="lazy" /></button>)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {user?.id !== m.user.id && (
        <div className="sticky-actions">
          <div className="row gap-8"><a className="btn btn-light btn-lg" href={`tel:${m.user.phone}`} aria-label="Qo'ng'iroq" style={{ paddingInline: 14 }}><Phone size={18} /></a><button className="btn btn-light btn-lg grow" onClick={chat}><MessageCircle size={18} />Yozish</button></div>
          <button className="btn btn-lg" onClick={() => setBook(true)} disabled={m.services.length === 0}>Bron qilish</button>
        </div>
      )}
      {book && <BookingModal master={m} preselect={pre} onClose={() => setBook(false)} onDone={() => setBook(false)} />}
    </div>
  );
}

function BookingModal({ master, preselect, onClose, onDone }: { master: any; preselect?: number | null; onClose: () => void; onDone: () => void }) {
  const hasServices = master.services.length > 0;
  const [service, setService] = useState<string>(String(preselect || master.services[0]?.id || ""));
  const [date, setDate] = useState(isoDate(new Date()));
  const [time, setTime] = useState("");
  const [cars, setCars] = useState<any[]>([]);
  const [vehicle, setVehicle] = useState<any>("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);
  useEffect(() => { api.get("/garage/vehicles/").then((r) => { setCars(r.data); if (r.data[0]) setVehicle(r.data[0].id); }).catch(() => {}); }, []);
  const svc = master.services.find((s: any) => String(s.id) === service);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await api.post("/masters/bookings/", { master: master.id, service: service ? Number(service) : undefined, date, time, vehicle: vehicle || undefined, note });
      setDone(r.data);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <Modal title="Bron yuborildi" onClose={() => { onDone(); }}>
        <div className="col gap-12 book-ok">
          <div className="im-ic ok"><Check size={26} /></div>
          <b style={{ fontSize: 18 }}>So'rovingiz ustaga yuborildi</b>
          <p className="small muted" style={{ margin: 0 }}>Usta tasdiqlashi bilan sizga xabar keladi.</p>
          <div className="book-summary" style={{ textAlign: "left" }}>
            <div><span>Usta</span><b>{master.name}</b></div>
            <div><span>Xizmat</span><b>{done.service_name}</b></div>
            <div><span>Vaqt</span><b>{fmtDay(done.date)}, {done.time}</b></div>
            <div><span>Narx</span><b>{done.price ? money(done.price) : "Joyida kelishiladi"}</b></div>
            {master.address && <div><span>Manzil</span><b>{master.address}</b></div>}
          </div>
          <button className="btn btn-ghost btn-block" onClick={() => downloadIcs(done, master)}><CalendarPlus size={16} />Telefon kalendariga qo'shish</button>
          <Link to={`/app/orders?focus=booking-${done.id}`} className="btn btn-lg btn-block">Buyurtmalarim</Link>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Bron qilish" onClose={onClose}>
      <div className="col gap-16">
        <label className="field"><span>Xizmat</span>
          <select className="select" value={service} onChange={(e) => setService(e.target.value)}>
            {master.services.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {money(s.price)}</option>)}
            <option value="">{hasServices ? "Boshqa / ko'rik va maslahat (narx kelishiladi)" : "Ko'rik va maslahat (narx kelishiladi)"}</option>
          </select>
          {!hasServices && <small className="xs muted">Usta hali narxlarni kiritmagan — narx ko'rikdan so'ng kelishiladi.</small>}
        </label>
        {cars.length > 0 ? (
          <label className="field"><span>Avtomobil</span>
            <select className="select" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
              {cars.map((c) => <option key={c.id} value={c.id}>{[c.brand, c.model, c.year, c.plate].filter(Boolean).join(" ")}</option>)}
              <option value="">Ko'rsatmaslik</option>
            </select>
          </label>
        ) : <Link to="/app/cars" className="xs link">+ Avtomobilingizni qo'shing — usta oldindan tayyorlanadi</Link>}
        <SlotPicker masterId={master.id} date={date} time={time} onDate={setDate} onTime={setTime} />
        <label className="field"><span>Muammo (ixtiyoriy)</span><textarea className="textarea" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: dvigateldan shovqin chiqyapti, check engine yonadi" /></label>
        {time && (
          <div className="book-summary">
            <div><span>Vaqt</span><b>{fmtDay(date)}, {time}</b></div>
            <div><span>Narx</span><b>{svc ? money(svc.price) : "Joyida kelishiladi"}</b></div>
          </div>
        )}
        {err && <div className="alert error">{err}</div>}
        <div className="sticky-submit">
          <button className="btn btn-lg btn-block" disabled={!time || busy} onClick={submit}>{busy ? "Yuborilmoqda…" : time ? "Bronni tasdiqlash" : "Vaqtni tanlang"}</button>
        </div>
      </div>
    </Modal>
  );
}


/** Standart .ics fayl — iPhone/Android kalendari ochadi (bir soat oldin eslatma bilan) */
export function downloadIcs(b: any, master: any) {
  const [y, m, d] = String(b.date).split("-").map(Number);
  const [hh, mm] = String(b.time).split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
  const end = `${y}${pad(m)}${pad(d)}T${pad((hh + 1) % 24)}${pad(mm)}00`;
  const esc = (s: string) => String(s || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, " ");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Avtora//UZ", "BEGIN:VEVENT", `UID:avtora-booking-${b.id}@avtora`,
    `DTSTART;TZID=Asia/Tashkent:${start}`, `DTEND;TZID=Asia/Tashkent:${end}`, `SUMMARY:${esc(`Avtora: ${b.service_name}`)}`,
    `LOCATION:${esc(master?.address || "")}`, `DESCRIPTION:${esc(`Usta: ${master?.name || ""}`)}`,
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Avtora bron", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a"); a.href = url; a.download = `avtora-bron-${b.id}.ics`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
