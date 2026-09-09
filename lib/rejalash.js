/**
 * O'quvchilarni mashinalar bo'yicha taqsimlash (sig'imli marshrutlash).
 *
 * Masala: markaz, N ta uy va sig'imi cheklangan mashinalar berilgan.
 * Har bir uyga bir marta borilsin, hech bir mashinaga sig'imidan ortiq
 * bola tushmasin, umumiy yo'l imkon qadar qisqa bo'lsin.
 *
 * Usul — Clarke-Wright "savings" (1964), yuk tashishda hozirgacha eng ko'p
 * ishlatiladigan amaliy usul:
 *   1. Har bir uy o'zicha alohida reys: markaz → uy → markaz.
 *   2. Ikki reysni birlashtirsak qancha yo'l tejaladi:
 *      tejam(i,j) = d(markaz,i) + d(markaz,j) − d(i,j)
 *   3. Tejami kattadan boshlab birlashtiriladi — sig'im yetsa.
 * So'ng har bir reys ichidagi tartib 2-opt bilan tekislanadi.
 *
 * Bola yo'lda necha daqiqa o'tirishi cheklanmaydi: qishloq sharoitida uzoq
 * yurish odatiy hol, sig'im esa qat'iy — mashinaga sig'magan bola qolib
 * ketadi. Shuning uchun sig'im yagona qattiq shart.
 *
 * Fayl sof: bazaga ham, brauzerga ham bog'liq emas.
 */
import { distanceKm, ochiqYol, parseLatLng } from './tartib.js';

/** O'rtacha tezlik (km/soat) — qishloq yo'llari uchun ehtiyotkor baho. */
export const ORTACHA_TEZLIK = 25;
/** Bitta bekatda ketadigan vaqt (daqiqa): to'xtash, kutish, o'tirish. */
export const BEKAT_DAQIQA = 1.5;

/** Reys davomiyligi bahosi, daqiqa. */
export function reysDaqiqasi(km, bekatSoni) {
  return Math.round((km / ORTACHA_TEZLIK) * 60 + bekatSoni * BEKAT_DAQIQA);
}

/** "07:30" + 45 → "08:15" (sutkadan oshsa 23:59 da to'xtaydi). */
export function vaqtQoshish(vaqt, daqiqa) {
  const [h, m] = String(vaqt || '07:30').split(':').map(Number);
  const jami = Math.min(h * 60 + m + daqiqa, 23 * 60 + 59);
  return `${String(Math.floor(jami / 60)).padStart(2, '0')}:${String(jami % 60).padStart(2, '0')}`;
}

/**
 * Clarke-Wright: uylarni sig'imga sig'adigan guruhlarga bo'ladi.
 *
 * @param {[number,number]} markaz
 * @param {{id:any, nuqta:[number,number]}[]} uylar
 * @param {number} sigim — bitta guruhga nechta bola sig'adi
 * @returns {any[][]} — guruhlar, har biri id lar ro'yxati
 */
export function guruhlash(markaz, uylar, sigim) {
  if (uylar.length === 0) return [];
  if (sigim < 1) return uylar.map(u => [u.id]);

  // Har bir uy — alohida reys.
  let reyslar = uylar.map(u => [u]);
  const nuqta = new Map(uylar.map(u => [u.id, u.nuqta]));

  // Tejamlar: kattadan kichikka.
  const tejamlar = [];
  for (let i = 0; i < uylar.length; i++) {
    for (let j = i + 1; j < uylar.length; j++) {
      const a = uylar[i];
      const b = uylar[j];
      tejamlar.push({
        a: a.id,
        b: b.id,
        tejam: distanceKm(markaz, a.nuqta) + distanceKm(markaz, b.nuqta) - distanceKm(a.nuqta, b.nuqta),
      });
    }
  }
  tejamlar.sort((x, y) => y.tejam - x.tejam);

  const reysTop = (id) => reyslar.find(r => r.some(u => u.id === id));

  for (const { a, b } of tejamlar) {
    const ra = reysTop(a);
    const rb = reysTop(b);
    if (!ra || !rb || ra === rb) continue;
    if (ra.length + rb.length > sigim) continue;

    // Faqat uchlari birlashtiriladi — o'rtadagi uyni uzib bo'lmaydi.
    const aBosh = ra[0].id === a;
    const aOxir = ra[ra.length - 1].id === a;
    const bBosh = rb[0].id === b;
    const bOxir = rb[rb.length - 1].id === b;
    if (!(aBosh || aOxir) || !(bBosh || bOxir)) continue;

    const chap = aOxir ? ra : [...ra].reverse();
    const ong = bBosh ? rb : [...rb].reverse();
    const yangi = [...chap, ...ong];

    reyslar = reyslar.filter(r => r !== ra && r !== rb);
    reyslar.push(yangi);
  }

  // Har bir guruh ichida tartibni tekislaymiz.
  return reyslar.map(r => {
    const yol = ochiqYol(markaz, r.map(u => nuqta.get(u.id)));
    return yol.map(i => r[i].id);
  });
}

/** Guruh yo'li uzunligi: markazdan boshlab bekatma-bekat. */
export function guruhKm(markaz, guruh, nuqtaOl) {
  let jami = 0;
  let joriy = markaz;
  for (const id of guruh) {
    const n = nuqtaOl(id);
    if (!n) continue;
    jami += distanceKm(joriy, n);
    joriy = n;
  }
  return jami;
}

