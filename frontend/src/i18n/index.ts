/**
 * Ikki tilli interfeys (o'zbekcha — asosiy, ruscha — tarjima).
 * Ekrandagi matnlar lug'at bo'yicha almashtiriladi: komponentlarni o'zgartirmasdan butun ilova tarjima qilinadi.
 * - Foydalanuvchi yozgan kontent (ism, xabar, sharh, mahsulot nomi) `translate="no"` bilan belgilanadi va tegilmaydi.
 * - Sonli matnlar ({n}) ham tarjima qilinadi: «5 kun qoldi» → «осталось 5 дн.».
 * - Tanlov localStorage'da va foydalanuvchi profilida (server) saqlanadi.
 */
import RU1 from "./ru1";
import RU2 from "./ru2";
import RU3 from "./ru3";
import RU4 from "./ru4";

export type Lang = "uz" | "ru";
const KEY = "ah_lang";
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const NUM = /\d+(?:[ \u00a0.,]\d+)*/g;

let dict: Map<string, string> | null = null;
function build() {
  if (dict) return dict;
  dict = new Map();
  for (const src of [RU1, RU2, RU3, RU4]) for (const [k, v] of Object.entries(src)) dict.set(norm(k), v);
  return dict;
}

export function getLang(): Lang {
  try { return localStorage.getItem(KEY) === "ru" ? "ru" : "uz"; } catch { return "uz"; }
}
export const appLocale = () => (getLang() === "ru" ? "ru-RU" : "uz-UZ");

function tr1(d: Map<string, string>, key: string): string {
  const v = d.get(key);
  if (v !== undefined) return v;
  const nums = key.match(NUM);
  if (nums) { const p = d.get(key.replace(NUM, "{n}")); if (p !== undefined) { let i = 0; return p.replace(/\{n\}/g, () => nums[i++] ?? ""); } }
  return key;
}

/** Bitta matnni tarjima qilish (topilmasa — o'zi qaytadi) */
export function tr(text: string): string {
  if (getLang() !== "ru" || !text) return text;
  const d = build();
  const key = norm(text);
  if (!key || !/[A-Za-z]/.test(key)) return text;
  let out = d.get(key);
  if (out === undefined) {
    const nums = key.match(NUM);
    if (nums) {
      const pattern = d.get(key.replace(NUM, "{n}"));
      if (pattern !== undefined) { let i = 0; out = pattern.replace(/\{n\}/g, () => nums[i++] ?? ""); }
    }
  }
  for (const sep of [" · ", " — ", ", "]) {
    // «Motor · Hodovoy», «Diagnostika — 150 000 so'm» kabi birikmalar — har qismi alohida
    if (out !== undefined || !key.includes(sep)) continue;
    const parts = key.split(sep); const tp = parts.map((x) => tr1(d, x));
    if (tp.some((x, i) => x !== parts[i])) out = tp.join(sep);
  }
  if (out === undefined) return text;
  // matn atrofidagi bo'shliqlarni saqlaymiz (JSX qismlari orasida)
  const lead = text.match(/^\s*/)?.[0] || "", trail = text.match(/\s*$/)?.[0] || "";
  return lead + out + trail;
}

const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const done = new WeakMap<Node, string>();

function skip(el: Element | null) {
  if (!el) return true;
  if (SKIP.has(el.tagName)) return true;
  return !!el.closest('[translate="no"], .notranslate, [contenteditable="true"]');
}
function textNode(n: Text) {
  const v = n.nodeValue || "";
  if (done.get(n) === v || skip(n.parentElement)) return;
  const t = tr(v);
  if (t !== v) n.nodeValue = t;
  done.set(n, n.nodeValue || "");
}
function attrs(el: Element) {
  if (el.closest('[translate="no"], .notranslate')) return;  // textarea/input placeholder ham tarjima qilinadi
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); }
  }
}
function walk(root: Node) {
  if (root.nodeType === 3) return textNode(root as Text);
  if (root.nodeType !== 1) return;
  const el = root as Element;
  if (skip(el)) return;
  attrs(el);
  el.querySelectorAll("[placeholder],[title],[aria-label],[alt]").forEach(attrs);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = w.nextNode())) textNode(n as Text);
}

export function startI18n() {
  const lang = getLang();
  document.documentElement.lang = lang;
  if (lang !== "ru") return;
  const run = () => {
    walk(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "characterData") textNode(m.target as Text);
        else if (m.type === "attributes") attrs(m.target as Element);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.body) run(); else document.addEventListener("DOMContentLoaded", run);
}

/** Tilni almashtirish: saqlaydi (server + qurilma) va ilovani qayta yuklaydi */
export async function setLang(lang: Lang, saveToProfile?: (l: Lang) => Promise<unknown>) {
  try { localStorage.setItem(KEY, lang); localStorage.setItem("ah_lang_set", "1"); } catch { /* */ }
  try { await saveToProfile?.(lang); } catch { /* tarmoq xatosi — qurilmada saqlangan */ }
  window.location.reload();
}
