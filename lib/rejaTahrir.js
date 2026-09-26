/**
 * Kunlik transport rejasini tahrirlash — sof funksiyalar (2026-09-26).
 *
 * Egasi: "logistikani interaktivroq qilish kerak, srazu xaritada ko'rinsin,
 * xohlaguncha o'zgartirish mumkin bo'lsin". Reja sahifasida koordinator
 * xaritada bolani bosib boshqa mashinaga o'tkazadi, bir nechtasini "bo'yab"
 * chiqadi, rejasizlarni tizim o'zi joylaydi. Hammasi brauzerda qoralama
 * bo'lib turadi va "Haydovchilarga yuborish" bosilganda server
 * (services/logistics.js → kunniSaqlash) farqni yozadi.
 *
 * "Mashina" (car) — bitta haydovchining bitta reysi:
 *   { key, routeId: number|null, driverId, navbat, studentIds: number[] }
 * routeId — bazadagi reja (Route.id); null — hali yuborilmagan yangi reys.
 *
 * Fayl sof: bazaga ham, brauzerga ham bog'liq emas (server ham, sahifa ham
 * ishlatadi; node bilan sinaladi).
 */
import { reyalarniTuzish, reysDaqiqasi } from './rejalash.js';
import { bekatlarniTartiblash, distanceKm, parseLatLng } from './tartib.js';

/** Bir reysda 3 tadan ortiq navbat amalda ishlamaydi (rejalash.js bilan bir xil). */
export const ENG_KOP_NAVBAT = 3;

/**
 * Reys ko'rsatkichlari: uyga tarqatish tartibi, yo'l (km) va vaqt (daqiqa).
 * Tartib serverdagi bilan bir xil funksiya — haydovchi botda aynan shu
 * ketma-ketlikni ko'radi.
 * @param {number[]} ids
 * @param {(id:number)=>string|null|undefined} joyOl — o'quvchi koordinatasi ("lat,lng")
 * @param {[number,number]} markaz
 */
export function reysKorsatkichi(ids, joyOl, markaz) {
  const natija = bekatlarniTartiblash(ids.map(id => ({ id, location: joyOl(id) })), markaz, 'QAYTISH');
  const km = Math.round(natija.km * 10) / 10;
  return { tartib: natija.tartib, km, daqiqa: ids.length ? reysDaqiqasi(natija.km, ids.length) : 0, nuqtasiz: natija.nuqtasiz };
}

/** Haydovchining keyingi reys raqami (bor reyslardan keyin). */
export function keyingiNavbat(cars, driverId) {
  return Math.max(0, ...cars.filter(c => c.driverId === driverId).map(c => c.navbat || 1)) + 1;
}

let kalitSanogi = 0;
/** Yangi (hali saqlanmagan) reys kaliti. */
export function yangiKalit(driverId) {
  kalitSanogi += 1;
  return `n${driverId}-${Date.now().toString(36)}-${kalitSanogi}`;
}

/**
 * Rejasiz bolalarni mavjud mashinalarga joylaydi, sig'maganiga yangi reys
 * ochadi.
 *
 * 1. Uyi belgilanganlar — markazdan uzog'idan boshlab, eng yaqin qo'shnisi
 *    bor va joyi bor mashinaga (bo'sh mashina — markazdan masofa bilan
 *    solishtiriladi). Shunda mahallalar bir mashinada qoladi.
 * 2. Hech qayerga sig'maganlar — reyalarniTuzish bilan yangi reyslarga
 *    (bo'sh turgan haydovchilar birinchi, keyin ikkinchi reys).
 * 3. Uyi belgilanmaganlar — eng ko'p bo'sh joyi bor mashinaga.
 *
 * Qulflangan (yo'lga chiqqan) reyslarga tegilmaydi.
 *
 * @param {{ markaz:[number,number], cars:object[], rejasiz:number[],
 *           haydovchilar:{id:number, capacity:number}[], joyOl:(id:number)=>string|null,
 *           qulf?:Set<string> }} p
 * @returns {{ cars:object[], sigmagan:number[] }}
 */
