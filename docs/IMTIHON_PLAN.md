# Imtihon moduli — reja

Sana: 2026-09-24. Holat belgilari: ✅ tayyor · 🟡 qisman · ⬜ boshlanmagan.

Asos: egasi bilan Gemini yozgan "Smart imtihon va AI-OMR" texnik vazifasi (TZ).
Bu hujjat o'sha TZ ni bo'limma-bo'lim tanqid qiladi va CRM ning hozirgi kodi va
bazasiga tayangan rejaga aylantiradi.

---

## 0. Qisqasi

- **TZ noldan alohida Python tizim quradi, holbuki CRM da imtihon moduli allaqachon bor**
  (savollar banki, shablon, variantlar, OMR varaqa, QR skaner). U hech qachon
  ishlatilmagan: bazada 0 ta imtihon, 0 ta savol. To'g'ri yo'l — alohida mikroxizmat
  emas, mavjud CRM ichida (Node + React + Prisma) shu modulni oxiriga yetkazish.
- TZ texnologiyadan boshlanadi. Markazga esa natija kerak: **imtihon tugaganidan
  3 soat ichida har ota-onaga to'g'ri ball yetib borsin** va **ustoz o'z kursida
  qaysi mavzu zaif ekanini ko'rsin**. Reja shu ikki natija atrofida qurilgan.
- TZ da eng muhim jarayonlar yo'q: kalitni tuzatib hammani qayta hisoblash, e'lon
  qilishdan oldingi tekshiruv, smenalar, ikki filial, kalit sizib chiqishidan himoya,
  bo'sh qoldirilgan javoblar.
- AI (klon, tarjima, yechim) 3-bosqichga o'tadi. Birinchi haqiqiy imtihonni AI siz
  ham o'tkazish mumkin. AI yozgan xato yechim 400 ota-onaga borib qolsa, markazning
  obro'siga zarar yetadi.
- Qo'lyozmani OCR (Mathpix) bilan o'qish o'rniga raqamli javoblar ham doirachalar
  bilan belgilanadi (grid-in). Buni mashina 100% o'qiydi va hech qanday to'lov yo'q.
- Ko'chirishning oldini olish uchun har o'quvchiga alohida savol shart emas.
  **Variant o'rindiqqa qarab beriladi**: 4 ta variantning o'zi yetadi, shunda yondagi,
  oldingi, orqadagi va diagonaldagi qo'shnining varianti boshqa bo'ladi. Klonlar esa
  2-smena va keyingi oy uchun kerak.

---

## 1. Hozir nima bor (audit)

### 1.1 Kod

| Qism | Qayerda | Holati |
|---|---|---|
| Savollar banki | `QuestionsList.tsx`, `QuestionEditor.tsx`, `/api/questions` (+ `/bulk`) | Faqat A–D li yopiq savol. Fan va mavzu erkin matn sifatida yoziladi, rasm Storage da saqlanadi |
| Imtihon shabloni | `ExamBuilder.tsx`, `Exam.blocks` (JSON) | Fan bloki → mavzu qoidasi (mavzu, soni) → savol bali (sukut 3.1). DTM ning blok modeli bor |
| Kurslarga biriktirish | `ExamDetail.tsx`, `ExamAssignment` | Kurs tanlanadi. `attendsExam = false` bo'lgan o'quvchiga varaqa chiqmaydi |
| Variantlar | `src/lib/shuffler.ts` → `Exam.variants` (JSON) | Brauzerda yasaladi: mavzudan tasodifiy savol olinadi va javoblar aralashtiriladi |
| Savol kitobchasi | `pdf-generator.ts` `generateQuestionPaper` | jsPDF, 2 ustunli |
| Javob varaqasi | `pdf-generator.ts` `renderOMRPage` | 4 burchak markeri, QR `{e,s,v}`, rasm, ID va variant doirachalari, A–D javoblar |
| Skaner | `Scanner.tsx` | Kamera faqat QR ni o'qiydi. Javoblarni operator **qo'lda bosib chiqadi**, doirachalarni o'qish yo'q |
| Ball hisoblash | `POST /api/exam-results` | Serverda hisoblanadi, blok ballari ham. `(studentId, examId)` bo'yicha upsert |
| Xabarlar | `lib/xabarMatni.js` `{testnatijasi}` | Oxirgi natija shablonga qo'yiladi |
| Ruxsatlar | `lib/ruxsatlar.js` `imtihonlar.*` | 4 ta bo'lim: imtihon, savollar, natija, o'chirish |

### 1.2 Bazadagi real ma'lumot (2026-09-24)

- Savol **0** · imtihon **0** · natija **0** · biriktirish **0**. Qayta qurishga
  erkinmiz, ko'chiriladigan ma'lumot yo'q.
