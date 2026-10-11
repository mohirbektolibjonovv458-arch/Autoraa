import { ReactNode, useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge, cx, ErrorState, Field, Modal, Skeleton, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { ApiError, api, del, get, post } from "../../lib/api";
import { useDebounced } from "../../lib/hooks";

export type FieldDef = {
  name: string; label: string;
  type?: "text" | "textarea" | "number" | "decimal" | "bool" | "select" | "date" | "url" | "lines" | "chips";
  options?: { value: string; label: string }[];
  required?: boolean; hint?: string; full?: boolean;
};

export type Column = { label: string; render: (row: any) => ReactNode; className?: string };

function toForm(fields: FieldDef[], row: any) {
  const out: any = {};
  for (const f of fields) {
    const v = row?.[f.name];
    if (f.type === "lines") out[f.name] = Array.isArray(v) ? v.join("\n") : "";
    else if (f.type === "chips") out[f.name] = Array.isArray(v) ? v : [];
    else if (f.type === "bool") out[f.name] = v ?? (f.name === "is_published");
    else out[f.name] = v ?? "";
  }
  return out;
}

function fromForm(fields: FieldDef[], form: any) {
  const out: any = {};
  for (const f of fields) {
    const v = form[f.name];
    if (f.type === "lines") out[f.name] = String(v || "").split("\n").map((s) => s.trim()).filter(Boolean);
    else if (f.type === "number") out[f.name] = v === "" || v == null ? null : +v;
    else if (f.type === "decimal") out[f.name] = v === "" || v == null ? null : String(v);
    else if (f.type === "date") out[f.name] = v || null;
    else out[f.name] = v;
  }
  return out;
}

export function FormFields({ fields, form, setForm, errors }: { fields: FieldDef[]; form: any; setForm: (f: any) => void; errors: Record<string, string> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const v = form[f.name];
        const set = (val: any) => setForm({ ...form, [f.name]: val });
        const full = f.full || ["textarea", "lines", "chips"].includes(f.type || "");
        let input: ReactNode;
        switch (f.type) {
          case "textarea": input = <textarea className="input min-h-[96px] py-3" value={v} onChange={(e) => set(e.target.value)} />; break;
          case "lines": input = <textarea className="input min-h-[96px] py-3" value={v} onChange={(e) => set(e.target.value)} placeholder="Har bir qator — alohida element" />; break;
          case "bool": input = <label className="flex h-12 items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[rgb(var(--brand))]" checked={!!v} onChange={(e) => set(e.target.checked)} /> Ha</label>; break;
          case "select": input = <select className="input" value={v} onChange={(e) => set(e.target.value)}>{!f.required && <option value="">—</option>}{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>; break;
          case "chips": input = <div className="flex flex-wrap gap-2">{f.options?.map((o) => <button type="button" key={o.value} onClick={() => set(v.includes(o.value) ? v.filter((x: string) => x !== o.value) : [...v, o.value])} className={cx("chip", v.includes(o.value) && "chip-on")}>{o.label}</button>)}</div>; break;
          case "number": input = <input type="number" className="input" value={v} onChange={(e) => set(e.target.value)} />; break;
          case "decimal": input = <input type="number" step="0.5" className="input" value={v} onChange={(e) => set(e.target.value)} />; break;
          case "date": input = <input type="date" className="input" value={v || ""} onChange={(e) => set(e.target.value)} />; break;
          case "url": input = <input type="url" className="input" value={v} onChange={(e) => set(e.target.value)} placeholder="https://" />; break;
          default: input = <input className="input" value={v} onChange={(e) => set(e.target.value)} required={f.required} />;
        }
        return <div key={f.name} className={full ? "sm:col-span-2" : ""}><Field label={f.label + (f.required ? " *" : "")} error={errors[f.name]} hint={f.hint}>{input}</Field></div>;
      })}
    </div>
  );
}

