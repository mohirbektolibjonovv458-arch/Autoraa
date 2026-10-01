import ProviderJobs from "../../components/ProviderJobs";
export default function UstaSos() {
  return (
    <div className="col gap-16" style={{ maxWidth: 860 }}>
      <div><h2 className="page-title">Tezkor so'rovlar</h2><p className="small muted">«Tezkor usta» va «Diagnostika» SOS chaqiruvlari. Qabul qilsangiz, mijoz sizni xaritada kuzatadi.</p></div>
      <ProviderJobs />
    </div>
  );
}
