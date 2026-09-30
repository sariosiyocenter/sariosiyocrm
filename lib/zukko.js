// Zukko suhbati: xodim savoli → Gemini → vositalar (lib/zukkoVositalar.js) → javob.
//
// Model faqat vositalar qaytargan ma'lumotni ko'radi (telefon va manzilsiz);
// ekranga esa vositaning kartochkasi (blok) to'liq chiqadi — AI aytgan har bir
// raqamning manbasi yonida turadi. Amallar (lib/zukkoAmallar.js — to'lov,
// yo'qlama, o'quvchi, kurs, lid, xarajat, xabar, xodim...) faqat taklif:
// kartochkani xodim tasdiqlaydi, bajarish odatdagi API orqali.
//
// Kvota: bepul Gemini kaliti daqiqasiga ~10 so'rov beradi. Bir savolga ko'pi
// bilan MAKS_QADAM chaqiruv; oddiy savollar uchun qisqa holat tizim matnida
// tayyor turadi — vosita chaqirmasdan javob beriladi.

import { modelgaSora, aiKaliti, AiXato } from './imtihonAI.js';
import { ROL_NOMLARI } from './ruxsatlar.js';
import { toTimeStr } from './lessons.js';
import { ruxsatliVositalar, vositaniBajar, korsatkichlar, haftaKuni, haftaKuniNomi, kunQosh } from './zukkoVositalar.js';
import { ruxsatliAmallar, amalniTayyorla } from './zukkoAmallar.js';

const MAKS_QADAM = 5;
const MAKS_CHAQIRUV = 4;   // bir qadamda nechta vosita (parallel chaqiruvlar)

// Sinov uchun: haqiqiy Gemini o'rniga ({ contents, config }) => { functionCalls?, text?, candidates? }.
let soxta = null;
export function zukkoSoxtaModel(f) { soxta = f; }
export const zukkoTayyormi = () => !!aiKaliti() || !!soxta;

async function chaqir(contents, tizim, vositalar, { faqatMatn = false } = {}) {
  const config = {
    systemInstruction: tizim,
    temperature: 0.2,
    maxOutputTokens: 2048,
    ...(vositalar.length ? {
      tools: [{ functionDeclarations: vositalar }],
      toolConfig: { functionCallingConfig: { mode: faqatMatn ? 'NONE' : 'AUTO' } },
    } : {}),
  };
  if (soxta) return soxta({ contents, config });
  // 2.5 modellarida "o'ylash" o'chiriladi: javob tezroq, vosita tanlash baribir to'g'ri.
  return modelgaSora(aiKaliti(), (model) => ({
    contents,
    config: /2\.5/.test(model) ? { ...config, thinkingConfig: { thinkingBudget: 0 } } : config,
  }));
}

// Qisqa holat tizim matni uchun: bir xodimga 60 soniya keshda (har savolda
// 10 ta so'rov bazaga bormasin).
const holatKeshi = new Map();
async function qisqaHolat(k) {
  const kalit = `${k.user.id}:${k.maktablar.join(',')}`;
  const hit = holatKeshi.get(kalit);
  if (hit && Date.now() - hit.at < 60_000) return hit.qiymat;
  const qiymat = await korsatkichlar(k).catch(() => null);
  holatKeshi.set(kalit, { at: Date.now(), qiymat });
  if (holatKeshi.size > 500) holatKeshi.delete(holatKeshi.keys().next().value);
  return qiymat;
}

