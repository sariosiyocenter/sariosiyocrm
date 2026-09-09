# Logistika moduli — to'liq ishlab chiqish rejasi

Sana: 2026-09-09. Holat belgilari: ✅ tayyor · 🟡 qisman · ⬜ boshlanmagan.

Maqsad: o'quvchini uyidan olib kelib, darsdan keyin uyiga qaytarish jarayoni
**haydovchi telefonidan boshqariladigan**, **ota-ona xabardor bo'ladigan**,
**admin bir ekranda ko'radigan** tizim bo'lsin. Hozirgi modul buning
skeletigina — pastda nima bor, nima buzuq va nima qilinishi kerakligi.

---

## 1. Hozir nima bor (audit)

### 1.1 Baza

| Model | Maydonlar | Izoh |
|---|---|---|
| `Transport` | name, model, number, capacity, driverName, driverPhone, status, driverId (unique) | Haydovchi ismi/telefoni `User` da ham bor — ikki nusxa, eskirib qoladi |
| `Route` | name, startTime, transportId, driverId, days (TOQ/JUFT/HAR_KUNI), studentIds Int[] | Tartiblangan o'quvchi ro'yxati. Yo'nalish (ketish/qaytish) yo'q |
| `DeliveryLog` | transportId, studentId, date, status | Kuniga o'quvchiga **bitta** yozuv. Vaqt yo'q, kim belgilagani yo'q, qaysi marshrut yo'q |
| `Student.transportId` | | Marshrutdan **alohida** ikkinchi "haqiqat" (pastga qarang) |