export function Crud({ title, endpoint, fields, columns, extra, renderDetail, filters }: {
  title: string; endpoint: string; fields: FieldDef[]; columns: Column[];
  extra?: (row: any, reload: () => void) => ReactNode; renderDetail?: (row: any) => ReactNode; filters?: string;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    get(`${endpoint}?page=${page}&q=${encodeURIComponent(dq)}${filters ? `&${filters}` : ""}`).then(setData).catch(setError);
  };
  useEffect(load, [endpoint, page, dq, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (row: any | null) => { setEdit(row || {}); setForm(toForm(fields, row)); setErrors({}); };
  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      const body = fromForm(fields, form);
      if (edit?.id) await api(`${endpoint}${edit.id}/`, { method: "PATCH", body });
      else await post(endpoint, body);
      toast("Saqlandi");
      setEdit(null);
      load();
    } catch (e: any) {
      const d = e.data || {};
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(d)) out[k] = Array.isArray(v) ? String(v[0]) : typeof v === "string" ? v : JSON.stringify(v);
      setErrors(out);
      toast(e.message, "bad");
    } finally { setBusy(false); }
  };
  const remove = async (row: any) => {
    if (!confirm("O'chirilsinmi? Bu amalni qaytarib bo'lmaydi.")) return;
    try { await del(`${endpoint}${row.id}/`); toast("O'chirildi"); load(); } catch (e: any) { toast(e.message, "bad"); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-extrabold">{title}</h1>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" /><input className="input h-10 w-56 pl-9" placeholder="Qidirish..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        {fields.length > 0 && <button className="btn-primary btn-sm h-10" onClick={() => open(null)}><Plus className="h-4 w-4" /> Qo'shish</button>}
      </div>
      {error ? <ErrorState error={error} onRetry={load} /> : !data ? <Skeleton className="h-64" /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line bg-muted/60 text-left">{columns.map((c) => <th key={c.label} className="px-4 py-3 font-semibold">{c.label}</th>)}<th className="w-px px-4 py-3" /></tr></thead>
              <tbody>
                {data.results.length === 0 && <tr><td colSpan={columns.length + 1} className="p-8 text-center text-sub">Ma'lumot yo'q</td></tr>}
                {data.results.map((row: any) => (
                  <tr key={row.id} className="border-b border-line last:border-0 hover:bg-muted/40">
                    {columns.map((c) => <td key={c.label} className={cx("px-4 py-3 align-top", c.className)}>{c.render(row)}</td>)}
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {extra?.(row, load)}
                      {fields.length > 0 && <button onClick={() => open(row)} aria-label="Tahrirlash" className="inline-grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Pencil className="h-4 w-4" /></button>}
                      {fields.length > 0 && <button onClick={() => remove(row)} aria-label="O'chirish" className="inline-grid h-8 w-8 place-items-center rounded-lg text-bad hover:bg-bad/10"><Trash2 className="h-4 w-4" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-sub">
            <span>Jami: {data.count}</span>
            <div className="flex gap-2"><button className="btn-outline btn-sm" disabled={!data.previous} onClick={() => setPage(page - 1)}>Oldingi</button><button className="btn-outline btn-sm" disabled={!data.next} onClick={() => setPage(page + 1)}>Keyingi</button></div>
          </div>
        </>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Tahrirlash" : "Yangi"} wide>
        {edit && (
          <>
            {errors.detail && <p className="mb-3 rounded-xl bg-bad/10 p-3 text-sm text-bad">{errors.detail}</p>}
            {errors.non_field_errors && <p className="mb-3 rounded-xl bg-bad/10 p-3 text-sm text-bad">{errors.non_field_errors}</p>}
            <FormFields fields={fields} form={form} setForm={setForm} errors={errors} />
            {edit.id && renderDetail?.(edit)}
            <div className="mt-5 flex gap-2"><button className="btn-outline flex-1" onClick={() => setEdit(null)}>Bekor</button><button className="btn-primary flex-1" disabled={busy} onClick={save}>{busy ? <Spinner /> : "Saqlash"}</button></div>
          </>
        )}
      </Modal>
    </div>
  );
}

export const yes = (v: boolean) => (v ? <Badge tone="ok">Ha</Badge> : <Badge tone="muted">Yo'q</Badge>);
