/** Kirishdan keyin qaytish manzili: faqat sayt ichidagi yo'l (tashqi saytga yo'naltirib bo'lmaydi). */
export function safeNext(raw?: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.startsWith("/\\")) return null;
  if (raw.startsWith("/login") || raw.startsWith("/register")) return null;
  return raw;
}
