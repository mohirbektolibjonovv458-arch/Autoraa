import { NavLink } from "react-router-dom";
import { Heart, List, Map } from "lucide-react";

/** Usta topish bo'limi ichidagi ko'rinishlar: ro'yxat, xarita, sevimlilar */
export default function MastersTabs() {
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");
  return (
    <div className="tabs" style={{ alignSelf: "flex-start" }}>
      <NavLink to="/app/masters" end className={cls}><span className="row gap-4"><List size={15} />Ro'yxat</span></NavLink>
      <NavLink to="/app/map" className={cls}><span className="row gap-4"><Map size={15} />Xaritada</span></NavLink>
      <NavLink to="/app/favorites" className={cls}><span className="row gap-4"><Heart size={15} />Sevimlilar</span></NavLink>
    </div>
  );
}
