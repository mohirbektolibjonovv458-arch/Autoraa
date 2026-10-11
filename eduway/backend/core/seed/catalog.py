"""Boshlang'ich katalog. Barcha yozuvlar verified=False — administrator rasmiy manbadan tekshirib, narx va muddatlarni kiritgach tasdiqlaydi.
Narxlar va aniq muddatlar ataylab bo'sh qoldirilgan: tasdiqlanmagan raqamlarni haqiqat sifatida ko'rsatmaymiz."""

UZ_ADMISSION = ("Davlat OTMlariga qabul odatda test sinovlari natijalari asosida, davlat granti va to'lov-kontrakt asosida amalga oshiriladi. "
                "Fanlar majmuasi va o'tish ballari yo'nalishga qarab har yili e'lon qilinadi — rasmiy sayt va uzbmb.uz dan tekshiring.")
INTL_ADMISSION = ("Odatda: o'rta ta'lim hujjati, ingliz tili sertifikati (IELTS yoki ekvivalent), universitetning ichki imtihoni yoki suhbati. "
                  "Aniq talablar va minimal ballni rasmiy saytdan tekshiring.")
FOREIGN_ADMISSION = ("Odatda: o'rta ta'lim hujjati va baholar, til sertifikati, motivatsion xat, tavsiyanomalar. "
                     "Ayrim davlatlarda tayyorlov (foundation) yili yoki qo'shimcha imtihonlar talab qilinadi. Rasmiy saytdan tekshiring.")
NOTE = "Narx har yili yangilanadi — rasmiy saytdan tekshiring"


def U(name, short, country, city, kind, website, desc, langs, programs, admission, has_grants=None, grant_note=""):
    return dict(name=name, short_name=short, country=country, city=city, kind=kind, website=website, source_url=website,
                description=desc, languages=langs, admission_requirements=admission, tuition_note=NOTE,
                deadline_note="Qabul muddatlari har yili e'lon qilinadi — rasmiy saytdan tekshiring",
                has_grants=has_grants, grant_note=grant_note, programs=programs)


def P(name, field, lang="", degree="bachelor", years=4):
    return dict(name=name, field=field, language=lang, degree=degree, duration_years=years)


