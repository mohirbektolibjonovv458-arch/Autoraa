import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, get } from "./api";

/** Oddiy ma'lumot yuklash hook'i: loading / error / reload. */
export function useApi<T = any>(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!path) { setLoading(false); return; }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const d = await get<T>(path, c.signal);
      if (!c.signal.aborted) setData(d);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e instanceof ApiError ? e : new ApiError(0, null));
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => { load(); return () => ctrl.current?.abort(); }, [load]);
  return { data, setData, error, loading, reload: () => load(true) };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
