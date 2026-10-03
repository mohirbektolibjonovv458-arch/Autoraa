/** «Google bilan» boshlangan, lekin hali telefon tasdiqlanmagan holat (Kirish ↔ Ro'yxat sahifalari orasida). */
export type GooglePending = { ticket: string; email: string; first_name: string; last_name: string; at: number };

const KEY = "ah_google_pending";
const TTL = 25 * 60 * 1000;  // server ticket'i 30 daqiqa amal qiladi

export function saveGoogle(d: Omit<GooglePending, "at">) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...d, at: Date.now() })); } catch { /* */ }
}

export function loadGoogle(): GooglePending | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return d && d.ticket && Date.now() - d.at < TTL ? d : null;
  } catch { return null; }
}

export function clearGoogle() {
  try { sessionStorage.removeItem(KEY); } catch { /* */ }
}
