# UI yangilash rejasi

Sariosiyo CRM · 2026-yil sentabr

Ikki bosqich, ketma-ket: avval **umumiy vizual tizim** (tokenlar), keyin **elementlar** birma-bir. Sahifalar oxirida — element tayyor bo'lgach, u ishlatilgan har bir sahifa o'z-o'zidan yangilanadi.

Belgilar: ✅ bajarilgan · 🟡 qisman · ⬜ boshlanmagan

---

## 0. Hozirgi holat — kod inventarizatsiyasi

38 ta komponent. Bir xil element har joyda qaytadan yozilgan:

| Element | Kodda nechta variant | Bo'lishi kerak |
|---|---|---|
| Asosiy tugma (`bg-[#1b6b6b]`) | **90** ta har xil klass satri | 1 ta `Button` |
| Input | **20** ta `inp`/`inputCls` konstantasi | 1 ta `Input` |
| Modal oyna | **27** ta, har biri o'z markapi bilan | 1 ta `Modal` |
| Holat yorlig'i (Faol/Qarzdor…) | **10** ta joyda bir xil klass takrorlangan | 1 ta `Badge` |
| Burchak radiusi | 8 xil (`2xl` 427, `xl` 405, `lg` 178, `full` 105, `[2rem]` 39, `md` 36 …) | 3 pog'ona |
| Ikonka o'lchami | 8 xil (14/16/18/12/13/11/15/24) | 3 pog'ona |
| Soya | 5 pog'ona (`sm` 222, `2xl` 53, `lg` 28, `xl` 13, `md` 15) | 2 pog'ona |
| Bo'sh holat matni | 7 xil yozuv | 1 ta `EmptyState` |

Bu raqamlar tuzatishning asosiy yo'lini belgilaydi: **bitta element — bitta ta'rif**. `src/components/ui/` papkasi ochiladi, har element bir marta yoziladi, sahifalar shundan foydalanadi.

---

## 1-bosqich. Umumiy vizual tizim

Hamma narsa `src/index.css` ichidagi `@theme` tokenlaridan chiqadi. Komponentlar rangni, o'lchamni qo'lda yozmaydi.

### 1.1 Rang

| | Hozir | Bo'lishi kerak | Holat |
|---|---|---|---|
| Brend | Sozlamadan tanlanadi, `--color-brand` orqali | Shu qoladi | ✅ |
| Kulrang shkala | Slate ohangida, oraliq pog'onalar (55, 150, 850…) bilan | Shu qoladi | ✅ (tuzatilgan — avval 370 klass ishlamasdi) |
| Semantik ranglar | `emerald / amber / rose / sky` to'g'ridan-to'g'ri yozilgan | `--color-good / --color-warn / --color-bad / --color-info` tokenlari | ⬜ |
| Sirt qatlamlari | `bg-white` · `bg-gray-55` · `dark:bg-gray-800` · `dark:bg-gray-900` aralash | 3 qatlam: `--surface-0` (fon), `--surface-1` (kartochka), `--surface-2` (kartochka ichi) | ⬜ |
| Chegara | `gray-100` / `gray-700/50` / `gray-800/50` aralash | `--line` bitta token, ikkala mavzuda | ⬜ |

### 1.1a Kelishilgan palitra — 22 token

Chizma tasdiqlangan (kanvas: `Komponentlar.dc.html`). Har token bitta ma'noni
bildiradi va ikkala mavzuda bir xil ma'noni saqlaydi — shuning uchun komponent
mavzuni bilishi shart emas, faqat tokenni chaqiradi.