function tizimMatni(k, sahifa, holat) {
  const b = k.bugun;
  const dushanba = kunQosh(b, -((haftaKuni(b) + 6) % 7));
  const oyBoshi = `${b.slice(0, 8)}01`;
  const otganOyOxiri = kunQosh(oyBoshi, -1);
  const otganOyBoshi = `${otganOyOxiri.slice(0, 8)}01`;
  const sahifaQatori = sahifa?.tur === 'oquvchi'
    ? `Xodim hozir o'quvchi profilida: ${sahifa.nom} (id ${sahifa.id}). «Bu o'quvchi», «u», «uning» — shu o'quvchi.`
    : sahifa?.tur === 'kurs'
      ? `Xodim hozir kurs sahifasida: ${sahifa.nom} (kursId ${sahifa.id}). «Bu kurs», «shu kurs» — shu kurs.`
      : sahifa?.sahifa ? `Xodim hozir «${sahifa.sahifa}» sahifasida.` : '';
  return [
    `Sen — Zukko, «${k.markaz}» o'quv markazi CRM tizimidagi yordamchisan. Xodimlarga markaz ma'lumotlari bo'yicha tez va aniq javob berasan.`,
    `Xodim: ${k.user.name || '—'} (${ROL_NOMLARI[k.user.role] || k.user.role}). Filial: ${k.filialMatni}.`,
    `Bugun ${b}, ${haftaKuniNomi(b)}, soat ${toTimeStr()} (Toshkent vaqti). Kecha: ${kunQosh(b, -1)}. Bu hafta: ${dushanba} dan. Bu oy: ${oyBoshi} — ${b}. O'tgan oy: ${otganOyBoshi} — ${otganOyOxiri}.`,
    '',
    'QOIDALAR',
    "1. Faqat vositalar qaytargan ma'lumotga va quyidagi qisqa holatga tayan. Raqam, ism yoki sanani o'ylab topma; topilmasa — ochiq ayt.",
    "2. Atamalar: «kurs» — o'quv guruhi (masalan «Ingliz A1 14:00»), «fan» — predmet (Matematika). «Guruh» so'zini ishlatma.",
    "3. Pul — so'mda, raqamni guruhlab yoz: 1 200 000 so'm. Balans manfiy bo'lsa — qarz.",
    "4. Qisqa yoz: 1–4 gap yoki 3–6 bandli ro'yxat. Vosita natijasi ekranda kartochka bo'lib chiqadi — ro'yxatni to'liq takrorlama: asosiy xulosa, eng muhim 2–3 nom va keyingi qadam.",
    "5. Savol qaysi tilda bo'lsa (o'zbek lotin yoki rus), shu tilda javob ber.",
    "6. AMALLAR: xodim biror ishni bajarishni so'rasa (to'lov qabul qilish, yo'qlama, o'quvchi yoki lid qo'shish, kursga qo'shish/chiqarish, holat, xarajat, xabar, oylik, xona...) — tegishli amal vositasini chaqir. Amal darhol bajarilmaydi: xodimga tasdiqlash kartochkasi chiqadi. Javobda qisqa ayt va «kartochkani tekshirib, tasdiqlang» de; «bajarildi» dema.",
    "7. Amal uchun muhim ma'lumot aytilmagan bo'lsa (to'lov summasi, kim, qaysi kurs) — taxmin qilma, qisqa so'ra. To'lov turi aytilmasa — Naqd, sana aytilmasa — bugun (kartochkada ko'rinadi). O'quvchi, kurs, xodim, lidni ism, telefon, ID yoki id bilan berish mumkin; vosita bir nechta mos topsa — variantlarni sanab, qaysi biri ekanini so'ra. Bir nechta amal so'ralsa — har biri uchun alohida chaqir. Xavfli amaldan (o'chirish, kursdan chiqarish, SMS) oldin oqibatini bir gapda ayt. Katalogda yo'q ish (imtihon tuzish, logistika rejasi, sozlamalar, ruxsatlar, parol) — sahifani_ochish.",
    "8. Vosita «xato» qaytarsa yoki vosita yo'q bo'lsa — sababini qisqa ayt (masalan ruxsat yo'qligini).",
    "9. Telefon raqamlar senga berilmaydi; so'ralsa — kartochkada ko'rinishini ayt.",
    "10. Formatlash: **qalin** va «- » bilan ro'yxat. Jadval, sarlavha va kod bloki ishlatma.",
    "11. Ism yoki kurs noaniq bo'lsa (bir nechta mos), variantlarni sanab, qaysi biri ekanini so'ra.",
    "12. Xabarda «[Biriktirilgan fayllar: ...]» bo'lsa — bu odatda test/savollar fayli. Savollarni bankka yoki imtihonga qo'shish so'ralsa — savol_yuklash (fan va imtihonni xabardan ol; fan aytilmagan va imtihon bitta fanli bo'lmasa — so'ra). Fayl mazmunini sen ko'rmaysan: uni savol yuklash oynasi o'qiydi va tekshiradi.",
    '',
    sahifaQatori,
    holat ? `QISQA HOLAT (hozir, bazadan): ${JSON.stringify(holat)}` : '',
  ].filter(x => x !== null).join('\n');
}

