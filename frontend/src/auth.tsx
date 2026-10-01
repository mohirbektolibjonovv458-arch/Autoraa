import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, tokens } from "./api";

export type User = {
  id: number; phone: string; first_name: string; last_name: string; full_name: string; email: string;
  role: "user" | "usta" | "evakuator" | "admin"; avatar: string | null; city: string;
  lat: number | null; lng: number | null; is_online: boolean; is_premium: boolean; premium_until: string | null;
  telegram_linked: boolean; has_shop: boolean;
};

type Ctx = {
  user: User | null; loading: boolean;
  login: (data: { access: string; refresh: string; user: User }) => void;
  logout: () => void; refresh: () => Promise<void>; setUser: (u: User) => void;
};
const AuthCtx = createContext<Ctx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!tokens.access) { setUser(null); setLoading(false); return; }
    try {
      const r = await api.get("/auth/me/"); setUser(r.data);
      // profilda saqlangan til boshqa bo'lsa (boshqa qurilmada tanlangan) — qo'llaymiz
      // qurilmada til tanlangan bo'lsa — u ustun (profilga yoziladi); yangi qurilmada esa profildagi til qo'llanadi
      const saved = r.data.lang, local = localStorage.getItem("ah_lang") || "uz", chosen = localStorage.getItem("ah_lang_set") === "1";
      if ((saved === "ru" || saved === "uz") && saved !== local) {
        if (chosen) api.patch("/auth/me/", { lang: local }).catch(() => {});
        else { localStorage.setItem("ah_lang", saved); localStorage.setItem("ah_lang_set", "1"); window.location.reload(); return; }
      }
    }
    catch { setUser(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const login = (d: { access: string; refresh: string; user: User }) => { tokens.set(d.access, d.refresh); setUser(d.user); };
  const logout = () => {
    const r = tokens.refresh;
    const done = () => { tokens.clear(); setUser(null); window.location.href = "/"; };
    // avval shu qurilmaning push obunasi o'chiriladi (boshqa odam kirsa, avvalgi egasining xabarlari kelmasin)
    import("./push").then((m) => m.disablePush()).finally(() => {
      if (r) api.post("/auth/logout/", { refresh: r }).finally(done); else done();
    });
    return;
    // sessiyani serverda ham bekor qilamiz (token boshqa joyda ishlatilmasligi uchun)
    if (r) api.post("/auth/logout/", { refresh: r }).finally(done); else done();
  };
  return <AuthCtx.Provider value={{ user, loading, login, logout, refresh, setUser }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const homeFor = (role?: string) =>
  role === "admin" ? "/admin" : role === "usta" ? "/app/usta" : role === "evakuator" ? "/app/evak" : "/app";

export const ROLE_LABEL: Record<string, string> = { user: "Foydalanuvchi", usta: "Usta", evakuator: "Evakuator", admin: "Admin" };
