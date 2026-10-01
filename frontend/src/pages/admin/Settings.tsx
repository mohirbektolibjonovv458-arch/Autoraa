import { useEffect, useState } from "react";
import { api, errMsg } from "../../api";
import { Spinner, useToast } from "../../components/ui";

export default function AdminSettings() {
  const toast = useToast();
  const [f, setF] = useState<any>(null);
  useEffect(() => { api.get("/admin/settings/").then((r) => setF(r.data)); }, []);
  if (!f) return <Spinner />;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async () => { try { const r = await api.patch("/admin/settings/", f); setF(r.data); toast("Sozlamalar saqlandi", "success"); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <div className="col gap-16" style={{ maxWidth: 820 }}>
      <div className="card col gap-12">
        <b>Umumiy sozlamalar</b>
        <div className="grid g2 stack-sm">
          <label className="field"><span>Sayt nomi</span><input className="input" value={f.site_name} onChange={set("site_name")} /></label>
          <label className="field"><span>Qo'llab-quvvatlash telefoni</span><input className="input" value={f.support_phone} onChange={set("support_phone")} /></label>
          <label className="field"><span>SOS qidiruv radiusi (km)</span><input className="input" type="number" value={f.sos_radius_km} onChange={set("sos_radius_km")} /></label>
        </div>
        <label className="field"><span>Shior (tagline)</span><input className="input" value={f.tagline} onChange={set("tagline")} /></label>
        <label className="row gap-8 small"><input type="checkbox" checked={f.maintenance} onChange={set("maintenance")} />Texnik ishlar rejimi — yoqilsa sayt foydalanuvchilarga yopiladi (admin panel ishlayveradi)</label>
        <p className="xs muted">Shior bosh sahifada sarlavha bo'lib chiqadi. Qo'llab-quvvatlash telefoni sayt pastida, profil va SOS sahifasida ko'rsatiladi.</p>
      </div>
      <div className="card col gap-12">
        <b>Premium va to'lov</b>
        <div className="grid g2 stack-sm">
          <label className="field"><span>Premium narxi (so'm / oy)</span><input className="input" type="number" value={f.premium_price} onChange={set("premium_price")} /></label>
          <label className="field"><span>Karta egasi</span><input className="input" value={f.card_holder} onChange={set("card_holder")} /></label>
        </div>
        <label className="field"><span>To'lov qabul qilinadigan karta raqami</span><input className="input" value={f.card_number} onChange={(e) => setF({ ...f, card_number: e.target.value.replace(/\D/g, "").slice(0, 16) })} /></label>
      </div>
      <div className="card col gap-8">
        <b>Integratsiyalar</b>
        <p className="small muted">Telegram bot tokenlari xavfsizlik uchun serverdagi <code>backend/.env</code> faylida saqlanadi (AUTH_BOT_TOKEN, PREMIUM_BOT_TOKEN). To'lovlarni tasdiqlovchi admin bo'lish uchun Premium botda admin raqamingizni ulashing. Xarita — OpenStreetMap (kalit shart emas).</p>
      </div>
      <button className="btn btn-lg" onClick={save}>Saqlash</button>
    </div>
  );
}
