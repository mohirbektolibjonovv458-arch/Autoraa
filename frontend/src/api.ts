import axios from "axios";

const BASE = (import.meta.env.VITE_API_URL as string) || "";

export const api = axios.create({ baseURL: BASE + "/api", timeout: 30000 });

export const tokens = {
  get access() { return localStorage.getItem("ah_access"); },
  get refresh() { return localStorage.getItem("ah_refresh"); },
  set(a: string, r?: string) {
    localStorage.setItem("ah_access", a);
    if (r) localStorage.setItem("ah_refresh", r);
  },
  clear() {
    localStorage.removeItem("ah_access");
    localStorage.removeItem("ah_refresh");
  },
};

api.interceptors.request.use((cfg) => {
  const t = tokens.access;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const orig = err.config;
    if (err.response?.status === 401 && tokens.refresh && !orig._retry && !orig.url?.includes("/auth/refresh")) {
      orig._retry = true;
      refreshing =
        refreshing ||
        axios
          .post(BASE + "/api/auth/refresh/", { refresh: tokens.refresh })
          .then((r) => { tokens.set(r.data.access, r.data.refresh); return r.data.access; })
          .catch(() => { tokens.clear(); return null; })
          .finally(() => { setTimeout(() => (refreshing = null), 0); });
      const t = await refreshing;
      if (t) {
        orig.headers.Authorization = `Bearer ${t}`;
        return api(orig);
      }
      // sessiya tugadi: faqat yopiq bo'limlarda kirish sahifasiga yuboramiz
      const p = window.location.pathname;
      if (p.startsWith("/admin")) window.location.href = "/admin/login";
      else if (p.startsWith("/app")) window.location.href = `/login?next=${encodeURIComponent(p + window.location.search)}`;
    }
    // server yoki internet muammosi — ilova yuqorisida ogohlantirish chiqadi
    if (!err.response || err.response.status >= 500) window.dispatchEvent(new CustomEvent("ah-net-error"));
    return Promise.reject(err);
  }
);

export function errMsg(e: any, fallback = "Xatolik yuz berdi. Qayta urinib ko'ring.") {
  const d = e?.response?.data;
  if (!d) return !navigator.onLine ? "Internet aloqasi yo'q. Ulanishni tekshiring." : e?.code === "ECONNABORTED" ? "Server javob bermadi. Qayta urinib ko'ring." : "Serverga ulanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.";
  if (typeof d === "string") return fallback;
  if (typeof d.detail === "string") return d.detail;
  return fallback;
}

export function media(url?: string | null) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return BASE + url;
}
