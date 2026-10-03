import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api } from "./api";

export type Site = { site_name: string; tagline: string; support_phone: string; premium_price: number; maintenance: boolean; map_attribution?: string; apk_url?: string; sat_enabled?: boolean; sat_attribution?: string; google_client_id?: string };
const DEFAULT: Site = { site_name: "Avtora", tagline: "Avtomobilingiz uchun barcha xizmatlar — bir joyda", support_phone: "", premium_price: 40000, maintenance: false };
const Ctx = createContext<Site>(DEFAULT);

/** Admin paneldagi «Sayt sozlamalari» butun saytga shu yerdan tarqaladi */
/** Android ilova fayli manzili (o'rnatish tugmasi uchun) */
export const APK = { url: "" };

export function SiteProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Site>(DEFAULT);
  useEffect(() => { api.get("/settings/").then((r) => { setS({ ...DEFAULT, ...r.data }); APK.url = r.data.apk_url || ""; }).catch(() => {}); }, []);
  useEffect(() => { document.title = s.site_name || "Avtora"; }, [s.site_name]);
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}
export const useSite = () => useContext(Ctx);