| Token | Ma'nosi | Qorong'u | Yorug' |
|---|---|---|---|
| `fon` | sahifa foni | `#0f1216` | `#f4f6f5` |
| `sirt` | kartochka | `#171c25` | `#ffffff` |
| `sirt-2` | chap va yuqori panel | `#131720` | `#ffffff` |
| `ichki` | kartochka ichidagi maydon, input | `#181d26` | `#f4f6f5` |
| `chiziq` | asosiy chegara | `#232a35` | `#e3e8e5` |
| `chiziq-kuchli` | tugma va input chegarasi | `#2b323d` | `#dbe2de` |
| `chiziq-mayin` | jadval qatorlari orasi | `#1e242e` | `#eaefec` |
| `matn` | asosiy matn | `#e8ebef` | `#16211d` |
| `matn-2` | ikkilamchi matn, jadval qiymati | `#c3cad4` | `#3d4b45` |
| `matn-sokin` | ustun sarlavhasi, izoh | `#8b93a1` | `#71827b` |
| `matn-xira` | eng past daraja, yordamchi | `#6b7482` | `#8a978f` |
| `brend` | asosiy amal, faol holat | `#3ddad0` | `#0f7a6e` |
| `brend-ust` | brend ustidagi matn | `#0d1418` | `#ffffff` |
| `brend-fon` | brendning yumshoq foni, avatar | `#16302f` | `#ddefeb` |
| `yaxshi` | ijobiy qiymat, to'langan | `#3ddc97` | `#17803d` |
| `yaxshi-fon` | ijobiy fon | `#14302a` | `#dcf1e3` |
| `ogoh` | e'tibor talab qiladi | `#ffb547` | `#a86a00` |
| `ogoh-fon` | ogohlantirish foni | `#32281a` | `#fdf0dc` |
| `xato` | qarz, xato, salbiy | `#ff5d6c` | `#b4231f` |
| `xato-fon` | xato kartochkasi foni | `#2a1a1e` | `#fceeec` |
| `xato-chiziq` | xato kartochkasi chegarasi | `#4a2830` | `#f6d5d2` |
| `xato-mayin` | qizil fon ustidagi matn | `#ff8a95` | `#a45a54` |

Tekshirildi: yettita ekranning hech birida shu ro'yxatdan tashqari rang yo'q
(`design/tekshir.py`).

### 1.1b Chizmadan chiqqan qoidalar

Bular ekranlarni chizishda topilgan va tuzatilgan xatolar. Kodda ham xuddi
shunday bo'lishi kerak.

1. **Sahifa pastida o'lik bo'shliq bo'lmaydi.** Mazmun ramkani to'ldirishi
   kerak: ro'yxat yetarlicha qator ko'rsatadi, kartochkalar mazmunga teng.
   Aksincha qilish ham xato — qatorlarni cho'zib bo'shliqni yopish 4 ta
   qatorni 130px ga aylantiradi.
2. **Har bir progress chizig'i tagida u nimaning ulushi ekani yozilishi
   shart.** Izohsiz chiziq hech narsa anglatmaydi.
3. **Ogohlantirish rangi raqamning o'ziga tushmaydi**, izohga tushadi.
   «Guruhlar 5» sariq bo'lsa, go'yo 5 yomon son. Muammo izohda: bittasiga
   ustoz yo'q.
4. **Katta raqamlar monoshriftda emas.** 27px da JetBrains Mono «0 , 5» bo'lib
   yoyilib ketadi. Jadval ustunlari — `.num` (mono), katta ko'rsatkichlar —
   `.raqam` (Sora + `tabular-nums`).
5. **0% ko'rsatkichda chiziq umuman chizilmaydi.** Ingichka dumcha go'yo biror
   ish qilingandek ko'rinadi.
6. **Grafik o'qi qiymat oralig'iga moslanadi.** Davomat 47–58 orasida
   o'zgarsa, noldan chizilgan ustunlar bir xil bo'lib qoladi va grafik hech
   narsa ko'rsatmaydi.
7. **Ro'yxatdagi bog'lanish ustuni butunlay havola rangida bo'lmaydi** —
   12 ta ko'k qator ko'zni charchatadi. Kichik belgi (chip) shaklida.

### 1.2 Tipografika

