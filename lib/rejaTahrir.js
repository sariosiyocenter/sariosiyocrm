/**
 * Kunlik transport rejasini tahrirlash — sof funksiyalar (2026-09-26).
 *
 * Egasi: "logistikani interaktivroq qilish kerak, srazu xaritada ko'rinsin,
 * xohlaguncha o'zgartirish mumkin bo'lsin". Reja sahifasida koordinator
 * xaritada bolani bosib boshqa mashinaga o'tkazadi, rejasizlarni tizim o'zi
 * joylaydi. Hammasi brauzerda qoralama bo'lib turadi va "Haydovchilarga
 * yuborish" bosilganda server (services/logistics.js → kunniSaqlash) farqni
 * yozadi.
 *
 * 2026-09-27: masofa va vaqt yo'l bo'yicha (`olchagich`, lib/yolMasofa.js),
 * taqsimlash — lib/yolReja.js. `olchagich` berilmasa to'g'ri chiziq (sinovlar).
 *
 * "Mashina" (car) — bitta haydovchining bitta reysi:
 *   { key, routeId: number|null, driverId, navbat, studentIds: number[] }
 * routeId — bazadagi reja (Route.id); null — hali yuborilmagan yangi reys.
 *
 * Fayl sof: bazaga ham, brauzerga ham bog'liq emas (server ham, sahifa ham
 * ishlatadi; node bilan sinaladi).
 */
import { BEKAT_DAQIQA } from './rejalash.js';
import { bekatlarniTartiblash, parseLatLng } from './tartib.js';
import { togriChiziq } from './yolMasofa.js';
import { yolBilanTaqsimlash, TAYYORLOV_DAQIQA } from './yolReja.js';

/** Bir reysda 3 tadan ortiq navbat amalda ishlamaydi (rejalash.js bilan bir xil). */
export const ENG_KOP_NAVBAT = 3;

/**
 * Berilgan tartib bo'yicha reys ko'rsatkichlari: yo'l (km), vaqt (daqiqa,
 * bekatlarda to'xtash bilan) va oxirgi uydan markazga qaytish.
 * @param {number[]} tartib — bekatlar ketma-ketligi
 */
export function tartibKorsatkichi(tartib, joyOl, markaz, olchagich = togriChiziq) {
  let km = 0;
  let daqiqa = 0;
  let joriy = markaz;
  let bor = false;
  for (const id of tartib) {
    const n = parseLatLng(joyOl(id));
    if (!n) continue;
    km += olchagich.km(joriy, n);
    daqiqa += olchagich.daqiqa(joriy, n);
    joriy = n;
    bor = true;
  }
  return {
    km: Math.round(km * 10) / 10,
    daqiqa: tartib.length ? Math.round(daqiqa + tartib.length * BEKAT_DAQIQA) : 0,
    /** Oxirgi uydan markazga qaytish, daqiqa (keyingi reys shundan keyin). */
    qaytish: bor ? Math.round(olchagich.daqiqa(joriy, markaz)) : 0,
  };
}

/**
 * Reys ko'rsatkichlari: uyga tarqatish tartibi, yo'l (km) va vaqt (daqiqa).
 * Tartib faqat bolalar to'plamiga bog'liq (qaysi tartibda berilgani emas) —
 * sahifa har chizilganda sakramaydi. Yuborilganda aynan shu tartib serverga
 * ketadi va haydovchi botda shuni ko'radi.
 * @param {number[]} ids
 * @param {(id:number)=>string|null|undefined} joyOl — o'quvchi koordinatasi ("lat,lng")
 * @param {[number,number]} markaz
 * @param {{km:Function, daqiqa:Function}} [olchagich]
 */
export function reysKorsatkichi(ids, joyOl, markaz, olchagich = togriChiziq) {
  const saralangan = [...ids].sort((a, b) => a - b);
  const natija = bekatlarniTartiblash(saralangan.map(id => ({ id, location: joyOl(id) })), markaz, 'QAYTISH', olchagich);
  return { tartib: natija.tartib, ...tartibKorsatkichi(natija.tartib, joyOl, markaz, olchagich), nuqtasiz: natija.nuqtasiz };
}

/**
 * Bolani shu reysga qo'shsak yo'l necha daqiqaga uzayadi (eng qulay joyiga
 * qo'yilganda). Uyi belgilanmagan bo'lsa — null.
 */