export function rejasizlarniJoylash({ markaz, cars, rejasiz, haydovchilar, joyOl, qulf = new Set() }) {
  const sigim = new Map(haydovchilar.map(h => [h.id, h.capacity || 0]));
  const natija = cars.map(c => ({ ...c, studentIds: [...c.studentIds] }));
  const ochiq = () => natija.filter(c => !qulf.has(c.key) && sigim.has(c.driverId));
  const bosh = (c) => (sigim.get(c.driverId) || 0) - c.studentIds.length;

  const nuqtali = [];
  const nuqtasiz = [];
  for (const id of rejasiz) {
    const n = parseLatLng(joyOl(id));
    if (n) nuqtali.push({ id, n });
    else nuqtasiz.push(id);
  }
  // Uzoqdagilar birinchi: ular joy tanlashda eng cheklangan.
  nuqtali.sort((a, b) => distanceKm(markaz, b.n) - distanceKm(markaz, a.n));

  // Bugun ishlaydigan, lekin hali reysi yo'q haydovchi — bo'sh mashina
  // sifatida qatnashadi (bola unga tushsagina reys ochiladi).
  const reyssiz = () => haydovchilar
    .filter(h => (h.capacity || 0) > 0 && !natija.some(c => c.driverId === h.id && !qulf.has(c.key)))
    .filter(h => keyingiNavbat(natija, h.id) <= ENG_KOP_NAVBAT);

  const qolgan = [];
  for (const k of nuqtali) {
    let eng = null;
    let engNarx = Infinity;
    for (const c of ochiq()) {
      if (bosh(c) <= 0) continue;
      let narx = Infinity;
      for (const id of c.studentIds) {
        const n = parseLatLng(joyOl(id));
        if (n) narx = Math.min(narx, distanceKm(n, k.n));
      }
      // Bo'sh mashina: markazdan masofa (+ ozgina jarima — mavjud to'dani afzal ko'ramiz).
      if (narx === Infinity) narx = distanceKm(markaz, k.n) * 1.2;
      if (narx < engNarx) { engNarx = narx; eng = c; }
    }
    for (const h of reyssiz()) {
      const narx = distanceKm(markaz, k.n) * 1.2;
      if (narx < engNarx) { engNarx = narx; eng = { yangi: h }; }
    }
    if (eng?.yangi) {
      natija.push({ key: yangiKalit(eng.yangi.id), routeId: null, driverId: eng.yangi.id, navbat: keyingiNavbat(natija, eng.yangi.id), studentIds: [k.id] });
    } else if (eng) {
      eng.studentIds.push(k.id);
    } else {
      qolgan.push(k.id);
    }
  }

  const sigmagan = [];
  if (qolgan.length) {
    const ishlaydi = haydovchilar.filter(h => (h.capacity || 0) > 0);
    const tuzildi = reyalarniTuzish({
      markaz,
      oquvchilar: qolgan.map(id => ({ id, location: joyOl(id) })),
      mashinalar: ishlaydi.map(h => ({ id: h.id, name: String(h.id), capacity: h.capacity })),
      direction: 'QAYTISH',
      startTime: '00:00',
      rejim: 'tez',
    });
    // Navbat haydovchining bor reyslaridan keyin davom etadi.
    const oldingi = new Map(ishlaydi.map(h => [h.id, keyingiNavbat(natija, h.id) - 1]));
    for (const r of tuzildi.rejalar) {
      const navbat = (oldingi.get(r.transportId) || 0) + r.navbat;
      if (navbat > ENG_KOP_NAVBAT) { sigmagan.push(...r.studentIds); continue; }
      natija.push({ key: yangiKalit(r.transportId), routeId: null, driverId: r.transportId, navbat, studentIds: [...r.studentIds] });
    }
    sigmagan.push(...tuzildi.sigmaganlar);
  }

  for (const id of nuqtasiz) {
    const c = ochiq().filter(x => bosh(x) > 0).sort((a, b) => bosh(b) - bosh(a))[0];
    if (c) c.studentIds.push(id);
    else sigmagan.push(id);
  }
  return { cars: natija, sigmagan };
}

/**
 * Yangidan taqsimlash (reja hali yo'q bo'lganda yoki "Qaytadan"): qulflanmagan
 * reyslar tarqatiladi va barcha bolalar (ulardagilar + rejasizlar) mashina
 * sig'imi va uylar joylashuviga qarab bo'linadi — burchak bo'yicha sektorlar,
 * mashinalar parallel yuradi (lib/rejalash.js, 'tez'). Qulflangan reyslar
 * qoladi, yangi reyslarning navbati ulardan keyin.
 */
