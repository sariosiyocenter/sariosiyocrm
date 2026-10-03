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
  Qo'lda ko'chirish: xona xaritasida qatnashchini bosib, bo'sh o'ringa (ko'chadi) yoki
  boshqa qatnashchiga (joy almashadi); boshqa xona/smenaga — ro'yxatdagi tugma. Variant
  yangi o'rindan qayta hisoblanadi, natijasi borlar ko'chmaydi; bitta qatnashchi varag'ini
  qayta chop etish mumkin.
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
- ✅ **2.3** O'quvchi dinamikasi: profilda "Imtihonlar" bo'limi (foiz grafigi, oxirgi /
  o'rtacha / eng yaxshi, jadval, ota-ona sahifasi havolasi). Oylik hisobot — Xabarlar →
  Avtomatik qoidalar → "Oylik imtihon hisoboti" (`{imtihon_oylik}`, oyning tanlangan kuni).
- ✅ **2.4** "Xatolar ustida ishlash" — ota-onaga xabardagi imzolangan havola `/natija/:token`
  (Telegram ichida ham ochiladi): ball, fanlar, o'rin; sozlamada yoqilsa savollar, javob,
  to'g'ri javob va faqat tasdiqlangan yechim. Ko'rsatilgan savollar `shownAt` bilan belgilanadi.
  Telegram xabarida "📊 Natijani ochish" — Mini App (web_app) tugmasi; botda "📝 Imtihonlar"
  menyusi (yaqin imtihon o'rni va e'lon qilingan natijalar, har biri Mini App).
- ✅ **2.5** Ruxsatnoma: imtihondan bir kun oldin soat 12:00 dan o'zi (sozlamada o'chiriladi),
  qo'lda ham (Qatnashchilar). Kanal, kimga va matn — imtihon sozlamasi. O'rni o'zgargan
  qatnashchiga yangisi qayta ketadi. Xabar bilan botning yangi menyusi ham boradi.
- ✅ **2.6** Raqamli ochiq savollar (grid-in).
- ✅ **2.7** Reyting — natijalar jadvalida, xabarda va katta ekranda (`/exams/:id/reyting`:
  shohsupa, sahifama-sahifa aylanadigan ro'yxat, filial bo'yicha, to'liq ekran).

**Tayyor degani:** ustoz imtihondan keyingi kuni o'z kursidagi eng zaif 3 ta
mavzuni bitta ekranda ko'radi.

### 3-bosqich — AI va kengaytmalar

1–2-bosqichlar kamida 2 ta haqiqiy imtihonda ishlagandan keyin boshlanadi.

AI — Gemini (`@google/genai`), kalit **`GEMINI_API_KEY`** Vercel muhitida, model
`GEMINI_MODEL` (bo'lmasa `gemini-2.5-flash`). Kalit yo'q bo'lsa AI tugmalari "sozlanmagan"
deydi, qolgan modul ishlayveradi. Xodim boshiga soatiga 120 ta AI so'rovi.

- ✅ **3.1 AI import:** PDF (sahifalari rasm bo'lib), rasm yoki joylangan matn → savollar
  (LaTeX, umumiy matnlar bilan) → ko'rib chiqish oynasi (javobni tuzatish, tanlash) → bank
  (qoralama; xohlasa kamchiligi yo'qlari faol). Word — PDF qilib.
- ✅ **3.2** AI yechim qoralamasi — muharrirga tushadi, bazaga ustoz saqlaganda; AI o'z javobi
  kalitdan farq qilsa ogohlantiradi.
- ✅ **3.3 AI klon:** 3 ta qoralama (parentId); keyin AI ularni kalitsiz, alohida so'rovda
  yechadi — mos kelmagani manbasida "tekshiruvdan o'tmadi".
- ✅ **3.4 Yozma javoblar:** tekshirishda "AI taklifi" — varaqdagi katak kesiladi, AI o'qib
  ball va izoh taklif qiladi; ballni operator "Qo'llash" bilan qo'yadi.
- ✅ **3.5** Rasch (imtihon sozlamasi): JML baholash, T-ball (o'rtacha 50) va darajalar (A+ 70 …
  C 46, sozlanadi); yoqilsa reyting shu ball bo'yicha. Natijalar, katta ekran, ota-ona
  sahifasi, xabar (`{rasch}`, `{daraja}`), bot va profilda ko'rinadi.
- ✅ **3.6** Tashqi abituriyentlar: qatnashadi, natija oladi; "lidlarga qo'shish" (manba
  "Imtihon", izohda natija; telefoni bor lidga izoh qo'shiladi).
- ✅ **3.7** Tarjima — qoralama nusxa boshqa tilda (variantlar tartibi va kalit o'sha).

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
| Sahifalar | `ExamsList` (bitta ish joyi, 13-bo'lim), `ExamBuilder`, `ExamDetail` (eski havolalar → ish joyi) + `src/components/imtihon/*Tab.tsx`, `QuestionsList`, `QuestionEditor` |
| Katta ekran reytingi | `src/components/imtihon/ReytingEkrani.tsx`, `GET /api/exams/:id/leaderboard` |
| O'quvchi profilidagi grafik | `src/components/imtihon/OquvchiImtihonlari.tsx` (StudentDetails → "Imtihonlar") |
| Ruxsatnoma | `ruxsatnomalarniYubor`, `ruxsatnomaNavbati` (routes/imtihon.js; server.js avtomatik ishlarida), `POST /api/exams/:id/admit-cards` |
| Bot | `src/bot/bot.js` — "📝 Imtihonlar" / `/imtihon`; natija xabarida Mini App tugmasi (`natijaTugmasi`, `sendToOne` `telegramExtra`) |
| Rasch | `lib/rasch.js` (JML, T-ball, daraja), e'londa `raschNatijalari` |
| AI | `lib/imtihonAI.js` (Gemini), `routes/imtihonAI.js`, `src/components/imtihon/AiImportOynasi.tsx`, `useAiHolat.ts` |
| Lidlar | `POST /api/exams/:id/guests/leads` |
| Oylik hisobot | `oylikImtihonHisoboti` + Xabarlar qoidasi `EXAM_MONTHLY`, `{imtihon_oylik}` (lib/xabarMatni.js) |

Sinovlar (scratch/, bazaga tegmaydi): `test_imtihon_mantiq.mjs` (mantiq), `test_omr_oqish.mjs`
(sun'iy varaqlar: burilgan, teskari, yonboshlab, soyali, past sifat, DTM), `test_rasch.mjs`.
Jonli bazada (ZZ yozuvlari, oxirida o'chiriladi): `test_imtihon_api.mjs`, `test_imtihon_ui.mjs`
(skrinshot + ilova chiqargan varaq → o'qigich), `test_imtihon_yangi.mjs` (o'rin ko'chirish,
katta ekran, profil), `test_imtihon_bot.mjs` (ruxsatnoma, Rasch, lidlar, bot),
`test_imtihon_ai.mjs` (AI — soxta model bilan), qolib ketgani — `imt_tozalash.mjs` (`APPLY=1`).

Haqiqiy printer va skanerda sinov hali qilinmagan: birinchi imtihondan oldin 30 ta qo'lda
to'ldirilgan varaq bilan (1-bosqich "Tayyor degani") tekshirish kerak.

---

## 12. Modul tuzilmasi va "faqat kalit" rejimi (2026-09-25)

Egasi: "6 ta modul yuborgandim — 6 ta tab bo'lsin", "savollar banki, tarix qani?".

**Imtihonlar sahifasi — 6 bo'lim (TZ modullari bo'yicha):**

| # | Bo'lim | Nima qiladi |
|---|---|---|
| 1 | Savollar banki | qo'lda, Excel, AI import; matnlar |
| 2 | Imtihonlar | ro'yxat, yangi imtihon (tuzilma, manba, sozlamalar) |
| 3 | O'rinlashtirish | tanlangan imtihon: kurslar, xonalar, o'rinlar, ruxsatnoma |
| 4 | Chop etish | kitobcha (bank rejimida), javob varaqlari, ro'yxatlar |
| 5 | Skaner | skanerlash (PDF / rasm / kamera) va tekshirish (shubhalilar, yozma) |
| 6 | Natijalar va tarix | tanlangan imtihon natijalari; tarix — hamma imtihon, o'rtacha grafik, o'quvchi bo'yicha qidiruv |

3–6-bo'limlarda tepada imtihon tanlanadi (URL da `imtihon=`). Alohida imtihon sahifasi
13-bo'limda olib tashlandi — hammasi shu bitta ish joyida.

**"Faqat kalit" rejimi** (`settings.source = 'kalit'`): markaz o'z kitobchasi bilan
(sotib olingan to'plam yoki ustoz tuzgan test) imtihon o'tkazadi — savollar bankka
kiritilmaydi. Imtihon tuzishda fanlar, savol soni, turi va bali; "kitobcha variantlari"
(A, B …) va doirachalar soni (2–6). Tuzilma bo'limida har variantning kaliti: harf
tugmalari yoki matn bilan ("ABCD…" yoki "1A 2B …"), raqamli javob ("0,5;1/2"), bir
nechta to'g'ri javob ("AC"), "✱" — bekor (hammaga ball), "✕" — hisobdan chiqarish.
Qulflash kalitdan variant yasaydi; kalitni keyin tuzatsa — hamma natija qayta
hisoblanadi (`PUT /api/exams/:id/manual-key`, `imtihonlar.kalit` ruxsati). Varaqda har
fanda avval yopiq, keyin raqamli, keyin yozma savollar — kitobcha raqamlari shunga mos
bo'lishi kerak. Tahlil "A kitobcha · 5-savol" bo'yicha, ota-ona sahifasida savol matnisiz
javoblar.

**Bank tashxisi:** "bankda 0" bo'lsa sababi ko'rsatiladi — fan nomi mos emas, boshqa
qiyinlikda N ta, qoralamada N ta, chala N ta, boshqa tilda N ta.

Kod: `lib/imtihon.js` (`kalitTuzilmasi`, `kalitQiymati`, `kalitdanVariantlar`,
`kalitMatnidan`, `bankYetarliligi` sababi), `routes/imtihon.js` (lock, manual-key,
check, analysis, `GET /api/exams/history`), `src/components/ExamsList.tsx` (6 bo'lim),
`imtihon/KalitMuharriri.tsx`, `imtihon/TarixBolimi.tsx`, `imtihon/FoizGrafigi.tsx`,
`imtihon/useImtihonTafsil.ts`. Sinov: `scratch/kalit_sinov.mjs`, `scratch/test_imtihon_kalit.mjs`.

---

## 13. Bitta ish joyi (2026-09-25, kechqurun)

Egasi: "TZ xom edi — konsepsiyani tushungan bo'lsang, qolganini o'zing to'liq qil". Qaror
(TZ dagi raqamdan emas, ishdan kelib chiqib):

**Muammo.** 6 tabli modul sahifasi bilan birga imtihonning alohida sahifasi ham bor edi
(1 Tuzilma … 6 Natijalar). Bitta ekran ikki joyda, ikki xil raqamlash bilan ko'rinardi:
"3 O'rinlashtirish" bir joyda, "2 Qatnashchilar va o'rinlar" boshqa joyda. Imtihonga
kirilganda tepadagi 6 bo'lim yo'qolardi.

**Yechim — bitta ish joyi.** `/exams` da bitta tab qatori. Tablar — imtihon bosqichlari,
har biri alohida ish (ko'pincha boshqa odam, boshqa vaqt):

| Tab | Kim, qachon | Ichida |
|---|---|---|
| 1 Savollar banki | ustozlar, doim | hamma imtihon uchun umumiy |
| 2 Imtihonlar | metodist, imtihondan oldin | ro'yxat (har imtihonda bosqichlar chizig'i) · tanlangan imtihonning tuzilmasi, bank/kalit, qulf, "Keyingi qadam" |
| 3 O'rinlashtirish | qabulxona, ro'yxatdan o'tish kunlari | kurslar, xonalar, o'rinlar, keldi/kelmadi, ruxsatnoma |
| 4 Chop etish | printer yonidagi xodim, arafasida | kitobcha, javob varaqlari, ro'yxatlar |
| 5 Skaner | operator, imtihondan keyin | skanerlash (PDF / kamera / qo'lda) + **Skaner holati** · tekshirish |
| 6 Natijalar va tarix | metodist, direktor | reyting, savollar/mavzular tahlili, e'lon, xabar · tarix |

- 2–6-tablarda tepada **imtihon paneli**: nomi (bosilsa — boshqa imtihon), holati, sana,
  savol/ball, "Barcha imtihonlar", Sozlamalar, Nusxa, O'chirish. Imtihon tablar orasida
  URL da saqlanadi (`?tab=…&imtihon=…`); 3–6-tabga tanlanmay kirilsa, bosqichga mos
  imtihon o'zi tanlanadi.
- **Tablarda tanlangan imtihonning holati** (`GET /api/exams/:id` → `holat`): ✓ — bosqich
  bajarilgan; O'rinlashtirish yonida o'rinlar soni; Skaner yonida "skanerlangan/kutilgan"
  va shubhali bo'lsa sariq nuqta; Natijalar ✓ — e'lon qilingan.
- **Skaner holati** (Skaner tabining o'ng ustuni): xona (va smena) bo'yicha kutilgan,
  skanerlangan, kelmagan, qolgan. Qolganlar ro'yxatidan bir bosishda "Kelmadi" yoki
  "Qo'lda" (qo'lda kiritish shu qatnashchi bilan ochiladi) — e'londan oldin hech kim
  tushib qolmaydi.
- **"Faqat kalit" rejimida savol mavzulari** (`settings.keyTopics`, kalit bilan bir xil
  shakl; `PUT /api/exams/:id/manual-key` `{ topics }`): Kalit muharriri → "Mavzular",
  matn bilan ("1-5 Kasrlar"), "Boshqa kitobchalarga ham". Variant elementida `mv`;
  Natijalar → Mavzular va kurs × mavzu jadvali shu bo'yicha. Yozilmasa — fan bo'yicha.
- Eski havolalar (`/exams/:id`, `?b=natijalar` — jurnal, profil, katta ekran)
  `ExamDetail.tsx` orqali ish joyiga o'tadi.

Kod: `src/components/ExamsList.tsx` (ish joyi, `ImtihonPaneli`, `ImtihonlarRoyxati`),
`imtihon/turlar.ts` (`ImtihonTafsil`, `BosqichHolati`, `TabId`), `imtihon/QulfKerak.tsx`,
`SkanerTab.tsx` (`SkanerHolati`), `TuzilmaTab.tsx` (`KeyingiQadam`), `KalitMuharriri.tsx`
(mavzular), `routes/imtihon.js` (`bosqichHolati`). Sinov: `scratch/test_imtihon_ishjoy.mjs`.

---

## 14. Savollar banki: fan → mavzu → qiyinlik (2026-09-27)

Egasi: "juda primitiv — tanlash uchun kategoriyada bo'lish kerak: fanlar → fan ichida
mavzu → mavzuda savollar qiyinlik bo'yicha. Bu imtihonni alohida mahsulot qilib sotsa
bo'ladi". Qaror — bank tuzilmali kutubxona, imtihon shu tuzilmadan yig'iladi.

**Tuzilma (baza).** `QuestionSubject` (fan) → `QuestionTopic` (mavzu, `section` — bo'lim,
`order`); savolda `bankTopicId`. Savoldagi `subject`/`topic` matnlari — nomlarning nusxasi
(eski imtihon qoidalari nom bilan ishlaydi); nom o'zgarsa savollarda, matnlarda va
qulflanmagan imtihonlarda ham yangilanadi. Excel, AI va eski savollar nomi bo'yicha
o'zi bog'lanadi (`bankniSinxronla`, topilmasa fan/mavzu yaratiladi).

**Qiyinlik — 3 daraja:** oson / o'rta / qiyin (rang: yashil / sariq / qizil, hamma
joyda bir xil). Eski 1–5 → 4–5 qiyin; Excel da so'z ham bo'ladi ("oson", "o'rta"...).
Natijaga ko'ra qiyinlik: ≥70% topilgan — oson, 40–70% — o'rta, <40% — qiyin; bankda
"natijaga mos emas" faqat aniq farqda (±10% chegara atrofi hisobga olinmaydi),
"Natijaga moslash" bir bosishda to'g'rilaydi (`POST /api/bank/kalibrla`).

**Bank (1-tab), uch qavat, URL da `fan=`, `mavzu=`:**
1. Fanlar — kartalar: savollar, mavzular, qiyinlik chizig'i, qoralama/chala, o'rtacha
   natija; butun bankdan qidirish; "Fan qo'shish".
2. Fan — mavzular jadvali (bo'limlar bo'yicha): oson / o'rta / qiyin / jami / natija;
   "O'quv rejadan" — o'quv rejadagi mavzular bo'limi bilan bir bosishda; tartib.
3. Mavzu — savollar uch ustunda (telefonda — uch tab), formulalar bilan; kompyuterda
   kartani boshqa ustunga sudrab qiyinlik o'zgaradi; "Belgilash" — ko'p savolga birdan
   qiyinlik, mavzu, holat. Savol oynasi: to'liq ko'rinish, qiyinlik, mavzu, holat.
Savol muharriri: fan va mavzu — tanlov (shu yerda yangisini qo'shsa bo'ladi), qiyinlik —
uch tugma; mavzu sahifasidan ochilsa fan, mavzu va qiyinlik tayyor turadi.

**Imtihon tuzish (bank rejimi):** har fan bloki — fan → savollar soni → qiyinlik
(oson ko'proq 50/35/15 · muvozanatli 30/40/30 · qiyin ko'proq 15/35/50) → mavzular
(chiplar). Taqsimot o'zi hisoblanadi (`taqsimla`: navbatma-navbat eng kam olgan
mavzuga, bankdan oshmaydi, yetmasa qo'shni qiyinlikdan) va jadvalda ko'rinadi:
mavzu × oson / o'rta / qiyin / aralash, har katakda "bankda N" (yetmasa qizil).
Katakni o'zgartirsa — "qo'lda". Raqamli va yozma savollar alohida son bilan. "Aniq
savollarni tanlash" — bank oynasi (mavzu → qiyinlik, belgilab), tanlanganlar har
variantga tushadi. Blokda `fanId`, `taqsimot`; qoidada `mavzuId`, `questionIds`.

**Variant yasash:** qoidalar ustuvorlik bilan (tanlangan → mavzu+qiyinlik → mavzu →
qiyinlik → istalgan) tanlaydi, variantga o'z tartibida tushadi; bank yetarliligi ham
xuddi shunday "band" qiladi (umumiy qator aniqrog'i olgan savolni sanamaydi, sababi
ko'rsatiladi). Matnli savollar birlik — qiyinligi o'rtachasi; butun matn sig'masa
matnning bir qismi olinadi (savollar baribir birga).

Kod: `routes/savolBanki.js` (daraxt, fan/mavzu, o'quv reja, ommaviy o'zgartirish,
kalibrlash), `lib/imtihon.js` (qiyinlik, `taqsimla`, `tengYoy`, `mavzuMavjudligi`,
qoidalar ustuvorligi), `src/components/QuestionsList.tsx` + `imtihon/bank/*`,
`imtihon/tuzish/BlokMuharriri.tsx`, `QuestionEditor.tsx`. Ruxsat: daraxt —
"savollar" yoki "imtihon" ko'rish; imtihon tuzuvchi bankdan savol tanlaydi, lekin
to'g'ri javobni faqat "savollar" ruxsati bilan ko'radi. Sinov: `scratch/test_bank_mantiq.mjs`,
`test_bank_api.mjs`, `test_bank_ui.mjs`.


## 15. Rasmdan o'xshash savollar va AI kaliti CRM da (2026-09-27)

Egasi: "savol beriladi — misol rasmi, AI uni oladi, o'sha bilan bir xil, sonlar va
javob boshqa bo'lgan masala tuzib beradi. Savollar bankini yig'ib ketamiz."

**Oqim (bitta oyna — `imtihon/bank/OxshashSavollar.tsx`):** rasm (telefonda — kamera,
kompyuterda — tashlash yoki Ctrl+V; PDF bo'lsa 1-sahifa) yoki matn → fan, mavzu,
nechta (3 / 5 / 10), nima o'zgarsin ("Faqat sonlar" — matn va usul o'sha, sonlar va
javob boshqa; "Vaziyat ham"), javob shakli (asl masaladek / variantli / son), til →
**Tuzish**. AI rasmni o'qiydi (rasmda bir nechta masala bo'lsa — qaysi biri so'raladi),
o'xshashlarini tuzadi, keyin hammasini (asl masalani ham) kalitni ko'rmay qayta yechib
tekshiradi. Kartada belgi: ✓ javob to'g'ri / ⚠ AI boshqa javob chiqardi / ⚠ javobi asl
masaladagidek. Belgilanganlari bankka: tekshiruvdan o'tgan yoki ustoz tuzatgani — faol,
qolgani qoralama; asl masala ham (xohlasa), o'xshashlari unga `parentId` bilan
bog'lanadi; manba "Rasmdan (AI)" / "AI o'xshash", yechim — qoralama. Kirish: mavzu
sahifasi ("Rasmdan o'xshash"), bank → Import, savol oynasi va savol muharriri
("O'xshash" — rasm bosqichisiz).

**Har bosqich — alohida qisqa so'rov** (Vercel vaqt chegarasi): `POST
/api/questions/ai/import` (o'qish), `POST /api/ai/oxshash` (tuzish, saqlamaydi),
`POST /api/ai/tekshir` (12 tagacha savolni mustaqil yechish). Takror va aslidagi bilan
bir xil matnlar tashlanadi.

**AI kaliti:** administrator Sozlamalar → Integratsiyalar → "AI yordamchi" kartasida
kiritadi (bepul: aistudio.google.com/apikey → Create API key). `PUT /api/ai/kalit`
kalitni saqlashdan oldin kichik so'rov bilan sinaydi; `Organization.aiKaliti` — faqat
serverda (lib/prisma.js da global `omit`, jurnalda qiymati yozilmaydi), brauzerga oxirgi
4 belgisi. Har AI so'rovi markaz kaliti bilan (`aiBilan` — AsyncLocalStorage), yo'q bo'lsa
serverdagi `GEMINI_API_KEY`. Model nomi eskirsa — zaxira nomlar (`gemini-flash-latest`,
`gemini-2.5-flash`, `gemini-2.0-flash`).

Sinov: `scratch/test_ai_oxshash.mjs` (mantiq, yo'llar, global omit, haqiqiy Google soxta
kalit bilan), `test_oxshash_ui.mjs` va `test_ai_kalit_ui.mjs` (brauzer; soxta AI server —
`scratch/ai_soxta_server.mjs`).

## 16. Savol qo'shish — faqat fayl yoki kameradan (2026-09-29)

Egasi: "qo'lda savol kiritish — eng eski usul; fayldan yoki kameradan bo'lsin, fanlar bo'yicha,
qisqa va aniq; o'zing avtomatlashtir".

**Bitta tugma — "Savol qo'shish"** (bank sarlavhasida; mavzu sahifasida bo'sh holatda ham), oyna
`imtihon/bank/SavolYuklash.tsx`:
- Manba: **kamera** (telefonda ketma-ket sahifalar), **fayl** (PDF — hamma sahifasi, rasm, Excel),
  **matnni joylash** (Word/Telegramdan). 40 sahifagacha; kompyuterda tashlash va Ctrl+V.
- Fan (majburiy), mavzu — "AI o'zi mavzularga ajratsin" (standart) yoki aniq mavzu.
- AI (3 sahifadan qism-qism, `POST /api/questions/ai/import`): har savolni fanning bor
  mavzulariga (mos kelmasa — yangi qisqa nom) va qiyinlikka ajratadi, materialdagi raqamini va
  javoblar kalitini (`kalit`) qaytaradi, tilni o'zi aniqlaydi. Mijoz barcha qismlardan keyin
  kalitni **raqam bo'yicha** ulaydi (kitob oxiridagi "Javoblar" sahifasi), takror savollarni
  tashlaydi. Server shu fanda matni aynan bir xil savolni `takrorId` bilan belgilaydi.
- Mustaqil tekshiruv (`/api/ai/tekshir`, 12 tadan, ikki oqim): ✓ javob to'g'ri / ⚠ AI boshqa
  javob chiqardi / javob topilmadi. Ko'rib chiqish — mavzular bo'yicha guruh, filtr "Tekshirish
  kerak", "Bankda bor"; har kartada qiyinlik va mavzu, tuzatish.
- Saqlash: tekshiruvdan o'tgan, ustoz tuzatgan yoki yozma — **faol**, qolgani — **qoralama**;
  Excel qatori — faylidagi holat. "Bankda bor" — tanlanmagan.

Qo'lda kiritish olib tashlandi: "Yangi savol", ustunlardagi "+", Import menyusi; `/questions/new`
bankdagi shu oynani ochadi. Savol muharriri faqat mavjud savolni tuzatish uchun. "O'xshash masala"
(15-bo'lim) — bank sarlavhasida. Sinov: `scratch/test_ajrat_mantiq.mjs`,
`test_savol_yuklash_ui.mjs` (soxta AI server — `scratch/ai_soxta_server.mjs`).

## 17. Addmen'ga o'xshatish: savollar banki va Andoza (2026-10-01)

Markaz Addmen OMRv25 (Standard) dasturini sotib olgan va unga o'rgangan: bankida 18 311 ta
matematika savoli bor. Egasi: "ko'p joyi o'xshasin, dizayni chiroyliroq bo'lsin". Qarorlar:
- 6 ta tab qoladi, har birining ichi Addmen ekrani tartibida bo'ladi;
- nomlar o'zbekcha;
- birinchi navbatda savollar banki va Andoza;
- javob varaqasi markazning hozirgi bosma varag'iga o'xshaydi (bu hali qilinmagan).

**Savollar banki** (Addmen QUESTION BANK) — tepada [Savollar banki | Andoza (Blueprint)]:
- **Filtr ustunlari:** bo'limlar, mavzular (tanlangan bo'limlarnikigina), manba, qiyinlik va
  foydalanuvchi filtrlari. Ustun ichida "yoki", ustunlar orasida "va". Har qiymatda nechta savol
  borligi ko'rinadi.
- **Foydalanuvchi filtrlari** — `QuestionTagGroup` → `QuestionTag`, savolda `tagIds Int[]`
  (masalan "Milliy sertifikat savollari": 1-savol … 10-savol). Ular "Filtr qo'shish" va ustundagi ⚙
  bilan boshqariladi.
- **Ro'yxat:** QID, savol (formulalar bilan), to'plam, sana; sahifalab; QID tartibi; matn bo'yicha
  qidiruv; to'plam, holat va tur bo'yicha filtr.
- **Amallar paneli:**
  - QID dan/gacha, Hammasi / Filtr bo'yicha;
  - hisoblagichlar: Jami, Yashirin (arxiv), Ro'yxatda, Tanlangan;
  - Hammasini tanlash, Savolni ko'rish;
  - **Belgilash…** (Addmen SAVE): mavzu, qiyinlik, manba, holat va filtr qiymatlari. Ustunda
    bittadan tanlangan qiymat oldindan qo'yiladi;
  - **Belgini olib tashlash** (REMOVE FILTER);
  - **Ishlatilishini nolga** (RESET USE);
  - **O'chirish:** ishlatilgan savol arxivga o'tadi.
- Fan → mavzu tuzilmasi (14-bo'lim) "Tuzilma" tugmasi orqali (`?kor=tuzilma`).

**To'plam** (`Question.toplam`) — savol qaysi fayldan kelgani (Addmen "QR file name"). Word
jadvali va Excel importida fayl nomi yoziladi.

**Andoza** (Addmen BLUE PRINT, `QuestionBlueprint`):
- fan va qatorlar; har qatorda bo'lim, mavzu, qiyinlik, manba, har filtrdan bitta qiymat, tur va
  soni; har qatorda "bankda N" ko'rinadi (`POST /api/bank/andozalar/hisob`, bazaga yozmaydi);
- imtihon tuzishda fan blokida **"Andozadan"** tanlanadi: qatorlar qoidaga nusxa bo'lib tushadi
  (`section`, `source`, `tagIds`, `label`) va blokda `andoza: {id, nomi}` saqlanadi;
- variant yasash va "bank yetarlimi" bu filtrlarni hisobga oladi (`lib/imtihon.js` `filtrMos`).

**Word QR jadvali — AI siz** (`word.ts` `wordJadvalSavollari`):
- Addmen Question Resource fayli: har qator — bitta savol, ustunlar
  № | savol | A–E | javob.
- Jadval aniq qoida bilan o'qiladi:
  - javob A–F, kirill А–Е yoki 1–6 bo'lishi mumkin;
  - bo'sh 5-variant tashlanadi;
  - OMML formulalar LaTeX ga aylanadi;
  - rasmlar Storage ga yuklanadi va matn ichida qoladi.
- Javobsiz yoki MathType li savol qoralama bo'ladi, qolgani faol.
- Shu nomli to'plam bankda bo'lsa, savollar belgilanmaydi (takror bo'lmasin).
- Saqlash 1000 tadan bo'lib yuboriladi.
- **Ochiq:** haqiqiy Addmen QR fayli hali ko'rilmagan. Formulalar MathType bo'lsa o'qilmaydi —
  egasidan namuna fayl kerak.

Yo'llar:
- `GET /api/bank/belgilar`, `/api/bank/belgi-guruhlari(/:id)`, `/api/bank/belgilar(/:id)`;
- `GET /api/bank/filtr?fanId=`, `GET /api/bank/royxat?f=<json>` (`&idlar=1` — faqat id lar);
- `PUT /api/questions/bulk` (+ `source`, `tagQosh`, `tagOl`, `guruhlar`, `ishlatilishNol`);
- `POST /api/questions/bulk-ochir`;
- `/api/bank/andozalar(/:id)`.

O'chirish qoidasi: `lastUsedAt` bor savol ham o'chirilmaydi ("ishlatilishini nolga" `usedCount`
ni tozalaydi, lekin variantlar baribir unga bog'liq).

Audit: bir nechta qoida mos kelsa, eng aniqi tanlanadi (`matchSpec`). Avval
`PUT /api/questions/bulk` ni `/:id` yutib, ommaviy o'zgartirishlar jurnalga tushmas edi.

Sinovlar:
- `scratch/test_andoza_mantiq.mjs` (bazasiz);
- `test_addmen_bank_api.mjs` (jonli baza, ZZ yozuvlari, 50/50);
- `addmen_bank_ui.mjs` (brauzer, yozishlar ushlanadi, 21/21);
- sinov hujjati — `qr_docx_yasa.py`.

## 18. Addmen bilan qolgan farqlar yopildi (2026-10-01)

Egasining "hammasi" so'ziga ko'ra 17-bo'limdan keyin ketma-ket qilindi:

| # | Nima | Qayerda |
|---|---|---|
| 1 | **Javob varaqasi** markaz varag'i kabi: logo, "JAVOBLAR VARAQASI", ESLATMA (bo'yash namunasi, imzo), ABITURIYENT MA'LUMOTI (ism, filial, maktab/sinf, kurs, xona, 5 xonali ID, QR, rasm, katta VARIANT va O'RIN), fan bandi, pastda manzil/telefon va test sanasi. Javoblar ustunda kamida 15 qator | `src/lib/omr/render.ts`, `layout.ts` (QR_1, RASM, ID_Y0, VARIANT_Y, Y0_BIRINCHI) |
| 2 | **Hisobotlar** (Natijalar → Hisobotlar, Addmen raqamlari): 1111/1112/1113 ball ro'yxatlari (fanlar, T/X/B), 1211 o'quvchi javoblari, 1221 shaxsiy hisobot (persentil, mavzular, dinamika), 1231 kelmaganlar, 1241 savollar tahlili (KR-20), 1311 birlashtirilgan; Excel 2111–2411 | `imtihon/hisobotlar.ts`, `HisobotlarBolimi.tsx`, `GET /api/exams/:id/hisobot` |
| 3 | **Ball qoidalari**: xato javobga jarima (¼, ⅓, ½, to'liq; ikki belgili ham), fan bali 0 dan past emas; blokda "Hisoblanadi: n" (m tadan n, ortig'i `ortiqcha`); raqamli kalitda oraliq "2..3" | `lib/imtihon.js` (`xatoJarima`, `jarimaNoldan`, `tanlab`, `raqamOraligi`) |
| 4 | **Kalit varaqdan** ("faqat kalit"): bo'sh varaq chop etish (qulfsiz), to'ldirilgan varaqni o'qish — variant doirachasi bo'yicha kitobcha, ikki doira = "AC" | `imtihon/KalitMuharriri.tsx` |
| 5 | **Qo'shimcha ball** (og'zaki, yozma ish) Excel'dan — `settings.qoshimcha`, `ExamResult.extra`, ball/foiz/maxScore ga qo'shiladi; **ikki imtihonni birlashtirish** (hisobot) | `QoshimchaBall.tsx`, `POST/DELETE /api/exams/:id/qoshimcha-ball` |
| 6 | **A5 va "A4 da 2 ta"** varaq (o'qigich markerlar bo'yicha o'lchaydi — A5 200 dpi sinovi o'tdi) | `render.ts` `varaqlarniJoyla`, Chop etish |
| 7 | **Onlayn test** (CBT): `settings.onlayn`, `/test/:token` (Mini App), taymer, avtosaqlash (jsonb `||`, keepalive, navbat), o'zi yakunlanadi; "faqat kalit" — onlayn javob varaqasi; O'rinlashtirish → Onlayn test kartasi; ruxsatnomada `{test_havola}` va "Testni ochish" tugmasi | `OnlaynTest.tsx`, `imtihon/OnlaynTestKarta.tsx`, `routes/imtihon.js` (`testTokeni`, `/api/public/test/*`, `/api/exams/:id/onlayn*`), `ExamResult.onlayn` |

Sinovlar (scratch/):
- bazasiz: `test_varaq_render_oqish.mjs` (haqiqiy SVG → 200 dpi → o'qigich, 37/37; `--import ./scratch/ts_kengaytma.mjs`), `test_ball_qoida.mjs`;
- jonli baza (ZZ yoki DEMO 47 nusxa olinib tiklanadi): `test_qoshimcha_api.mjs` 10/10, `test_onlayn_api.mjs` 20/20;
- brauzer (bazaga yozmaydi yoki ZZ o'chiriladi): `hisobot_ui.mjs`, `kalit_varaq_ui.mjs`, `birlash_ui.mjs`, `a5_ui.mjs`, `onlayn_ui.mjs`.

Ochiq: haqiqiy Addmen QR Word fayli bilan import sinovi va haqiqiy printer/skanerda 30 varaqlik sinov
(yangi varaq dizayni bilan) hali egasida.

## 19. Ko'rinish: Chop etish ko'rinishli, Andoza → savol qog'ozi (2026-10-01)

Savol: "ko'rinishini yaxshilasa bo'ladimi? blueprint chop etish qismida bo'lmaydimi?"

Addmen'da BLUE PRINT — QPG 1-qadamda (QUESTION BANK yonida, tuzilma), 2-qadam "Generate
Paper" esa undan setlar yasaydi. Bizda ham shunday: andozaning **ta'rifi** bankda qoladi
(Savollar banki → Andoza), undan **savol qog'ozi yasash** Chop etishga ko'chdi.

- **Chop etish** ikki panel: chapda hujjatlar (Savol qog'ozi: Kitobchalar, Javoblar kaliti;
  Imtihon kuni: Javob varaqalari, Universal, Eshik ro'yxati, Vedomost) va tanlangan hujjat
  sozlamalari; o'ngda **jonli ko'rinish** — chop etiladigan HTML'ning o'zi iframe'da
  (`KORINISH_CSS` faqat `@media screen`), panel eniga `zoom` bilan sig'adi; "Chop etish · N"
  tugmasi ko'rinish sarlavhasida. Ko'rinish faqat birinchi betni chizadi (tez).
- **Javoblar kaliti** varag'i (yangi): `kalitVaragiHtml` — har variant bo'limi, fan bo'yicha
  katakchalar; kalit tuzatishlari varaq harfiga `it.m` orqali o'giriladi, bekor — ✱/✕.
  Faqat `imtihonlar.kalit` ko'radiganlarga.
- **Andozadan savol qog'ozi** (`AndozadanQogoz.tsx`): andoza(lar) tanlanadi (tartib, "bankda
  yetadi"), nomi/sana/variantlar/bal/daqiqa → `POST /api/exams` (har andoza — blok,
  `andozadanQoidalar`) → `POST /lock` → Chop etish shu imtihonda ochiladi. Bank yetmasa imtihon
  qoladi va "Imtihonlar"da ochiladi. Kirish: Chop etish ro'yxati pastida, qulflanmagan holatda
  ham, va Andoza muharririda "Savol qog'ozi" tugmasi.
- **Bank** qayta qurildi (foydalanuvchi: "o'ng panel tushunarsiz, tiqilinch, eski dasturdek" →
  "filtr paneli + kartochkalar" tanlandi). Addmen'ning 3 ustuni (filtr qutilari to'ri, jadval,
  o'ng amallar paneli) o'rniga: chapda yig'iladigan **filtr paneli** (fan; mavzular bo'limlari
  bilan — bo'lim belgisi hamma mavzusini tanlaydi, 8 tadan ko'p bo'lsa qidiruv; qiyinlik va tur
  tugmachalari; manba; foydalanuvchi filtrlari ⚙; to'plam; holat; QID oralig'i; "Filtr
  qo'shish"); o'ngda qidiruv, tartib, **To'liq / Ixcham** ko'rinish, faol filtr yorliqlari (✕),
  **savol kartochkalari** — matn formulalar bilan, rasm, A–D variantlar, to'g'ri javob yashil ✓,
  raqamli javob, mavzu, qiyinlik, tur, filtr qiymatlari, necha marta ishlatilgani. Savol
  belgilansa pastda **amallar paneli** chiqadi: Ko'rish (1 ta), O'zgartirish (avval "Belgilash"),
  Filtr qiymatini olish (faqat chapda filtr qiymati belgilansa), Ishlatilishini nolga,
  O'chirish. "Hammasi/Filtr bo'yicha" rejimi olib tashlandi (filtrni tozalash — shu). `GET
  /api/bank/royxat` endi variantlar va javobni ham beradi. `FiltrUstuni.tsx` o'chirildi.
  Sinov: `scratch/bank_ui2.mjs` (8/8, bazaga yozmaydi).

Sinov: `scratch/chop_shots.mjs` (har hujjat, kun/tun, 390px), `scratch/andozadan_e2e.mjs`
(ZZ andoza → imtihon → kalit; keyin imtihon, andoza o'chirildi va 8 savolning `usedCount`/
`lastUsedAt` qaytarildi — qulflash ularni oshiradi).

## 20. Addmen skrinshotlari bilan to'liq solishtirish (2026-10-01)

Foydalanuvchi: "skrinshotlarning hammasini ko'rdingmi? ko'p narsa hali yo'q". 18 ta skrinshot
qayta, ekranma-ekran solishtirildi; yetishmaganlar to'rt bo'limda qilinadi (foydalanuvchi
hammasini tanladi): 1) hisobotlar va sozlamalar, 2) savol qog'ozi (Generate Paper),
3) bank, qatnashchilar, skaner, 4) varaq dizayneri + Matrix va so'rovnoma. Veb CRM'da kerak
emas: SQL ulanish, Backup, Downloads/Support, ECAS import, til sinxronlash.

### 20.1 Hisobotlar va sozlamalar

- Raqamlar Addmen'dagidek aynan: 1111–1116, 1121, 1211, 1221, 1231 (o'sish grafigi — bir necha
  imtihon), 2111–2113, 2116 (har fandan TOP-N), 2121 (mavzular), 2211–2214, 2311, 2321, 2331.
  Bizniki: 1241 savollar tahlili, 1251 kelmaganlar (avval 1231 edi), 1311/2411 birlashtirish.
  1114/2113 — har fanga U (urinilgan) / T / X / B / ball; 1115/1116 — bet ikki ustunli;
  1121 — har fan ichida mavzular (to'g'ri soni), ko'p ustunli hisobot yotiq A4 (`@page yotiq`).
- "Select columns": O'rin, ID, Kurs, Filial, Variant, Ball, Foiz, Persentil, Rasch, Holat
  (bor bo'lganlari); xulosa qatorlari (o'rtacha / eng yuqori / eng past / o'tganlar).
  Sozlamalar brauzerda eslab qolinadi (`imt_hisobot_sozlama`).
- "Multiple PDFs": 1211/1221/1231 — har o'quvchiga alohida PDF, kurs papkalarida, bitta ZIP
  (`src/lib/htmlPdf.ts` html2canvas + jsPDF, `src/lib/zip.ts` — kutubxonasiz "stored" ZIP).
- "Export sheets": skanerlangan varaq rasmlari ZIP da (`/hisobot` → `rasmlar`).
- E'lon qilinmagan imtihonda o'rinlar hisobotda o'zi hisoblanadi (`orinlarniToldir`).
- Sozlama (Addmen PREFERENCES): `settings.orinUsuli` — 'otkazib' 1,2,2,4 / 'ketma' 1,2,2,3
  (e'londan keyin o'zgarsa — o'rinlar qayta, `orinlarniQaytaQoy`); `settings.otish`
  {turi: 'foiz'|'ball', qiymat} — "O'tdi/O'tmadi": hisobotlar, natija xabari `{holat}`
  (standart matnga qo'shildi; eski standart saqlanganlar ham yangisini oladi), natija sahifasi.
  Ikkalasi qulflangan imtihonda ham o'zgaradi (variantlarga ta'sir qilmaydi).

Sinov: `scratch/hisobot2_ui.mjs` (30/30, bazaga yozmaydi — o'tish bali `page.route` bilan),
`scratch/test_orin_otish_api.mjs` (8/8, DEMO 47 nusxasi olinib aynan tiklanadi).

### 20.2 Savol qog'ozi (Addmen QPG "Generate Paper")

- **Tanlangan savollar** (Chop etish → Savol qog'ozi): qulflangan imtihonga tushgan savollar
  1-variant tartibida (fan bo'yicha, javob — faqat kalit huquqi bo'lsa). ↻ — o'sha fan, mavzu,
  tur va (avval) o'sha qiyinlikdan kam ishlatilgan boshqa savol; # — QID bo'yicha aniq savol.
  Natija kelgach mumkin emas. `GET /api/exams/:id/tanlangan`, `POST /api/exams/:id/savol-almashtir`
  (`almashtirishNomzodlari`, `savolniAlmashtir`; variantlar aralashmasi yangidan, eskiga usedCount −1,
  yangiga +1, eski savolning keyFix/cancelled o'chadi). Matnli (passage) savol almashtirilmaydi.
- **Use ≤ N**: `settings.ishlatishChegarasi` — bankdan faqat shuncha martagacha ishlatilganlari
  (qo'lda tanlanganlar — baribir). **Duplicate content**: `settings.takror` 'variant' (standart —
  matn, rasm va variantlar bir xil) / 'savol' / 'yoq'; `savolIzi`, `tanlovHovuzi` — takrordan kam
  ishlatilgani qoladi; bankYetarliligi ham shu hovuz bilan, `sabab.chiqarilgan`. Imtihon
  sozlamalarida va "Andozadan savol qog'ozi" oynasida (u yerda yana: savollar / variantlar aralashsinmi).
- **Kitobcha ko'rinishi** (Addmen "Output"): 1 yoki 2 ustun, fan sarlavhalari, savol izohlari,
  ikki tilli — `KitobchaSozlama`, brauzerda eslab qolinadi (`imt_kitobcha`).
- **Word (.docx)**: `kitobchaWord.ts` + `src/lib/docx.ts` (kutubxonasiz, `zip.ts`) + `src/lib/omml.ts`
  (KaTeX MathML → Word formulasi OMML: kasr, ildiz, daraja/indeks, ∑∫ (nary), \left( \right),
  sistema (eqArr), matritsa, urg'u/chiziq). Har variant — muqova (1 ustun) va savollar (1/2 ustun)
  bo'limi; rasmlar ichida (webp → png). Word'da ochildi: 74 formula, 2 rasm, 4 bo'lim.
- **Savol maydonlari**: `Question.remark` (Addmen REMARK, 300 belgi) va `Question.tarjima`
  {til, text, options} (Bilingual) — savol muharririda; "AI bilan to'ldirish" →
  `POST /api/questions/:id/ai/tarjima-matn` (faqat qaytaradi, bazaga yozmaydi).
- `Maydon` endi `div` rejimiga ega: ichida tugma bo'lsa <label> uning nomini buzardi
  (ExamBuilder va Chop etishdagi Tanlov'li maydonlar tuzatildi).

Sinov: `scratch/test_hovuz.mjs` (12/12, bazasiz), `test_almashtir_api.mjs` (15/15, ZZ imtihon,
usedCount aynan tiklanadi), `qpg_ui.mjs` (13/13, brauzer; docx Word'da `word_ochish.ps1` bilan),
eski mantiq testlari o'tdi (bank 32, imtihon 56, ajrat 10).

### 20.3 Bank, qatnashchilar, skaner

- **Word QR shablon** (Addmen "CREATE QR FILE → BLANK QPG QR"): «Savol qo'shish» oynasida —
  savollar soni, 4/5 variant, ikki tilli (har savol ostida "N (ru)" qatori), fayl nomi
  (`bank/qrShablon.ts`, yotiq A4 jadval). To'ldirilgan fayl AI siz o'qiladi: word.ts
  "N (ru)" qatorini oldingi savolning `tarjima` si qiladi; bo'sh shablon qatorlari va tarjima
  qatorlari "QR jadvalimi" hisobiga kirmaydi.
- **Bank filtrlari**: Izoh (remark), Matnli savollar (passage: bog'langan / matnsiz), Variantlar
  joylashuvi (Addmen DISPLAY CHOICES; `Question.joylashuv` 1/2/4, null — avto) — `bank/filtr`
  (`izohlar`, `matnli`, `joylashuv`) va `royxatSharti`. Kartochkada izoh, "matnli", joylashuv.
  «O'zgartirish» (ommaviy) — izoh va joylashuv ham. Savol muharririda "Kitobchada variantlar";
  kitobcha (HTML, `.tort` — 4 ustun) va Word shu qiymatga bo'ysunadi.
- **Tashqi qatnashchilar Excel'dan** (Addmen "Import candidate names from Excel"):
  O'rinlashtirish → Tashqi qatnashchilar → "Excel'dan ro'yxat" (+ shablon). Ustunlar nomidan:
  F.I.Sh, Telefon, Maktab, Sinf (`mehmonExcel.ts`); 500 tadan. `ExamSeat.guestSchool/guestGrade`
  — javob varaqasida maktab/sinf.
- **Skaner "Sort codes"** (`src/lib/omr/saralash.ts`): UNR, IDX, SKW, BLT, IVT, BID, DID, LID,
  IID, DUP, MUL, THR, XAT — "O'qilgan varaqlar" ustida kod tugmachalari (sanoq, bosilsa — shu kod
  bo'yicha ro'yxat), har qatorda kod, "Kodlar" izohi. O'qigich `idHolat` (bo'sh / bir ustunda
  ko'p / chala), server `/scans` → `takror` (shu sahifa oldin skanerlangan).

Sinov: `scratch/test_saralash.mjs` (16/16), `qr_ikki_til.mjs` (shablon + to'ldirilgan fayl; Word'da
ochildi), `b3_ui.mjs` (15/15: filtrlar, ikki tilli import — saqlash ushlanadi, Excel mehmonlar ZZ
imtihonda, saralash kodlari; tiklash va o'chirish bilan).

### 20.4 So'rovnoma (Addmen "Survey Data & Analysis / Feedback & Survey Reports")

- Imtihon infratuzilmasi ustida: `settings.source = 'sorovnoma'`, `settings.sorovnoma`
  {anonim, shkala (2–6 yorliq; tayyorlari `SOROVNOMA_SHKALALARI`), savollar [{matn, variantlar?}]}.
  Server bloklarni o'zi yasaydi (`sorovnomaBloklari`: bitta "So'rovnoma" bloki, hammasi yopiq,
  ball 0), `optionCount` — eng uzun shkala. Qulflash — `sorovnomaVariantlari` (har smenaga A,
  kalitsiz). `natijaniHisobla` — ball 0, holat 'javob' / 'bosh' / 'ortiqcha'.
- Muharrir: Imtihonlar → "So'rovnoma" (`/exams/new?tur=sorovnoma`, `SorovnomaMuharriri`):
  shkala, savollar (ro'yxatdan joylash), har savolga o'z javoblari, anonim. Qulflangach faqat
  matnlar o'zgaradi (soni va yorliqlar soni bir xil bo'lsa).
- Varaq (`layout.ts sorovnomaSahifalari`): har qatorda savol matni (2 qatorgacha, bezak) va o'ngda
  shkala doirachalari (ichida 1…k — `Doira.belgi`, qiymati A…), tepada shkala izohi; sarlavha
  "SO'ROVNOMA VARAQASI". Anonim: ID siz, har chop etilgan nusxaga QR da noyob kod
  (`IMT1|A|examId|smena|kod|bet`) — betlari bitta javob, qayta skanerlash sanalmaydi (DUP);
  server o'rinni `sheetCode = {examId}A{kod}` bilan topadi/yaratadi ("Anonim N").
- Natijalar (`SorovnomaNatijalari`): savol bo'yicha taqsimot (rangli chiziq, soni va %),
  o'rtacha, qoniqish indeksi (Ha/Yo'q da ijobiy — boshida), kurs/filial/smena kesimi
  (anonim bo'lmasa), Excel (savollar + javoblar) va chop etish.
- Yana: bitta variantli imtihonda varaq varianti doim A (avval o'rinsiz varaqda "Variant
  aniqlanmadi" chiqardi); universal/anonim varaq boshqa imtihonniki bo'lsa — IVT.
- `varaqParam.ts`: chop etish, skaner, tekshirish, kalit varag'i bir xil parametrni oladi.

Sinov: `test_sorovnoma_render.mjs` (10/10, bazasiz: chizish → bo'yash → 200 dpi → o'qish),
`sorovnoma_ui.mjs` (13/13: muharrir → tayyor → chop etish → 7 varaq skaner, 3 respondent → natijalar,
Excel; ZZ o'chiriladi), `test_varaq_render_oqish.mjs` 37/37 (oddiy varaq buzilmagan).

### 20.5 Moslashtirish savoli (Addmen "Matrix")

- Yangi tur `moslash` (`SAVOL_TURLARI`): chap ustun A–D — savol `options` (2–4), o'ng ustun P–T —
  `answers` (2–5; moslashda bo'shi ham o'z o'rnida saqlanadi, harflar siljimasin), kalit
  `correctAnswer` = "PQ|R|PRS|T" (har qatorga bir nechta harf). `savolXatosi` qatorlar sonini va
  o'ng ustunda yo'q harfni tekshiradi; `moslashQatorlari` — tartiblaydi, takrorni olib tashlaydi.
- Variant elementi: `r`, `c`, `mk` (qator kalitlari); qatorlar/ustunlar aralashtirilmaydi.
  Ball: `p × to'g'ri qatorlar / r` (qatordagi to'plam aynan mos bo'lsa), holat togri / qisman /
  xato / bosh; manfiy ball faqat to'liq xatoga. `keyFix[q] = ["PQ|R|S|T"]` — kalit tuzatish.
  "Faqat kalit" rejimida `kalitQiymati('moslash', 'PQ|R|S')` (2–4 qator).
- Varaq: raqamli kataklardan keyin 4 × 5 to'r (sarlavha "N-savol (moslash)", ustunda P–T, qatorda
  A–D), qatorda bir nechtasi; o'qish — "PQ|R||T", noaniq belgi — shubha. Tekshirishda kesim + to'r
  bilan qo'lda tuzatish (`review` moslashni tozalab saqlaydi).
- Interfeys: savol muharriri (turini "Moslashtirish" ga o'tkazish, ikki ustun, kalit to'ri — yangi
  savol baribir fayldan kiradi, 16-bo'lim), Excel (Tur "moslash": A–D chap, "Qo'shimcha javoblar"
  o'ng ustun ; bilan, Javob "PQ|R|S"), bank kartochkasi/filtr, blok taqsimotida "Moslashtirish"
  soni, kitobcha (HTML va Word: ikki ustun + ko'rsatma), onlayn test (to'r), natija sahifasi
  (to'g'ri / xato / belgilanmagan), kalit oynasi.
- Kalit sirligi: kitobcha API `k, j, ka, mk` ni bermaydi (avval `ka` ham ketardi); kalitsiz
  foydalanuvchiga moslashning o'ng ustuni ko'rinadi (bu savol matni).

Sinov: `test_moslash_mantiq.mjs` 14/14, `test_moslash_varaq.mjs` 9/9 (bazasiz), `moslash_ui.mjs`
25/25 (Excel qatori → bank → muharrir → blok → kitobcha/varaq → 2 varaq skaner, qisman ball,
noaniq belgi → tekshirish), `moslash_onlayn.mjs` 10/10 (telefon: onlayn test → e'lon → natija).

### 20.6 Erkin varaq dizayneri (Addmen "OMR Designer")

- Andoza (`VaraqAndoza` modeli: name, sahifalar 1–4, bloklar Json, schoolId; butun tashkilotga umumiy;
  API `/api/varaq-andozalar` — ko'rish IMTIHON_KORISH, yasash/tahrir/o'chirish `imtihonlar.imtihon`;
  jurnalda "Varaq andozasi"). Blok: `{id, tur, sahifa, x, y}` (mm) + savol bloklarida `boshi, soni,
  ustunlar, sarlavha?`, yozma — `w, h`, yozuv — `matn, olcham, qalin, tekis, w`, rasm — `src` (faqat
  png/jpeg/webp/gif data URL, bittasi 400 KB, jami 1,2 MB), `w, h`. Server tozalovi —
  `varaqAndozaTozala` (lib/imtihon.js).
- Imtihonga nusxasi qo'yiladi: `settings.varaqAndoza = {id, nomi, sahifalar, bloklar, yangilangan}`.
  Andoza keyin o'zgarsa — "Yangilash". Qulfdan keyin ham o'zgaradi, lekin birorta varaq
  skanerlangan bo'lsa — 409 (chop etilgan varaq o'qilmay qolmasin).
- Geometriya (`layout.ts`): `blokOlchami` — savol bloklarida o'lcham savollar soni va ustunlardan
  (doirachalar oralig'i standartdagidek, qo'lda cho'zilmaydi); `andozaSahifalari` — bloklardan
  `Sahifa` (yopiq/raqamli/moslash/yozma + bezak yozuvlar + `rasmlar`), shuning uchun chizish
  (`render.ts`), skaner (`reader.ts`, worker) va tekshirish o'zgarmasdan ishlaydi. Sarlavha (markerlar,
  QR, ID, variant, fan bandi) standart; bloklar maydoni x 20–190, y 86 (1-bet) / 40 (keyingi) – 279.
  `tuzilmadanAndoza` — boshlang'ich joylashuv (fan sarlavhali yopiq bloklar, 15 qatordan ustunlar,
  keyin raqamli, moslash, yozma; sig'masa keyingi bet). `andozaXatolari` — maydondan chiqqan,
  ustma-ust bloklar, varaqda yo'q / ikki joyda / boshqa turdagi blokda turgan savollar (xato),
  imtihonda yo'q savollar (ogohlantirish).
- Interfeys: Chop etish → "Varaq dizayni" (`dizayner/VaraqDizayni.tsx`): hozirgi varaq (kichik
  ko'rinish, tekshiruv), Yangi dizayn / Tahrirlash / Standart varaq, saqlangan andozalar (mos /
  mos emas, Qo'llash). Dizayner (`dizayner/VaraqDizayner.tsx`, to'liq ekran): blok palitrasi
  (Variantli, Raqamli, Moslashtirish, Yozma, Yozuv, Rasm), varaq ustida sudrash (0,5 mm qadam,
  maydondan chiqmaydi), strelkalar / Shift / Delete, xususiyatlar paneli, sahifalar (+/−),
  "Tuzilmadan yasash", jonli tekshiruv. Andozada xato bo'lsa javob va universal varaqlar chop
  etilmaydi.

Sinov: `test_andoza_varaq.mjs` 19/19 (bazasiz: tuzilmadan → tekshiruv → yozuv/rasm → xato holatlari
→ chizish → bo'yash → 2 bet o'qish), `dizayner_ui.mjs` 22/22 (brauzer: dizayner → sudrash, yozuv,
logo, ustma-ust va yo'q savol xatolari → saqlash va qo'llash → universal varaq → 2 varaq skaner,
ball → 409; ZZ o'chiriladi), regressiya: `test_varaq_render_oqish` 37/37.

## 21. Bank ustunlari: hammasi shu ekranda (2026-10-03)

Egasi (ovozli TZ): "fan qo'shish tushunarli, lekin fanda bo'limlar, bo'limda mavzular bor — hammasi
savollar ro'yxati turgan birinchi panelda qo'shilsin; kirish-kirish-kirish qiyin; bir necha ustun,
«buni bu yerga» uslubida; filtrlar fanga bo'ysunsin; oson/o'rta/qiyindan boshqa darajalarni ham o'zim
qo'shay; hammasini o'zim qo'shaman". Yon paneldagi filtrlar o'rniga — tepada yonma-yon ustunlar.

- **Ustunlar** (`bank/BankJadvali.tsx`, `bank/BankUstunlari.tsx`): Fan → Bo'lim → Mavzu → Qiyinlik →
  foydalanuvchi filtrlari → "+ O'z filtringiz". Har ustun pastida «+ … qo'shish»: Enter qo'shadi va
  maydon ochiq qoladi (ketma-ket yozish). Qatorda qalam (nom; mavzuda — bo'limi, darajada — guruhi)
  va savat. Qatorni bosish — savollarni saralaydi (ustun ichida "yoki", ustunlar orasida "va").
  Kam ishlatiladigan filtrlar (turi, holati, manba, fayl, izoh, matn, joylashuv, QID) — «Boshqa
  filtrlar» tugmasi ostida. Qisqa yo'riqnoma (3 qadam) — yopsa eslab qoladi, «?» bilan qayta ochiladi.
- **Biriktirish**: savol(lar) belgilansa ustunlar tepada yopishib turadi (kompyuterda) va qator
  yonida tugma chiqadi: → mavzuga o'tkazish / darajani qo'yish, + filtrga biriktirish, − ajratish
  (hammasi shu qiymatda bo'lsa), yonida "2/5". Savol kartochkasini qatorga sudrab tashlasa ham
  bo'ladi; mavzuni bo'limga sudrash — bo'limini o'zgartiradi; kartochkadagi belgi yonidagi × —
  ajratadi. Telefonda pastki paneldagi «Biriktirish» ustunlarga olib chiqadi.
- **Bo'limlar**: `QuestionSubject.bolimlar String[]` — tartib va hali mavzusi yo'q bo'limlar.
  API `POST/PUT/DELETE /api/bank/bolimlar` (+ `/tartib`): nom o'zgarsa mavzular, shu fan andozalari va
  qulflanmagan imtihon qoidalarida ham; o'chirilsa mavzulari "bo'limsiz" qoladi.
- **Fanga tegishli filtrlar**: `QuestionTagGroup.subjectId` (null — hamma fanda). Ustundagi globus —
  "hamma fanlarda / faqat shu fanda". Yangi filtr joriy fanga ochiladi; fan o'chsa o'z filtrlari ham.
  Eski filtrlar (subjectId null) hamma fanda ko'rinaveradi.
- **Qiyinlik darajalari**: uchta asosiy (oson, o'rta, qiyin — imtihon tuzish shular bilan ishlaydi)
  + foydalanuvchi darajalari: `QuestionTagGroup.tur = 'qiyinlik'` guruhidagi belgilar, `QuestionTag.asos`
  (1–3) — qaysi asosiy guruhga kiradi. Daraja qo'yilsa savol qiyinligi = asos va belgi yoziladi
  (`PUT questions/bulk {darajaId}`, savol muharririda ham); asosiy qiyinlik qo'yilsa yoki natijaga
  moslansa — mos kelmaydigan daraja belgisi olinadi (`darajaniQoy`). Andoza qatorida daraja oddiy
  filtr qiymati kabi tanlanadi. API: `POST /api/bank/darajalar`, nom/guruh — `PUT bank/belgilar/:id`.
- **Tezlik**: ustunlardagi amallar ekranda darhol ko'rinadi (mahalliy holat, sonlar ham), serverga
  fonda navbat bilan yoziladi; navbat bo'shagach ro'yxat jimgina qayta olinadi; xato bo'lsa xabar va
  serverdagi holat qaytadi. Tanlov holati sahifadagi savollardan shu yerda sanaladi, tanlov sahifadan
  katta bo'lsa — `POST /api/bank/tanlov-holati`.
- Yuqoridagi «Tuzilma» tugmasi «Statistika» bo'ldi (fanlar bo'yicha sonlar, o'quv rejadan mavzular,
  qiyinlikni natijaga moslash) — fan/bo'lim/mavzu qo'shish uchun endi u yerga kirish shart emas.

Sinov: `test_bank4_api.mjs` 36/36 (bo'limlar, fan filtri, darajalar, tanlov holati, ro'yxat),
`bank4_ui.mjs` 31/31 (brauzer: fan → bo'limlar → mavzular → daraja → filtr → →/+/− → sudrash →
kartochkadan ajratish → muharrirda daraja → nom, o'chirish, yig'ish; ZZ o'chiriladi),
regressiya: bank/imtihon/andoza mantiq testlari.

### 21.1 Egasining izohlari bo'yicha (2026-10-03, kechroq)

"Bo'lim qaysi fanga kirishi yozilmagan; «Fan» bilan «Fanlar» alohida yotibdi; xohlagancha o'zim
kirita olay; balki qiyinlikni 2 ga bo'larman."

- Ustunlar uch guruhga ajratildi, har birining tepasida nomi: **Tuzilma** (fan → bo'lim → mavzu,
  orasida strelka), **Qiyinlik**, **O'z filtrlaringiz**. Bo'lim ustuni sarlavhasi ostida «… fani»,
  Mavzu ustunida «… bo'limi» yoki «… fani — hamma bo'lim». Shunda «Fan» (tuzilma) va foydalanuvchining
  «Fanlar» filtri aralashmaydi.
- **Qiyinlik to'liq foydalanuvchiniki**: asosiy uch daraja ham nomi o'zgartiriladi va olib tashlanadi
  (masalan faqat ikkitasi qoladi). Sozlama — `QuestionTagGroup.sozlama` (tur 'qiyinlik' guruhida):
  `{1: {nom?, yashirin?}, 2: …, 3: …}`; API `PUT /api/bank/darajalar/asosiy/:d {name?, yashirin?}`.
  Savoli bor daraja olinmaydi, oxirgisi ham. Olib tashlangan o'rin «Daraja qo'shish»da shu rang
  tanlansa qaytadi (rang oldindan tanlangan turadi). Olib tashlangan darajaga yozilgan savol
  (import, AI, natijaga moslash) eng yaqin ko'rinadigan darajaga tushadi (`yaqinDaraja`; teng
  uzoqlikda — osonrog'iga). Imtihon tuzish o'zgarmagan: uch o'rin qoladi, bo'sh o'rin ulushi
  qo'shnilariga o'tadi (`taqsimla`).
- Nomlar butun ilovada bir joydan: `bank/qiyinlik.tsx` (`qiyinlikniSozla`, `useQiyinlik`,
  `korinadiganQiyinlik`) — `bank/daraxt` javobidagi `qiyinlik` dan to'ladi. Imtihon bloki jadvali,
  andoza, savol tanlash va muharrirda olib tashlangan daraja ko'rinmaydi.
- Eskirgan javoblar qo'llanmaydi: `useBankDaraxt` faqat oxirgi so'rov javobini oladi, ekranda
  o'zgargan qiyinlik sozlamasini eski javob bosib ketmaydi (`qiyinlikMahalliyVersiya`).
- DEMO fanlar, DEMO imtihonlar va ularning savollari egasining buyrug'i bilan shu kuni bazadan
  o'chirildi (zaxira — `scratch/demo_ochirildi_2026-10-03_*.json`).

Sinov: `test_bank4_api.mjs` 45/45, `bank4_ui.mjs` 37/37 (daraja nomi → olib tashlash → 2 ta → qaytarish;
guruh sarlavhalari; bo'limda fan nomi).

### 21.2 Maket bo'yicha qayta qurildi: fan yorliqlari, chapda daraxt, kartadagi yorliqlar (2026-10-03)

Egasi ustunli ekranni rad etdi ("real foydalanuvchi tajribasini his qilmayapsan… avval maketini qil").
Bosib ko'rsa bo'ladigan maket (Artifact) ko'rsatildi, "ok" dan keyin aynan shu ko'rinish qurildi.

- **Fan — tepada yorliq** (`+ Fan`, `…` — nomini o'zgartirish / o'chirish). Pastdagi hamma narsa
  tanlangan fanniki; alohida "Fanlar" ro'yxati yo'q.
- **Chap panel** (`bank/BankQismlari.tsx` — `YonQator`, `QatorForma`): *Tuzilma* — «Hamma savollar»,
  bo'limlar (ochiladi/yig'iladi) ichida mavzular, bo'limsiz mavzular; `+ Bo'lim`, `+ Mavzu`, bo'lim
  qatoridagi `+` — shu bo'limga mavzu. *Filtrlar* — birinchi ro'yxat «Qiyinlik» (hamma fanlarda bitta),
  keyin fanning o'z filtrlari; `+ daraja`, `+ qiymat`, `+ Yangi filtr`. Enter — maydon ochiq qoladi.
  Telefonda panel yig'iladi («Tuzilma va filtrlar»), mavzu tanlansa yopiladi.
- **Qiyinlik — oddiy ro'yxat**: "rang o'rni" so'ralmaydi. Yangi daraja oxiriga qo'shiladi: uchinchi
  asosiy o'rin bo'sh bo'lsa — shu o'rin, aks holda `asos = 3` li belgi. Asosiy darajani o'chirish
  endi rad etilmaydi: tasdiqdan keyin savollari eng yaqin darajaga o'tadi
  (`PUT bank/darajalar/asosiy/:d {yashirin: true, kochir: true}` → `kochirildi`). Foydalanuvchi darajasi
  o'chsa va asosi olib tashlangan bo'lsa — savollari ham yaqin darajaga.
- **Savol kartasi**: yorliqlar (mavzu, qiyinlik, har filtr; qo'yilmagani — punktir «manba?») bosilsa
  menyu ochiladi (`Menyu`) — qiymat tanlanadi, olib tashlanadi yoki shu yerda yangisi yoziladi
  (yaratiladi va darhol qo'yiladi). Filtr bitta qiymatli: `questions/bulk {guruhlar: [{groupId, tagIds}]}`.
  `…` — ochish / o'chirish; ikki marta bosish — ochish.
- **Bir nechtasi belgilansa** — pastda panel: Mavzuga, Qiyinlik, har filtr, `…` (manba-izoh-holat
  oynasi, ishlatilishini nolga), O'chirish. Kartani chapdagi mavzu / daraja / filtr qiymatiga sudrab
  tashlasa ham bo'ladi; mavzuni — bo'limga.
- **Bekor qilish**: biriktirish va mavzuni bo'limga o'tkazishdan keyin pastda xabar va «Bekor qilish»
  (savollar ekranda bo'lsa — har biri avvalgi qiymatiga qaytadi). O'chirishlar — tasdiq oynasi bilan.
- **Sonlar tanlovga qarab**: `bank/filtr` javobida `kesim` — mavzu kesimida `{j, q[3], b{belgi}, y{filtr}}`;
  ekran tanlangan fan / bo'lim / mavzu uchun o'zi yig'adi va biriktirganda darhol o'zgartiradi (`hissa`).
  `bank/royxat`: `belgilar[guruh]` ichida `0` — shu filtr qo'yilmaganlar; `qiyinlikSof` — asosiy
  daraja faqat o'zi (foydalanuvchi darajasi qo'yilganlarsiz).
- **Savol qo'shish** tugmasi ro'yxat sarlavhasida, tanlangan mavzu nomi bilan; oyna (SavolYuklash)
  shu mavzu oldindan qo'yilib ochiladi. Saqlangach ro'yxat yangi savollarga o'tadi: bitta mavzuga
  tushgan bo'lsa — o'sha mavzu, yangilari tepada («yangi» belgisi); bir nechta mavzuga — fan bo'yicha
  faqat «Hozirgina qo'shilganlar».
- Ixcham ko'rinish olib tashlandi; tartib «Boshqa filtrlar» ichida. `BankUstunlari.tsx` o'chirildi.

Sinov: `scratch/bank6_ui.mjs` (ZZ yozuvlar; fan → bo'lim → mavzu → daraja → filtr → yorliq, panel,
sudrash, bekor qilish, filtrlash, telefon).
