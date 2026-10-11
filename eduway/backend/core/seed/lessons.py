"""Ingliz tili darslari (sodda markdown: ## sarlavha, - ro'yxat, **qalin**, > misol)."""

L = lambda title, skill, level, summary, content, order=0, quiz=None, premium=False, listening="": dict(
    title=title, skill=skill, level=level, summary=summary, content=content.strip(), order=order, quiz_title=quiz,
    is_premium=premium, listening_text=listening.strip())

LESSONS = [
    L("To be: am, is, are", "grammar", "A1", "Eng asosiy fe'l: men ...man, u ...dir.", """
## Qoida
«To be» fe'li hozirgi zamonda uch shaklga ega:
- **I am** — men ...man
- **He / She / It is** — u ...
- **You / We / They are** — sen/biz/ular ...

## Misollar
> I am a student. — Men talabaman.
> She is from Samarkand. — U Samarqanddan.
> We are ready. — Biz tayyormiz.

## Inkor va so'roq
- Inkor: **I am not**, **she isn't**, **they aren't**
- So'roq: fe'l oldinga chiqadi — **Is she** a teacher? **Are you** tired?

## Mashq
O'zingiz haqingizda 5 ta gap yozing: ismingiz, yoshingiz, qayerdansiz, kim bo'lib o'qiysiz, nimaga qiziqasiz.
""", 1),
    L("Present Simple va Present Continuous", "grammar", "A2", "Odatlar va hozir bo'layotgan ishlar.", """
## Present Simple — odat va faktlar
Tuzilishi: **V / V+s (he, she, it)**
> I **study** English every day.
> The Earth **goes** around the Sun.
Kalit so'zlar: *every day, usually, often, never, always*

## Present Continuous — ayni paytdagi ish
Tuzilishi: **am / is / are + V-ing**
> I **am studying** now.
> Look! It **is raining**.
Kalit so'zlar: *now, at the moment, Look!, Listen!*

## Muhim
**know, like, love, want, need, understand** kabi holat fe'llari odatda Continuous'da ishlatilmaydi:
> I **know** the answer. (✗ I am knowing)

## Keyingi qadam
Mavzu bo'yicha testni ishlang va xatolaringizni AI English Coach bilan tahlil qiling.
""", 2, "Present Simple vs Present Continuous"),
    L("Artikllar: a, an, the", "grammar", "A2", "Qachon a/an, qachon the, qachon artiklsiz.", """
## a / an — birinchi marta, «bitta»
- **a** — undosh tovushdan oldin: *a book, a university*
- **an** — unli tovushdan oldin: *an apple, an hour*
Muhimi — **tovush**, harf emas!

## the — aniq, ma'lum narsa
- Avval tilga olingan: *I have a cat. **The** cat is black.*
- Yagona narsalar: ***the** sun, **the** moon*
- Eng ustun daraja: ***the** best student*

## Artiklsiz
- Sport, fanlar, tillar: *play football, study maths, speak English*
- Umumiy ko'plik: *Dogs are friendly.*
""", 3, "Articles: a, an, the"),
    L("Past Simple va Present Perfect", "grammar", "B1", "Aniq o'tgan vaqt yoki hozirgi natija?", """
## Past Simple — tugagan, vaqti aniq
> I **visited** Bukhara **last summer**.
Kalit so'zlar: *yesterday, last week, in 2020, ago, when?*

## Present Perfect — hozirgi natija yoki tajriba
Tuzilishi: **have / has + V3**
> I **have visited** Bukhara **twice**. (tajriba)
> She **has lost** her phone. (hozir telefoni yo'q)
Kalit so'zlar: *ever, never, already, yet, just, since, for*

## Qisqa qoida
Vaqt aniq aytilsa → **Past Simple**. Vaqt muhim emas, natija/tajriba muhim → **Present Perfect**.
""", 4, "Past Simple vs Present Perfect"),
    L("Shart gaplar (Conditionals 0–2)", "grammar", "B1", "If bilan gaplar: real va xayoliy holatlar.", """
## Zero — har doim haqiqat
**If + Present, Present** — *If you heat ice, it melts.*

## First — real kelajak
**If + Present, will + V** — *If I study, I will pass.*

## Second — xayoliy hozirgi/kelajak
**If + Past, would + V** — *If I had wings, I would fly.*
Maslahat berish: *If I **were** you, I **would** read more.*

## unless = if not
> **Unless** you hurry, you'll miss the bus.
""", 5, "Conditionals (0, 1, 2)"),
    L("Passive Voice (majhul nisbat)", "grammar", "B2", "Ish kim tomonidan emas, nima qilingani muhim bo'lganda.", """
## Tuzilishi
**be + V3**
> The bridge **was built** in 1990.
> English **is spoken** all over the world.
> The results **will be announced** tomorrow.

## Qachon ishlatiladi?
- Bajaruvchi noma'lum yoki muhim emas
- Ilmiy va rasmiy matnlarda (IELTS Writing Task 1 jarayon tasvirida juda ko'p)

## by
Bajaruvchini aytish kerak bo'lsa: *The novel was written **by** Abdulla Qodiriy.*
""", 6, premium=True),
    L("Ta'lim mavzusidagi so'zlar", "vocabulary", "B1", "Universitet va o'qish haqida gapirish uchun 15 ta so'z.", """
## So'zlar
- **apply (for)** — ariza topshirmoq: *I want to apply for a scholarship.*
- **admission** — qabul
- **degree** — ilmiy daraja (diplom): *a bachelor's degree*
- **tuition fee** — o'qish to'lovi
- **scholarship / grant** — stipendiya / grant
- **deadline** — oxirgi muddat
- **requirement** — talab
- **transcript** — baholar varaqasi
- **major** — asosiy mutaxassislik
- **graduate** — bitirmoq / bitiruvchi
- **campus** — universitet hududi
- **lecture** — ma'ruza
- **assignment** — topshiriq
- **semester** — semestr
- **certificate** — sertifikat

## Mashq
Har bir so'zni lug'atingizga qo'shing va o'zingiz haqingizda gap tuzing.
""", 1),
    L("Reading: My first year at university", "reading", "A2", "Qisqa matn va tushunish savollari.", """
## Matn
> Aziza is from Namangan. Last year she started studying computer science in Tashkent. At first, everything was new: the big campus, the long lectures and the city traffic. She missed her family, so she called them every evening. In the second semester, she joined the robotics club and made new friends. Now she says that the first year was difficult but very useful.

## Savollar
1. Where is Aziza from?
2. What does she study?
3. Why did she call her family every evening?
4. What helped her make new friends?
5. How does she describe her first year?

## Maslahat
Avval savollarni o'qing, keyin matndan kalit so'zlarni qidiring (scanning). Javoblaringizni AI English Coach'ga yozib tekshirtiring.
""", 1),
    L("Listening: Planning a study weekend", "listening", "B1", "Dialogni tinglang (brauzer o'qib beradi) va savollarga javob bering.", """
## Topshiriq
«Tinglash» tugmasini bosing. Dialogni ikki marta tinglang, keyin savollarga javob bering.

## Savollar
1. Which exam are they preparing for?
2. What will they do on Saturday morning?
3. Where will they meet?
4. What time will they meet?
5. What will they do on Sunday?

## Javoblar (tinglagandan keyin oching)
1. IELTS — 2. Practise reading — 3. At the library — 4. At nine o'clock — 5. Write an essay and check it together
""", 1, listening="""
Sardor: Hi Malika! Are you free this weekend?
Malika: Hi! I want to study for the IELTS exam. It's in three weeks.
Sardor: Me too. Let's study together. On Saturday morning we can practise reading.
Malika: Good idea. Where shall we meet?
Sardor: At the library. It's quiet there.
Malika: OK. What time?
Sardor: At nine o'clock.
Malika: Great. And on Sunday let's write an essay and check it together.
Sardor: Perfect. See you on Saturday!
"""),
    L("IELTS Writing Task 2: tuzilish", "writing", "B2", "4 paragrafli esse rejasi va foydali iboralar.", """
## Tuzilish (250+ so'z, ~40 daqiqa)
1. **Introduction** — savolni o'z so'zlaringiz bilan qayta ifodalang + pozitsiyangiz (thesis).
2. **Body 1** — birinchi asosiy fikr + izoh + misol.
3. **Body 2** — ikkinchi fikr (yoki qarama-qarshi fikr) + izoh + misol.
4. **Conclusion** — pozitsiyani qisqa takrorlang, yangi fikr qo'shmang.

## Foydali iboralar
- *It is often argued that...*
- *There are several reasons why...*
- *For instance, ...*
- *On the other hand, ...*
- *In conclusion, I firmly believe that...*

## Baholash mezonlari
Task Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy — har biri teng ulushda.

## Amaliyot
«Writing» bo'limida esse yozing — Premium foydalanuvchilar AI'dan taxminiy tahlil oladi (rasmiy IELTS balli emas).
""", 1, premium=False),
    L("Speaking Part 1: o'zingiz haqingizda", "speaking", "B1", "Imtihonning birinchi qismida qanday javob berish kerak.", """
## Part 1 haqida
4–5 daqiqa; uy, o'qish, sevimli mashg'ulotlar haqida oddiy savollar.

## Javob formulasi: A + R + E
- **Answer** — to'g'ridan-to'g'ri javob
- **Reason** — sabab
- **Example** — misol
> *Do you like reading?* — Yes, I really do. It helps me relax after classes. For example, last month I read a novel by Chingiz Aitmatov.

## Ko'p uchraydigan xatolar
- Juda qisqa javob («Yes.»)
- Yod olingan uzun matn
- Savolni tushunmasdan javob berish — tushunmasangiz: *Could you repeat the question, please?*

## Mashq
AI bilan ovozli speaking rejimida 5 ta Part 1 savoliga javob bering.
""", 1),
    L("IELTS formati bilan tanishuv", "ielts", "B1", "To'rt bo'lim, vaqt va baholash.", """
## Bo'limlar
- **Listening** — taxminan 30 daqiqa, 4 qism, 40 savol
- **Reading** — 60 daqiqa, 3 matn, 40 savol
- **Writing** — 60 daqiqa, 2 topshiriq (Task 1 va Task 2)
- **Speaking** — 11–14 daqiqa, 3 qism, imtihonchi bilan suhbat

## Baholash
Har bir bo'lim 0–9 ball (0,5 qadam bilan), umumiy ball — o'rtacha qiymat.

## Academic va General Training
Universitetga kirish uchun odatda **Academic** topshiriladi. Qaysi turi kerakligini universitet talablaridan tekshiring.

## Muhim
EduWay'dagi mashqlar va AI baholari **taxminiy**dir va rasmiy IELTS natijasi o'rnini bosmaydi. Imtihonni faqat rasmiy markazlarda topshirish mumkin.
""", 0),
    L("IELTS Reading: True / False / Not Given", "ielts", "B2", "Eng qiyin savol turini yechish strategiyasi.", """
## Farq
- **True** — matn aynan shuni aytadi (sinonimlar bilan)
- **False** — matn bunga **zid**
- **Not Given** — matnda bu haqda ma'lumot **yo'q**

## Strategiya
1. Gapdagi kalit so'zlarni belgilang.
2. Matndan mos joyni toping (savollar matn tartibida keladi).
3. Har bir so'zni solishtiring: *all, some, only, never* kabi so'zlarga e'tibor bering.
4. Bilimingizga emas, faqat matnga tayaning.

## Mashq
Bo'lim oxiridagi T/F/NG testini ishlang.
""", 2, "IELTS Reading: True / False / Not Given", premium=True),
]