Bazadagi real ma'lumot (2026-09-09): 1 transport (DAMAS), 1 marshrut
("Markaz-Dashnabod", 23:00, TOQ, 1 o'quvchi), **0** yetkazish yozuvi,
**0** o'quvchi `transportId` bilan, 1 haydovchi (Telegram ulanmagan),
1 o'quvchida koordinata. Ya'ni modul hali ishlatilmagan — buzib
qayta qurishga erkinmiz, migratsiya og'rig'i yo'q.

### 1.2 UI — `src/components/Logistics.tsx` (675 qator, 3 tab)

- **Marshrutlar** — ro'yxat + tanlangan marshrutning o'quvchilari, ↑↓ tartib, o'quvchi qo'shish/olish.
- **Kunlik holat** — transport tanlanadi → o'sha kunga aktiv marshrutlar → har o'quvchiga 3 tugma (Olib ketildi / Uyiga yetkazildi / Kelmadi).
- **Flot** — transport kartochkalari, qo'shish/tahrirlash/o'chirish.

Eski uslub (ikonka kvadrati + kartochka sarlavha) — UI rejasidagi E9 ro'yxatida.

### 1.3 Haydovchi tomoni

- Web: `DRIVER` roli uchun `/logistics` yopiq (`isAdminOrManager`), ruxsatlar jadvalida hamma modul `false`. **Haydovchi web'da hech narsa ko'rmaydi.**
- Bot: 2 tugma — "📍 O'quvchilar lokatsiyasi" (ro'yxat + Yandex havolasi) va "🚍 Mening Transportim". **Belgilash tugmasi yo'q** — "oldim / yetkazdim" faqat admin kompyuterdan bosishi mumkin. Hech kim shunday qilmaydi.
- Ota-onaga xabar: **yo'q**.

### 1.4 Topilgan xatolar

| # | Xato | Qayerda | Oqibat |
|---|---|---|---|
| X1 | **Ikki haqiqat.** Kim qaysi mashinada — `Student.transportId` (o'quvchi qo'shish/tahrirlash/ariza formasi yozadi) va `Route.studentIds` (Logistika yozadi). Bot `transport.students` ni oladi, marshrutni emas | `bot.js:612`, `Logistics.tsx` | Marshrutga qo'shilgan o'quvchi haydovchi ro'yxatida chiqmaydi. Hozir ham ajralib turibdi: 0 ta vs 1 ta |
| X2 | **Toq/juft ikki xil hisoblanadi.** Logistika hafta kuni bo'yicha (Du-Cho-Ju = TOQ), bot oy kuni juftligi bo'yicha (`dayNum % 2`) | `Logistics.tsx:~135`, `bot.js:626` | Bir kunda admin bir ro'yxatni, haydovchi boshqasini ko'radi |
| X3 | Bot `'HAR KUNI'` (bo'sh joy) bilan solishtiradi, marshrut `'HAR_KUNI'` saqlaydi; bot guruh kunlariga qaraydi, marshrut kunlariga emas | `bot.js:634` | Har kunlik marshrut botda noto'g'ri filtrlanadi |
| X4 | Kuniga bitta yozuv: "Olib ketildi" ni "Uyiga yetkazildi" **ustidan yozadi** | `server.js /api/delivery-logs` | Ertalab olganini kechqurun yo'qotamiz; tarix yo'q |
| X5 | Kunlik holat faqat transport orqali: `transportId` bo'sh marshrut **ko'rinmaydi**; birinchi transport avtomatik tanlanadi | `Logistics.tsx` yetkazish tabi | Haydovchiga biriktirilgan, mashinasi ko'rsatilmagan marshrut yo'qolib qoladi |
| X6 | Server tekshirmaydi: `req.body` to'g'ridan-to'g'ri Prisma'ga (o'quvchilardagi kabi whitelist yo'q); `capacity: parseInt('')` → NaN → 500; `PUT/DELETE routes/:id` va `transports/:id` **filialga tekshirmaydi** | `server.js:4204–4300` | Boshqa filial marshrutini o'zgartirish mumkin; bo'sh sig'im formani buzadi |
| X7 | `Transport.driverId @unique`: bir haydovchini ikkinchi mashinaga qo'yish → P2002 → xom 500 | `server.js:4217` | Foydalanuvchi sababsiz xato ko'radi |
| X8 | Transport o'chirilganda marshrut `transportId = null` bo'lib **jimgina** qoladi (ogohlantirish yo'q); marshrut o'chirishda tasdiq so'ralmaydi | `server.js:4232`, `Logistics.tsx` | Bir bosishda marshrut yo'q |
| X9 | Arxiv/o'chirilgan o'quvchi `studentIds` da qolib ketadi — sanoq noto'g'ri, qator ko'rinmaydi | `Logistics.tsx` | "5 o'quvchi" deydi, 3 tasi chiqadi |
| X10 | Flot qidiruvi va o'quvchi tanlash oynasi bitta `searchTerm` ni bo'lishadi | `Logistics.tsx` | Birida yozilgani ikkinchisini filtrlab qo'yadi |
| X11 | Yagona marshrutning vaqti **23:00** — forma vaqtni dars jadvaliga bog'lamaydi, foydalanuvchi to'g'ri to'ldirolmagan | ma'lumot | Vaqt maydoni ma'nosiz |
| X12 | Sig'im tekshirilmaydi: 6 o'rinli Damasga 15 o'quvchi qo'shsa bo'ladi | `Logistics.tsx` | — |
| X14 | `/api/transports` javobida haydovchining **parol hashi va emaili** bor edi (`include: { driver: true }`) | `server.js` | Har bir logistika sahifasi ochilganda hash brauzerga uzatilardi |
| X15 | Kunlik holat sanasi `toISOString()` — UTC. UTC+5 da ertalab soat 5 gacha **kechagi kun** ochilardi va belgilash ham o'sha kunga yozilardi | `Logistics.tsx` | Ertalabki reys kechaga tushadi |
| X16 | "Hamma marshrutlar" holatida belgilash tugmalari jimgina ishlamasdi (`if (!selectedTransportId) return`) | `Logistics.tsx` | Bosiladi, hech narsa yozilmaydi |
| X13 | Yangi qilingan joylashuv ishi (`Student.location`, `Setting.centerLocation`, `StudentLocationMap`) logistikada **umuman ishlatilmaydi** — marshrutda faqat matnli manzil | `Logistics.tsx` | Haydovchiga xarita yo'q, tartib geografiyaga qaramaydi |

---

## 2. Yakuniy ko'rinish (nimaga borayapmiz)

**Haydovchi (telefon, Telegram bot):**
"🚌 Bugungi marshrutlar" → *Ertalab: Markaz–Dashnabod 07:40 (6/6)* →
o'quvchilar tartib bilan, har birida `✅ Oldim` / `❌ Kelmadi` / `🗺 Yo'l`
inline tugmalari; kechqurun `🏠 Yetkazdim`. "Boshladim" / "Tugatdim" — reys
vaqti yoziladi.

**Ota-ona (Telegram, keyin SMS):**
"🚌 Elyorbek 07:52 da olib ketildi (DAMAS, Alijon aka)" ·
"🏠 Elyorbek 12:35 da uyiga yetkazildi".

**Admin (web):**
- *Bugun* — jonli doska: reyslar, progress (4/6), kechikish, kelmaganlar.
- *Marshrutlar* — xaritada bekatlar (o'quvchi portretlari, markaz logosi), sudrab tartiblash, sig'im ko'rsatkichi, kunlar va vaqtlar.
- *Flot* — mashina + haydovchi, holat, hujjat muddatlari (ixtiyoriy).
- *Tarix* — kun/oy bo'yicha: kim qatnadi, kim kelmadi, haydovchi bo'yicha.
- O'quvchi profilida "Transport" kartasi; Dashboard'da bugungi reys KPI.

---

## 3. Bosqichlar

Har bosqich — alohida commit(lar), `tsc` + `vite build` + **brauzer skrinshoti**,
keyin `main` ga push (foydalanuvchi jonli saytda ko'radi).

### 0-bosqich. Tozalash — mavjud xatolar ✅ (2026-09-09)

Modelni o'zgartirmasdan, hozirgi kod ustida:
- Toq/juft **bitta** funksiya (`src/lib/days.ts`, server uchun `lib/days.js`): hafta kuni asosida — Du/Cho/Ju = TOQ, Se/Pa/Sha = JUFT, Yak = hech qaysi. Guruh `days` shu formatda, marshrut ham shunga o'tadi.
- Server: `transports`/`routes` uchun whitelist + `capacity` son tekshiruvi + `schoolId` bo'yicha egalik tekshiruvi (`findFirst({id, schoolId})` → 404), P2002 uchun "Bu haydovchi allaqachon boshqa mashinaga biriktirilgan" xabari.
- Transport o'chirishda marshrutlari bo'lsa 400 + izoh (avval marshrutni ko'chir); marshrut o'chirishga `confirm`.
- `studentIds` ni faqat mavjud, arxivda bo'lmagan o'quvchilar bilan ko'rsatish; ikki qidiruv holati.
- **Natija:** modul hozirgi imkoniyatida to'g'ri ishlaydi — 1-bosqich uchun toza asos.

**Bajarildi:** X2, X3 (kun jadvali `lib/lessons.js` dagi `isLessonDay` ga birlashdi —
guruh, marshrut va bot bitta manbadan), X5 ("Hamma marshrutlar" tanlovi), X6
(maydon whitelisti, sig'im/holat/kun/sana tekshiruvi, filial egaligi), X7
(band haydovchi haqida tushunarli xabar), X8 (marshrutli mashinani o'chirib
bo'lmaydi; marshrut o'chirishga tasdiq), X9 (yo'q/arxivdagi o'quvchi bekat
sanog'iga kirmaydi — serverda ham, UI da ham), X10 (ikki alohida qidiruv),
X14 (parol hashi javobdan chiqarildi), X15 (mahalliy sana), X16 (belgilash
marshrut mashinasiga yoziladi).

Tekshiruv: `scratch/test_logistics_api.mjs` — 15 ta holat, hammasi o'tdi;
brauzerda uchala tab skrinshot qilindi, yetkazish belgilandi va baza yozuvi
ko'rildi.

Qolgani (1-bosqichda hal bo'ladi): X1 (ikki haqiqat), X4 (kuniga bitta yozuv),
X11 (reys vaqti), X12 (sig'im chegarasi), X13 (xarita).

### 1-bosqich. Ma'lumot modeli — bitta haqiqat ✅ (2026-09-09)

```
Route         + direction   KETISH | QAYTISH        (ertalab olib kelish / darsdan keyin qaytarish)
              + groupId?    Int                     (vaqtni guruh jadvalidan olish uchun, ixtiyoriy)
              days          TOQ | JUFT | HAR_KUNI   (hafta kuni asosida — 0-bosqich)
RouteStop     id, routeId, studentId, order, pickupLocation? ("lat,lng" — uyidan boshqa joy bo'lsa)
              → Route.studentIds Int[] o'rniga; o'quvchi o'chirilsa Cascade
RouteRun      id, routeId, date, driverId, transportId, startedAt?, finishedAt?
              → bir kunning bir reysi
DeliveryLog   + runId, + markedById, + markedAt, + note
              status: OLINDI | YETKAZILDI | KELMADI | OTKAZILDI
              → (runId, studentId) unique — ertalab va kechqurun alohida
Student.transportId  → olib tashlanadi (yoki faqat o'qish uchun: marshrutdan hisoblanadi)
```

- Migratsiya: `prisma migrate diff` → SQL ko'rib chiqiladi → `db push` (2a qarori bo'yicha). Ma'lumot yo'qligi uchun ko'chirish skripti kerak emas; bitta marshrutni qo'lda qayta yaratish kifoya.
- `Student.transportId` ni ishlatgan 4 forma (o'quvchi qo'shish, tahrirlash, ariza, profil kartasi) → "marshrut" tanlovi yoki faqat ko'rsatish.
- Bot va Logistika **bitta** `services/logistics.js` dan oladi: `bugungiReyslar(schoolId, date)`, `reysOquvchilari(runId)`.
- **Natija:** admin ham, haydovchi ham, ota-ona ham bitta ro'yxatni ko'radi.

**Bajarildi.** Baza faqat kengaydi — hech qaysi ustun yoki jadval
o'chirilmadi (`prisma migrate diff` bilan SQL oldindan ko'rildi):

- `RouteStop` — marshrut bekatlari, tartibi bilan. O'quvchi o'chirilsa bekat
  ham ketadi (Cascade), ya'ni "ro'yxatda bor, bazada yo'q" holati qaytmaydi.
  Mavjud `Route.studentIds` ma'lumoti ko'chirildi (`scratch/migrate_stops.js`).
- `RouteRun` — bir kunning bir reysi (marshrut + sana, unique). Birinchi
  belgilashda o'zi yaratiladi; mashina va haydovchi o'sha ondagi marshrutdan
  ko'chiriladi, keyin marshrut o'zgarsa ham tarix saqlanadi. `startedAt` /
  `finishedAt` 2-bosqichdagi bot tugmalari uchun tayyor.
- `DeliveryLog` + `runId`, `markedById`, `markedAt`, `note`; `transportId`
  endi ixtiyoriy. **X4 yopildi:** ertalabki "Olib ketildi" kechqurungi
  "Uyiga yetkazildi" ni bosib ketmaydi — ular ikki xil reysning yozuvi
  (`@@unique([runId, studentId])`).
- `Route.direction` — KETISH / QAYTISH, formada tanlanadi va ro'yxatda
  ko'rinadi.

**X1 yopildi:** bot endi `transport.students` emas, marshrut bekatlarini
o'qiydi (haydovchining o'z marshruti yoki mashinasi bo'yicha), har reysni
alohida xabar qilib yuboradi va o'quvchining koordinatasi bo'lsa Google
Maps havolasini beradi.

`Route.studentIds` ustuni ataylab joyida qoldirildi — endi hech kim uni
o'qimaydi, lekin API javobida `studentIds` bekatlardan hisoblanib qaytadi,
shuning uchun sahifaning qolgan qismi va tashqi so'rovlar buzilmadi.
Ustunning o'zi keyingi bosqichda, `Student.transportId` bilan birga
olib tashlanadi.

Tekshiruv: `scratch/test_logistics_1.mjs` — 23 holat (bekat tartibi,
ikki reysning yozuvi, qayta belgilash, begona marshrut, o'chirish),
hammasi o'tdi; `scratch/test_bot_query.js` — botning yangi so'rovi;
brauzerda sahifa va belgilash.

**Qolgani:** `Student.transportId` hali 4 ta formada turibdi (o'quvchi
qo'shish, profil tahriri, ariza, profil kartasi) — u endi logistikaga
ta'sir qilmaydi, lekin foydalanuvchini chalg'itadi. 4-bosqichda,
sahifa qayta yozilganda olib tashlanadi.

### 2-bosqich. Haydovchi — Telegram bot ✅ (2026-09-09)

- Haydovchini botga ulash (xodimlar uchun mavjud ulash yo'li tekshiriladi; yo'q bo'lsa HR'dan bir martalik kod).
- "🚌 Bugungi marshrutlar" → reyslar ro'yxati (kun filtri 0-bosqichdagi funksiya bilan) → reys → **inline tugmalar**: `▶️ Boshladim`, har o'quvchi uchun `✅ Oldim | ❌ Kelmadi | 🗺 Yo'l` (Google/Yandex havolasi `Student.location`, bo'lmasa manzil), oxirida `⏹ Tugatdim`.
- Qaytish reysida `🏠 Yetkazdim`.
- Har bosish → `DeliveryLog` (runId, markedById = haydovchi, markedAt = hozir).
- Xatoga chidamli: qayta bosish holatni o'zgartiradi, eskisini yozib qo'ymaydi; 4096 belgi chegarasi uchun bo'laklab yuborish.
- **Natija:** yetkazish yozuvi haydovchi qo'lida paydo bo'ladi — modul "tirik" bo'ladi.

**Bajarildi.** Menyuda yangi tugma: **🚌 Bugungi reyslar**. Har reys alohida
xabar bo'lib keladi — marshrut, yo'nalish, vaqt, mashina, `2/5 belgilandi`,
so'ng har o'quvchi manzili, xarita havolasi va telefoni bilan.

Tugmalar:
- **▶️ Boshladim** → **⏹ Tugatdim** — reys vaqti (`RouteRun.startedAt` /
  `finishedAt`) yoziladi va xabarda ko'rinadi.
- Har o'quvchi uchun bitta tugma, bosilgan sari holat aylanadi:
  ⬜ belgilanmagan → ✅ olindi (KETISH) yoki yetkazildi (QAYTISH) →
  ❌ kelmadi → yana ⬜ (xato bosilgani uchun orqaga qaytish yo'li).
- 🔄 Yangilash — boshqa joyda o'zgargan bo'lsa.

Butun holat bazada, xotirada emas: bot qayta ishga tushsa ham eski
xabardagi tugmalar ishlayveradi. Har bosishda marshrut haydovchiniki
ekani qayta tekshiriladi.

Reys va yozuv mantig'i endi `services/logistics.js` da — admin sahifasi
(server.js endpointlari) va bot aynan shu funksiyalarni chaqiradi, ikkinchi
nusxa yozilmadi.

Tekshiruv: `scratch/test_bot_reys.mjs` — soxta bot obyekti bilan 24 holat
(ro'yxat, boshlash, uch bosqichli belgilash, tugatish, begona marshrut,
haydovchi bo'lmagan foydalanuvchi), hammasi o'tdi. Sinov haydovchining
`telegramId` sini vaqtincha yozib, oxirida qaytaradi.

**Haydovchini botga ulash:** botni ochib, kontaktini ulashadi — raqami
`User.phone` bilan solishtiriladi va haydovchi menyusi chiqadi.

### 3-bosqich. Ota-onaga xabar ✅ (2026-09-09)

- `sendToOne` (Xabarlar moduli) orqali: kanal Telegram (ota/ona/o'quvchi ulangan bo'lsa), keyin SMS (Eskiz — pullik, sozlamada yoqish/o'chirish).
- Trigger: `OLINDI` va `YETKAZILDI` yozilganda. `KELMADI` → adminlarga (`notifyAdmins`) va ota-onaga "bugun mashina keldi, chiqmadi".
- Shablonlar Xabarlar → Shablonlar ichida (`{oquvchi}`, `{vaqt}`, `{transport}`, `{haydovchi}`), avtomatik qoida sifatida — mavjud `AutoMessageRule` mexanizmiga yangi hodisa turi.
- **Natija:** ota-ona hech narsa so'ramay xabardor.

**Bajarildi.** Xabar yozuv yozilgan ondayoq ketadi — `holatniYozish` ichidan,
ya'ni haydovchi botdan bossa ham, admin sahifadan bossa ham bir xil; bir
yo'lni unutib qo'yish imkoni yo'q.

- Matnlar: «🚌 Elyorbek 07:52 da olib ketildi (DAMAS, Alijon aka)» ·
  «🏠 … uyiga yetkazildi» · «❗️ … bugun … da mashinaga chiqmadi».
- Qabul qiluvchi: ota, ona, keyin o'quvchining o'zi (Telegramga ulanganlari).
- Takror yubormaydi: xabar faqat holat **o'zgarganda** ketadi, bir xil
  tugmani qayta bosish yoki ro'yxatni yangilash yangi xabar hosil qilmaydi.
- Har xabar `SmsLog` ga `type: TRANSPORT` bilan yoziladi (Xabarlar
  modulidagi tarixda ko'rinadi), yuborilmasa sababi bilan.
- Xato yuz bersa haydovchining tugmasi baribir ishlaydi — xabar chaqiruvi
  kutilmaydi.

Sozlama: **Sozlamalar → Avtomatlashtirish → Transport xabarlari**. Ataylab
**o'chiq** holda keladi (haqiqiy ota-onaga xabar ketadi — admin o'zi
yoqsin). Kanal: faqat Telegram (bepul) · Telegram, ulanmagan bo'lsa SMS ·
faqat SMS. `BOTH` da SMS faqat Telegram ishlamaganda ketadi — xabar ikki
marta bormasin va bekorga pul ketmasin.

SMS Eskiz orqali: server ishga tushganda o'z yuboruvchisini servisga
ro'yxatdan o'tkazadi, shuning uchun xabarlar modulini ko'chirish shart
bo'lmadi va bot ham SMS yubora oladi.

**Yo'l-yo'lakay topilgan xato:** vaqt va sana server soatidan olinardi,
Vercel esa UTC da ishlaydi — ota-onaga «02:52 da olib ketildi» ketardi va
yarim kechadan keyin reys kechagi kunga yozilardi. Endi ikkalasi ham
O'zbekiston vaqtida (`toDateStr`, `toTimeStr` — loyihadagi UTC+5 usuli).

Tekshiruv: `scratch/test_notify.mjs` — 12 holat. Haqiqiy ota-onaga xabar
ketmasligi uchun sinov o'z o'quvchisini yaratib, unga mavjud bo'lmagan
Telegram ID beradi: Telegram «chat not found» qaytaradi, ya'ni butun yo'l
tekshiriladi, lekin hech kimga hech narsa bormaydi.

### 4-bosqich. Admin sahifasi — `Logistics.tsx` qayta 🟡 (2026-09-09)

Sahifa E9 `PageHeader` uslubiga o'tadi (UI rejasi bilan bir vaqtda). Tablar:

1. **Bugun** — reyslar kartochkalari: marshrut, haydovchi, transport, `4/6` progress, boshlangan/tugagan vaqt, kechikish (startTime + 15 min o'tsa sariq), kelmaganlar ro'yxati. Admin ham belgilashi mumkin (haydovchi telefoni o'chgan holat uchun) — bu hozirgi "Kunlik holat" ning o'rnini bosadi (X5 ni ham yopadi: reys marshrutdan keladi, transportdan emas).
2. **Marshrutlar** — chapda ro'yxat (kun, vaqt, yo'nalish, sig'im `6/6` ko'rsatkichi — to'lsa qizil, X12), o'ngda **xarita**: bekatlar o'quvchi portreti bilan, markaz logosi (`StudentLocationMap` dan umumiy `LeafletMap` komponenti ajratiladi), chiziq tartib bo'yicha; ro'yxatda sudrab tartiblash (↑↓ qoladi, sudrash qo'shiladi); "Yaqinidan boshlab tartibla" tugmasi (masofa bo'yicha oddiy greedy). Koordinatasi yo'q o'quvchi sariq belgi bilan — profilga havola.
3. **Flot** — hozirgi kartochkalar E4 uslubida; haydovchi `User` dan (nom/telefon nusxasi olib tashlanadi, X-dublikat); holat `Ta'mirda` bo'lsa reyslar sahifasida ogohlantirish.
4. **Tarix** — sana oralig'i → jadval: o'quvchi × kunlar (✅/❌/—), haydovchi bo'yicha reys soni, o'rtacha davomiylik; Excel eksport (mavjud `xlsx` bilan).

Qo'shimcha:
- O'quvchi profili → "Transport" kartasi: marshruti, haydovchi, so'nggi 10 reys.
- Dashboard → "Bugungi reyslar 3/4 · 2 kelmadi" plitka (Logistika sahifasiga havola).
- **Natija:** admin bir ekranda hamma narsani ko'radi.

**Bajarildi:**

- **Kunlik holat → reys doskasi.** Kartochka sarlavhasida yo'nalish, vaqt,
  mashina va haydovchi; o'ngda `belgilangan/jami`, kelmaganlar soni,
  haydovchi boshlagan va tugatgan vaqt. Boshlanish vaqtidan 15 daqiqa
  o'tgan, lekin boshlanmagan reys "kechikmoqda" deb belgilanadi. O'quvchi
  qatorida kim va qachon belgilagani yoziladi.
- **Marshrutlar — xarita.** Bekatlar tartib raqami va o'quvchi portreti
  bilan, markaz logosi bilan, orasida chiziq va yo'l uzunligi.
  Koordinatasi yo'q o'quvchilar soni alohida aytiladi. Marker kodi
  `src/lib/mapMarkers.ts` da — profil xaritasi bilan bir xil.
- **Sig'im ko'rsatkichi** (X12): 6 o'rinli mashinaga 8 o'quvchi qo'shilsa
  qizil rangda ogohlantiradi.
- **Tarix tabi** — sana oralig'i yoki **boshidan**: reyslar, olib
  ketilgan/yetkazilgan/kelmagan soni, o'quvchi bo'yicha jamlanma,
  haydovchi bo'yicha reys soni va o'rtacha davomiylik, kun bo'yicha
  yig'indi. Excel ga chiqariladi (uch varaq).
  Yangi endpointlar: `GET /api/route-runs`, `GET /api/logistics/stats`.
- **O'quvchi profilidagi Transport qatori** endi marshrutdan olinadi
  (X13 ning bir qismi): ilgari u `Student.transportId` ni ko'rsatardi va
  marshrutga qo'shilgan o'quvchida ham "Transport yo'q" deb turardi.

**Keyin qo'shildi (2026-09-09):**

- **Formalarda marshrut.** O'quvchi qo'shish va profil tahririda "Transport"
  o'rniga marshrut tanlanadi va u haqiqiy bekat bo'lib yoziladi. Bir
  o'quvchi ertalabki va kechqurungi marshrutda bo'lishi mumkin, shuning
  uchun ro'yxatdan bosib tanlanadi. `Student.transportId` ustuni
  o'chirilmadi, formalar endi unga yozmaydi. (`routeIds` — POST/PUT
  `/api/students`, javobda ham qaytadi.)
- **Sudrab tartiblash** va **"Yaqindan tartibla"** (markazdan boshlab eng
  yaqin keyingi bekat). Koordinatasi yo'q o'quvchilar oxiriga tushadi.
- Ikkita xato: `/api/init` marshrutlarni eski `studentIds` ustunidan
  qaytarardi (yangi marshrutga qo'shilganlar sahifa yangilangach yo'qolib
  ko'rinardi); o'ng paneldagi ro'yxat marshrutning eski nusxasidan
  chizilardi va o'zgarishdan keyin yangilanmasdi (↑↓ da ham).

**Qolgani:** Avtopark kartochkalarining E4 uslubiga o'tishi; Dashboard
plitkasi; E9 `PageHeader`. Ochiq ariza formasida (`PublicApply`) hali
transport tanlovi turibdi.

Tekshiruv: `scratch/test_stats_full.mjs` — 13 holat (jamlanma, o'rtacha
davomiylik, oraliq filtri), hammasi o'tdi; brauzerda uchala tab va
o'quvchi profili.

### 5-bosqich. Transport to'lovi (ixtiyoriy, qaror kerak) ⬜  · Hajm: M

Agar transport pullik xizmat bo'lsa: marshrutga oylik narx → o'quvchiga oy boshida hisob (`services/ledger.js` dagi guruh hisobi kabi, alohida "TRANSPORT" bucket) → Moliyada ko'rinadi. Aks holda bosqich o'chiriladi.

### 6-bosqich. Sifat ⬜  · Hajm: S

Yorug' rejim, mobil (haydovchi ham, admin ham telefondan), tarjimalar (RU/EN — hozir 72 kalit bor), bo'sh holatlar (E11), `tsc`, skrinshotlar.

---

## 4. Qarorlar

Foydalanuvchi "qarab to'g'rilarini tanla" dedi (2026-09-09) — quyidagilar
tanlandi va shu bo'yicha ishlanmoqda.

| # | Savol | Tanlangan | Nega |
|---|---|---|---|
| Q1 | Kim qaysi mashinada — manba | **Marshrut** (`RouteStop`); `Student.transportId` olib tashlanadi | Ikki manba allaqachon bir-biridan ajralgan (0 ta vs 1 ta). Sinxronlash ikkinchi xatolar manbai |
| Q2 | Haydovchi vositasi | **Telegram bot** inline tugmalar bilan | Haydovchida kompyuter yo'q; botga allaqachon ulanadi |
| Q3 | Ota-onaga xabar | **Telegram**, SMS sozlamada ixtiyoriy | SMS pullik; hozir bazada atigi 1 ta ulangan TG bor, shuning uchun SMS zaxira sifatida kerak |
| Q4 | Toq/juft ma'nosi | **Hafta kuni**: Du/Cho/Ju = toq | `lib/lessons.js` allaqachon shunday hisoblaydi va unga pul hisobi bog'langan |
| Q5 | Reys vaqti | **Qo'lda**, ertalab/kechqurun alohida marshrut | Guruh jadvali bir necha xil, avtomatik olish noaniq |
| Q6 | Transport pullikmi | **Hozircha yo'q** | Foydalanuvchi aytmadi; keyin qo'shish oson, noto'g'ri hisob yozish qiyin qaytariladi |

---

## 5. Ish tartibi

1. Bir bosqich — bir yoki bir nechta kichik commit; har commit o'z-o'zidan ishlaydigan holat.
2. `tsc --noEmit` + `vite build` + brauzerda skrinshot (test admin, `scratch/shot_token.mjs`); bot uchun haqiqiy Telegram sinovi (haydovchi akkaunti).
3. Faqat o'z fayllari stage qilinadi; boshqa sessiya bilan bir faylda ishlanmaydi.
4. Baza o'zgarishi: `prisma migrate diff` → ko'rish → `db push` → shu zahoti kod push (baza jonli Supabase).
5. Bosqich tugaganda shu hujjatdagi belgi yangilanadi.
