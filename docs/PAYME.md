# Payme integratsiyasi

Payme Business **Merchant API** (JSON-RPC) bo'yicha. Karta ma'lumotlari CRM ga
hech qachon kelmaydi — to'lovchi Payme'ning o'z sahifasida to'laydi, Payme
bizning webhook'ga natijani yuboradi.

## Fayllar

| Fayl | Nima qiladi |
|---|---|
| `services/payme.js` | Protokol: 6 metod, holat mashinasi, buyurtma, havola, autentifikatsiya |
| `routes/payme.js` | Webhook `POST /api/payme/<token>`, CRM API, ochiq holat endpoint'i |
| `prisma/schema.prisma` | `PaymeOrder`, `PaymeTransaction`, `PaymeLog`, `Setting.payme*` |
| `src/components/PaymeSettings.tsx` | Sozlamalar → Payme |
| `src/components/PaymeLinkModal.tsx` | O'quvchi kartochkasi → "Payme havola" (havola + QR + Telegramga yuborish) |
| `src/components/PublicPay.tsx` | `/pay/:orderId` — to'lovdan keyin qaytish sahifasi |
| `src/bot/bot.js` | Botda "💳 Payme orqali to'lash" (faqat jonli rejimda) |

## Ulash tartibi

1. **Payme Business kabineti** (merchant.paycom.uz): kassa yarating.
   - Endpoint URL: Sozlamalar → Payme dagi webhook manzili
     (`https://<sayt>/api/payme/<maxfiy-token>`). Token tasodifiy, bir marta
     yaratiladi; "almashtirish" tugmasi bilan yangilanadi (keyin kabinetda ham).
   - Hisob (account) maydoni: `order_id`.
2. **CRM Sozlamalar → Payme**: Merchant ID, jonli kalit, test kalit. Rejim: `Test`.
   Kalitlar `SETTINGS_KEY` bilan shifrlanadi va brauzerga qaytmaydi. **`SETTINGS_KEY`
   Vercel'da o'rnatilmagan bo'lsa server kalitni saqlamaydi** (fail-closed) — avval
   uzun tasodifiy qiymat qo'shib deploy qiling.
3. **Sandbox** (test.paycom.uz): webhook manzili + test kaliti bilan avtomatik
   testlar. Buyurtma ID si — o'quvchi kartochkasi → "Payme havola" (test rejimda
   havola `test.paycom.uz` ga boradi, Payment yozilmadi, balans o'zgarmaydi).
4. Testlar o'tgach rejim → `Jonli`. Shu paytdan bot ham tugma ko'rsatadi.

Ixtiyoriy env: `APP_URL=https://sariosiyocrm.vercel.app` — bot yaratgan
havolada to'lovdan keyin qaytish manzili (`/pay/<id>`) uchun. CRM'dan yaratilgan
havola buni so'rovdan o'zi oladi.

## Ikki xil hisob (bitta kassa)

