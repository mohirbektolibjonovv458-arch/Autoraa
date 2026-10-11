import { useState } from "react";
import { AlertTriangle, Check, Crown, Minus, Sparkles } from "lucide-react";
import { Badge, cx, ErrorState, Field, PageHeader, PageSkeleton, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";
import { post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { fmtDate, fmtMoney } from "../lib/format";

const ST: Record<string, [string, any]> = { pending: ["Ko'rib chiqilmoqda", "warn"], approved: ["Tasdiqlandi", "ok"], rejected: ["Rad etildi", "bad"], cancelled: ["Bekor qilindi", "muted"] };

export default function Premium() {
  const { data: d, error, loading, reload } = useApi<any>("/billing/plans/");
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [months, setMonths] = useState(1);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  if (loading) return <PageSkeleton />;
  if (error || !d) return <ErrorState error={error} onRetry={reload} />;
  const pending = d.requests.find((r: any) => r.status === "pending");

  const send = async () => {
    setBusy(true);
    try { await post("/billing/requests/", { months, payment_reference: ref }); toast("So'rov yuborildi. Administrator to'lovni tekshirgach Premium faollashadi."); setRef(""); reload(); }
    catch (e: any) { toast(e.message, "bad"); } finally { setBusy(false); }
  };
  const cancel = async (id: number) => { await post(`/billing/requests/${id}/cancel/`); reload(); };

  return (
    <>
      <PageHeader title="Premium" subtitle="O'qishingizni keyingi bosqichga olib chiqing" back />
      <section className="relative overflow-hidden rounded-3xl gradient-hero p-6 text-white shadow-lift">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-amber-300/30 blur-3xl" />
        <Crown className="h-9 w-9 text-amber-300" />
        {user?.is_premium ? (
          <><h2 className="mt-3 text-2xl font-extrabold">Siz Premium foydalanuvchisiz</h2><p className="mt-1 text-white/80">{fmtDate(d.current.premium_until)} gacha amal qiladi</p></>
        ) : (
          <><h2 className="mt-3 text-2xl font-extrabold">EduWay Premium</h2><p className="mt-1 text-white/80">Ko'proq AI, IELTS Writing tahlili, shaxsiy AI reja va ovozli mashqlar</p>
            <p className="mt-4 text-3xl font-extrabold">{fmtMoney(d.price_uzs)}<span className="text-base font-semibold text-white/70"> / oy</span></p></>
        )}
      </section>

      <section className="card mt-4 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-line bg-muted/60 px-4 py-3 text-sm font-bold">
          <span>Imkoniyat</span><span className="w-20 text-center sm:w-28">Bepul</span><span className="w-20 text-center text-brand sm:w-28">Premium</span>
        </div>
        {d.features.map((f: any) => (
          <div key={f.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-line px-4 py-3 text-sm last:border-0">
            <span className="font-medium">{f.name}</span>
            <span className="w-20 text-center text-xs text-sub sm:w-28">{f.free === "✓" ? <Check className="mx-auto h-4 w-4 text-ok" /> : f.free === "—" ? <Minus className="mx-auto h-4 w-4" /> : f.free}</span>
            <span className="w-20 text-center text-xs font-semibold sm:w-28">{f.premium === "✓" ? <Check className="mx-auto h-4 w-4 text-ok" /> : f.premium}</span>
          </div>
        ))}
      </section>

      {!user?.is_premium && (
        <section className="card mt-4 p-5">
          <h2 className="flex items-center gap-2 font-bold"><Sparkles className="h-5 w-5 text-brand" /> Premium'ga o'tish</h2>
          <div className="mt-3 flex gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-3 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
            <p>Onlayn to'lov tizimi (Payme/Click va h.k.) hali ulanmagan. {d.payment_configured ? "To'lov quyidagi ko'rsatma bo'yicha amalga oshiriladi va administrator tomonidan qo'lda tasdiqlanadi." : "To'lov usuli hali sozlanmagan — Premium'ni hozircha faqat administrator faollashtira oladi."}</p>
          </div>
          {d.payment_configured && (
            pending ? (
              <div className="mt-4 rounded-2xl bg-muted p-4 text-sm"><p className="font-semibold">So'rovingiz ko'rib chiqilmoqda</p><p className="text-sub">{pending.months} oy · {fmtMoney(pending.amount)} · {fmtDate(pending.created)}</p><button className="btn-outline btn-sm mt-3" onClick={() => cancel(pending.id)}>Bekor qilish</button></div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="whitespace-pre-line rounded-2xl bg-muted p-4 text-sm"><p className="mb-1 font-bold">To'lov ko'rsatmasi</p>{d.payment_instructions}</div>
                <div className="grid grid-cols-4 gap-2">{[1, 3, 6, 12].map((m) => <button key={m} onClick={() => setMonths(m)} className={cx("rounded-2xl border p-3 text-center", months === m ? "border-brand bg-brand-soft" : "border-line")}><p className="text-lg font-extrabold">{m}</p><p className="text-[11px] text-sub">oy</p></button>)}</div>
                <p className="text-sm">Jami: <b>{fmtMoney(d.price_uzs * months)}</b></p>
                <Field label="To'lov ma'lumoti" hint="Masalan: chek raqami, to'lov vaqti va karta oxirgi 4 raqami"><input className="input" value={ref} maxLength={200} onChange={(e) => setRef(e.target.value)} /></Field>
                <button className="btn-primary w-full" disabled={busy || !ref.trim()} onClick={send}>{busy ? <Spinner /> : "To'ladim — tekshirishga yuborish"}</button>
              </div>
            )
          )}
        </section>
      )}

      {d.requests.length > 0 && (
        <section className="card mt-4 p-5"><h2 className="font-bold">So'rovlar tarixi</h2>
          <ul className="mt-2 divide-y divide-line">{d.requests.map((r: any) => <li key={r.id} className="flex items-center justify-between py-2.5 text-sm"><span>{fmtDate(r.created)} · {r.months} oy{r.admin_note ? ` · ${r.admin_note}` : ""}</span><Badge tone={ST[r.status][1]}>{ST[r.status][0]}</Badge></li>)}</ul>
          <button className="btn-ghost btn-sm mt-2" onClick={() => { refresh(); reload(); }}>Holatni yangilash</button>
        </section>
      )}
    </>
  );
}