export function qoshishNarxi(id, tartib, joyOl, markaz, olchagich = togriChiziq) {
  const k = parseLatLng(joyOl(id));
  if (!k) return null;
  const nuqtalar = [markaz, ...tartib.filter(x => x !== id).map(x => parseLatLng(joyOl(x))).filter(Boolean)];
  let eng = Infinity;
  for (let p = 1; p <= nuqtalar.length; p++) {
    const a = nuqtalar[p - 1];
    const b = nuqtalar[p];
    const d = olchagich.daqiqa(a, k) + (b ? olchagich.daqiqa(k, b) - olchagich.daqiqa(a, b) : 0);
    if (d < eng) eng = d;
  }
  return Math.round(eng + BEKAT_DAQIQA);
}

/**
 * Oxirgi bola qachon uyda bo'ladi (reja boshlanganidan, daqiqa). Har
 * haydovchi reyslarini navbat bilan qiladi: reys → markazga qaytish →
 * bolalarni o'tqazish → keyingi reys.
 * @param {{ driverId:number, navbat:number, daqiqa:number, qaytish:number }[]} reyslar
 */
export function oxirgiBolaDaqiqasi(reyslar) {
  const h = new Map();
  for (const r of reyslar) {
    if (!r.daqiqa) continue;
    if (!h.has(r.driverId)) h.set(r.driverId, []);
    h.get(r.driverId).push(r);
  }
  let eng = 0;
  for (const rr of h.values()) {
    rr.sort((a, b) => a.navbat - b.navbat);
    let t = 0;
    rr.forEach((r, i) => { t += r.daqiqa + (i < rr.length - 1 ? r.qaytish + TAYYORLOV_DAQIQA : 0); });
    eng = Math.max(eng, t);
  }
  return Math.round(eng);
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
 * Yo'ldagi (qulflangan) reyslar: haydovchi nechta reysni band qilgan va ular
 * taxminan qachon tugaydi — yangi reyslar shundan keyin.
 */
function bandlik(cars, qulf, joyOl, markaz, olchagich) {
  const m = new Map();
  for (const c of cars) {
    if (!qulf.has(c.key)) continue;
    const k = reysKorsatkichi(c.studentIds, joyOl, markaz, olchagich);
    const x = m.get(c.driverId) || { bandReys: 0, ofset: 0 };
    x.bandReys += 1;
    x.ofset += k.daqiqa + k.qaytish + TAYYORLOV_DAQIQA;
    m.set(c.driverId, x);
  }
  return m;
}

/** Uyi belgilanmaganlar — eng ko'p bo'sh joyi bor ochiq mashinaga. */
function nuqtasizlarniJoylash(natija, ids, sigim, qulf, sigmagan) {
  const bosh = (c) => (sigim.get(c.driverId) || 0) - c.studentIds.length;
  for (const id of ids) {
    const c = natija.filter(x => !qulf.has(x.key) && sigim.has(x.driverId) && bosh(x) > 0)
      .sort((a, b) => bosh(b) - bosh(a))[0];
    if (c) c.studentIds.push(id);
    else sigmagan.push(id);
  }
}

/**
 * Rejasiz bolalarni mavjud mashinalarga joylaydi, sig'maganiga yangi reys
 * ochadi. Mashinalardagi bolalar joyidan qimirlamaydi (admin qo'lda qilgan
 * o'zgarishlar saqlanadi) — yangilar yo'l bo'yicha eng arzon joyga qo'yiladi:
 * mavjud mashinaga, bo'sh haydovchiga yoki keyingi reysga.
 * Uyi belgilanmaganlar — eng ko'p bo'sh joyi bor mashinaga.
 * Qulflangan (yo'lga chiqqan) reyslarga tegilmaydi.
 *
 * @param {{ markaz:[number,number], cars:object[], rejasiz:number[],
 *           haydovchilar:{id:number, capacity:number}[], joyOl:(id:number)=>string|null,
 *           qulf?:Set<string>, olchagich?:object }} p
 * @returns {{ cars:object[], sigmagan:number[] }}
 */
export function rejasizlarniJoylash({ markaz, cars, rejasiz, haydovchilar, joyOl, qulf = new Set(), olchagich = togriChiziq }) {
  const sigim = new Map(haydovchilar.map(h => [h.id, h.capacity || 0]));
  const natija = cars.map(c => ({ ...c, studentIds: [...c.studentIds] }));
  const nuqta = (id) => parseLatLng(joyOl(id));
  const ochiq = natija.filter(c => !qulf.has(c.key) && sigim.has(c.driverId) && sigim.get(c.driverId) > 0);
  const band = bandlik(natija, qulf, joyOl, markaz, olchagich);

  const yangilar = rejasiz.filter(id => nuqta(id));
  const nuqtasiz = rejasiz.filter(id => !nuqta(id));
  const mavjud = ochiq.map(c => ({ key: c.key, driverId: c.driverId, ids: c.studentIds.filter(id => nuqta(id)) }));
  const uylar = [...mavjud.flatMap(c => c.ids), ...yangilar].map(id => ({ id, nuqta: nuqta(id) }));

  const tuzildi = yolBilanTaqsimlash({
    markaz, uylar, olchagich, mavjud,
    haydovchilar: haydovchilar.map(h => ({ id: h.id, sigim: h.capacity || 0, ...(band.get(h.id) || {}) })),
  });
  const sigmagan = [...tuzildi.sigmagan];
  const carMap = new Map(ochiq.map(c => [c.key, c]));
  for (const r of tuzildi.reyslar) {
    if (r.key && carMap.has(r.key)) {
      const c = carMap.get(r.key);
      const joysiz = c.studentIds.filter(id => !nuqta(id));
      c.studentIds = [...r.ids, ...joysiz];
    } else if (r.ids.length) {
      const navbat = keyingiNavbat(natija, r.driverId);
      if (navbat > ENG_KOP_NAVBAT) { sigmagan.push(...r.ids); continue; }
      natija.push({ key: yangiKalit(r.driverId), routeId: null, driverId: r.driverId, navbat, studentIds: [...r.ids] });
    }
  }
  nuqtasizlarniJoylash(natija, nuqtasiz, sigim, qulf, sigmagan);
  return { cars: natija, sigmagan };
}

/**
 * Yangidan taqsimlash (reja hali yo'q bo'lganda yoki "Qaytadan"): qulflanmagan
 * reyslar tarqatiladi va barcha bolalar (ulardagilar + rejasizlar) yo'l
 * bo'yicha bo'linadi (lib/yolReja.js). Qulflangan reyslar qoladi, yangi
 * reyslarning navbati ulardan keyin; har haydovchida qisqa reys birinchi.
 */
export function yangidanTaqsimlash({ markaz, cars, rejasiz, haydovchilar, joyOl, qulf = new Set(), olchagich = togriChiziq }) {
  const natija = cars.filter(c => qulf.has(c.key)).map(c => ({ ...c, studentIds: [...c.studentIds] }));
  const bolalar = [...new Set([...rejasiz, ...cars.filter(c => !qulf.has(c.key)).flatMap(c => c.studentIds)])];
  const ishlaydi = haydovchilar.filter(h => (h.capacity || 0) > 0);
  if (!ishlaydi.length) return { cars: natija, sigmagan: bolalar };

  const nuqta = (id) => parseLatLng(joyOl(id));
  const band = bandlik(natija, qulf, joyOl, markaz, olchagich);
  const tuzildi = yolBilanTaqsimlash({
    markaz,
    uylar: bolalar.filter(id => nuqta(id)).map(id => ({ id, nuqta: nuqta(id) })),
    haydovchilar: ishlaydi.map(h => ({ id: h.id, sigim: h.capacity, ...(band.get(h.id) || {}) })),
    olchagich,
  });
  const sigmagan = [...tuzildi.sigmagan];
  for (const r of tuzildi.reyslar) {
    if (!r.ids.length) continue;
    const navbat = keyingiNavbat(natija, r.driverId);
    if (navbat > ENG_KOP_NAVBAT) { sigmagan.push(...r.ids); continue; }
    natija.push({ key: yangiKalit(r.driverId), routeId: null, driverId: r.driverId, navbat, studentIds: [...r.ids] });
  }
  const sigim = new Map(ishlaydi.map(h => [h.id, h.capacity]));
  nuqtasizlarniJoylash(natija, bolalar.filter(id => !nuqta(id)), sigim, qulf, sigmagan);
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