| | Hozir | Bo'lishi kerak | Holat |
|---|---|---|---|
| Matn shrifti | Inter | Shu qoladi | ✅ |
| Raqam shrifti | JetBrains Mono, `.num` klassi | Shu qoladi; `tabular-nums` qolgan joylarga ham `.num` | 🟡 |
| Og'irlik shkalasi | `black` 780, `extrabold` 700 ga pasaytirilgan | Shu qoladi | ✅ |
| Bosh harflar | Faqat ≤11px yorliqlarda | Shu qoladi | ✅ |
| O'lcham shkalasi | 7/9/10/11/12/13/14/15/26/30px — 10 xil | 6 pog'ona: 11 · 12 · 13 · 15 · 20 · 28 | ⬜ |
| Sarlavha ierarxiyasi | Sahifa sarlavhasi 26px ✅, bo'lim sarlavhasi 14–15px aralash | `h1` 28 · `h2` 20 · `h3` 15 · yorliq 11 | 🟡 |

### 1.3 Bo'shliq, radius, soya

| | Hozir | Bo'lishi kerak | Holat |
|---|---|---|---|
| Kartochka ichki to'ldirishi | `p-4` / `p-5` / `p-6` / `p-8` | `p-5` (ichki kichik: `p-4`) | 🟡 |
| Radius | 8 xil | `lg` (tugma, input, chip) · `2xl` (kartochka) · `full` (avatar, nuqta) | ⬜ |
| Soya | 5 pog'ona, kartochkalarda ham | Kartochka — soyasiz, faqat chegara; modal — `shadow-2xl` | 🟡 |
| Majburiy balandlik | `min-h-[500px]` va shunga o'xshash 7 joyda edi | Yo'q — balandlik kontentdan | ✅ |

### 1.4 Ikonka va harakat

| | Hozir | Bo'lishi kerak | Holat |
|---|---|---|---|
| Ikonka o'lchami | 8 xil | 13 (matn ichida) · 16 (tugma) · 20 (navigatsiya) | ⬜ |
| Ikonka qutisi (rangli kvadrat) | Statistika kartalaridan olib tashlangan; ro'yxatlarda hali bor | Faqat ro'yxat qatorida, 36px, neytral | 🟡 |
| Hover | `hover:shadow-md`, `-translate-y-0.5`, `scale-105` aralash | Faqat chegara/fon rangi o'zgaradi (`transition-colors`) | 🟡 |
| Animatsiya | `animate-in fade-in`, `animate-pulse` | Sahifa kirishida yo'q; faqat yuklanish spinneri | ⬜ |

### 1.5 Mavzu

| | Hozir | Bo'lishi kerak | Holat |
|---|---|---|---|
| Qorong'u rejim | Asosiy; tekshirilgan | — | ✅ |
| Yorug' rejim | Dashboard tekshirilgan, qolgani yo'q | Har sahifa ikkala mavzuda skrinshot | 🟡 |
| Yuklanish ekrani | Mavzuga mos | — | ✅ (tuzatilgan) |

---

## 2-bosqich. Elementlar — ketma-ket

Har element uchun: `src/components/ui/<Nom>.tsx` yoziladi → mavjud sahifalardagi takrorlar unga almashtiriladi → brauzerda tekshiriladi → commit. Keyingi elementga shundan keyin o'tiladi.

Tartib — eng ko'p takrorlangandan boshlab:

### E1. Button ⬜
- **Hozir:** 90 ta variant. Bir sahifada uch xil balandlik, ikki xil radius, ba'zida bosh harf, ba'zida `shadow-lg` yog'du.
- **Spetsifikatsiya:** `variant = primary | secondary | ghost | danger`, `size = sm | md`. Balandlik `md` 40px, `sm` 32px. Radius `lg`. Yozuv 13px oddiy. Soya yo'q. Ikonka 16px.
- **Qayerda:** hamma sahifada.
- **Hajm:** L (90 joy).

### E2. Input / Select / Textarea ⬜
- **Hozir:** 20 ta `inp` konstantasi, `text-xs font-bold` ichki matn, `rounded-2xl` — tugmadan kattaroq radius.
- **Spetsifikatsiya:** balandlik 40px, radius `lg`, matn 13px oddiy, `focus` — brend chegara. Yorliq 11px kulrang ustida. Select — o'sha ko'rinish + o'ng strelka.
- **Qayerda:** modallar, filtrlar, sozlama.
- **Hajm:** M.

