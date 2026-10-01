import { useState } from "react";
import { api, errMsg } from "../api";
import SlotPicker from "./SlotPicker";
import { Modal, useToast } from "./ui";

/** Bron vaqtini o'zgartirish (mijoz yoki usta). Ikkinchi tomonga avtomatik xabar boradi. */
export default function RescheduleModal({ booking, masterId, onClose, onDone }: { booking: { id: number; date: string; time: string }; masterId: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(booking.date);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true); setErr("");
    try { await api.post(`/masters/bookings/${booking.id}/reschedule/`, { date, time }); toast("Vaqt o'zgartirildi — ikkinchi tomonga xabar yuborildi", "success"); onDone(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Vaqtni o'zgartirish" onClose={onClose}>
      <div className="col gap-16">
        <p className="small muted" style={{ margin: 0 }}>Hozirgi vaqt: <b>{booking.date} · {booking.time}</b></p>
        <SlotPicker masterId={masterId} date={date} time={time} onDate={setDate} onTime={setTime} initialDate={booking.date} />
        {err && <div className="alert error">{err}</div>}
        <div className="sticky-submit"><button className="btn btn-lg btn-block" disabled={!time || busy} onClick={save}>{busy ? "Saqlanmoqda…" : time ? `${time} ga o'zgartirish` : "Yangi vaqtni tanlang"}</button></div>
      </div>
    </Modal>
  );
}