- Faol o'quvchi 487 ta (Sariosiyo 414, Langar 73), 486 tasida rasm bor.
- Telegram ulangani (o'quvchi yoki ota-onasi) 253 ta, ya'ni **faqat yarmi**. Qolgan
  yarmiga natija faqat SMS orqali boradi.
- Xonalar: Sariosiyoda 10 ta, jami 356 o'rin; Langarda 2 ta, 54 o'rin. Bu raqamlar
  dars uchun kiritilgan. Imtihonda bir partaga bitta o'quvchi o'tqazilsa, sig'im
  taxminan ikki barobar kamayadi. Demak 400 kishilik imtihon **bir smenaga
  sig'maydi**, smena tushunchasi majburiy.
- Kurslar 11 ta, bittasida (Matematika-4) 100 o'quvchi bor.

### 1.3 Mavjud koddagi xatolar (reja qanday bo'lmasin, tuzatiladi)

1. **Blok ballari noto'g'ri hisoblanadi.** `server.js:7246` `vq.subject` ni o'qiydi,
   lekin `shuffler.ts` yasagan variant savolida `subject` maydoni yo'q. Natijada har
   savol birinchi blokka va shu blokning bali bilan (masalan 3.1) qo'shiladi. DTM
   formatida jami ball xato chiqadi.
2. **Bo'sh javobli varaqni saqlab bo'lmaydi.** `Scanner.tsx:271` da hamma savol
   belgilanmaguncha "Saqlash" tugmasi o'chiq turadi. Real imtihonda deyarli har
   varaqda bo'sh savol bo'ladi.
3. **Bank yetmasa, xato ko'rsatilmaydi.** `shuffler.ts:57` faqat `console.warn`
   yozadi va variant qisqaroq chiqadi. Javob varaqasi esa `exam.totalQuestions`
   bo'yicha chiziladi, shuning uchun savol raqamlari surilib ketadi.
4. **Takrorlanish haqidagi ogohlantirish yo'qoladi.** `shuffler.ts:106` uni massivga
   xossa qilib yopishtiradi, JSON ga saqlanganda esa u o'chib ketadi.
5. **Kalitlar brauzerga ketadi.** Variantlar to'g'ri javoblari bilan va butun savol
   banki `/api/init` orqali (`server.js:4039-4041`) imtihon bo'limini ko'radigan har
   bir foydalanuvchiga yuboriladi. Ustoz kalitni o'quvchilariga imtihondan oldin
   berib qo'yishi mumkin. Bank kattalashgan sari init ham sekinlashadi.
6. **Variant o'rindiqqa emas, ro'yxatdagi tartibga qarab beriladi.** `prepareBatched`
   da `globalIdx % variants.length`. Yonma-yon o'tirganlarga bir xil variant
   tushib qolishi mumkin.
7. **Varaqdagi shtrix-kod soxta.** Chiziqlari `Math.random` bilan chiziladi
   (`pdf-generator.ts:200`), hech narsani kodlamaydi va o'qigichni chalg'itadi. ID va
   variant doirachalarini esa hech qaysi kod o'qimaydi.
8. **PDF formulalarni va kirillni chiqarmaydi.** `stripHtml` (`pdf-generator.ts:115`)
   formatlashni, daraja va indekslarni o'chirib yuboradi. `helvetica` shriftida
   kirill va `ʻ` kabi belgilar yo'q. Matematika testi uchun bu yaroqsiz.
9. **Kitobcha QR ida o'quvchi yo'q** (`{e, v}`). Uni skanerlasangiz "O'quvchi
   topilmadi" chiqadi.
10. **Imtihon bitta filialga bog'langan** (`Exam.schoolId`). Ikki filial uchun bitta
    imtihon va umumiy reyting qilib bo'lmaydi.

---

## 2. Gemini TZ — bo'limma-bo'lim tanqid

Belgilar: ✗ muammo · → nima qilish kerak.

### 2.1 Maqsad (TZ 1-bo'lim)

- ✗ "Mustaqil mikroxizmat". O'quvchi, kurs, xona, filial, ruxsat, Telegram va SMS —
  hammasi CRM da. Alohida xizmat bularni nusxalab oladi yoki API orqali tortadi.
  Natijada ikkita deploy, ikkita login va ikkita baza paydo bo'ladi, sinxronlashda
  xatolar chiqadi. Bitta dasturchiga ish ikki barobar ko'payadi.
- ✗ "Addmen OMR mantiqi". Addmen skanerga ulangan kompyuterda ishlaydigan dastur. Uni
  g'oya sifatida olsa bo'ladi, lekin web va telefon uchun ish oqimini undan
  ko'chirib bo'lmaydi.
- ✗ Maqsad texnologiyalar ro'yxati bilan berilgan. Muvaffaqiyatni nima bilan
  o'lchash yozilmagan.
- → O'lchanadigan maqsadlar:
  1. 400+ o'quvchilik sinov imtihoni bir kunda o'tadi, natija **3 soat ichida**
     ota-onaga yetadi.
  2. Operatorning qo'l mehnati 100 varaqqa **≤ 10 daqiqa**.
  3. **Noto'g'ri ball e'lon qilinmaydi.**
  4. Ustoz imtihondan keyingi kuni o'z kursidagi zaif mavzularni ko'radi.

### 2.2 Texnologik stek (TZ 2-bo'lim)

- ✗ Python/FastAPI + Celery + Redis. Vercel da doimiy ishlaydigan worker yo'q, alohida
  VPS ijaraga olish, kuzatish va yangilab turish kerak bo'ladi. 500 o'quvchilik
  markazga bu ortiqcha og'ir.
- ✗ Skanlarni serverga yuklab, OpenCV ni serverda ishlatish. Vercel funksiyasiga
  keladigan so'rov hajmi ~4.5 MB, ishlash vaqti ham cheklangan. 400 varaqlik PDF
  bunga sig'maydi.
- ✗ Mathpix / Google Vision pullik va har oy to'lov talab qiladi. Raqamli javoblar
  doirachalar bilan olinsa, ular umuman kerak emas (2.4.5).
- ✗ GPT-4o-mini va Claude 3.5 Sonnet eskirgan modellar. Model nomi TZ ga yozilmaydi,
  u sozlamada turadi. Loyihada `@google/genai` paketi allaqachon o'rnatilgan
  (hozircha ishlatilmayapti).
- ✗ WeasyPrint Python kutubxonasi. HTML ni brauzerning o'zida chop etsak
  (`window.print`), xuddi shu natija chiqadi, shrift, formula va rasmlar ham
  muammosiz chiqadi.
- → Hammasi mavjud stekda qoladi: Express (`server.js` → alohida
  `routes/imtihon.js`, xuddi `routes/payme.js` kabi), React, Prisma, Supabase
  Storage. Og'ir ish brauzerda bajariladi: varaqni o'qish (Web Worker), skan PDF ni
  sahifalarga bo'lish (pdf.js), kitobchani chop etish (HTML + KaTeX). Serverda faqat
  kalit, ball hisoblash, ruxsatlar, e'lon va xabarlar qoladi.

### 2.3 Baza (TZ 3-bo'lim)

- ✗ `subjects / topics / subtopics`. CRM da `Syllabus → Topic` allaqachon bor
  (bo'lim nomi `Topic.moduleName` da) va u hamma filialga umumiy. Uchinchi
  ierarxiya qo'shilsa, ikki manba paydo bo'ladi va ular vaqt o'tib bir-biridan
  ajralib ketadi.
- ✗ `content_uz / ru / en` ni uchta ustunda saqlash. Til savolning ustuni emas,
  alohida savol: DTM da rus guruhi ham alohida test yozadi. Undan tashqari, markazda
  rus yoki ingliz tilida o'qitiladigan kurs bormi — bu hali ochiq savol (10-bo'lim).
- ✗ `open_rush` nomi noaniq, Rasch modeli bilan adashtirilgan bo'lsa kerak.
  `passage` esa savol turi emas: bitta matnga 3–5 ta savol bog'lanadi. Buning uchun
  alohida Matn jadvali va variant yasalganda shu savollarni birga ushlab turish
  qoidasi kerak. TZ da ikkalasi ham yo'q.
- ✗ `difficulty 1–5` ustozning taxmini xolos. Haqiqiy qiyinlik natijadan hisoblanadi:
  necha foiz to'g'ri topgani, kuchli va kuchsiz o'quvchilar orasidagi farq. Shu
  statistika tufayli bank vaqt o'tib o'zini o'zi kalibrlaydi. TZ bunga umuman
  to'xtalmagan.
- ✗ `solution` "AI tuzgan" deb yozilgan, lekin yechim tasdiqlanganmi yoki yo'qmi,
  belgisi yo'q.
- ✗ Savolning holati (qoralama / faol / arxiv), qachon ishlatilgani, o'quvchiga
  ko'rsatilgan-ko'rsatilmagani saqlanmaydi. Bularsiz o'tgan oy ko'rsatilgan savol
  bu oy yana tushib qolishi mumkin.
- ✗ Javoblari aralashtirilmasligi kerak bo'lgan savollar ("A va B to'g'ri",
  "Hammasi to'g'ri") uchun belgi yo'q.