### E3. Chip / Badge ⬜
- **Hozir:** holat yorlig'i 10 joyda bir xil klass bilan qayta yozilgan; filtr chiplari uch sahifada uch xil.
- **Spetsifikatsiya:** `Badge tone=good|warn|bad|info|neutral` (holat uchun, 11px) va `Chip active count` (filtr uchun, 12px, `rounded-lg`).
- **Qayerda:** O'quvchilar, Guruhlar, Lidlar, profil, jadvallar.
- **Hajm:** M.

### E4. Tabs 🟡
- **Hozir:** profilda pill (✅), guruh sahifasida chiziqli, Moliya va Xodim profilida bosh harfli eski uslub.
- **Spetsifikatsiya:** bitta `Tabs` — pill uslubi (faol: brend fon, oq yozuv), ikonkasiz.
- **Qayerda:** O'quvchi profili ✅, Guruh sahifasi, Moliya, Xodim profili, Dashboard hisobotlar, Sozlama.
- **Hajm:** S.

### E5. Card / Surface 🟡
- **Hozir:** `rounded-3xl` + `shadow-sm` + `border` — uchchalasi birga; ichki panellar `bg-gray-55` bilan.
- **Spetsifikatsiya:** `Card` — `--surface-1`, `--line` chegara, `rounded-2xl`, soyasiz. `Card.Inner` — `--surface-2`. Sarlavha bo'lsa `Card.Header` (15px, ostida chiziq).
- **Hajm:** M.

### E6. StatTile ✅ → 🟡
- **Hozir:** Dashboard, guruh sahifasi, profil, hisobotlar — to'rt joyda alohida yozilgan, lekin bitta ko'rinishda.
- **Qolgani:** to'rttasini bitta `StatTile` ga birlashtirish (`label, value, unit, sub, tone, bar`).
- **Hajm:** S.

### E7. Table ⬜
- **Hozir:** Guruh sahifasi, Xodimlar, Guruhlar (jadval rejimi) — uchta alohida markap, sarlavha 11px kulrang ✅, qator 13px ✅.
- **Spetsifikatsiya:** `Table` — sarlavha, hover qator, `num` ustunlar o'ngga, harakat tugmalari hover'da. Mobil: `overflow-x-auto`.
- **Qayerda:** yuqoridagilar + O'quvchilar ro'yxati, Moliya to'lovlar.
- **Hajm:** M.

### E8. ListRow ⬜
- **Hozir:** profil to'lovlari, ballari, guruhlari, harakatlar tasmasi, Dashboard "Bugun hal qilinsin" — beshta o'xshash, alohida yozilgan.
- **Spetsifikatsiya:** `ListRow` — chapda 36px ikonka/avatar, o'rtada sarlavha + izoh, o'ngda qiymat + sana + yorliq.
- **Hajm:** M.

### E9. PageHeader ✅ → 🟡
- **Hozir:** Lidlar, Guruhlar, O'quvchilar, Moliya, Xodimlar, Sozlama, Dashboard — bitta uslubda ✓. Imtihon, Xabarlar, Logistika, Davomat, Jadval — eski (ikonka kvadrati + kartochka).
- **Qolgani:** `PageHeader title meta actions` komponenti va besh sahifaga qo'llash.
- **Hajm:** S.

### E10. Modal ⬜
- **Hozir:** 27 ta, har biri o'z fon/radius/sarlavha markapi bilan; `rounded-[2rem]` va `[2.5rem]` shu yerdan.
- **Spetsifikatsiya:** `Modal title size onClose` — fon `bg-gray-950/60 backdrop-blur`, panel `rounded-2xl`, sarlavha 15px, pastda tugmalar o'ngda.
- **Hajm:** L (27 joy).

### E11. EmptyState / Loading ⬜
- **Hozir:** 7 xil bo'sh holat matni; yuklanish — `Yuklanmoqda…` spinner ✅.
- **Spetsifikatsiya:** `EmptyState icon title hint action` — 12px kulrang, markazda, `py-10`.
- **Hajm:** S.

### E12. Toast ⬜
- **Hozir:** bitta joyda (`Layout`), `shadow-2xl`, `backdrop-blur`.
- **Spetsifikatsiya:** o'sha, faqat soya pasaytiriladi; `tone` semantik tokenlardan.
- **Hajm:** XS.

