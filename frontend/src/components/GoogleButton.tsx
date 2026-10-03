import { useEffect, useRef, useState } from "react";
import { useSite } from "../site";
import { inAppBrowser } from "../push";

/**
 * «Google bilan davom etish» — Google Identity Services (rasmiy tugma).
 * Google'dan ID token (credential) olinadi va onCredential ga beriladi; server uni tekshiradi (/api/auth/google/).
 * Serverda GOOGLE_CLIENT_ID sozlanmagan bo'lsa — hech narsa ko'rsatilmaydi (oddiy telefon orqali kirish ishlayveradi).
 */
type Gsi = { accounts: { id: { initialize: (o: any) => void; renderButton: (el: HTMLElement, o: any) => void; cancel?: () => void } } };
let gsiPromise: Promise<Gsi> | null = null;

function loadGsi(): Promise<Gsi> {
  const w = window as any;
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => (w.google?.accounts?.id ? resolve(w.google) : reject(new Error("gsi")));
      s.onerror = () => { gsiPromise = null; reject(new Error("gsi")); };
      document.head.appendChild(s);
    });
  }
  return gsiPromise;
}

export default function GoogleButton({ onCredential, text = "continue_with" }: { onCredential: (credential: string) => void; text?: "continue_with" | "signup_with" | "signin_with" }) {
  const site = useSite();
  const cid = site.google_client_id;
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!cid || inAppBrowser()) return;
    let alive = true, lastW = 0;
    const render = (g: Gsi) => {
      const el = box.current;
      if (!el || !alive) return;
      // tugma kengligi konteynerga moslashadi (Google ruxsat bergan oraliq: 200–400 px) — telefonda ham, kompyuterda ham
      const w = Math.round(Math.max(200, Math.min(400, el.parentElement?.clientWidth || el.clientWidth || 320)));
      if (Math.abs(w - lastW) < 8) return;
      lastW = w;
      el.innerHTML = "";
      g.accounts.id.renderButton(el, { type: "standard", theme: "outline", size: "large", shape: "pill", text, logo_alignment: "center", width: w, locale: "uz" });
    };
    let ro: ResizeObserver | undefined;
    loadGsi().then((g) => {
      if (!alive) return;
      g.accounts.id.initialize({
        client_id: cid,
        callback: (r: { credential?: string }) => { if (r?.credential) cb.current(r.credential); },
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
        use_fedcm_for_button: true,
      });
      render(g);
      setState("ready");
      if (box.current?.parentElement && "ResizeObserver" in window) {
        ro = new ResizeObserver(() => render(g));  // ekran burilganda / o'lcham o'zgarganda tugma qayta chiziladi
        ro.observe(box.current.parentElement);
      }
    }).catch(() => alive && setState("error"));
    return () => { alive = false; ro?.disconnect(); };
  }, [cid, text]);

  if (!cid) return null;
  if (inAppBrowser()) {
    // Google o'z siyosatiga ko'ra Telegram/Instagram ichidagi brauzerda kirishni bloklaydi
    return <p className="xs center" style={{ color: "#8e9bb2" }}>Google bilan kirish uchun saytni Chrome yoki Safari'da oching (⋮ menyu → «Brauzerda ochish»).</p>;
  }
  return (
    <div className="google-btn">
      <div ref={box} className="google-btn-slot" aria-label="Google bilan davom etish" />
      {state === "loading" && <div className="google-btn-skel" />}
      {state === "error" && <p className="xs center" style={{ color: "#8e9bb2" }}>Google bilan kirish hozir yuklanmadi. Internetni tekshiring yoki telefon raqam orqali davom eting.</p>}
    </div>
  );
}

/** «yoki» ajratuvchi */
export function OrDivider() {
  return <div className="or-divider"><span>yoki</span></div>;
}
