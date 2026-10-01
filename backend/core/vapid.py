"""VAPID kalitlarini yaratish (Web Push uchun). Maxfiy kalit faqat serverdagi .env da saqlanadi."""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def generate():
    key = ec.generate_private_key(ec.SECP256R1())
    private = _b64(key.private_numbers().private_value.to_bytes(32, "big"))
    public = _b64(key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
    return public, private


def ensure_keys(env_path, settings):
    """Kalitlar yo'q bo'lsa — yaratib .env ga yozadi va darhol ishlatadi. Qaytaradi: yangi yaratildimi."""
    if settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY:
        return False
    public, private = generate()
    settings.VAPID_PUBLIC_KEY, settings.VAPID_PRIVATE_KEY = public, private
    try:
        txt = env_path.read_text(encoding="utf-8") if env_path.exists() else ""
        lines = [l for l in txt.splitlines() if not l.startswith(("VAPID_PUBLIC_KEY=", "VAPID_PRIVATE_KEY="))]
        lines += ["", "# Web Push kalitlari (avtomatik yaratildi — o'zgartirmang, aks holda barcha qurilmalar qayta obuna bo'lishi kerak)",
                  f"VAPID_PUBLIC_KEY={public}", f"VAPID_PRIVATE_KEY={private}"]
        env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    except OSError:
        pass
    return True


def check_keys(public, private):
    """Kalitlar to'g'rimi: ochiq kalit — 65 bayt (0x04 bilan), maxfiy — 32 bayt va ikkalasi bir juft.
    Qaytaradi: (ok, sabab). Tez-tez uchraydigan xato: nusxalashda qo'shtirnoq, bo'shliq yoki «VAPID_PUBLIC_KEY=» qo'shilib ketishi."""
    import base64
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    def dec(v):
        v = (v or "").strip()
        return base64.urlsafe_b64decode(v + "=" * (-len(v) % 4))
    try:
        pub, prv = dec(public), dec(private)
    except Exception:
        return False, "kalit base64 formatida emas"
    if len(pub) != 65 or pub[0] != 4:
        return False, "VAPID_PUBLIC_KEY noto'g'ri (65 bayt bo'lishi kerak)"
    if len(prv) != 32:
        return False, "VAPID_PRIVATE_KEY noto'g'ri (32 bayt bo'lishi kerak)"
    try:
        key = ec.derive_private_key(int.from_bytes(prv, "big"), ec.SECP256R1())
        if key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint) != pub:
            return False, "VAPID kalitlari bir juft emas (public va private har xil juftlikdan)"
    except Exception:
        return False, "VAPID_PRIVATE_KEY noto'g'ri"
    return True, ""