- ✗ `blueprints` alohida jadval sifatida. `Exam.blocks` aynan shu vazifani bajaradi.
  Shablonni qayta ishlatish uchun "imtihondan nusxa olish" tugmasi yetadi.
- ✗ `exam_variants` har o'quvchiga alohida bo'lsa, 400 × 90 savollik JSON bitta
  qatorga tushadi. Hozirgi kodda u `/api/init` orqali hammaga ham ketadi.
- ✗ `exam_results` da skan rasmi (apellyatsiya uchun), har javobning ishonchliligi,
  kim tekshirgani saqlanmaydi, kalit o'zgarganda qayta hisoblash ham yo'q.
- ✗ Filial, smena va tashqi qatnashchi (markazda o'qimaydigan abituriyent)
  ko'zda tutilmagan.
- → Yangi model 5-bo'limda.

### 2.4 Modullar (TZ 4-bo'lim)

#### 2.4.1 Savollar banki va AI

- ✗ "Fan → Sinf → Bo'lim → Mavzu → Qiyinlik → Manba" daraxt emas. Daraxt faqat
  Fan → Bo'lim → Mavzu. Sinf, qiyinlik va manba — filtr belgilari.
- ✗ "Word dan rasmlari bilan import". Eng qiyin joyi rasm emas, formulalar: Word
  dagi tenglamalar (OMML / MathType) oddiy konvertorlarda yo'qolib ketadi. TZ buni
  oddiy vazifa deb yozgan.
- ✗ AI "5 ta klon + javob + yechim" ni to'g'ridan-to'g'ri bazaga yozadi. AI
  matematikada noto'g'ri javob va ma'nosiz distraktor chiqarishi mumkin, tekshiruvsiz
  bank ifloslanadi.
- ✗ AI bilan 3 tilga tarjima kerakligi isbotlanmagan.
- → 1-bosqichda: KaTeX formulali muharrir, mavjud Excel importi va qat'iy Word
  shabloni. 3-bosqichda: Word/PDF sahifasini rasm qilib AI ga beramiz, u savollarni
  LaTeX li JSON ga aylantiradi, keyin ko'rib chiqish ekrani, keyin bank. AI klon
  faqat qoralama bo'ladi: raqamli savolda javob kod bilan qayta hisoblanadi, mos
  kelmasa belgilanadi, ustoz tasdiqlamaguncha imtihonga tushmaydi.

#### 2.4.2 Blueprint va ko'chirishga qarshi himoya

- ✗ "Har o'quvchiga klonlar hovuzidan tasodifiy savol" g'oyasining ikki muammosi bor:
  - **Bank hajmi.** Shablondagi har o'ringa kamida 5 ta tekshirilgan klon kerak:
    90 savollik imtihon uchun 450+ savol, har oy yangisi bilan. Asosiy to'siq kod
    emas, bank hajmi.
  - **Adolat.** Klonlarning qiyinligi bir xil emas: kimgadir oson klon tushadi va
    reyting adolatsiz chiqadi. Ota-onalar esa aynan reytingga qaraydi.
- ✗ TZ faqat javoblarni aralashtirishni aytadi. Savollar tartibini aralashtirish
  haqida gap yo'q.
- ✗ `Math.random` ishlatilgan, shuning uchun variantni keyinroq aynan qayta tiklab
  yoki tekshirib bo'lmaydi.
- → **1-daraja (sukut bo'yicha):** bitta smenadagi hamma bir xil savollarni oladi.
  Har variantda blok ichidagi savollar tartibi va javoblar aralashtiriladi: matnli
  savollar birga qoladi, "qulflangan" javoblar joyidan qo'zg'almaydi. Aralashtirish
  seed (imtihon + variant raqami) bilan qilinadi, shuning uchun variantni istalgan
  payt aynan qayta tiklash mumkin.
- → **2-daraja:** klon almashtirish faqat 2-smena va qayta topshirish uchun, faqat
  tasdiqlangan parallel klonlar bilan.

#### 2.4.3 O'rinlashtirish

- ✗ "Bir kurs o'quvchilari yonma-yon o'tirmaydi" qoidasini bajarib bo'lmaydi: 11 ta
  kursdan bittasida 100 kishi bor. Aslida muhimi kurs emas, qo'shnining varianti.
- ✗ Xona modelida faqat nom va sig'im bor, qator va ustun yo'q. Algoritm nimaga
  qarab o'tqazishi noma'lum.
- ✗ Smena, kelmaganlar, kechikib kelgan yoki boshqa joyga o'tirgan o'quvchi hisobga
  olinmagan.
- → Xonaga qator × ustun maydonlari qo'shiladi (ustun = o'rin, partadagi ikkala
  o'rin alohida sanaladi).
- → Variant o'rindiqdan hisoblanadi: **variant = (2 × qator + ustun) mod N**.
  - N ≥ 4 bo'lsa, 8 ta qo'shnidan (yon, old, orqa, diagonal) hech biriga bir xil
    variant tushmaydi.
  - N ≥ 5 bo'lsa, ikki qator oldinda o'tirganga ham tushmaydi.
- → O'quvchilar o'rinlarga kurslarni aralashtirgan holda joylashtiriladi (kurs
  qoidasi imkon bo'lgan joyda qo'llanadi).
- → Chiqadigan hujjatlar: eshikka ilinadigan ro'yxat va imzo ustuni bor nazoratchi
  vedomosti.
- → Zaxirada nomsiz "universal" varaqlar turadi, ularda o'quvchi ID si
  doirachalardan o'qiladi.

#### 2.4.4 Shaxsiylashtirilgan chop etish (VDP)

- ✗ Har o'quvchiga shaxsiy kitobcha: 400 xil kitobcha × ~8 bet ≈ 3200 bet, hammasi
  faqat kompyuterdan chop etiladi. Keyin har birini to'g'ri o'quvchiga, to'g'ri
  partaga tarqatish kerak. Bitta almashinuv — varaq noto'g'ri kalit bilan
  tekshiriladi.
- ✗ Rangli javob varaqasi. 400 ta rangli varaq qimmatga tushadi, o'qigichga esa rang
  kerak emas.
- ✗ QR `{exam_id}_{student_id}_{variant_code}` g'oyasi to'g'ri, lekin unda varaq
  raqami va sahifa yo'q, qo'lda terish uchun qisqa kod ham yo'q.
- → Kitobcha variant bo'yicha chiqariladi (N ta asl nusxa, qolgani ksero qilinadi),
  muqovasida katta harf bilan variant yoziladi.
- → Shaxsiy faqat javob varaqasi: ism, rasm, xona va o'rin, QR (varaq kodi), zaxira
  uchun variant doirachalari. Oq-qora rangda.
- → Chop etish tartibi: filial → smena → xona → qator → o'rin. Dasta xonaga shu
  tartibda kiradi va darhol tarqatiladi.
- → Formula va kirill to'g'ri chiqishi uchun kitobcha HTML + KaTeX dan brauzerda
  chop etiladi.

#### 2.4.5 OMR o'qigich va Vision AI

- ✗ Faqat 4 ta burchak markeri telefon rasmidagi qog'oz egilishini to'g'rilamaydi.
  Varaq chetlari bo'ylab vaqt belgilari (timing track) ham kerak.
- ✗ "Piksel zichligi"ni bitta chegara bilan o'lchash yetmaydi. Yorug'lik har
  rasmda har xil, varaqda o'chirg'ich izi, ✓ yoki × belgisi uchraydi. Chegara har
  qatorning o'z doirachalariga nisbatan olinishi kerak (eng qorasi bilan ikkinchi
  qorasini solishtirish).
- ✗ Qo'lyozma OCR. Raqamli javob doirachali kataklarga o'tkazilsa, OCR umuman
  kerak emas.
- ✗ Qayta skanerlash operator tasdiqlagan natijani ustidan yozib yuboradi (hozirgi
  upsert ham shunday qiladi).
- ✗ Skan rasmi saqlanmaydi, apellyatsiyada ko'rsatadigan narsa qolmaydi.
- ✗ Qaysi qurilmada skanerlanishi yozilmagan. 400 varaqni telefonda birma-bir
  skanerlash ≈ 30–40 daqiqa, qayta urinishlar bilan undan ham ko'p.
- → **Asosiy yo'l:** ADF skaner (varaqni o'zi tortadi), 200–300 dpi, oq-qora. PDF
  yoki rasmlar brauzerga yuklanadi, brauzer o'qiydi, serverga faqat natija (JSON)
  va kichraytirilgan rasm (Storage ga) boradi.
