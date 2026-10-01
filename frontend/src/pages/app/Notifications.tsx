import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ClipboardList, Crown, MessageCircle, Siren, Star } from "lucide-react";
import { api } from "../../api";
import EnablePush from "../../components/EnablePush";
import { Empty, Spinner } from "../../components/ui";
import { timeAgo } from "../../utils";

const IC: Record<string, [any, string]> = { order: [ClipboardList, "#1f6feb"], sos: [Siren, "#ee2b2f"], chat: [MessageCircle, "#12a150"], premium: [Crown, "#f5a623"], review: [Star, "#f5a623"], system: [Bell, "#6b7a90"] };

export default function Notifications() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [data, setData] = useState<any>(null);
  const load = () => api.get("/notifications/", { params: tab === "unread" ? { unread: 1 } : {} }).then((r) => setData(r.data));
  useEffect(() => { load(); }, [tab]);
  useEffect(() => { const f = () => load(); window.addEventListener("avtora-push", f); return () => window.removeEventListener("avtora-push", f); }, [tab]);
  const readAll = async () => { await api.post("/notifications/read/"); load(); };
  const open = async (n: any) => { if (!n.is_read) await api.post(`/notifications/${n.id}/read/`); if (n.link) nav(n.link); else load(); };

  return (
    <div className="col gap-16" style={{ maxWidth: 760 }}>
      <div className="page-head"><h2 className="page-title">Bildirishnomalar</h2>{data?.unread > 0 && <button className="btn btn-sm btn-ghost" onClick={readAll}>Barchasini o'qildi</button>}</div>
      <EnablePush />
      <div className="tabs" style={{ alignSelf: "flex-start" }}><button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>Barchasi</button><button className={tab === "unread" ? "active" : ""} onClick={() => setTab("unread")}>O'qilmagan ({data?.unread ?? 0})</button></div>
      {!data ? <Spinner /> : data.results.length === 0 ? <Empty title="Bildirishnoma yo'q" /> : (
        <div className="card card-tight list">
          {data.results.map((n: any) => {
            const [I, c] = IC[n.kind] || IC.system;
            return (
              <button key={n.id} className="list-row" onClick={() => open(n)} style={{ background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left", width: "100%" }}>
                <span className="ico" style={{ background: c + "1a", color: c, borderRadius: "50%" }}><I size={17} /></span>
                <div className="grow"><b className="small" style={{ fontWeight: n.is_read ? 600 : 800 }}>{n.title}</b><div className="xs muted">{n.body}</div><div className="xs muted mt-4">{timeAgo(n.created_at)}</div></div>
                {!n.is_read && <span className="online-dot" style={{ background: "var(--blue)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
