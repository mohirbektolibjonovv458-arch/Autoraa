export const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
export const WEEKDAYS = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

export function fmtDate(v?: string | null, withYear = true) {
  if (!v) return "—";
  const d = new Date(v.length === 10 ? v + "T00:00:00" : v);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
}
export function fmtMoney(n?: number | null, cur = "UZS") {
  if (n == null) return "—";
  return new Intl.NumberFormat("ru-RU").format(n).replace(/,/g, " ") + (cur === "UZS" ? " so'm" : ` ${cur}`);
}
export function isoDate(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export function timeAgo(v: string) {
  const s = (Date.now() - new Date(v).getTime()) / 1000;
  if (s < 60) return "hozirgina";
  if (s < 3600) return `${Math.floor(s / 60)} daqiqa oldin`;
  if (s < 86400) return `${Math.floor(s / 3600)} soat oldin`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} kun oldin`;
  return fmtDate(v);
}
export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Xayrli tun";
  if (h < 11) return "Xayrli tong";
  if (h < 18) return "Xayrli kun";
  return "Xayrli kech";
}
export function fmtDuration(sec?: number | null) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
export const SUBJECT_LABEL: Record<string, string> = {
  math: "Matematika", english: "Ingliz tili", ielts: "IELTS", physics: "Fizika", chemistry: "Kimyo",
  biology: "Biologiya", informatics: "Informatika", history: "Tarix", logic: "Mantiq",
};
export const FIELD_LABEL: Record<string, string> = {
  it: "IT va kompyuter fanlari", engineering: "Muhandislik", medicine: "Tibbiyot", business: "Biznes va iqtisod",
  law: "Huquq", education: "Ta'lim", arts: "San'at va dizayn", science: "Tabiiy fanlar", media: "Media",
  social: "Ijtimoiy fanlar", languages: "Tillar",
};
export const LEVEL_LABEL: Record<string, string> = { easy: "Oson", medium: "O'rta", hard: "Qiyin" };