### E13. Avatar ⬜
- **Hozir:** har sahifada alohida — initsial + rang gradient, `object-top` faqat 3 joyda.
- **Spetsifikatsiya:** `Avatar src name size` — `object-top`, initsial neytral fonda, 28/36/96px.
- **Hajm:** S.

### E14. Chart ⬜
- **Hozir:** Dashboard ustunlari ✅ (qiymat tepada), Moliya chiziqli grafik eski uslubda (bosh harfli yorliqlar, nuqtalar).
- **Spetsikasiya:** ustun va chiziq — mavzu tokenlaridan rang, `num` yorliqlar, eng baland nuqta ajratilgan.
- **Hajm:** M.

---

## 3-bosqich. Sahifalarga qo'llash

Elementlar tayyor bo'lgach, sahifa faqat ularni terib chiqadi. Tartib:

| # | Sahifa | Nima qoladi | Holat |
|---|---|---|---|
| 1 | Dashboard | E6, E8 ga o'tkazish | 🟡 |
| 2 | Guruhlar + Guruh sahifasi | E4, E7 | 🟡 |
| 3 | O'quvchilar + Profil | E7, E8 | 🟡 |
| 4 | Xodimlar + Xodim profili | KPI qatori, guruhlar jadvali, oylik kartasi (E6, E7) | ⬜ |
| 5 | Moliya | E4, E14, "To'lov usullari", "Eng katta qarzdorlar" | 🟡 |
| 6 | Lidlar | E3 | ✅ |
| 7 | O'quv reja | tugmalar E1 | 🟡 |
| 8 | Sozlama | E2, E4 | 🟡 |
| 9 | Imtihon, Xabarlar, Logistika, Davomat, Jadval | E9 + E1–E7 | ⬜ |
| 10 | Yorug' rejim — hamma sahifa | tekshirish | ⬜ |
| 11 | Mobil — hamma sahifa | tekshirish | ⬜ |

Bazaga kerak maydonlar (qaror 2a bo'yicha qo'shiladi): `Course.level`, `Course.durationMonths`, `Teacher.rating`, `Setting.monthlyRevenuePlan`, `Payment.acceptedById`, `Score.type`, `Lead.telegramId`, `Lead.trialAt`. Ular 3-bosqichning 4–6-qadamlarida ishlatiladi.

---

## 4. Ish tartibi (har qadam uchun)

1. Bitta element yoki sahifa — bitta commit.
2. `tsc` + `vite build` + **brauzerda skrinshot** (test admin bilan, `scratch/shot.mjs`). Ko'rilmagan narsa "tayyor" deyilmaydi.
3. Faqat o'z fayllari stage qilinadi (`git add <fayl>`), `git add -A` yo'q — bu papkada boshqa sessiya ham ishlagan.
4. Bazada yo'q raqam ko'rsatilmaydi; blok bo'sh qoladi.
5. Referens — yo'nalish, nusxa emas: bizdagisi yaxshiroq bo'lsa (masalan Dashboard sana filtri) — qoladi.

## 5. Ketma-ketlik — keyingi qadamlar

Dizayn bosqichi yakunlandi: vizual tizim va yettita ekran chizilib, tasdiqlandi. Endi kod shu chizmalarga keltiriladi.

```
1-bosqich  tokenlar: semantik ranglar, sirt qatlamlari, chegara, o'lcham shkalasi   (M)
E1   Button                                                                        (L)
E2   Input / Select                                                                (M)
E3   Chip / Badge                                                                  (M)
E4   Tabs                                                                          (S)
E5   Card                                                                          (M)
E6   StatTile birlashtirish                                                        (S)
E7   Table                                                                         (M)
E8   ListRow                                                                       (M)
E9   PageHeader — qolgan 5 sahifa                                                  (S)
E10  Modal                                                                         (L)
E11–E14                                                                            (S+XS+S+M)
3-bosqich  sahifalar 4 → 5 → 9 → 10 → 11
```

Hajm: XS — 1 soatgacha · S — 1–2 soat · M — yarim kun · L — bir kun.
