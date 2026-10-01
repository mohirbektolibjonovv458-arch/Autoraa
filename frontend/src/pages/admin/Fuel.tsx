import { useEffect, useState } from "react";
import { Check, Download, EyeOff, Search, Trash2 } from "lucide-react";
import { api, errMsg } from "../../api";
import { FSTATUS, FUELS } from "../../components/Fuel";
import { Spinner, useToast } from "../../components/ui";
import { usePoll } from "../../utils";

export default function AdminFuel() {
  const toast = useToast();
  const [tab, setTab] = useState<"stations" | "reports">("stations");
  const [st, setSt] = useState("");
  const [q, setQ] = useState("");
  const [d, setD] = useState<any>(null);
  const [reports, setReports] = useState<any[] | null>(null);
  const load = () => api.get("/fuel/admin/stations/", { params: { status: st || undefined, q: q || undefined } }).then((r) => setD(r.data));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [st, q]);
  usePoll(() => { if (d?.import?.running) load(); }, 5000, [d?.import?.running]);
  useEffect(() => { if (tab === "reports") api.get("/fuel/admin/reports/").then((r) => setReports(r.data)); }, [tab]);

  const patch = async (s: any, data: any) => { try { await api.patch(`/fuel/admin/stations/${s.id}/`, data); load(); } catch (e) { toast(errMsg(e), "error"); } };
  const del = async (s: any) => { if (!confirm(`«${s.name}» va uning barcha belgilari o'chirilsinmi?`)) return; await api.delete(`/fuel/admin/stations/${s.id}/`); load(); };
  const importOsm = async () => { try { const r = await api.post("/fuel/admin/stations/"); toast(r.data.detail, "success"); load(); } catch (e) { toast(errMsg(e), "error"); } };
  const importFile = async (f?: File) => {
    if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    try { const r = await api.post("/fuel/admin/stations/", fd); toast(r.data.detail, "success"); load(); } catch (e) { toast(errMsg(e), "error"); }
  };
  const delReport = async (id: number) => { await api.delete("/fuel/admin/reports/", { data: { ids: [id] } }); setReports((r) => (r || []).filter((x) => x.id !== id)); };

  return (
    <div className="col gap-16">
      {d && (
        <div className="grid g4">
          <div className="stat"><div className="label">Shoxobchalar</div><div className="value">{d.total}</div></div>
          <div className="stat"><div className="label">Tekshirilmagan</div><div className="value" style={{ color: d.pending ? "#b37400" : undefined }}>{d.pending}</div></div>
          <div className="stat"><div className="label">Belgilar (24 soat)</div><div className="value">{d.reports_24h}</div></div>
          <div className="stat col gap-8"><div className="label">OpenStreetMap</div>
            <button className="btn btn-sm" disabled={d.import.running} onClick={importOsm}><Download size={14} />{d.import.running ? "Yuklanmoqda…" : "Yangilash"}</button>
            {d.import.last && <div className="xs muted">{d.import.last}</div>}
            {d.import.history?.[0] && <div className="xs muted">Oxirgi: {new Date(d.import.history[0].at).toLocaleString("ru-RU")} — {d.import.history[0].ok ? `${d.import.history[0].total} ta` : `xato: ${d.import.history[0].error}`}</div>}
            <label className="xs link" style={{ cursor: "pointer" }}>JSON fayldan import<input type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files?.[0])} /></label></div>
        </div>
      )}
      <div className="tabs" style={{ alignSelf: "flex-start" }}>
        <button className={tab === "stations" ? "active" : ""} onClick={() => setTab("stations")}>Shoxobchalar</button>
        <button className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>So'nggi belgilar</button>
      </div>

      {tab === "stations" && <>
        <div className="row gap-8 wrap">
          <div className="search grow"><Search size={18} /><input className="input" placeholder="Nomi yoki manzil" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="tabs">{[["", "Barchasi"], ["pending", "Tekshirilmagan"], ["hidden", "Yashirilgan"]].map(([k, l]) => <button key={k} className={st === k ? "active" : ""} onClick={() => setSt(k)}>{l}</button>)}</div>
        </div>
        {!d ? <Spinner /> : (
          <div className="card card-tight table-wrap"><table className="table">
            <thead><tr><th>Shoxobcha</th><th>Yoqilg'i</th><th>Manba</th><th>Belgilar</th><th>Holat</th><th></th></tr></thead>
            <tbody>{d.results.map((s: any) => (
              <tr key={s.id}>
                <td><b className="small">{s.name}</b><div className="xs muted">{s.address || `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`} · <a href={`https://maps.google.com/?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" className="link">xarita</a></div></td>
                <td className="small">{s.fuels.map((f: string) => FUELS.find((x) => x.key === f)?.label).join(", ")}</td>
                <td className="xs">{s.source === "osm" ? "OSM" : s.added_by || "Foydalanuvchi"}</td>
                <td className="small">{s.reports_count}</td>
                <td>{!s.is_active ? <span className="badge">Yashirin</span> : s.is_verified ? <span className="badge green">Tasdiqlangan</span> : <span className="badge amber">Tekshirilmagan</span>}</td>
                <td><div className="row gap-4">
                  {!s.is_verified && s.is_active && <button className="btn btn-sm btn-green" onClick={() => patch(s, { is_verified: true })} aria-label="Tasdiqlash"><Check size={14} /></button>}
                  <button className="icon-btn" onClick={() => patch(s, { is_active: !s.is_active })} aria-label={s.is_active ? "Yashirish" : "Ko'rsatish"} title={s.is_active ? "Yashirish" : "Ko'rsatish"}><EyeOff size={14} /></button>
                  <button className="icon-btn" onClick={() => del(s)} aria-label="O'chirish"><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}</tbody></table>
            {d.results.length === 0 && <p className="small muted" style={{ padding: 16 }}>Shoxobchalar yo'q. «OpenStreetMap → Yangilash» tugmasini bosing.</p>}</div>
        )}
      </>}

      {tab === "reports" && (!reports ? <Spinner /> : (
        <div className="card card-tight table-wrap"><table className="table">
          <thead><tr><th>Vaqt</th><th>Shoxobcha</th><th>Belgi</th><th>Narx</th><th>Foydalanuvchi</th><th></th></tr></thead>
          <tbody>{reports.map((r) => (
            <tr key={r.id}><td className="xs muted">{new Date(r.created_at).toLocaleString("ru-RU")}</td><td className="small">{r.station}</td>
              <td className="small">{FSTATUS[r.status].icon} {FUELS.find((x) => x.key === r.fuel)?.label}: {r.label.toLowerCase()}</td>
              <td className="small">{r.price || "—"}</td><td className="small">{r.user}<div className="xs muted">{r.user_phone}</div></td>
              <td><button className="icon-btn" onClick={() => delReport(r.id)} aria-label="O'chirish" title="Noto'g'ri belgini o'chirish"><Trash2 size={14} /></button></td></tr>
          ))}</tbody></table>
          {reports.length === 0 && <p className="small muted" style={{ padding: 16 }}>Hali belgilar yo'q.</p>}</div>
      ))}
    </div>
  );
}