- → **Zaxira yo'l:** telefon kamerasi, bitta-bitta qayta skanerlash uchun.
- → Har javob to'rt holatdan biriga tushadi: aniq, bo'sh, ikkita belgilangan,
  shubhali. Shubhalilar operator ekraniga chiqadi: qatorning kesilgan rasmi yonida
  turadi, bir bosishda tasdiqlanadi. Operator tasdiqlagan javob qayta skan bilan
  o'zgarmaydi.
- → Raqamli ochiq javob SAT uslubidagi grid-in bilan olinadi: ishora, raqamlar,
  vergul, kasr chizig'i.
- → Yozma (ifodali) javoblar 3-bosqichga qoladi: kesilgan rasm ustozga ko'rsatiladi,
  AI bahoni oldindan taklif qiladi.

#### 2.4.6 Natijalar, Telegram, SMS

- ✗ E'lon qilishdan oldin tekshiruv bosqichi yo'q. Yuborilgan SMS ni qaytarib
  bo'lmaydi: kalitdagi bitta xato 400 ota-onaga noto'g'ri ball bo'lib boradi.
- ✗ Kalitni tuzatish, savolni bekor qilish va qayta hisoblash imkoniyati yo'q.
- ✗ "Xatolar ustida ishlash" Telegram xabari sifatida yuboriladi. Telegram LaTeX
  ni ko'rsatmaydi, formulali savol buzilib chiqadi. Qolaversa, savolni o'quvchiga
  ko'rsatish bankni "kuydiradi": keyingi oy o'sha savol tushsa, javobi hammada
  bo'ladi.
- ✗ Jonli reyting ekranda hamma ismi bilan ko'rsatiladi. Ro'yxat pastidagi
  o'quvchilarning ota-onalari norozi bo'ladi.