- **Havola/QR** — `account.order_id` (16 belgili buyurtma ID). CRM yoki bot
  buyurtma yaratadi (o'quvchi + kurs + summa), summa qat'iy, bir marta to'lanadi
  (одноразовый). Buyurtma bo'yicha bir vaqtda bitta faol tranzaksiya.
- **Payme ilovasi katalogi** — `account.student_id` (Student.id, kartochkadagi №)
  + ixtiyoriy `account.course_id` (CRM'dagi kurs raqami, bazada Group.id: "Matematika 2-Guruh" va "Matematika 3-Guruh" alohida kurslar). To'lovchi summani o'zi yozadi (butun
  so'm, `MIN_AMOUNT..MAX_AMOUNT`), накопительный — istalgancha marta.
  Kurs berilmasa: o'quvchi bitta kursda bo'lsa o'sha kurs, bir nechta bo'lsa
  `courseId = null` ("umumiy" to'lov — lib/allocation.js hamyon qoidasi).
  CheckPerformTransaction ikkala holatda ham `additional: { oquvchi: "FAMILIYA I.",
  kurs: "Matematika 2-Guruh" | "Umumiy" }` qaytaradi — ID ketma-ket raqam, shuning uchun
  to'liq ism/qarz/guruh ko'rsatilmaydi. Payme uni to'lov sahifasida ko'rsatishi uchun
  ularning texnik mutaxassisiga aytiladi (hujjat talabi).
  Xatolar: `-31055` o'quvchi topilmadi (`data: student_id`), `-31056` kurs
  (`data: course_id`).

Payme kabinetida ikkala maydon ham ixtiyoriy qilib sozlanadi (biri to'ldiriladi);
`course_id` Payme'da ro'yxat qilinmaydi (kurslar qo'shilib turadi): ota-ona o'z kurslari raqamini botdagi balans xabarida ko'radi, to'liq ro'yxat Sozlamalar > Payme'da.
Tranzaksiya (`PaymeTransaction`) o'zida `studentId/groupId/courseId/test/account`
saqlaydi — Perform/Cancel buyurtmaga qaramaydi.

## Metodlar

`CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`,
`CancelTransaction`, `CheckTransaction`, `GetStatement` (majburiy) va ixtiyoriy
`SetFiscalData` (fiskal chek ma'lumoti `PaymeTransaction.fiscalPerform/fiscalCancel`
ga saqlanadi). Boshqalari `-32601` (`data` = metod nomi).

Holatlar: `1` yaratildi → `2` o'tkazildi; `-1` o'tkazilmay bekor; `-2` o'tgach bekor
(jonli rejimda faqat `paymeAllowRefund` yoqiq bo'lsa, aks holda `-31007`; test
rejimda doim — sandbox'ning 2-ssenariysi shuni kutadi). Taymaut 12 soat (Payme
`time` dan), muddati o'tgan `-1` / sabab `4`. `GetStatement` Payme `time` bo'yicha
`from <= time <= to`, o'sish tartibida.

Xato kodlari: `-32300` POST emas, `-32504` auth, `-32600/-32601/-32700` so'rov,
`-32400` ichki (baza) xato — Payme qayta yuboradi, `-31001` summa, `-31003`
tranzaksiya topilmadi, `-31007` bekor qilib bo'lmaydi, `-31008` bajarib bo'lmaydi
(faol emas, muddati o'tgan),
`-31050..-31054` buyurtma (topilmadi / muddati o'tgan / to'langan / bekor / boshqa
rejim), `-31055/-31056` katalog (o'quvchi / kurs), `-31057` buyurtmada boshqa faol
tranzaksiya — sandbox shu holatda `-31050..-31099` kutadi (hujjat matnidagi `-31008`
emas; 2026-09-14 da sandbox'da tekshirilgan). Auth: `Basic base64(login:KEY)` — login solishtirilmaydi (Payme beradi),
kalit `timingSafeEqual`.

Hujjat manbalari (developer.help.paycom.uz, 2026-09-11 da o'qilgan): Протокол
Merchant API (формат запроса/ответа, общие ошибки, схема взаимодействия), Методы
Merchant API (7 sahifa + ошибки + типы данных), Песочница, Инициализация платежей
(GET/POST, кнопка/QR, ошибки чека).

## Pul

Buyurtma = o'quvchi + guruh + summa (so'm, butun). Payme summani tiyinda yuboradi
(`×100`) va u buyurtmadagi bilan **aynan** teng bo'lishi shart.

`PerformTransaction` bitta DB tranzaksiyasida: `updateMany WHERE state = 1`
(atomar — parallel so'rov ikki marta kreditlay olmaydi), `Payment` (`type:
'Peyme'`, `groupId`/`courseId` buyurtmadan — pul kursga biriktiriladi,
`lib/allocation.js`), `Student.balance += summa`. Kassa `Peyme` ni naqd emas deb
hisoblaydi.

`CancelTransaction` (state 2 → -2): manfiy `Qaytarish` yozuvi, balans kamayadi;
avans sarflangan bo'lsa allocation uni alohida qarz qiladi. Ota-onaga va
adminlarga Telegram xabar.

## Xavfsizlik

- Webhook manzilida maxfiy token; noto'g'ri token/IP/kalit — bir xil `-32504`.
- `Authorization: Basic Paycom:KEY` — `timingSafeEqual` (SHA-256 dan keyin).
- Jonli rejimda faqat Payme IP lari (`185.234.113.1–15`, `paymeIpCheck`).
- Test kaliti jonli rejimda qabul qilinmaydi; test buyurtmasi jonlida to'lanmaydi.
- Har so'rov `PaymeLog` da (Authorization sarlavhasisiz), 120 so'rov/daqiqa/IP.
- Payme'ga faqat buyurtma tokeni (16 belgi, 80 bit) va summa ketadi.
- Kalitlar hech qachon brauzerga qaytmaydi (`hidePaymeSecrets`), loglarda
  `redactBody` bilan yashiriladi.

## Test

`scratch/test_payme.mjs` — Payme rolini o'ynab lokal serverga 143 ta tekshiruv
(auth, buyurtma, create/perform/cancel, parallel so'rovlar, taymaut, statement,
IP, test rejim, CRM API, ochiq sahifa). `scratch/test_payme_bot.mjs` — bot oqimi.
Ikkalasi ham production bazaga ishlaydi va faqat o'zi yaratganini o'chiradi.
