// Backend bilan ishlash. Tokenlar localStorage'da; access muddati tugasa refresh orqali avtomatik yangilanadi.
const ACCESS = "eduway-access";
const REFRESH = "eduway-refresh";

export class ApiError extends Error {
  status: number;
  code?: string;
  data: any;
  constructor(status: number, data: any) {
    super(errorText(data, status));
    this.status = status;
    this.code = data?.code;
    this.data = data;
  }
}

function errorText(data: any, status: number): string {
  if (!data) return status >= 500 ? "Server bilan bog'lanishda xatolik." : "Xatolik yuz berdi.";
  if (typeof data === "string") return data;
  if (data.detail) return String(data.detail);
  const first = Object.entries(data)[0];
  if (first) {
    const [k, v] = first;
    const msg = Array.isArray(v) ? v[0] : typeof v === "object" ? errorText(v, status) : v;
    return k === "non_field_errors" ? String(msg) : String(msg);
  }
  return "Xatolik yuz berdi.";
}

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* private mode */ } },
};

export const tokens = {
  access: () => store.get(ACCESS),
  refresh: () => store.get(REFRESH),
  save: (a: string, r?: string) => { store.set(ACCESS, a); if (r) store.set(REFRESH, r); },
  clear: () => { store.set(ACCESS, null); store.set(REFRESH, null); },
};

let refreshing: Promise<boolean> | null = null;
async function refreshAccess(): Promise<boolean> {
  const r = tokens.refresh();
  if (!r) return false;
  refreshing ??= fetch("/api/auth/refresh/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh: r }) })
    .then(async (res) => {
      if (!res.ok) return false;
      const d = await res.json();
      tokens.save(d.access, d.refresh);
      return true;
    })
    .catch(() => false)
    .finally(() => { setTimeout(() => (refreshing = null), 0); });
  return refreshing;
}

export let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

export async function api<T = any>(path: string, opts: { method?: string; body?: any; signal?: AbortSignal; retry?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const a = tokens.access();
  if (a) headers.Authorization = `Bearer ${a}`;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: opts.method || (opts.body !== undefined ? "POST" : "GET"), headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: opts.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    throw new ApiError(0, { detail: "Internet aloqasi yo'q yoki server javob bermayapti." });
  }
  if (res.status === 401 && opts.retry !== false && tokens.refresh()) {
    if (await refreshAccess()) return api<T>(path, { ...opts, retry: false });
    tokens.clear();
    onUnauthorized();
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export const get = <T = any>(p: string, signal?: AbortSignal) => api<T>(p, { signal });
export const post = <T = any>(p: string, body: any = {}) => api<T>(p, { method: "POST", body });
export const patch = <T = any>(p: string, body: any) => api<T>(p, { method: "PATCH", body });
export const del = <T = any>(p: string, body?: any) => api<T>(p, { method: "DELETE", body });