UNIVERSITIES = [
    U("O'zbekiston Milliy universiteti", "O'zMU", "O'zbekiston", "Toshkent", "state", "https://nuu.uz",
      "Mamlakatdagi eng yirik klassik universitetlardan biri: tabiiy, aniq va ijtimoiy fanlar.", ["o'zbek", "rus"],
      [P("Matematika", "science"), P("Fizika", "science"), P("Biologiya", "science"), P("Kompyuter ilmlari", "it"), P("Jurnalistika", "media"), P("Psixologiya", "social"), P("Xalqaro munosabatlar", "social")],
      UZ_ADMISSION, True, "Davlat granti o'rinlari mavjud"),
    U("Muhammad al-Xorazmiy nomidagi Toshkent axborot texnologiyalari universiteti", "TATU", "O'zbekiston", "Toshkent", "state", "https://tuit.uz",
      "Axborot texnologiyalari, dasturiy injiniring va telekommunikatsiya bo'yicha yetakchi OTM.", ["o'zbek", "rus"],
      [P("Dasturiy injiniring", "it"), P("Kompyuter injiniringi", "it"), P("Kiberxavfsizlik", "it"), P("Sun'iy intellekt", "it"), P("Telekommunikatsiya texnologiyalari", "engineering")],
      UZ_ADMISSION, True, "Davlat granti o'rinlari mavjud"),
    U("Toshkent davlat texnika universiteti", "TDTU", "O'zbekiston", "Toshkent", "state", "https://tdtu.uz",
      "Muhandislik, energetika, mexatronika va texnologiyalar yo'nalishlari.", ["o'zbek", "rus"],
      [P("Mexatronika va robototexnika", "engineering"), P("Elektr energetikasi", "engineering"), P("Qurilish muhandisligi", "engineering"), P("Avtomatlashtirish", "engineering")],
      UZ_ADMISSION, True, "Davlat granti o'rinlari mavjud"),
    U("Toshkent davlat iqtisodiyot universiteti", "TDIU", "O'zbekiston", "Toshkent", "state", "https://tsue.uz",
      "Iqtisodiyot, moliya, bank ishi va menejment bo'yicha ixtisoslashgan universitet.", ["o'zbek", "rus", "ingliz"],
      [P("Iqtisodiyot", "business"), P("Moliya", "business"), P("Buxgalteriya hisobi va audit", "business"), P("Marketing", "business"), P("Menejment", "business")],
      UZ_ADMISSION, True, "Davlat granti o'rinlari mavjud"),
    U("Toshkent davlat yuridik universiteti", "TDYU", "O'zbekiston", "Toshkent", "state", "https://tsul.uz",
      "Huquqshunoslik bo'yicha yetakchi oliy ta'lim muassasasi.", ["o'zbek", "rus", "ingliz"],
      [P("Yurisprudensiya", "law"), P("Xalqaro huquq", "law")], UZ_ADMISSION, True, "Davlat granti o'rinlari mavjud"),
    U("O'zbekiston davlat jahon tillari universiteti", "O'zDJTU", "O'zbekiston", "Toshkent", "state", "https://uzswlu.uz",
      "Xorijiy tillar, tarjima va filologiya bo'yicha ixtisoslashgan universitet.", ["o'zbek", "ingliz", "rus"],
      [P("Ingliz tili filologiyasi", "languages"), P("Tarjima nazariyasi va amaliyoti", "languages"), P("Xorijiy til o'qitish metodikasi", "education")],
      UZ_ADMISSION, True, "Davlat granti o'rinlari mavjud"),
    U("Samarqand davlat universiteti", "SamDU", "O'zbekiston", "Samarqand", "state", "https://samdu.uz",
      "Tarixiy klassik universitet: tabiiy, gumanitar va IT yo'nalishlar.", ["o'zbek", "rus"],
      [P("Matematika", "science"), P("Biotexnologiya", "science"), P("Axborot tizimlari", "it"), P("Tarix", "social"), P("Pedagogika", "education")],
      UZ_ADMISSION, True, "Davlat granti o'rinlari mavjud"),
    U("Samarqand davlat tibbiyot universiteti", "SamDTU", "O'zbekiston", "Samarqand", "state", "https://sammu.uz",
      "Tibbiyot va farmatsiya yo'nalishlarida kadrlar tayyorlaydi.", ["o'zbek", "rus", "ingliz"],
      [P("Davolash ishi", "medicine", years=6), P("Pediatriya", "medicine", years=6), P("Stomatologiya", "medicine", years=5)],
      UZ_ADMISSION, True, "Davlat granti o'rinlari mavjud"),
    U("Toshkent farmatsevtika instituti", "TFI", "O'zbekiston", "Toshkent", "state", "https://pharmi.uz",
      "Farmatsiya va dori vositalari texnologiyasi bo'yicha ixtisoslashgan institut.", ["o'zbek", "rus"],
      [P("Farmatsiya", "medicine", years=5), P("Sanoat farmatsiyasi", "medicine", years=5)], UZ_ADMISSION, True, "Davlat granti o'rinlari mavjud"),
    U("Toshkentdagi Vestminster xalqaro universiteti", "WIUT", "O'zbekiston", "Toshkent", "branch", "https://wiut.uz",
      "Buyuk Britaniyaning University of Westminster diplomini beruvchi xalqaro universitet; ta'lim ingliz tilida.", ["ingliz"],
      [P("Business Administration", "business", "ingliz", years=3), P("Economics", "business", "ingliz", years=3), P("Business Information Systems", "it", "ingliz", years=3), P("Commercial Law", "law", "ingliz", years=3)],
      INTL_ADMISSION),
    U("Toshkentdagi Inha universiteti", "IUT", "O'zbekiston", "Toshkent", "branch", "https://inha.uz",
      "Janubiy Koreyaning Inha universiteti modeli asosida IT va logistika yo'nalishlari; ta'lim ingliz tilida.", ["ingliz"],
      [P("Computer Science and Engineering", "it", "ingliz"), P("Information and Communication Engineering", "engineering", "ingliz"), P("Logistics", "business", "ingliz")],
      INTL_ADMISSION),
    U("Toshkentdagi Turin politexnika universiteti", "TTPU", "O'zbekiston", "Toshkent", "branch", "https://polito.uz",
      "Italiyaning Politecnico di Torino bilan hamkorlikdagi muhandislik universiteti.", ["ingliz"],
      [P("Mechanical Engineering", "engineering", "ingliz"), P("Civil Engineering", "engineering", "ingliz"), P("Software Engineering", "it", "ingliz"), P("Architecture", "arts", "ingliz", years=5)],
      INTL_ADMISSION),
    U("Toshkentdagi Webster universiteti", "Webster", "O'zbekiston", "Toshkent", "branch", "https://webster.uz",
      "AQShning Webster University tizimidagi kampus: biznes, kompyuter fanlari va media.", ["ingliz"],
      [P("Business Administration", "business", "ingliz"), P("Computer Science", "it", "ingliz"), P("Media Communications", "media", "ingliz"), P("Psychology", "social", "ingliz")],
      INTL_ADMISSION),
    U("Seoul National University", "SNU", "Janubiy Koreya", "Seul", "foreign", "https://en.snu.ac.kr",
      "Janubiy Koreyaning yetakchi tadqiqot universiteti.", ["koreys", "ingliz"],
      [P("Computer Science and Engineering", "it"), P("Mechanical Engineering", "engineering"), P("Economics", "business"), P("Biological Sciences", "science")],
      FOREIGN_ADMISSION, None, "GKS kabi davlat stipendiyalari orqali o'qish imkoniyati bor"),
    U("Technical University of Munich", "TUM", "Germaniya", "Myunxen", "foreign", "https://www.tum.de/en/",
      "Germaniyaning yetakchi texnika universitetlaridan biri.", ["nemis", "ingliz"],
      [P("Informatics", "it", years=3), P("Mechanical Engineering", "engineering", years=3), P("Management and Technology", "business", years=3)],
      FOREIGN_ADMISSION, None, "Germaniyada davlat universitetlarida o'qish to'lovi siyosati yerga va fuqarolikka qarab farq qiladi — tekshiring"),
    U("University of Debrecen", "UD", "Vengriya", "Debretsen", "foreign", "https://unideb.hu/en",
      "Vengriyaning yirik universitetlaridan biri; ko'plab ingliz tilidagi dasturlar.", ["ingliz", "venger"],
      [P("Medicine", "medicine", "ingliz", years=6), P("Computer Science Engineering", "it", "ingliz", years=3.5), P("Business Administration and Management", "business", "ingliz", years=3)],
      FOREIGN_ADMISSION, True, "Stipendium Hungaricum dasturida ishtirok etadi"),
    U("Middle East Technical University", "METU", "Turkiya", "Anqara", "foreign", "https://www.metu.edu.tr",
      "Turkiyaning yetakchi texnika universiteti; ta'lim ingliz tilida.", ["ingliz"],
      [P("Computer Engineering", "it", "ingliz"), P("Civil Engineering", "engineering", "ingliz"), P("Economics", "business", "ingliz"), P("Architecture", "arts", "ingliz")],
      FOREIGN_ADMISSION, None, "Türkiye Bursları orqali o'qish imkoniyati bo'lishi mumkin"),
    U("University of Bologna", "UNIBO", "Italiya", "Boloniya", "foreign", "https://www.unibo.it/en",
      "Yevropaning eng qadimgi universitetlaridan biri; ingliz tilidagi dasturlar mavjud.", ["italyan", "ingliz"],
      [P("Economics and Finance", "business", "ingliz", years=3), P("Genomics", "science", "ingliz", years=3), P("Medicine and Surgery", "medicine", "ingliz", years=6)],
      FOREIGN_ADMISSION, None, "Universitet va mintaqa stipendiyalari bor — rasmiy saytdan tekshiring"),
]

