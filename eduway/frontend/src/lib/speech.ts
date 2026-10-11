// Brauzerning Web Speech API'si: nutqni matnga aylantirish (SpeechRecognition) va matnni o'qib berish (speechSynthesis).
// EduWay serveri audio olmaydi va saqlamaydi — serverga faqat tanilgan matn yuboriladi.

const SR: any = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

export const speechSupport = {
  recognition: !!SR,
  synthesis: typeof window !== "undefined" && "speechSynthesis" in window,
};

export function listen(lang: string, onText: (t: string, final: boolean) => void, onEnd: (err?: string) => void) {
  if (!SR) { onEnd("unsupported"); return () => {}; }
  const r = new SR();
  r.lang = lang;
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  let ended = false;
  r.onresult = (e: any) => {
    let text = "", final = false;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      if (e.results[i].isFinal) final = true;
    }
    onText(text, final);
  };
  r.onerror = (e: any) => { if (!ended) { ended = true; onEnd(e.error || "error"); } };
  r.onend = () => { if (!ended) { ended = true; onEnd(); } };
  r.start();
  return () => { try { r.stop(); } catch { /* ignore */ } };
}

export function speak(text: string, lang = "en-US", onEnd?: () => void) {
  if (!speechSupport.synthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[*_#>`|]/g, "").replace(/💡/g, "");
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang;
  u.rate = 0.95;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2)));
  if (voice) u.voice = voice;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speechSupport.synthesis) window.speechSynthesis.cancel();
}

export function micErrorText(err?: string) {
  switch (err) {
    case "not-allowed":
    case "service-not-allowed":
      return "Mikrofonga ruxsat berilmagan. Brauzer manzil satridagi qulf belgisidan ruxsat bering.";
    case "no-speech": return "Ovoz eshitilmadi. Qayta urinib ko'ring.";
    case "audio-capture": return "Mikrofon topilmadi.";
    case "network": return "Nutqni tanish xizmatiga ulanib bo'lmadi (internet kerak).";
    case "unsupported": return "Brauzeringiz ovozli kiritishni qo'llab-quvvatlamaydi. Chrome yoki Edge'dan foydalaning.";
    default: return err ? "Ovozni tanishda xatolik." : "";
  }
}