export function yangidanTaqsimlash({ markaz, cars, rejasiz, haydovchilar, joyOl, qulf = new Set() }) {
  const natija = cars.filter(c => qulf.has(c.key)).map(c => ({ ...c, studentIds: [...c.studentIds] }));
  const bolalar = [...new Set([...rejasiz, ...cars.filter(c => !qulf.has(c.key)).flatMap(c => c.studentIds)])];
  const ishlaydi = haydovchilar.filter(h => (h.capacity || 0) > 0);
  if (!ishlaydi.length) return { cars: natija, sigmagan: bolalar };

  const nuqtali = bolalar.filter(id => parseLatLng(joyOl(id)));
  const nuqtasiz = bolalar.filter(id => !parseLatLng(joyOl(id)));
  const tuzildi = reyalarniTuzish({
    markaz,
    oquvchilar: nuqtali.map(id => ({ id, location: joyOl(id) })),
    mashinalar: ishlaydi.map(h => ({ id: h.id, name: String(h.id), capacity: h.capacity })),
    direction: 'QAYTISH',
    startTime: '00:00',
    rejim: 'tez',
  });
  const oldingi = new Map(ishlaydi.map(h => [h.id, keyingiNavbat(natija, h.id) - 1]));
  const sigmagan = [...tuzildi.sigmaganlar];
  for (const r of tuzildi.rejalar) {
    const navbat = (oldingi.get(r.transportId) || 0) + r.navbat;
    if (navbat > ENG_KOP_NAVBAT) { sigmagan.push(...r.studentIds); continue; }
    natija.push({ key: yangiKalit(r.transportId), routeId: null, driverId: r.transportId, navbat, studentIds: [...r.studentIds] });
  }
  // Uyi belgilanmaganlar — eng ko'p bo'sh joyi bor mashinaga.
  const sigim = new Map(ishlaydi.map(h => [h.id, h.capacity]));
  for (const id of nuqtasiz) {
    const c = natija.filter(x => !qulf.has(x.key) && sigim.has(x.driverId) && sigim.get(x.driverId) - x.studentIds.length > 0)
      .sort((a, b) => (sigim.get(b.driverId) - b.studentIds.length) - (sigim.get(a.driverId) - a.studentIds.length))[0];
    if (c) c.studentIds.push(id);
    else sigmagan.push(id);
  }
  return { cars: natija, sigmagan };
}

/**
 * Qayta taqsimlangandan keyin: shu haydovchining shu navbatdagi eski reysi
 * bo'lsa, yangi reys uning o'rnini oladi (kalit va routeId). Shunda haydovchi
 * "bekor qilindi" + "yangi reja" o'rniga bitta "reja o'zgartirildi" oladi.
 */
export function kalitlarniSaqla(yangi, eski) {
  const band = new Set();
  return yangi.map(c => {
    if (c.routeId) return c;
    const e = eski.find(x => x.routeId && !band.has(x.key) && x.driverId === c.driverId && x.navbat === c.navbat);
    if (!e) return c;
    band.add(e.key);
    return { ...c, key: e.key, routeId: e.routeId };
  });
}

/** Ikki ro'yxat bir xil to'plammi (tartib muhim emas — tartibni server o'zi quradi). */
export function birXilmi(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every(x => s.has(x));
}

/**
 * Qoralama va bazadagi holat farqi.
 * @param {object[]} asos — bazadagi (qulflanmagan) reyslar
 * @param {object[]} cars — qoralama (qulflanmagan) reyslar
 * @returns {{ yangi:string[], ozgargan:string[], ochirilgan:number[], soni:number }}
 *   yangi/ozgargan — qoralama kalitlari, ochirilgan — routeId lar.
 */
export function farqlar(asos, cars) {
  const asosMap = new Map(asos.filter(c => c.routeId).map(c => [c.routeId, c]));
  const yangi = [];
  const ozgargan = [];
  const qolgan = new Set();
  for (const c of cars) {
    if (!c.studentIds.length) continue;
    const a = c.routeId ? asosMap.get(c.routeId) : null;
    if (!a) { yangi.push(c.key); continue; }
    qolgan.add(c.routeId);
    if (a.driverId !== c.driverId || !birXilmi(a.studentIds, c.studentIds)) ozgargan.push(c.key);
  }
  const ochirilgan = [...asosMap.keys()].filter(id => !qolgan.has(id));
  return { yangi, ozgargan, ochirilgan, soni: yangi.length + ozgargan.length + ochirilgan.length };
}

/**
 * Bolani boshqa mashinaga o'tkazish (yoki mashinadan chiqarish: `qayerga`
 * null). Qulflangan mashinadan ham, unga ham ko'chirilmaydi.
 * @returns {object[]|null} yangi cars, yoki null — mumkin emas
 */
export function kochir(cars, studentId, qayerga, qulf = new Set()) {
  const hozir = cars.find(c => c.studentIds.includes(studentId));
  if (hozir && qulf.has(hozir.key)) return null;
  if (qayerga && qulf.has(qayerga)) return null;
  if (hozir && hozir.key === qayerga) return cars;
  return cars.map(c => {
    let ids = c.studentIds;
    if (c === hozir) ids = ids.filter(id => id !== studentId);
    if (c.key === qayerga) ids = [...ids, studentId];
    return ids === c.studentIds ? c : { ...c, studentIds: ids };
  });
}