D_COMMON = ["Pasport nusxasi", "Ta'lim hujjati va baholar (transkript) — tarjimasi bilan", "Til sertifikati", "Motivatsion xat", "Tavsiyanomalar", "Rezyume (CV)"]


def G(name, provider, country, levels, funding, url, desc, eligibility, deadline_note, documents=None, language_note="", fields=None, funding_note=""):
    return dict(name=name, provider=provider, country=country, levels=levels, funding=funding, official_url=url, source_url=url,
                description=desc, eligibility=eligibility, deadline_note=deadline_note, documents=documents or D_COMMON,
                language_note=language_note, fields=fields or [], funding_note=funding_note)


GRANTS = [
    G("El-yurt umidi", "El-yurt umidi jamg'armasi", "O'zbekiston", ["master", "phd"], "full", "https://eyuf.uz",
      "O'zbekiston fuqarolarining xorijdagi yetakchi universitetlarda magistratura va doktoranturada o'qishini moliyalashtiradigan davlat jamg'armasi dasturi.",
      "O'zbekiston fuqarolari; bakalavr diplomi; xorijiy universitetdan qabul yoki tanlov shartlari. Bitirgandan so'ng O'zbekistonda ishlab berish majburiyati bo'lishi mumkin.",
      "Tanlovlar yil davomida e'lon qilinadi — eyuf.uz dan tekshiring", language_note="Til sertifikati talablari tanlov nizomida ko'rsatiladi"),
    G("Chevening", "Buyuk Britaniya hukumati", "Buyuk Britaniya", ["master"], "full", "https://www.chevening.org",
      "Buyuk Britaniya universitetlarida bir yillik magistratura uchun to'liq stipendiya: o'qish, yashash, aviachipta.",
      "Bakalavr diplomi; ish tajribasi (odatda kamida 2 yil); yetakchilik salohiyati; bitirgach vataniga qaytish sharti.",
      "Odatda kuzda (taxminan avgust–noyabr) qabul qilinadi — taxminiy, rasmiy saytdan tekshiring",
      D_COMMON + ["Uchta Buyuk Britaniya universitetidan dastur tanlovi", "Esse (yetakchilik, tarmoq, kelajak rejasi)"],
      "Ingliz tili talabi va muddatini rasmiy saytdan tekshiring"),
    G("Fulbright Foreign Student Program", "AQSh Davlat departamenti", "AQSh", ["master", "phd"], "full", "https://foreign.fulbrightonline.org",
      "AQSh universitetlarida magistratura yoki tadqiqot uchun nufuzli davlat stipendiyasi. O'zbekistonda AQSh elchixonasi orqali e'lon qilinadi.",
      "Bakalavr diplomi; yuqori akademik natijalar; ingliz tili; O'zbekiston fuqaroligi (mamlakat dasturi shartlari bo'yicha).",
      "Har yili elchixona e'lon qiladi — uz.usembassy.gov va rasmiy saytdan tekshiring",
      D_COMMON + ["Shaxsiy bayonot (Personal Statement)", "Tadqiqot maqsadi (Study/Research Objective)"],
      "Odatda TOEFL/IELTS va GRE kabi testlar talab qilinishi mumkin"),
    G("DAAD stipendiyalari", "Germaniya akademik almashinuv xizmati (DAAD)", "Germaniya", ["master", "phd"], "full", "https://www.daad.de/en/",
      "Germaniyada magistratura, doktorantura va tadqiqot uchun turli stipendiya dasturlari.",
      "Bakalavr (magistratura uchun) yoki magistr (PhD uchun) diplomi; dasturga qarab ish tajribasi talab qilinishi mumkin.",
      "Har bir dastur o'z muddatiga ega — DAAD stipendiyalar bazasidan tekshiring", language_note="Ingliz yoki nemis tili — dasturga bog'liq"),
    G("Stipendium Hungaricum", "Vengriya hukumati", "Vengriya", ["bachelor", "master", "phd"], "full", "https://stipendiumhungaricum.hu",
      "Vengriya universitetlarida o'qish to'lovi, oylik stipendiya, yotoqxona va tibbiy sug'urtani qoplaydigan davlat stipendiyasi.",
      "Hamkor davlat fuqarolari (O'zbekiston hamkorligini rasmiy saytdan tekshiring); tanlangan dastur talablariga javob berish; milliy nominatsiya.",
      "Odatda noyabr–yanvar oralig'ida — taxminiy, rasmiy saytdan tekshiring", D_COMMON + ["Tibbiy ma'lumotnoma"],
      "Ko'pchilik dasturlar uchun ingliz tili sertifikati kerak", funding_note="O'qish, stipendiya, yotoqxona, sug'urta"),
    G("Global Korea Scholarship (GKS)", "Janubiy Koreya hukumati (NIIED)", "Janubiy Koreya", ["bachelor", "master", "phd"], "full", "https://www.studyinkorea.go.kr",
      "Koreya universitetlarida o'qish, yashash va bir yillik koreys tili kursini qoplaydigan to'liq stipendiya.",
      "Chet el fuqarolari; yosh chegarasi va o'rtacha baho talabi mavjud; elchixona yoki universitet orqali ariza.",
      "Bakalavr odatda kuzda, magistratura bahorda — taxminiy, rasmiy saytdan tekshiring", D_COMMON + ["Tibbiy ma'lumotnoma", "Ta'lim rejasi (Study Plan)"],
      "TOPIK yoki IELTS/TOEFL bonus ball berishi mumkin"),
    G("Türkiye Bursları", "Turkiya hukumati", "Turkiya", ["bachelor", "master", "phd"], "full", "https://www.turkiyeburslari.gov.tr",
      "Turkiya universitetlarida o'qish, oylik stipendiya, yotoqxona, sug'urta va turk tili kursini qoplaydigan stipendiya.",
      "Chet el fuqarolari; yosh chegarasi va minimal akademik baho talablari mavjud (bosqichga qarab).",
      "Odatda yil boshida (yanvar–fevral) — taxminiy, rasmiy saytdan tekshiring", D_COMMON,
      "Turkcha yoki inglizcha dasturlar; turk tili kursi beriladi"),
    G("Erasmus Mundus Joint Masters", "Yevropa Ittifoqi", "Yevropa Ittifoqi", ["master"], "full", "https://erasmus-plus.ec.europa.eu",
      "Bir nechta Yevropa universitetida o'qiladigan qo'shma magistratura dasturlari uchun to'liq stipendiya.",
      "Bakalavr diplomi; har bir dasturning o'z talablari; dunyo bo'ylab talabalar ariza bera oladi.",
      "Har bir dastur o'z muddatiga ega (ko'pincha oktyabr–yanvar) — taxminiy", D_COMMON, "Odatda IELTS/TOEFL talab qilinadi"),
    G("MEXT (Japoniya hukumati stipendiyasi)", "Japoniya Ta'lim vazirligi (MEXT)", "Yaponiya", ["bachelor", "master", "phd"], "full", "https://www.studyinjapan.go.jp/en/",
      "Yaponiya universitetlarida o'qish, oylik stipendiya va aviachiptani qoplaydi; ko'pincha yapon tili tayyorlov kursi bilan.",
      "Yosh chegarasi bor; elchixona tavsiyasi yoki universitet tavsiyasi orqali; yozma imtihon va suhbat.",
      "Odatda bahor–yozda elchixona e'lon qiladi — taxminiy, rasmiy saytdan tekshiring", D_COMMON + ["Tibbiy ma'lumotnoma"],
      "Yapon yoki ingliz tili — dasturga bog'liq"),
]