/** Mijoz yuborgan tarix → Gemini contents. Oxirgi 10 ta, jami ~8000 belgi. */
function tarixniTayyorla(tarix) {
  const toza = (Array.isArray(tarix) ? tarix : [])
    .filter(t => t && (t.rol === 'user' || t.rol === 'model') && typeof t.matn === 'string' && t.matn.trim())
    .slice(-10)
    .map(t => ({
      role: t.rol,
      text: (t.matn.slice(0, 1500) + (t.rol === 'model' && t.dalil ? `\n[Ekranda ko'rsatilgan: ${String(t.dalil).slice(0, 600)}]` : '')).trim(),
    }));
  let jami = 0;
  const natija = [];
  for (let i = toza.length - 1; i >= 0; i--) {
    jami += toza[i].text.length;
    if (jami > 8000) break;
    natija.unshift({ role: toza[i].role, parts: [{ text: toza[i].text }] });
  }
  // Gemini suhbati user bilan boshlanishi kerak.
  while (natija.length && natija[0].role !== 'user') natija.shift();
  return natija;
}

// Keyingi savol takliflari — ishlatilgan vositaga qarab (AI siz).
const KEYINGI = {
  qarzdorlar: [["30 kundan beri to'lamaganlar kim?", 'qarzdorlar'], ['Ularga qarz eslatmasi yubor', 'qarz_eslatmasi'], ["Qaysi kursda qarz ko'p?", 'qarzdorlar']],
  darslar: [['Bugun kim kelmadi?', 'davomat'], ["Yo'qlama qilinmagan kurslar qaysi?", 'darslar']],
  davomat: [["Shu hafta eng ko'p dars qoldirganlar", 'davomat'], ['Qaysi kursda davomat past?', 'davomat']],
  tushum: [["O'tgan oy bilan solishtir", 'tushum'], ['Shu oy xarajatlar qancha?', 'xarajatlar']],
  xarajatlar: [['Shu oy tushum qancha?', 'tushum']],
  lidlar: [["Qaysi manbadan ko'p lid keladi?", 'lidlar'], ['2 kundan beri javobsiz lidlar', 'lidlar']],
  kurslar: [['Shu kurs qarzdorlari', 'qarzdorlar'], ['Shu kurs davomati', 'davomat']],
  oquvchi_kartasi: [['Uning davomati batafsil', 'davomat'], ["Izohiga yozib qo'y: ", 'oquvchi_izoh'], ["To'lov qabul qil: ", 'tolov_qabul']],
  oquvchi_qidir: [["Birinchisining kartochkasi", 'oquvchi_kartasi']],
  xonalar: [["Ertaga 15:00 da qaysi xona bo'sh?", 'xonalar']],
  korsatkichlar: [['Bugungi darslar', 'darslar'], ["Qarzdorlar ro'yxati", 'qarzdorlar']],
};

/**
 * Bitta savol. `yubor(hodisa)` — ekranga oqim:
 *   { t: 'qadam', id, matn, holat: 'ish'|'tayyor'|'xato', izoh? }  — AI nima qilyapti
 *   { t: 'blok', blok }        — vosita kartochkasi (manba)
 *   { t: 'amal', amal }        — tasdiqlanadigan amal taklifi
 *   { t: 'matn', matn }        — javob
 *   { t: 'takliflar', takliflar } — keyingi savollar
 * `toxtadimi()` — mijoz uzilgan bo'lsa true (kvota behuda ketmasin).
 */
