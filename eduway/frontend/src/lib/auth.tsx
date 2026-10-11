import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api, post, setUnauthorizedHandler, tokens } from "./api";

export type User = {
  id: number; email: string; first_name: string; last_name: string; full_name: string;
  education_stage: string; grade: number | null; region: string; interests: string[]; favorite_subjects: string[];
  future_goals: string; target_countries: string[]; english_level: string; ielts_score: string | null; birth_year: number | null;
  daily_minutes: number; onboarded: boolean; push_reminders: boolean; plan: "free" | "premium"; is_premium: boolean; premium_until: string | null;
  xp: number; streak: number; best_streak: number; is_admin: boolean; date_joined: string;
};

type Ctx = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { email: string; password: string; first_name: string; last_name?: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthCtx = createContext<Ctx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!tokens.access() && !tokens.refresh()) { setUser(null); return; }
    try { setUser(await api<User>("/auth/me/")); } catch { setUser(null); }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const d = await post("/auth/login/", { email, password });
    tokens.save(d.access, d.refresh);
    setUser(d.user);
    return d.user as User;
  };
  const register = async (data: any) => {
    const d = await post("/auth/register/", data);
    tokens.save(d.access, d.refresh);
    setUser(d.user);
    return d.user as User;
  };
  const logout = async () => {
    try { await post("/auth/logout/", { refresh: tokens.refresh() }); } catch { /* token allaqachon yaroqsiz */ }
    tokens.clear();
    setUser(null);
  };
  return <AuthCtx.Provider value={{ user, ready, login, register, logout, refresh, setUser }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
