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
   Kalitlar `SETTINGS_KEY` bilan shifrlanadi va brauzerga qaytmaydi.
3. **Sandbox** (test.paycom.uz): webhook manzili + test kaliti bilan avtomatik
   testlar. Buyurtma ID si — o'quvchi kartochkasi → "Payme havola" (test rejimda
   havola `checkout.test.paycom.uz` ga boradi, Payment yozilmaydi, balans o'zgarmaydi).
4. Testlar o'tgach rejim → `Jonli`. Shu paytdan bot ham tugma ko'rsatadi.

Ixtiyoriy env: `APP_URL=https://sariosiyocrm.vercel.app` — bot yaratgan
havolada to'lovdan keyin qaytish manzili (`/pay/<id>`) uchun. CRM'dan yaratilgan
havola buni so'rovdan o'zi oladi.

## Metodlar

`CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`,
`CancelTransaction`, `CheckTransaction`, `GetStatement`. Boshqalari `-32601`.

Holatlar: `1` yaratildi → `2` o'tkazildi; `-1` o'tkazilmay bekor; `-2` o'tgach bekor
(faqat `paymeAllowRefund` yoqiq bo'lsa, aks holda `-31007`). Taymaut 12 soat
(`time` dan), muddati o'tgan `-1` / sabab `4`.

Xato kodlari: `-32504` auth, `-32600/-32601/-32700` so'rov, `-31001` summa,
`-31003` tranzaksiya topilmadi, `-31008` bajarib bo'lmaydi (faol emas, muddati
o'tgan, buyurtmada boshqa faol tranzaksiya), `-31050..-31054` buyurtma
(topilmadi / muddati o'tgan / to'langan / bekor / boshqa rejim).

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

`scratch/test_payme.mjs` — Payme rolini o'ynab lokal serverga 87 ta tekshiruv
(auth, buyurtma, create/perform/cancel, parallel so'rovlar, taymaut, statement,
IP, test rejim, CRM API, ochiq sahifa). `scratch/test_payme_bot.mjs` — bot oqimi.
Ikkalasi ham production bazaga ishlaydi va faqat o'zi yaratganini o'chiradi.