export async function zukkoSuhbat({ k, savol, tarix, sahifa, fayllar = [], yubor, toxtadimi = () => false }) {
  const vositalar = ruxsatliVositalar(k);
  const amallar = ruxsatliAmallar(k);
  const elonlar = [
    ...vositalar.map(v => ({ name: v.nom, description: v.tavsif, parametersJsonSchema: v.parametrlar })),
    ...amallar.map(a => ({ name: a.nom, description: `${a.tavsif} Tasdiqlash kartochkasi chiqadi.`, parametersJsonSchema: a.parametrlar })),
  ];
  const holat = await qisqaHolat(k);
  const tizim = tizimMatni(k, sahifa, holat);
  const faylQatori = fayllar.length ? `\n\n[Biriktirilgan fayllar: ${fayllar.map(f => `${f.nom}${f.tur ? ` (${f.tur})` : ''}`).join(', ')}]` : '';
  const contents = [...tarixniTayyorla(tarix), { role: 'user', parts: [{ text: String(savol).slice(0, 2000) + faylQatori }] }];

  const ishlatilgan = new Set();
  let bloklar = 0;
  let matn = '';
  for (let qadam = 0; qadam < MAKS_QADAM && !toxtadimi(); qadam++) {
    const oxirgi = qadam === MAKS_QADAM - 1;
    const javob = await chaqir(contents, tizim, elonlar, { faqatMatn: oxirgi });
    const chaqiruvlar = javob?.functionCalls || [];
    if (!chaqiruvlar.length || oxirgi) {
      matn = String(javob?.text || '').trim();
      break;
    }
    const modelQismi = javob?.candidates?.[0]?.content;
    contents.push(modelQismi?.parts?.length ? modelQismi : { role: 'model', parts: chaqiruvlar.map(c => ({ functionCall: c })) });

    const javoblar = [];
    // Ketma-ket: har vosita bir nechta so'rovni parallel qiladi, baza hovuzi kichik.
    // Gemini har bir chaqiruvga javob kutadi — chegaradan oshgani ham javob oladi.
    for (let i = 0; i < chaqiruvlar.length; i++) {
      const c = chaqiruvlar[i];
      if (i >= MAKS_CHAQIRUV) {
        javoblar.push({ functionResponse: { ...(c.id ? { id: c.id } : {}), name: c.name, response: { xato: `Bir qadamda ko'pi bilan ${MAKS_CHAQIRUV} ta vosita — keyingi qadamda so'rang` } } });
        continue;
      }
      const v = vositalar.find(x => x.nom === c.name);
      const amal = v ? null : amallar.find(x => x.nom === c.name);
      const id = `${qadam}.${i}`;
      yubor({ t: 'qadam', id, matn: v?.qadam?.(c.args || {}) || amal?.qadam || c.name, holat: 'ish' });
      const natija = amal ? await amalniTayyorla(k, c.name, c.args || {}) : await vositaniBajar(k, c.name, c.args || {});
      ishlatilgan.add(c.name);
      yubor({ t: 'qadam', id, holat: natija.xato ? 'xato' : 'tayyor', izoh: natija.xato || natija.xulosa || '' });
      if (natija.blok) { yubor({ t: 'blok', blok: natija.blok }); bloklar++; }
      if (natija.amal) yubor({ t: 'amal', amal: natija.amal });
      javoblar.push({
        functionResponse: {
          ...(c.id ? { id: c.id } : {}),
          name: c.name,
          response: natija.xato ? { xato: natija.xato } : { natija: natija.model },
        },
      });
    }
    contents.push({ role: 'user', parts: javoblar });
  }

  // Bo'sh javob (bepul kalitda uchraydi): bir marta faqat matn so'raladi.
  if (!matn && !toxtadimi()) {
    try {
      contents.push({ role: 'user', parts: [{ text: "Yuqoridagi ma'lumotlar asosida xodimga qisqa javob yozing." }] });
      const javob = await chaqir(contents, tizim, elonlar, { faqatMatn: true });
      matn = String(javob?.text || '').trim();
    } catch (e) {
      if (!(e instanceof AiXato) || !bloklar) throw e;
    }
  }
  if (!matn) matn = bloklar ? "Ma'lumotlar yuqoridagi kartochkada." : "Javob olinmadi — savolni boshqacha yozib ko'ring.";
  yubor({ t: 'matn', matn });

  const ruxsatli = new Set([...vositalar.map(v => v.nom), ...amallar.map(a => a.nom)]);
  const takliflar = [];
  for (const nom of ishlatilgan) {
    for (const [s, kerak] of KEYINGI[nom] || []) {
      if (ruxsatli.has(kerak) && !takliflar.includes(s) && takliflar.length < 3) takliflar.push(s);
    }
  }
  if (takliflar.length) yubor({ t: 'takliflar', takliflar });
}
