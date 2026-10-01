import { Link } from "react-router-dom";
import { Logo } from "../../components/ui";
import { useSite } from "../../site";

/** Foydalanish shartlari va Maxfiylik siyosati (ommaviy ishga tushirishdan oldin yurist bilan ko'rib chiqing) */
export default function Terms() {
  const site = useSite();
  const S = ({ id, title, children }: any) => <section id={id} className="col gap-8 mt-24"><h2 style={{ fontSize: 22 }}>{title}</h2><div className="col gap-8" style={{ color: "#c6d0e0", lineHeight: 1.7 }}>{children}</div></section>;
  return (
    <div className="landing">
      <nav className="pub-nav"><Link to="/"><Logo /></Link><div className="grow" /><Link to="/register" className="btn btn-red btn-sm">Ro'yxatdan o'tish</Link></nav>
      <div className="pub-section" style={{ maxWidth: 820 }}>
        <h1 style={{ fontSize: 32 }}>Foydalanish shartlari va maxfiylik siyosati</h1>
        <p className="small mt-8" style={{ color: "#8e9bb2" }}>Kuchga kirgan sana: 2026-yil. {site.site_name} platformasidan foydalanib, siz quyidagi shartlarga rozilik bildirasiz.</p>

        <S id="shartlar" title="1. Platforma haqida">
          <p>{site.site_name} — avtomobil egalarini ustalar, evakuator xizmatlari va ehtiyot qismlar sotuvchilari bilan bog'laydigan onlayn platforma. Xizmatlarni platformaning o'zi emas, ro'yxatdan o'tgan mustaqil ijrochilar (ustalar, evakuatorlar, do'konlar) ko'rsatadi.</p>
        </S>
        <S title="2. Ro'yxatdan o'tish">
          <p>Ro'yxatdan o'tish telefon raqami va Telegram orqali yuboriladigan tasdiqlash kodi bilan amalga oshiriladi. Hisobingizga kirish kodini hech kimga bermang. Bir kishi bitta raqam bilan bitta hisob ochadi.</p>
        </S>
        <S title="3. Xizmatlar, narx va to'lov">
          <p>Usta va evakuator xizmatlari narxi platformada ko'rsatilgan narx yoki ijrochi bilan kelishuv asosida belgilanadi va to'lov bevosita ijrochiga amalga oshiriladi. Ehtiyot qismlar uchun to'lov yetkazib berilganda sotuvchiga qilinadi.</p>
          <p>Ustalar uchun Premium obuna ({site.premium_price.toLocaleString("ru-RU")} so'm/oy) karta orqali to'lanadi va to'lov tasdiqlangach faollashadi. Tasdiqlangan obuna to'lovi, xizmat ko'rsatilmagan holatlardan tashqari, qaytarilmaydi.</p>
        </S>
        <S title="4. Foydalanuvchi majburiyatlari">
          <p>To'g'ri ma'lumot kiritish; SOS funksiyasidan faqat haqiqiy ehtiyoj bo'lganda foydalanish; boshqa foydalanuvchilarni haqorat qilmaslik, firibgarlik va noqonuniy mahsulot joylashtirmaslik. Qoidalarni buzgan hisoblar ogohlantirishsiz bloklanishi mumkin.</p>
        </S>
        <S title="5. Javobgarlik">
          <p>Platforma ijrochilarni tekshirishga harakat qiladi («Tasdiqlangan» belgisi), biroq ko'rsatilgan xizmat sifati va ehtiyot qismlar uchun bevosita ijrochi javobgar. Nizolar yuzasidan qo'llab-quvvatlash xizmatiga murojaat qiling — biz hal qilishga ko'maklashamiz.</p>
          <p>Hayot va sog'liqqa xavf tug'ilganda platformaga emas, darhol 112 raqamiga qo'ng'iroq qiling.</p>
        </S>

        <S id="maxfiylik" title="6. Qanday ma'lumotlar yig'iladi">
          <p>Ism, telefon raqami, Telegram chat identifikatori; avtomobil ma'lumotlari, hujjat muddatlari va xarajatlar (siz kiritsangiz); buyurtmalar, chat xabarlari va baholar; SOS so'rovi yoki ijrochi «online» bo'lganda — geolokatsiya.</p>
        </S>
        <S title="7. Ma'lumotlar nima uchun ishlatiladi">
          <p>Hisobga kirish, buyurtmalarni bajarish, sizga eng yaqin ijrochini topish, eslatmalar (hujjat muddati, bron vaqti) yuborish va xizmat sifatini yaxshilash uchun. Ma'lumotlaringiz uchinchi shaxslarga sotilmaydi. Buyurtma berganingizda ism va telefon raqamingiz faqat shu buyurtma ijrochisiga ko'rinadi.</p>
        </S>
        <S title="8. Saqlash va o'chirish">
          <p>Ma'lumotlar O'zbekiston Respublikasining «Shaxsga doir ma'lumotlar to'g'risida»gi qonuni talablariga muvofiq saqlanadi. Hisobingizni istalgan vaqtda Profil → «Hisobni o'chirish» orqali o'chirishingiz mumkin: shaxsiy ma'lumotlaringiz o'chiriladi, buyurtmalar statistikasi esa anonim holda qoladi.</p>
        </S>
        <S title="9. Aloqa">
          <p>Savollar va shikoyatlar uchun: {site.support_phone || "qo'llab-quvvatlash xizmati"}.</p>
        </S>
      </div>
      <footer className="footer"><span>© {new Date().getFullYear()} {site.site_name}</span><Link to="/">Bosh sahifa</Link></footer>
    </div>
  );
}
