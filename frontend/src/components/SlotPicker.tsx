import { appLocale } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const WD = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

/** Sana (14 kun) + vaqt tanlash. Bugun bo'sh vaqt qolmagan bo'lsa — keyingi bo'sh kunga o'zi o'tadi. */
export default function SlotPicker({ masterId, date, time, onDate, onTime, initialDate }: {
  masterId: number; date: string; time: string; onDate: (d: string) => void; onTime: (t: string) => void; initialDate?: string;
}) {
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d; });
  const [slots, setSlots] = useState<any[] | null>(null);
  const tried = useRef(0);
  useEffect(() => {
    setSlots(null);
    api.get(`/masters/${masterId}/slots/`, { params: { date } }).then((r) => {
      setSlots(r.data);
      // tanlangan kunda bo'sh vaqt yo'q va foydalanuvchi hali o'zi tanlamagan — keyingi kunni ko'rsatamiz (7 kungacha)
      if (!initialDate && tried.current < 7 && !r.data.some((x: any) => x.available) && tried.current === days.findIndex((d) => isoDate(d) === date)) {
        tried.current += 1;
        const n = new Date(today); n.setDate(n.getDate() + tried.current); onDate(isoDate(n));
      }
    }).catch(() => setSlots([]));
  }, [date]);
  const free = (slots || []).filter((s) => s.available).length;
  return (
    <div className="col gap-12">
      <div className="field"><span>Sana</span>
        <div className="day-strip">
          {days.map((d, i) => {
            const v = isoDate(d);
            return (
              <button key={v} type="button" className={"day" + (date === v ? " active" : "")} onClick={() => { tried.current = 99; onDate(v); onTime(""); }}>
                <small>{i === 0 ? "Bugun" : i === 1 ? "Ertaga" : appLocale() === "ru-RU" ? d.toLocaleDateString("ru-RU", { weekday: "short" }) : WD[d.getDay()]}</small>
                <b>{d.getDate()}</b>
                <small>{d.toLocaleDateString(appLocale(), { month: "short" }).replace(".", "")}</small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="field"><span>Vaqt {slots && <em className="muted" style={{ fontStyle: "normal", fontWeight: 500 }}>· {free ? `${free} ta bo'sh` : "bo'sh vaqt yo'q"}</em>}</span>
        {!slots ? <div className="slots">{Array.from({ length: 8 }).map((_, i) => <span key={i} className="slot skel" />)}</div>
          : slots.length === 0 ? <p className="small muted">Bu kun usta ishlamaydi.</p>
          : (
            <div className="slots">
              {slots.map((s) => (
                <button key={s.time} type="button" disabled={!s.available} className={"slot" + (time === s.time ? " active" : "")} onClick={() => onTime(s.time)}
                  aria-pressed={time === s.time} title={s.available ? "Bo'sh" : "Band yoki o'tib ketgan"}>{s.time}</button>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

export const fmtDay = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - t.getTime()) / 864e5);
  return diff === 0 ? "Bugun" : diff === 1 ? "Ertaga" : d.toLocaleDateString(appLocale(), { day: "numeric", month: "long", weekday: "short" });
};