/**
 * To'liq reja: o'quvchilarni mashinalarga taqsimlaydi.
 *
 * Mashinalar sig'imi bo'yicha kattadan tartiblanadi va eng katta guruh eng
 * katta mashinaga beriladi. Guruhlar mashinalardan ko'p bo'lsa — qolganlari
 * o'sha mashinalarning ikkinchi reysi bo'ladi (avval kattasi qaytib keladi,
 * keyin qolganlarni oladi). Bu ham sig'maydigan bola bo'lsa, u alohida
 * qaytariladi: admin yangi mashina qo'shishi yoki qo'lda joylashi kerak.
 *
 * @returns {{rejalar: object[], sigmaganlar: any[], nuqtasiz: any[]}}
 */
export function reyalarniTuzish({ markaz, oquvchilar, mashinalar, direction = 'KETISH', startTime = '07:30', rejim = 'tez' }) {
  const nuqtasiz = [];
  const uylar = [];
  for (const o of oquvchilar) {
    const n = parseLatLng(o.location);
    if (n) uylar.push({ id: o.id, nuqta: n });
    else nuqtasiz.push(o.id);
  }
  const nuqtaOl = (id) => uylar.find(u => u.id === id)?.nuqta || null;

  const tartiblangan = [...mashinalar].sort((a, b) => (b.capacity || 0) - (a.capacity || 0));
  const engKatta = tartiblangan[0]?.capacity || 0;
  if (!tartiblangan.length || engKatta < 1) {
    return { rejalar: [], sigmaganlar: uylar.map(u => u.id), nuqtasiz };
  }

  // Guruh o'lchami rejimga bog'liq:
  //  - "tez": ish hamma mashinaga bo'linadi. Umumiy km ko'proq, lekin har
  //    mashina qisqa yuradi va bola kam o'tiradi — 14 bola bitta mashinada
  //    94 daqiqa, ikkitasida esa 45 daqiqadan.
  //  - "arzon": iloji boricha kam mashina. Umumiy km kam, lekin uzoq yuriladi.
  const olcham = rejim === 'arzon'
    ? engKatta
    : Math.max(1, Math.min(engKatta, Math.ceil(uylar.length / tartiblangan.length)));
  let guruhlar = guruhlash(markaz, uylar, olcham);
  // Katta guruh oldinda tursin — katta mashinaga tushsin.
  guruhlar.sort((a, b) => b.length - a.length);

  const rejalar = [];
  const sigmaganlar = [];
  // Har bir mashina uchun navbat (nechanchi reysi) va keyingi chiqish vaqti.
  const navbat = new Map(tartiblangan.map(m => [m.id, 0]));
  const keyingiVaqt = new Map(tartiblangan.map(m => [m.id, startTime]));

  let qolgan = [...guruhlar];
  while (qolgan.length) {
    const guruh = qolgan.shift();
    // Shu guruhga mashina: "tez" rejimda hali qatnamagani birinchi navbatda
    // (ish parallel ketsin), aks holda sig'adigan eng kichigi.
    const sigadi = [...tartiblangan].filter(m => (m.capacity || 0) >= guruh.length);
    const bosh = sigadi.filter(m => navbat.get(m.id) === 0);
    const mos = rejim === 'tez' && bosh.length
      ? bosh.sort((a, b) => (a.capacity || 0) - (b.capacity || 0))[0]
      : sigadi.sort((a, b) => (a.capacity || 0) - (b.capacity || 0))[0];

    if (!mos) {
      // Guruh eng katta mashinaga ham sig'maydi — bo'lamiz.
      const bolinadi = engKatta;
      qolgan.unshift(guruh.slice(bolinadi));
      qolgan.unshift(guruh.slice(0, bolinadi));
      continue;
    }

    // Reys navbati bo'yicha vaqt: oldingi reys qaytib kelgach.
    const n = navbat.get(mos.id) + 1;
    navbat.set(mos.id, n);
    const km = guruhKm(markaz, guruh, nuqtaOl);
    const daqiqa = reysDaqiqasi(km, guruh.length);
    const vaqt = keyingiVaqt.get(mos.id);
    // Qaytish yo'li ham bor — davomiylikni ikki tomonga hisoblaymiz.
    keyingiVaqt.set(mos.id, vaqtQoshish(vaqt, daqiqa * 2 + 10));

    rejalar.push({
      transportId: mos.id,
      transportName: mos.name,
      capacity: mos.capacity,
      navbat: n,
      startTime: vaqt,
      studentIds: direction === 'KETISH' ? [...guruh].reverse() : guruh,
      km,
      daqiqa,
    });
  }

  // Bir mashinada juda ko'p navbat to'planib qolmasin — 3 tadan ortig'i
  // amalda ishlamaydi (dars vaqtiga ulgurmaydi).
  const ortiqcha = rejalar.filter(r => r.navbat > 3);
  for (const r of ortiqcha) sigmaganlar.push(...r.studentIds);
  const yakuniy = rejalar.filter(r => r.navbat <= 3);

  return { rejalar: yakuniy, sigmaganlar, nuqtasiz };
}
