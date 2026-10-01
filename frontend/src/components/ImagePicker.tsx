import { useEffect, useMemo, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { media } from "../api";

/** Telefonga qulay rasm tanlash: katta bosish maydoni, darhol ko'rinadigan oldindan ko'rish,
 *  galereya yoki kamera. Mavjud rasm (current) ham ko'rsatiladi. */
export default function ImagePicker({ label, file, onFile, current, aspect = "4 / 3", hint }: {
  label: string; file: File | null; onFile: (f: File | null) => void; current?: string | null; aspect?: string; hint?: string;
}) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const [err, setErr] = useState("");
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [file, current]);
  const pick = (f?: File | null) => {
    setErr("");
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name)) { setErr("Faqat rasm (JPG, PNG, WEBP, HEIC)."); return; }
    if (f.size > 10 * 1024 * 1024) { setErr("Rasm 10 MB dan katta bo'lmasin."); return; }
    onFile(f);
  };
  const src = url || (current ? media(current) : "");
  return (
    <div className="field">
      <span>{label}</span>
      <div className="img-pick" style={{ aspectRatio: aspect }}>
        {src && broken ? <div className="img-empty"><ImagePlus size={24} /><b className="small">{file?.name || "Rasm"}</b><small>Tanlandi — saqlangandan keyin ko'rinadi</small></div>
          : src ? <img src={src} alt="" onError={() => setBroken(true)} /> : (
          <div className="img-empty"><ImagePlus size={28} /><b className="small">Rasm tanlash uchun bosing</b>{hint && <small>{hint}</small>}</div>
        )}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/*" aria-label={label} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        {src && (
          <div className="img-actions">
            <label className="img-act"><Camera size={15} />Almashtirish<input type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} /></label>
            {file && <button type="button" className="img-act" onClick={() => onFile(null)} aria-label="Bekor qilish"><X size={15} /></button>}
          </div>
        )}
      </div>
      {err && <small className="xs" style={{ color: "var(--red)" }}>{err}</small>}
    </div>
  );
}
