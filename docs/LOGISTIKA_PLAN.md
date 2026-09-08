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

### 1-bosqich. Ma'lumot modeli — bitta haqiqat (X1, X4, X11) ⬜  · Hajm: M

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

### 2-bosqich. Haydovchi — Telegram bot ⬜  · Hajm: L

- Haydovchini botga ulash (xodimlar uchun mavjud ulash yo'li tekshiriladi; yo'q bo'lsa HR'dan bir martalik kod).
- "🚌 Bugungi marshrutlar" → reyslar ro'yxati (kun filtri 0-bosqichdagi funksiya bilan) → reys → **inline tugmalar**: `▶️ Boshladim`, har o'quvchi uchun `✅ Oldim | ❌ Kelmadi | 🗺 Yo'l` (Google/Yandex havolasi `Student.location`, bo'lmasa manzil), oxirida `⏹ Tugatdim`.
- Qaytish reysida `🏠 Yetkazdim`.
- Har bosish → `DeliveryLog` (runId, markedById = haydovchi, markedAt = hozir).
- Xatoga chidamli: qayta bosish holatni o'zgartiradi, eskisini yozib qo'ymaydi; 4096 belgi chegarasi uchun bo'laklab yuborish.
- **Natija:** yetkazish yozuvi haydovchi qo'lida paydo bo'ladi — modul "tirik" bo'ladi.

### 3-bosqich. Ota-onaga xabar ⬜  · Hajm: M

- `sendToOne` (Xabarlar moduli) orqali: kanal Telegram (ota/ona/o'quvchi ulangan bo'lsa), keyin SMS (Eskiz — pullik, sozlamada yoqish/o'chirish).
- Trigger: `OLINDI` va `YETKAZILDI` yozilganda. `KELMADI` → adminlarga (`notifyAdmins`) va ota-onaga "bugun mashina keldi, chiqmadi".
- Shablonlar Xabarlar → Shablonlar ichida (`{oquvchi}`, `{vaqt}`, `{transport}`, `{haydovchi}`), avtomatik qoida sifatida — mavjud `AutoMessageRule` mexanizmiga yangi hodisa turi.
- **Natija:** ota-ona hech narsa so'ramay xabardor.

### 4-bosqich. Admin sahifasi — `Logistics.tsx` qayta ⬜  · Hajm: L

Sahifa E9 `PageHeader` uslubiga o'tadi (UI rejasi bilan bir vaqtda). Tablar:

1. **Bugun** — reyslar kartochkalari: marshrut, haydovchi, transport, `4/6` progress, boshlangan/tugagan vaqt, kechikish (startTime + 15 min o'tsa sariq), kelmaganlar ro'yxati. Admin ham belgilashi mumkin (haydovchi telefoni o'chgan holat uchun) — bu hozirgi "Kunlik holat" ning o'rnini bosadi (X5 ni ham yopadi: reys marshrutdan keladi, transportdan emas).
2. **Marshrutlar** — chapda ro'yxat (kun, vaqt, yo'nalish, sig'im `6/6` ko'rsatkichi — to'lsa qizil, X12), o'ngda **xarita**: bekatlar o'quvchi portreti bilan, markaz logosi (`StudentLocationMap` dan umumiy `LeafletMap` komponenti ajratiladi), chiziq tartib bo'yicha; ro'yxatda sudrab tartiblash (↑↓ qoladi, sudrash qo'shiladi); "Yaqinidan boshlab tartibla" tugmasi (masofa bo'yicha oddiy greedy). Koordinatasi yo'q o'quvchi sariq belgi bilan — profilga havola.
3. **Flot** — hozirgi kartochkalar E4 uslubida; haydovchi `User` dan (nom/telefon nusxasi olib tashlanadi, X-dublikat); holat `Ta'mirda` bo'lsa reyslar sahifasida ogohlantirish.
4. **Tarix** — sana oralig'i → jadval: o'quvchi × kunlar (✅/❌/—), haydovchi bo'yicha reys soni, o'rtacha davomiylik; Excel eksport (mavjud `xlsx` bilan).

Qo'shimcha:
- O'quvchi profili → "Transport" kartasi: marshruti, haydovchi, so'nggi 10 reys.
- Dashboard → "Bugungi reyslar 3/4 · 2 kelmadi" plitka (Logistika sahifasiga havola).
- **Natija:** admin bir ekranda hamma narsani ko'radi.

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
