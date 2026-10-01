import { api } from "../api";
import { getLang, Lang, setLang } from "../i18n";

/** UZ | RU almashtirgich. Kirgan foydalanuvchida tanlov profilga ham yoziladi. */
export default function LangSwitch({ dark = false, logged = false }: { dark?: boolean; logged?: boolean }) {
  const cur = getLang();
  const pick = (l: Lang) => { if (l !== cur) setLang(l, logged ? (x) => api.patch("/auth/me/", { lang: x }) : undefined); };
  return (
    <div className={"lang-switch" + (dark ? " dark" : "")} role="group" aria-label="Til / Язык" translate="no">
      <button className={cur === "uz" ? "active" : ""} onClick={() => pick("uz")} aria-pressed={cur === "uz"}>UZ</button>
      <button className={cur === "ru" ? "active" : ""} onClick={() => pick("ru")} aria-pressed={cur === "ru"}>RU</button>
    </div>
  );
}