- ✗ Alohida `/notifications/telegram-push` va `/sms-push` yo'llari taklif qilingan,
  holbuki CRM da xabar moduli, shablonlar va `{testnatijasi}` o'zgaruvchisi
  allaqachon bor.
- ✗ Ustoz uchun tahlil yo'q. Markazga eng foydali qismi aynan shu: qaysi savolni
  hamma xato qildi (balki kalit xatodir?), qaysi mavzu qaysi kursda zaif.
- ✗ Telegram ulanmagan yarmi haqida TZ da gap yo'q, ularga natija faqat SMS bilan
  boradi.
- → "E'lon qilish" tugmasi. Avval xulosa ko'rsatiladi: skanerlanmagan N ta,
  tekshirilmagan N ta, 0 ball olganlar, kalitdagi shubhali savollar. Keyin natija bir
  marta yuboriladi, qayta yuborilmaydi.
- → Yuborish mavjud xabar moduli orqali: avval Telegram (ota-onaga, bo'lmasa
  o'quvchiga — davomatdagi qoida bilan bir xil), qolganlarga SMS.
- → "Xatolar ustida ishlash" Telegram Mini App (veb sahifa) bo'ladi: formulalar,
  rasmlar va faqat tasdiqlangan yechimlar ko'rinadi.
- → Reyting: o'quvchining kurs ichidagi o'rni va umumiy top-10.

### 2.5 API (TZ 5-bo'lim)

- ✗ `/api/v1/...` prefiksi. CRM da hamma yo'l `/api/...` bilan boshlanadi, alohida
  versiya kerak emas.
- ✗ `GET generate-vdp-pdf`. Og'ir va ma'lumotni o'zgartiradigan amal GET bilan
  qilinmaydi.
- ✗ Yetishmaydigan yo'llar: kalitni tuzatish, qayta hisoblash, e'lon qilish,
  apellyatsiya, skan rasmini olish, imtihon davomati.
- ✗ Ruxsatlar umuman yo'q: kim kalitni ko'radi, kim natijani o'zgartiradi. CRM
  qoidasi: har yangi o'zgartiruvchi yo'l `lib/ruxsatApi.js` da qatorga ega bo'ladi
  va `AuditLog` ga yoziladi.
- ✗ TZ "guruh" so'zini ishlatadi. CRM da bu **kurs** (`Group` jadvali), "fan" esa
  `Course`.

---

## 3. Tamoyillar

1. **Bitta tizim.** Hammasi CRM ichida, alohida xizmat yo'q.
2. **To'g'rilik tezlikdan muhim.** E'lon qilishdan oldin bitta tekshiruv darvozasi
   bor.
3. **Mashina o'qiy oladigan dizayn.** Grid-in OCR dan arzonroq va ishonchliroq.
4. **Kalit serverda turadi.** Brauzerga u faqat ruxsati bor foydalanuvchiga va faqat
   imtihondan keyin beriladi.
5. **AI faqat qoralama yozadi,** odam tasdiqlaydi.
6. **Og'ir hisob brauzerda, server yengil** (Vercel sharoiti).
7. **Hamma narsa qayta tiklanadi.** Variantlar seed bilan yasaladi, skan rasmlari
   saqlanadi, har o'zgarish AuditLog da qoladi.
8. **Varaq tuzilishi bitta faylda** (`src/lib/omrLayout.ts`). Varaqni chizadigan kod
   ham, o'qiydigan kod ham koordinatalarni shu yerdan oladi.

---

## 4. Arxitektura

| Ish | Qayerda | Qanday |
|---|---|---|
| Savol yozish | Brauzer | Muharrir + KaTeX, rasmlar Storage ga |
| Variant yasash | Server | Seed bilan aralashtirish, kalit bazada qoladi |
| Kitobcha chop etish | Brauzer | Serverdan kalitsiz variant olinadi → HTML + KaTeX → `window.print` |
| Javob varaqasi | Brauzer | jsPDF + `omrLayout.ts` |
| Skanlarni o'qish | Brauzer (Web Worker) | pdf.js → sahifalar → markerlar → perspektivani to'g'rilash → doirachalar |
| Skan natijasini saqlash | Server | Javoblar JSON + ishonchlilik, varaq rasmi Storage da |
| Ball hisoblash | Server | Faqat server hisoblaydi, brauzer yuborgan balli qabul qilinmaydi |
| E'lon va xabar | Server | Mavjud xabar moduli: Telegram → SMS |
| Xatolar ustida ishlash | Telegram Mini App | Muddatli imzolangan havola (`ApplyToken` ga o'xshash) |

---

## 5. Ma'lumotlar modeli

Faqat qo'shiladi, hech narsa buzilmaydi. Vercel postinstall oddiy `db push`
qiladi, shuning uchun mavjud jadvalga yangi `@unique` o'rniga `@@index` qo'yiladi.
Yangi jadvallarda `@unique` ishlatish mumkin.

| Model | O'zgarish |
|---|---|
| `Question` | `topicId → Topic`; `type` (yopiq / raqamli / yozma); `options Json` (4–6 ta, `optionA–D` o'rniga — bazada 0 savol, ko'chiriladigan narsa yo'q); `answer Json` (yopiq: `"C"`, raqamli: `{qabul: ["0.5","1/2"]}`); `lockOptions`; `passageId`; `solution` + `solutionStatus` (yo'q / qoralama / tasdiqlangan) + `solutionById`; `status` (qoralama / faol / arxiv); `source`; `grade`; `language`; `parentId` (klon); statistika: `usedCount`, `lastUsedAt`, `shownAt`, `pCorrect`, `discrimination`. Bank butun tashkilotga umumiy (`orgSchoolIds`) |
| `Passage` (yangi) | Matn, rasm, fan. Unga bir nechta savol bog'lanadi |
| `Exam` | `scoring` (dtm / foiz, keyinroq rasch); holatlar: Qoralama → Tayyor (savollar qulflangan) → O'tkazildi → Tekshirilmoqda → E'lon qilindi; `branches Int[]`; `smenalar Json`; `variantCount`; `publishedAt` / `publishedById`. `variants` JSON ustuni olib tashlanadi |
| `ExamVariant` (yangi) | `examId`, `smena`, `code`, `seed`, `items Json` `[{questionId, blok, tartib, optionMap, togri}]`. `/api/init` ga kirmaydi |
| `ExamSeat` (yangi) | `examId`, `schoolId`, `smena`, `roomId`, `qator`, `ustun`, `variantId`, `studentId?`, mehmon ma'lumoti (ism, telefon, `leadId?`), `sheetCode` (qisqa, unikal), holati (rejada / keldi / kelmadi) |
| `Room` | `rows`, `cols`, `blocked Json` (ishlatib bo'lmaydigan o'rinlar) |
| `ExamResult` | `seatId`; `answers` (xom javoblar); `confidence Json`; `scanUrl`; `source` (skaner / telefon / qo'lda); `reviewStatus` + `reviewedById`; `locked`. Blok ballari variantdagi `blok` maydonidan to'g'ri hisoblanadi |
| `ExamAssignment` | O'zgarmaydi (kurslar) |
| Blueprint | Alohida jadval yo'q, "imtihondan nusxa olish" bilan qayta ishlatiladi |
| Kalit tarixi | Alohida jadval yo'q, `AuditLog` yetadi |

---

## 6. Imtihon kuni jarayoni

| Qachon | Kim | Nima qiladi | Tizimdagi holat |
|---|---|---|---|
| T−7 | Metodist | Imtihon yaratadi (o'tgan oydan nusxa), kurslar, filiallar va smenalarni tanlaydi | Qoralama |
| T−7…T−3 | Ustozlar | Bankni to'ldiradi, savollarni tasdiqlaydi | Har blok uchun "bank yetarlimi" — yashil yoki qizil |
| T−3 | Metodist | Savollarni qulflaydi, variantlar yasaladi | Tayyor, kalit qulflangan |
| T−2 | Admin | O'rinlashtiradi, chop etadi | `ExamSeat`, PDF lar |
| T−1 | Tizim | Botda ruxsatnoma yuboradi (xona, o'rin, vaqt) | 2-bosqich |
| T0 | Nazoratchi | Kirishda ro'yxat bo'yicha belgilaydi, kelmaganlarni qayd qiladi | `ExamSeat` holati |
| T0 + 0–2 soat | Operator | ADF skaner → yuklash → shubhalilarni tasdiqlash | Tekshirilmoqda |
| T0 + 2–3 soat | Metodist | Savol tahlilini ko'radi → kalit xatosi bo'lsa tuzatadi → e'lon qiladi | E'lon qilindi → Telegram / SMS |
| T+1…T+3 | Ustozlar | Kurs bo'yicha mavzu tahlilini ko'radi, dars rejasiga kiritadi | 2-bosqich |

---

## 7. Bosqichlar

### 1-bosqich — birinchi haqiqiy imtihon (MVP)

Maqsad: bir oylik DTM uslubidagi sinov imtihoni (ikkala filial, ~400 kishi,
smenalar bilan) boshidan oxirigacha CRM ichida o'tadi.

- ✅ **1.1 Mavjud xatolar:** 1.3 dagi 1–10 bandlar tuzatiladi.
- ✅ **1.2 Savollar banki:**
  - KaTeX formulalar (muharrir va ko'rinish), 4–6 variantli javob;
  - `lockOptions`, matnli savollar (Passage), `Topic` ga bog'lash, holat;
  - bank filiallarga umumiy;
  - Excel importi formulalarni LaTeX matn sifatida oladi;
  - bank `/api/init` dan chiqariladi va sahifaning o'zida yuklanadi.
- ✅ **1.3 Imtihon:**
  - nusxa olish, filiallar, smenalar;
  - qatnashchilar kurslar va `attendsExam` bo'yicha tanlanadi;
  - "bank yetarlimi" tekshiruvi — bank yetmasa, variant yaratilmaydi;
  - savollarni qulflash.
- ✅ **1.4 Variantlar:** serverda, seed bilan yasaladi, blok ichida savol va javoblar
  aralashtiriladi. Kalitni faqat yangi `imtihonlar.kalit` ruxsati borlar ko'radi va
  faqat imtihon o'tgandan keyin.
- ✅ **1.5 O'rinlashtirish:** xona sxemasi (qator × ustun), avtomatik joylashtirish,
  variant = (2·qator + ustun) mod N. Eshik ro'yxati va nazoratchi vedomosti.
- ✅ **1.6 Chop etish:**
  - kitobcha variant bo'yicha (HTML + KaTeX);
  - yangi javob varaqasi (`omrLayout.ts`, vaqt belgilari bilan, soxta shtrix-kodsiz);
  - chop etish tartibi va universal varaqlar.
- ✅ **1.7 Skaner:**
  - ADF dan PDF yoki rasm yuklash, telefon kamerasi zaxirada;
  - o'qish brauzerda, har javobga ishonchlilik belgisi;
  - tekshirish ekrani;
  - skan rasmlari Storage da saqlanadi, qayta skan tasdiqlangan javobni o'zgartirmaydi.
- ✅ **1.8 Hisob va e'lon:**
  - serverda DTM blok yoki foiz bo'yicha hisob;
  - savolni bekor qilish yoki kalitni tuzatish → hamma natija qayta hisoblanadi;
  - e'lon darvozasi, Telegram → SMS;
  - natija kartasi: ball, foiz, blok ballari, kurs ichidagi o'rni.
- ✅ **1.9 Ruxsatlar:** `imtihonlar.kalit` va `imtihonlar.elon` bo'limlari,
  `ruxsatApi.js` qatorlari, AuditLog SPECS.

**Tayyor degani:**
- 30 ta qo'lda to'ldirilgan sinov varag'i (bo'sh, ikkita belgili, o'chirilgan,
  qiyshiq suratga olingan) bilan tekshiriladi: avtomatik o'qish qo'lda sanalgan
  natija bilan 100% mos keladi, shubhalilar operatorga chiqadi.
- 400 varaqni skanerlash va tekshirish ≤ 1 soat davom etadi.
- Kalit o'zgartirilsa, hamma natija qayta hisoblanadi va AuditLog ga yoziladi.
- Ustoz roli imtihon tugaguncha kalitni ko'ra olmaydi, bu API darajasida
  tekshirilgan.

### 2-bosqich — tahlil va o'quvchiga qaytish

- ✅ **2.1 Savol tahlili:** to'g'ri javob foizi, har bir javob variantini tanlaganlar
  ulushi, "shubhali kalit" belgisi (kuchli o'quvchilar ko'proq xato qilgan savol).
  Tahlil e'lon qilishdan oldin ko'rinadi.
- ✅ **2.2** Kurs × mavzu issiqlik xaritasi ustozga.
- ⬜ **2.3** O'quvchi dinamikasi: profilda imtihonlar grafigi, ota-onaga oylik
  hisobot.
- ✅ **2.4** "Xatolar ustida ishlash" — ota-onaga xabardagi imzolangan havola `/natija/:token`
  (Telegram ichida ham ochiladi): ball, fanlar, o'rin; sozlamada yoqilsa savollar, javob,
  to'g'ri javob va faqat tasdiqlangan yechim. Ko'rsatilgan savollar `shownAt` bilan belgilanadi.
  Telegram Web App tugmasi (Mini App) — keyingi qadam.
- ⬜ **2.5** Imtihondan bir kun oldin botda ruxsatnoma.
- ✅ **2.6** Raqamli ochiq savollar (grid-in).
- 🟡 **2.7** Reyting (top-N, kurs ichidagi o'rin) — natijalar jadvalida va xabarda; alohida katta ekran rejimi yo'q.

**Tayyor degani:** ustoz imtihondan keyingi kuni o'z kursidagi eng zaif 3 ta
mavzuni bitta ekranda ko'radi.

### 3-bosqich — AI va kengaytmalar

1–2-bosqichlar kamida 2 ta haqiqiy imtihonda ishlagandan keyin boshlanadi.

- ⬜ **3.1 AI import:** Word/PDF → savollar (LaTeX) → ko'rib chiqish → bank.
- ⬜ **3.2** AI yechim qoralamasi, ustoz tasdiqlaydi.
- ⬜ **3.3 AI klon:** faqat qoralama. Raqamli savolda javob hisoblab tekshiriladi.
  Asosan 2-smena va qayta topshirish uchun ishlatiladi.
- ⬜ **3.4 Yozma javoblar:** kesilgan rasm → AI baho taklif qiladi → ustoz ball
  qo'yadi.
- ⬜ **3.5** Rasch ballari (Milliy sertifikat uslubidagi mock uchun, yetarli natija
  to'plangandan keyin).
- 🟡 **3.6** Tashqi abituriyentlar: qatnashadi va natija oladi; lidga avtomatik aylantirish yo'q.
- ⬜ **3.7** Tarjima — faqat rus tilidagi kurslar bo'lsa.

---

## 8. Qilinmaydigan narsalar

| TZ dagi narsa | Nega qilinmaydi |
|---|---|
| Python/FastAPI mikroxizmat, Celery, Redis | Ikkinchi tizim bo'lib qoladi; Vercel da worker yo'q; bu ishni brauzer bajaradi |
| Mathpix / Google Vision | Grid-in bilan kerak emas. Yozma javoblarni AI va ustoz ko'radi (3-bosqich) |
| WeasyPrint | Brauzerning chop etishi yetadi |
| Rangli javob varaqasi | Qimmat, o'qishga foydasi yo'q |
| `content_uz / ru / en` ustunlari | Til — alohida savol |
| Alohida `blueprints` jadvali | Imtihondan nusxa olish yetadi |
| Har o'quvchiga alohida kitobcha (sukut bo'yicha) | Chop etish va tarqatishda xato ko'payadi. O'rindiq bo'yicha variant xuddi shu himoyani beradi |
| `/api/v1`, alohida xabar yo'llari | Mavjud API va xabar moduli bor |

---

## 9. Xatarlar

- **Savol bankining hajmi — eng katta xatar.** Kod tayyor bo'ladi, bank esa
  to'lmay qolishi mumkin. Chora: birinchi imtihonga bitta to'plam (90 savol)
  yetadi, chunki aralashtirish bilan variantlar chiqadi. Keyin bank har oy o'sib
  boradi. Ustozlarga oylik savol normasi qo'yish — egasining qarori.
- **Kalit sizib chiqishi.** Kalit serverda turadi, ustoz uni imtihondan keyin
  ko'radi. Chop etilgan kitobchalar soni hisobga olinadi.
- **Tarqatishda aralashib ketish.** Javob varaqasi shaxsiy, kitobcha variantli.
  O'quvchi kitobcha variantini varaqqa ham bo'yaydi, mos kelmasa varaq shubhali
  deb belgilanadi.
- **Telefon skaner sifati.** Asosiy yo'l ADF, telefon faqat zaxira.
- **Noto'g'ri e'lon.** E'lon darvozasi va savol tahlili. SMS qayta yuborilmaydi.
- **SMS narxi va Eskiz shablonlari.** Eskiz SMS matnini oldindan moderatsiya
  qilishi mumkin (tekshirish kerak), shuning uchun natija shabloni oldindan
  tasdiqlatib qo'yiladi.

---

## 10. Egasiga savollar (tavsiyam bilan)

> **Javob (2026-09-24):** "universal bo'lishi kerak". Har bir savol imtihonning
> o'z sozlamasiga aylandi (`lib/imtihon.js` `sozlamaniTozala`, imtihon
> quruvchisidagi bo'limlar):
>
> | Savol | Qayerda tanlanadi |
> |---|---|
> | 1. Format | Ball tizimi: blok bali (DTM, har fan savoliga o'z bali) yoki foiz; "DTM andozasi" tugmasi (5 blok, 189 ball). Rasch — 3-bosqich |
> | 2. Smenalar | Istalgancha smena (nomi, vaqti); savollar hammaga bir xil yoki har smenaga boshqa; smenalarga bo'lish: teng / ketma-ket / kurs bittada |
> | 3. Filiallar | Imtihonga qatnashadigan filiallar; reyting umumiy, filial va kurs ichida |
> | 4. Skaner | ADF skanerdan PDF/rasm ham, telefon kamerasi ham, qo'lda kiritish ham |
> | 5. Savollar manbai | Qo'lda (formula bilan), Excel import (shablon bor), matnli savollar; AI import — 3-bosqich |
> | 6. Til | Savolning tili; imtihonda "hamma til" yoki bittasi |
> | 7. Reyting | Hammaga o'rni / faqat top-N / o'rin ko'rsatilmaydi |
> | 8. Savollarni ko'rsatish | Imtihon sozlamasi ("natijadan keyin o'quvchi ko'radi") — Mini App 2-bosqichda |
> | 9. Tashqi qatnashchilar | Ism + telefon bilan qo'shiladi, o'ringa tushadi, natija SMS bilan |
> | 10. AI | 3-bosqich; provayder o'shanda sozlamaga chiqadi |
>
> Xabar kanali ham sozlama: Telegram (bo'lmasa SMS) / faqat Telegram / faqat SMS /
> yubormaslik; kimga: ota-ona / o'quvchi / ikkalasi; matn shabloni o'zgaruvchilar bilan.

Dastlabki savollar (tarix uchun):


1. **Imtihon formati qaysi:** DTM blok (masalan 3.1 / 2.1 / 1.1 ball), Milliy
   sertifikat yoki oddiy foiz? Oyiga nechta imtihon? — *Tavsiya: DTM blok, oyiga 1.*
2. **Bitta imtihonda nechta o'quvchi va nechta smena?** Xonalarga bir smenada ~200
   kishi sig'adi. — *Tavsiya: 2 smena, 2-smenaga boshqa savol to'plami.*
3. **Ikkala filial bir kunda bitta imtihon yozadimi, umumiy reyting kerakmi?**
4. **Markazda varaqni o'zi tortadigan (ADF) skaner yoki shunday printer bormi?**
   Yo'q bo'lsa — sotib olinadimi yoki telefon bilan ishlaymizmi?
5. **Savollar hozir qayerda saqlanadi** (Word, kitob, qog'oz)? Word da formulalar
   qanday yozilgan? Bankni kim to'ldiradi va oyiga nechta savol qo'shadi?
6. **Rus yoki ingliz tilida o'qitiladigan kurs bormi?** Yo'q bo'lsa, tarjima kerak
   emas.
7. **Reyting ekranda hammaning ismi bilan chiqsinmi, yoki faqat top-10?**
8. **Imtihondan keyin o'quvchiga savollar va yechimlar ko'rsatilsinmi?** Ko'rsatilsa,
   bu savollar keyingi imtihonlarga tushmaydi.
9. **Markazda o'qimaydigan abituriyentlar ham qatnashadimi** (reklama uchun ochiq
   mock)?
10. **AI uchun oylik xarajatga tayyormi va qaysi xizmat ishlatiladi?** 3-bosqichgacha
    bu qaror kutib turishi mumkin.

---

## 11. Kod xaritasi (1-bosqich qurilgani)

| Qism | Fayl |
|---|---|
| Umumiy mantiq (server + brauzer): sozlamalar, varaq tuzilmasi, variant yasash (urug' bilan), ball, o'rinlashtirish, reyting, savol tahlili, xabar matni | `lib/imtihon.js` |
| API: bank, matnlar, imtihon, qulf/variantlar, kalit, o'rinlar, skan, tekshirish, tahlil, e'lon, xabar | `routes/imtihon.js` (`registerImtihonRoutes` server.js da) |
| Baza | `Question` (+turi, variantlar, yechim, statistika), `Passage`, `Exam` (+scoring, branchIds, settings, lockedAt, publishedAt), `ExamVariant`, `ExamSeat`, `ExamResult` (+raw, flags, manual, pages, detail, rank...), `Room` (+rows, cols, blocked) |
| Ruxsatlar | `imtihonlar.imtihon / savollar / natija / kalit / elon / ochirish` — `lib/ruxsatlar.js`, yo'llar `lib/ruxsatApi.js`; ikki filialli imtihon — `middleware/auth.js` `recordAccessError` |
| Varaq geometriyasi (chizuvchi va o'qigich uchun bitta) | `src/lib/omr/layout.ts` |
| Varaqni chizish (SVG, oq-qora) | `src/lib/omr/render.ts` |
| Varaqni o'qish (markerlar, yo'nalish, perspektiva, mahalliy qog'oz darajasi, doiracha to'lganligi, QR) | `src/lib/omr/reader.ts`, `worker.ts`, `skaner.ts` (PDF — pdf.js) |
| Formulalar | `src/lib/matn.ts` (KaTeX, HTML tozalash) |
| Chop etish | `src/lib/chopEtish.ts`, `src/components/imtihon/chop.ts` |
| Ota-ona natija sahifasi | `src/components/NatijaSahifasi.tsx`, `GET /api/public/natija/:token` (HMAC imzo, `natijaTokeni`) |
| Skaner PDF dekoderlari | pdf.js wasm (JBIG2/JPEG2000) — `vite.config.ts` `pdfjsWasm()` → `/pdfjs-wasm/`; CSP da `'wasm-unsafe-eval'` |
| Sahifalar | `ExamsList`, `ExamBuilder`, `ExamDetail` + `src/components/imtihon/*Tab.tsx`, `QuestionsList`, `QuestionEditor` |

Sinovlar (scratch/, bazaga tegmaydi): `test_imtihon_mantiq.mjs` (mantiq), `test_omr_oqish.mjs`
(sun'iy varaqlar: burilgan, teskari, yonboshlab, soyali, past sifat, DTM). Jonli bazada (ZZ
yozuvlari, oxirida o'chiriladi): `test_imtihon_api.mjs`, `test_imtihon_ui.mjs` (skrinshot +
ilova chiqargan varaq → o'qigich), qolib ketgani — `imt_tozalash.mjs` (`APPLY=1`).

Haqiqiy printer va skanerda sinov hali qilinmagan: birinchi imtihondan oldin 30 ta qo'lda
to'ldirilgan varaq bilan (1-bosqich "Tayyor degani") tekshirish kerak.
