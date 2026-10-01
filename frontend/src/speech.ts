/** Ovozli yordamchi uchun matnni tayyorlash: aniq, sekinroq, gapma-gap.
 *  Ko'p telefonlarda o'zbek ovozi yo'q — turkcha ovoz ishlatiladi. Uni o'zbekcha to'g'ri o'qishi uchun:
 *  sonlar so'z bilan yoziladi (32 → «o'ttiz ikki») va harflar turkcha o'qilishiga moslanadi (sh→ş, ch→ç, q→k, x→h, j→c). */
const ONES = ["nol", "bir", "ikki", "uch", "to'rt", "besh", "olti", "yetti", "sakkiz", "to'qqiz"];
const TENS = ["", "o'n", "yigirma", "o'ttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "to'qson"];

export function numUz(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 10) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  if (n < 1000) return (n >= 200 ? ONES[Math.floor(n / 100)] + " " : "") + "yuz" + (n % 100 ? " " + numUz(n % 100) : "");
  if (n < 1e6) return (n >= 2000 ? numUz(Math.floor(n / 1000)) + " " : "") + "ming" + (n % 1000 ? " " + numUz(n % 1000) : "");
  return String(n);
}

function numbersToWords(t: string) {
  return t.replace(/(\d+)[.,](\d)\b/g, (_, a, b) => `${numUz(+a)} butun ${numUz(+b)}`).replace(/\d+/g, (d) => numUz(+d));
}

function toTurkishReading(t: string) {
  return t
    .replace(/[‘’ʻʼ`]/g, "'")
    .replace(/o'/gi, (m) => (m[0] === "O" ? "O" : "o")).replace(/g'/gi, (m) => (m[0] === "G" ? "G" : "g"))
    .replace(/sh/g, "ş").replace(/Sh/g, "Ş").replace(/ch/g, "ç").replace(/Ch/g, "Ç")
    .replace(/q/g, "k").replace(/Q/g, "K").replace(/x/g, "h").replace(/X/g, "H").replace(/j/g, "c").replace(/J/g, "C")
    .replace(/'/g, "");
}

/** Matnni gaplarga bo'ladi va ovozga mos ko'rinishga keltiradi */
export function speechParts(text: string, voiceLang: string): string[] {
  let t = text.replace(/[«»"]/g, "").replace(/\bkm\b/g, "kilometr").replace(/\s+—\s+/g, ". ");
  const lang = voiceLang.toLowerCase();
  if (!lang.startsWith("ru")) t = numbersToWords(t);
  if (lang.startsWith("tr")) t = toTurkishReading(t);
  return t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
}
