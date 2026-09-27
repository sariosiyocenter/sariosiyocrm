/**
 * Bolalarni mashinalarga yo'l bo'yicha taqsimlash (2026-09-27).
 *
 * Ilgari: markaz atrofida burchak bo'yicha "pirog bo'laklari"
 * (lib/rejalash.js → sektorlarga). Bitta bo'lakka ikki xil vodiy tushsa
 * haydovchi markaz orqali aylanib o'tardi (egasi xaritada ko'rsatdi: qizil
 * mashina shimoli-sharq va janubi-sharqqa birdan ketgan).
 *
 * Hisob har bir juft uy orasidagi haqiqiy yo'l vaqti bilan (lib/yolMasofa.js,
 * OSRM). Egasining talabi: har reys — bitta tomon. Faqat yo'l vaqti bu uchun
 * yetmaydi: janubi-sharqdan chegara bo'ylab shimoli-sharqqa aylana yo'l bor
 * va vaqt bo'yicha "bir aylanib chiqish" arzon ko'rinadi — egasi esa xaritada
 * "bittasi bu yerda, boshqasi vabshe boshqa tomonda" deb ko'rdi. Shuning uchun
 * reys narxi uch qismdan:
 *
 *   borib-qaytish vaqti
 *   + 1.5 × chetga chiqish: borib-qaytish − 2 × eng uzoq uygacha (bitta yo'l
 *     bo'ylab borib qaytgan reysda ~0);
 *   + 4 × (uzoq bolalar yoyi − 45°) / 45° × eng uzoq uygacha vaqt: reysning
 *     uzoqdagi bolalari markazdan qaraganda 45° dan keng yoyga tarqalsa.
 *     Markazga yaqin (12 daqiqagacha) bolalar hisobga kirmaydi — ular
 *     chiqishda, yo'l-yo'lakay olinadi (dispetcher ham shunday qiladi).
 *     Vazn katta: ikki tomonga ketgan reys "oxirgi bola ertaroq uyda" bo'lsa
 *     ham olinmaydi — egasi uchun bu aqlsiz marshrut.
 *
 * Umumiy baho = reyslar narxi yig'indisi + eng kech tugatadigan haydovchi
 * (oxirgi bola uyda bo'lgan vaqt) — mashinalar parallel ishlasin.
 * Haydovchi reyslarini qisqasidan boshlab qiladi; har reysdan keyin markazga
 * qaytib, 10 daqiqada keyingi bolalarni o'tqazadi.
 *
 * Qidiruv:
 *   1. Boshlang'ich rejalar: (a) uzoqdagilardan boshlab har bolani eng arzon
 *      joyga; (b) hamma uyni bitta "katta aylana" bilan aylanib chiqib, uni
 *      ketma-ket bo'laklarga eng arzon kesish; (c) markaz atrofida burchak
 *      bo'yicha bo'laklar.
 *   2. Har biridan mahalliy qidiruv (faqat yaqin qo'shni bolalar orasida):
 *      1–3 bolani boshqa reysga ko'chirish, ikki bolani almashtirish, ikki
 *      reysning bo'laklarini almashtirish (butun mahalla boshqa sig'imli
 *      mashinaga o'tishi mumkin), 1–3 bolalik guruhlarni almashtirish.
 *      Eng arzon natija olinadi.
 * Hammasi deterministik (vaqtga emas, qadamlar soniga bog'liq): bir xil
 * ma'lumot — har kompyuterda bir xil reja. 93 bola: 2 mashina ~0.1 s,
 * 8 mashina ~0.8 s.
 *
 * Sig'im qat'iy, haydovchiga 3 tagacha reys. Hammaga joy yetmasa, markazga
 * eng yaqin bolalar qoladi (piyoda yetadi yoki admin qo'lda joylaydi) —
 * ular orasidan reyslar yo'liga to'g'ri kelmaydigani: qoldirish narxi
 * markazdan vaqtiga mutanosib, uzoqdagi bola qolmaydi.
 *
 * Fayl sof: bazaga ham, brauzerga ham bog'liq emas.
 */
import { yolniTekisla } from './tartib.js';
import { togriChiziq } from './yolMasofa.js';
import { BEKAT_DAQIQA } from './rejalash.js';

/** Reysdan keyin markazda keyingi bolalarni o'tqazish, daqiqa. */
export const TAYYORLOV_DAQIQA = 10;
/** Bir haydovchiga kuniga ko'pi bilan shuncha reys (rejaTahrir.js bilan bir xil). */
export const ENG_KOP_REYS = 3;
/** "Chetga chiqish" (bitta yo'nalishdan tashqari yurish) jarimasi. */
export const CHETLASH_VAZNI = 1.5;
/** Eng kech tugatadigan haydovchi vaqtining vazni. */
export const KECHLIK_VAZNI = 1;
/**
 * Reysning uzoqdagi bolalari markazdan qaraganda shu burchakdan (gradus)
 * kengroq yoyga tarqalsa — "ikki tomonga" ketgan hisoblanadi.
 */
export const YOY_CHEGARA = 45;
/** Yoy jarimasining vazni (reysning eng uzoq uyigacha vaqtiga ko'paytiriladi). */
export const TOMON_VAZNI = 4;
/** Shundan (daqiqa) yaqin bolalar yo'nalishga hisoblanmaydi — ular chiqishda olinadi. */
export const UZOQ_DAQIQA = 12;
/**
 * Joy yetmaganda: bolani qoldirish "narxi" = shu × markazdan vaqti. Yaqin bola
 * arzon (piyoda yetadi), uzoqdagi qimmat — shuning uchun faqat markazga eng
 * yaqinlar orasidan, reyslar yo'liga to'g'ri kelmaydigani qoladi.
 */
export const TASHLASH_VAZNI = 3;
/** Qoladiganlar tanlanadigan zaxira: eng yaqinlardan keyingi shuncha bola. */
const TASHLASH_ZAXIRA = 12;

const EPS = 1e-6;
const BOSH = { n: 0, yol: 0, qayt: 0, chuqur: 0, yoy: 0 };

let yoyBufer = new Float64Array(64);

/** Burchaklarni (gradus, `b[0..n)`) o'z ichiga olgan eng qisqa yoy. */
function yoyUzunligi(b, n) {
  if (n < 2) return 0;
  const x = b.subarray(0, n).sort();
  let bosh = x[0] + 360 - x[n - 1];
  for (let i = 1; i < n; i++) if (x[i] - x[i - 1] > bosh) bosh = x[i] - x[i - 1];
  return 360 - bosh;
}

/**
 * Reys ko'rsatkichlari: yo'l (bekatlar bilan), oxirgi uydan qaytish, eng uzoq
 * uy va uzoqdagi bolalar yo'nalishining yoyi (`burchak` — markazdan, gradus).
 */
function stat(M, w, seq, burchak) {
  let yol = 0;
  let o = 0;
  let chuqur = 0;
  for (const k of seq) {
    yol += M[o * w + k];
    o = k;
    if (M[k] > chuqur) chuqur = M[k];
  }
  const chegara = Math.max(UZOQ_DAQIQA, chuqur / 2);
  if (yoyBufer.length < seq.length) yoyBufer = new Float64Array(seq.length * 2);
  let u = 0;
  for (const k of seq) if (M[k] >= chegara) yoyBufer[u++] = burchak[k];
  return { n: seq.length, yol: yol + seq.length * BEKAT_DAQIQA, qayt: seq.length ? M[o * w] : 0, chuqur, yoy: yoyUzunligi(yoyBufer, u) };
}

/** Reys narxi: borib-qaytish + chetga chiqish + ikki tomonga ketish jarimalari. */
function reysNarxi(st) {
  if (!st.n) return 0;
  const aylana = st.yol - st.n * BEKAT_DAQIQA + st.qayt;
  return st.yol + st.qayt
    + CHETLASH_VAZNI * Math.max(0, aylana - 2 * st.chuqur)
    + TOMON_VAZNI * Math.max(0, st.yoy - YOY_CHEGARA) / YOY_CHEGARA * st.chuqur;
}

class Holat {
  /**
   * @param {Float64Array} M — (n+1)×(n+1) vaqt jadvali, 0 — markaz
   * @param {number} w — jadval kengligi
   * @param {{ sigim:number, reyslar:number, ofset:number }[]} h — haydovchilar
   * @param {number[][]} qoshni — har bolaning eng yaqin qo'shnilari (qidiruv faqat shular orasida)
   */
  constructor(M, w, h, qoshni, burchak) {
    this.M = M;
    this.w = w;
    this.qoshni = qoshni;
    this.burchak = burchak;
    this.h = h.map(x => ({ ...x, slotlar: [] }));
    this.slotlar = [];
    this.h.forEach((x, d) => { for (let r = 0; r < x.reyslar; r++) this.yangiSlot(d); });
    this.F = this.h.map(x => x.ofset || 0);
    /** Bola qaysi reysda (-1 — hech qayerda); qabul() da yangilanadi. */
    this.joy = new Int32Array(w).fill(-1);
    this.narxJami = 0;
    this.J = KECHLIK_VAZNI * Math.max(0, ...this.F);
  }

  yangiSlot(d) {
    const si = this.slotlar.length;
    this.h[d].slotlar.push(si);
    this.slotlar.push({ d, sigim: this.h[d].sigim, seq: [], st: BOSH, narx: 0, key: null });
    return si;
  }

  /** Haydovchi oxirgi bolani qachon yetkazadi (`oz` — sinovdagi reyslar: slot → ko'rsatkich). */
  tugash(d, oz = null) {
    const r = [];
    for (const si of this.h[d].slotlar) {
      const st = oz && oz.has(si) ? oz.get(si) : this.slotlar[si].st;
      if (st.n) r.push(st);
    }
    r.sort((a, b) => a.yol - b.yol);
    let F = this.h[d].ofset || 0;
    r.forEach((st, i) => { F += st.yol + (i < r.length - 1 ? st.qayt + TAYYORLOV_DAQIQA : 0); });
    return F;
  }

  /** O'zgarish (slot → yangi ketma-ketlik) qo'llansa baho qancha bo'ladi. */
  bahola(oz) {
    const stlar = new Map();
    let narxJami = this.narxJami;
    const tegdi = new Set();
    for (const [si, seq] of oz) {
      const st = stat(this.M, this.w, seq, this.burchak);
      stlar.set(si, st);
      narxJami += reysNarxi(st) - this.slotlar[si].narx;
      tegdi.add(this.slotlar[si].d);
    }
    let maxF = 0;
    for (let d = 0; d < this.h.length; d++) {
      const F = tegdi.has(d) ? this.tugash(d, stlar) : this.F[d];
      if (F > maxF) maxF = F;
    }
    return narxJami + KECHLIK_VAZNI * maxF;
  }

  qabul(oz) {
    const tegdi = new Set();
    for (const [si, seq] of oz) {
      const s = this.slotlar[si];
      s.seq = seq;
      for (const k of seq) this.joy[k] = si;
      s.st = stat(this.M, this.w, seq, this.burchak);
      const narx = reysNarxi(s.st);
      this.narxJami += narx - s.narx;
      s.narx = narx;
      tegdi.add(s.d);
    }
    for (const d of tegdi) this.F[d] = this.tugash(d);
    this.J = this.narxJami + KECHLIK_VAZNI * Math.max(0, ...this.F);
  }

  /** Yaxshilasa — qo'llaydi va reyslar ichidagi tartibni tekislaydi. */
  sina(oz) {
    if (this.bahola(oz) >= this.J - EPS) return false;
    this.qabul(oz);
    for (const si of oz.keys()) this.tekisla(si);
    return true;
  }

  /** Bo'sh reysga faqat haydovchining birinchi bo'sh o'rni — bir xil variantlar ko'paymasin. */
  ochiqmi(si, qoshiladi = 1) {
    const s = this.slotlar[si];
    if (s.seq.length + qoshiladi > s.sigim) return false;
    if (s.seq.length) return true;
    return this.h[s.d].slotlar.find(x => !this.slotlar[x].seq.length) === si;
  }

  /** Bolani reysning eng arzon joyiga qo'yadi (markaz → … → markaz aylanasi bo'yicha). */
  qoy(seq, k) {
    const { M, w } = this;
    let engP = 0;
    let engD = Infinity;
    for (let p = 0; p <= seq.length; p++) {
      const a = p ? seq[p - 1] : 0;
      const b = p < seq.length ? seq[p] : 0;
      const d = M[a * w + k] + M[k * w + b] - M[a * w + b];
      if (d < engD) { engD = d; engP = p; }
    }
    return [...seq.slice(0, engP), k, ...seq.slice(engP)];
  }

  /** Bolani eng arzon reysga qo'yadi. Qaytadi: qo'yildimi. */
  joyla(k) {
    let eng = null;
    let engJ = Infinity;
    for (let si = 0; si < this.slotlar.length; si++) {
      if (!this.ochiqmi(si)) continue;
      const oz = new Map([[si, this.qoy(this.slotlar[si].seq, k)]]);
      const J = this.bahola(oz);
      if (J < engJ - EPS) { engJ = J; eng = oz; }
    }
    if (!eng) return false;
    this.qabul(eng);
    return true;
  }

  /** Reys ichidagi tartib (uyga tarqatish yo'li) — lib/tartib.js; qidiruv ichida yengil, oxirida to'liq. */
  tekisla(si, toliq = false) {
    const s = this.slotlar[si];
    if (s.key || s.seq.length < 3) return;
    const { yol } = yolniTekisla(this.M, this.w, s.seq, !toliq);
    if (yol.join() !== s.seq.join()) this.qabul(new Map([[si, yol]]));
  }

  /** Kim qaysi reysda (bola → slot). */
  joylar() {
    return this.joy;
  }

  /** Har haydovchining birinchi bo'sh reysi — yangi reys ochish uchun. */
  boshlar() {
    const out = [];
    for (const x of this.h) {
      const si = x.slotlar.find(s => !this.slotlar[s].seq.length);
      if (si !== undefined) out.push(si);
    }
    return out;
  }

  /**
   * 1–3 ketma-ket bolani boshqa reysga (bir mahalla birga ko'chadi). Faqat
   * qo'shnilari bor reyslarga va bo'sh reyslarga — uzoqdagi reysga ko'chirish
   * baribir foyda bermaydi.
   */
  kochir() {
    let bor = false;
    for (let si = 0; si < this.slotlar.length; si++) {
      if (this.slotlar[si].key) continue;
      for (let L = 1; L <= 3; L++) {
        for (let p = 0; p + L <= this.slotlar[si].seq.length; p++) {
          const seq = this.slotlar[si].seq;
          const bolak = seq.slice(p, p + L);
          const qolgan = [...seq.slice(0, p), ...seq.slice(p + L)];
          const joy = this.joylar();
          const nomzod = new Set(this.boshlar());
          for (const k of bolak) for (const m of this.qoshni[k]) if (joy[m] >= 0) nomzod.add(joy[m]);
          nomzod.delete(si);
          let eng = null;
          let engJ = this.J - EPS;
          for (const ti of [...nomzod].sort((a, b) => a - b)) {
            if (this.slotlar[ti].key || !this.ochiqmi(ti, L)) continue;
            if (!this.slotlar[ti].seq.length && this.slotlar[ti].d === this.slotlar[si].d && !qolgan.length) continue;
            let yangi = this.slotlar[ti].seq;
            for (const k of bolak) yangi = this.qoy(yangi, k);
            const oz = new Map([[si, qolgan], [ti, yangi]]);
            const J = this.bahola(oz);
            if (J < engJ) { engJ = J; eng = oz; }
          }
          if (eng) {
            this.qabul(eng);
            for (const x of eng.keys()) this.tekisla(x);
            bor = true;
            p = -1; // reys o'zgardi — boshidan
          }
        }
      }
    }
    return bor;
  }

  /** Ikki qo'shni boladan biri ikkinchisining reysiga: joyida almashtirish. */
  almashtir() {
    let bor = false;
    for (let k = 1; k < this.w; k++) {
      for (const m of this.qoshni[k]) {
        const joy = this.joylar();
        const si = joy[k];
        const ti = joy[m];
        if (si < 0 || ti < 0 || si === ti || this.slotlar[si].key || this.slotlar[ti].key) continue;
        const A = [...this.slotlar[si].seq];
        const B = [...this.slotlar[ti].seq];
        const p = A.indexOf(k);
        const q = B.indexOf(m);
        [A[p], B[q]] = [B[q], A[p]];
        if (this.sina(new Map([[si, A], [ti, B]]))) bor = true;
      }
    }
    return bor;
  }

  /**
   * Bo'laklarni almashtirish (2-opt* va uning teskari varianti). A reysni
   * a da, B reysni b atrofida ikkiga bo'lib, to'rt bo'lakdan ikki yangi reys
   * yig'iladi: (A boshi + B davomi, B boshi + A davomi) yoki (A boshi + B
   * boshi, A davomi + B davomi) — va har biri ikkala mashinaga sinab ko'riladi.
   * Shu bilan butun mahalla (masalan 18 o'rinlidagi shimoli-sharq qismi)
   * 7 o'rinli mashinaga o'tib, uning janubdagi bolalari katta mashinaga keladi.
   * Faqat yangi qo'shnichilik paydo bo'ladigan joylarda (a → b, b qo'shni bo'lsa).
   */
  dumlar() {
    let bor = false;
    for (let a = 1; a < this.w; a++) {
      for (const b of this.qoshni[a]) {
        const joy = this.joylar();
        const si = joy[a];
        const ti = joy[b];
        if (si < 0 || ti < 0 || si === ti || this.slotlar[si].key || this.slotlar[ti].key) continue;
        const A = this.slotlar[si].seq;
        const B = this.slotlar[ti].seq;
        const p = A.indexOf(a) + 1;
        const q1 = B.indexOf(b);
        const q2 = q1 + 1;
        const sa = this.slotlar[si].sigim;
        const sb = this.slotlar[ti].sigim;
        const variantlar = [
          [p + B.length - q1, q1 + A.length - p, () => [[...A.slice(0, p), ...B.slice(q1)], [...B.slice(0, q1), ...A.slice(p)]]],
          [p + q2, A.length - p + B.length - q2, () => [[...A.slice(0, p), ...B.slice(0, q2).reverse()], [...A.slice(p).reverse(), ...B.slice(q2)]]],
        ];
        for (const [nx, ny, yasa] of variantlar) {
          const togri = nx <= sa && ny <= sb;
          const teskari = ny <= sa && nx <= sb;
          if (!togri && !teskari) continue;
          const [X, Y] = yasa();
          if ((togri && this.sina(new Map([[si, X], [ti, Y]]))) || (teskari && this.sina(new Map([[si, Y], [ti, X]])))) {
            bor = true;
            break; // reyslar o'zgardi — keyingi juftga
          }
        }
      }
    }
    return bor;
  }

  /** 1–3 bolalik guruhlarni almashtirish (qo'shni bolalardan boshlanadigan). Qimmatroq — oxirida. */
  guruhlar() {
    let bor = false;
    for (let k = 1; k < this.w; k++) {
      for (const m of this.qoshni[k]) {
        for (let La = 1; La <= 3; La++) {
          for (let Lb = 1; Lb <= 3; Lb++) {
            if (La === 1 && Lb === 1) continue;
            const joy = this.joylar();
            const si = joy[k];
            const ti = joy[m];
            if (si < 0 || ti < 0 || si === ti || this.slotlar[si].key || this.slotlar[ti].key) continue;
            const a = this.slotlar[si];
            const b = this.slotlar[ti];
            const p = a.seq.indexOf(k);
            const q = b.seq.indexOf(m);
            if (p + La > a.seq.length || q + Lb > b.seq.length) continue;
            if (a.seq.length - La + Lb > a.sigim || b.seq.length - Lb + La > b.sigim) continue;
            let A2 = [...a.seq.slice(0, p), ...a.seq.slice(p + La)];
            let B2 = [...b.seq.slice(0, q), ...b.seq.slice(q + Lb)];
            for (const x of b.seq.slice(q, q + Lb)) A2 = this.qoy(A2, x);
            for (const x of a.seq.slice(p, p + La)) B2 = this.qoy(B2, x);
            if (this.sina(new Map([[si, A2], [ti, B2]]))) bor = true;
          }
        }
      }
    }
    return bor;
  }

  /**
   * Joy yetmaganda kim qoladi: qolgan bola (q) zaxiradagi joylangan bola (o)
   * o'rniga — o ning reysida q eng arzon joyga. Yo'l qisqarishi qoldirish
   * narxlari farqidan katta bo'lsa qabul.
   */
  tashlanganlar() {
    if (!this.qoladi?.size) return false;
    let bor = false;
    for (const q of [...this.qoladi].sort((a, b) => a - b)) {
      let eng = null;
      let engD = -EPS;
      for (const o of [...this.zaxira].sort((a, b) => a - b)) {
        const si = this.joy[o];
        if (si < 0 || this.slotlar[si].key) continue;
        const oz = new Map([[si, this.qoy(this.slotlar[si].seq.filter(x => x !== o), q)]]);
        const d = this.bahola(oz) - this.J + TASHLASH_VAZNI * (this.M[o] - this.M[q]);
        if (d < engD) { engD = d; eng = { o, si, oz }; }
      }
      if (!eng) continue;
      this.joy[eng.o] = -1;
      this.qabul(eng.oz);
      this.tekisla(eng.si);
      this.qoladi.delete(q);
      this.qoladi.add(eng.o);
      this.zaxira.delete(eng.o);
      this.zaxira.add(q);
      this.tashlashNarxi += TASHLASH_VAZNI * (this.M[eng.o] - this.M[q]);
      bor = true;
    }
    return bor;
  }

  /** Mahalliy qidiruv: arzonlari yaxshilanmay qolguncha, keyin guruhlar; qadamlar soni cheklangan. */
  qidir() {
    for (let tur = 0; tur < 5; tur++) {
      for (let i = 0; i < 20; i++) {
        const a = this.kochir();
        const b = this.almashtir();
        const c = this.dumlar();
        const d = this.tashlanganlar();
        if (!a && !b && !c && !d) break;
      }
      if (!this.guruhlar()) break;
    }
  }

  /** Natija: haydovchi bo'yicha, har haydovchida qisqa reys birinchi. */
  reyslar(uylar) {
    const out = [];
    this.h.forEach(x => {
      const bu = x.slotlar.map(si => this.slotlar[si]).filter(s => s.seq.length || s.key);
      bu.sort((a, b) => a.st.yol - b.st.yol);
      for (const s of bu) out.push({ key: s.key, driverId: x.id, ids: s.seq.map(k => uylar[k - 1].id), daqiqa: s.st.yol });
    });
    return out;
  }
}

/**
 * Katta aylana: markazdan chiqib hamma uyni o'tib markazga qaytadigan qisqa
 * yo'l (eng yaqin keyingisi + 2-opt + or-opt). Qo'shni uylar ketma-ket keladi.
 */
function kattaAylana(M, w, tugunlar) {
  const tur = [];
  const qolgan = new Set(tugunlar);
  let joriy = 0;
  while (qolgan.size) {
    let eng = -1;
    let engM = Infinity;
    for (const k of qolgan) { const d = M[joriy * w + k]; if (d < engM || (d === engM && k < eng)) { engM = d; eng = k; } }
    tur.push(eng);
    qolgan.delete(eng);
    joriy = eng;
  }
  const n = tur.length;
  const A = [0, ...tur]; // aylana: A[n] dan keyin yana 0
  const t = (i) => (i > n ? 0 : A[i]);
  for (let aylanish = 0; aylanish < 60; aylanish++) {
    let bor = false;
    // 2-opt: A[i..j] ni teskari (ikki tomonga deyarli bir xil — farq e'tiborsiz).
    for (let i = 1; i < n; i++) {
      for (let j = i + 1; j <= n; j++) {
        const d = M[A[i - 1] * w + A[j]] + M[A[i] * w + t(j + 1)] - M[A[i - 1] * w + A[i]] - M[A[j] * w + t(j + 1)];
        if (d < -1e-9) {
          for (let x = i, y = j; x < y; x++, y--) [A[x], A[y]] = [A[y], A[x]];
          bor = true;
        }
      }
    }
    // or-opt: 1–3 ta uyni aylananing boshqa joyiga.
    for (let L = 1; L <= 3 && L < n; L++) {
      for (let i = 1; i + L - 1 <= n; i++) {
        const a = A[i - 1];
        const s1 = A[i];
        const sL = A[i + L - 1];
        const b = t(i + L);
        const yutuq = M[a * w + s1] + M[sL * w + b] - M[a * w + b];
        let engD = -1e-9;
        let engX = -1;
        let teskari = false;
        for (let x = 0; x <= n; x++) {
          if (x >= i - 1 && x <= i + L - 1) continue;
          const u = A[x];
          const v = t(x + 1);
          const d1 = M[u * w + s1] + M[sL * w + v] - M[u * w + v] - yutuq;
          const d2 = M[u * w + sL] + M[s1 * w + v] - M[u * w + v] - yutuq;
          if (d1 < engD) { engD = d1; engX = x; teskari = false; }
          if (d2 < engD) { engD = d2; engX = x; teskari = true; }
        }
        if (engX >= 0) {
          const bolak = A.slice(i, i + L);
          if (teskari) bolak.reverse();
          const u = A[engX];
          const qol = [...A.slice(0, i), ...A.slice(i + L)];
          const joy = qol.indexOf(u) + 1;
          const yangi = [...qol.slice(0, joy), ...bolak, ...qol.slice(joy)];
          for (let z = 0; z < yangi.length; z++) A[z] = yangi[z];
          bor = true;
        }
      }
    }
    if (!bor) break;
  }
  return A.slice(1);
}

/**
 * Aylanani ketma-ket bo'laklarga eng arzon kesish (dinamik dasturlash).
 * Har bo'lak — bitta reys; turlar — mashina sig'imlari, har turdan cheklangan son.
 * @returns {{ sigim:number, bolak:number[] }[] | null}
 */
function kesish(M, w, qator, turlar, burchak) {
  const m = qator.length;
  const radix = [];
  let holatlar = 1;
  for (const t of turlar) { radix.push(holatlar); holatlar *= t.soni + 1; }
  if (holatlar * (m + 1) > 400000) return null;
  const engKatta = Math.max(...turlar.map(t => t.sigim));
  const bolakNarxi = new Float64Array(m * (engKatta + 1)).fill(Infinity);
  for (let i = 0; i < m; i++) {
    for (let L = 1; L <= engKatta && i + L <= m; L++) bolakNarxi[i * (engKatta + 1) + L] = reysNarxi(stat(M, w, qator.slice(i, i + L), burchak));
  }
  const dp = new Float64Array((m + 1) * holatlar).fill(Infinity);
  const ota = new Int32Array((m + 1) * holatlar).fill(-1);
  const otaTur = new Int16Array((m + 1) * holatlar).fill(-1);
  dp[0] = 0;
  for (let i = 0; i < m; i++) {
    for (let u = 0; u < holatlar; u++) {
      const v = dp[i * holatlar + u];
      if (v === Infinity) continue;
      turlar.forEach((t, ti) => {
        const ishlatilgan = Math.floor(u / radix[ti]) % (t.soni + 1);
        if (ishlatilgan >= t.soni) return;
        const u2 = u + radix[ti];
        for (let L = 1; L <= t.sigim && i + L <= m; L++) {
          const narx = bolakNarxi[i * (engKatta + 1) + L];
          const j = (i + L) * holatlar + u2;
          if (v + narx < dp[j]) { dp[j] = v + narx; ota[j] = i * holatlar + u; otaTur[j] = ti; }
        }
      });
    }
  }
  let eng = -1;
  for (let u = 0; u < holatlar; u++) if (dp[m * holatlar + u] < Infinity && (eng < 0 || dp[m * holatlar + u] < dp[m * holatlar + eng])) eng = u;
  if (eng < 0) return null;
  const out = [];
  let j = m * holatlar + eng;
  while (j > 0) {
    const o = ota[j];
    const i = Math.floor(o / holatlar);
    const i2 = Math.floor(j / holatlar);
    out.push({ sigim: turlar[otaTur[j]].sigim, bolak: qator.slice(i, i2) });
    j = o;
  }
  return out.reverse();
}

/**
 * Taqsimlash.
 *
 * @param {object} p
 * @param {[number, number]} p.markaz
 * @param {{ id:number, nuqta:[number, number] }[]} p.uylar — joylanadigan bolalar (va `mavjud` dagilar)
 * @param {{ id:number, sigim:number, bandReys?:number, ofset?:number }[]} p.haydovchilar
 *   bandReys — yo'ldagi (o'zgarmaydigan) reyslari soni; ofset — ular qachon tugashi, daqiqa
 * @param {{ daqiqa:(a:[number,number], b:[number,number]) => number }} [p.olchagich]
 * @param {{ key:string, driverId:number, ids:number[] }[]} [p.mavjud]
 *   Bor reyslar: ulardagi bolalar joyida qoladi, yangilari ularga ham qo'yilishi mumkin.
 *   Berilmasa — hammasi yangidan bo'linadi.
 * @param {(nomi:string, baho:number, reyslar:object[]) => void} [p.jurnal] — sinov uchun: har boshlanish bahosi
 * @returns {{ reyslar: { key:string|null, driverId:number, ids:number[], daqiqa:number }[], sigmagan:number[] }}
 *   reyslar — haydovchi bo'yicha, har haydovchida qisqa reys birinchi.
 */
export function yolBilanTaqsimlash({ markaz, uylar, haydovchilar, olchagich = togriChiziq, mavjud = null, jurnal = null }) {
  const n = uylar.length;
  const w = n + 1;
  const nuqta = [markaz, ...uylar.map(u => u.nuqta)];
  const M = new Float64Array(w * w);
  for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) M[i * w + j] = i === j ? 0 : olchagich.daqiqa(nuqta[i], nuqta[j]);
  const indeks = new Map(uylar.map((u, i) => [u.id, i + 1]));
  const kenglikKoef = Math.cos(markaz[0] * Math.PI / 180);
  const burchak = new Float64Array(w);
  for (let k = 1; k < w; k++) burchak[k] = Math.atan2(nuqta[k][0] - markaz[0], (nuqta[k][1] - markaz[1]) * kenglikKoef) * 180 / Math.PI;
  // Har bolaning 12 ta eng yaqin qo'shnisi (yo'l bo'yicha).
  const yaqinlik = (a, b) => Math.min(M[a * w + b], M[b * w + a]);
  const qoshni = [[]];
  for (let k = 1; k < w; k++) {
    const x = [];
    for (let j = 1; j < w; j++) if (j !== k) x.push(j);
    x.sort((a, b) => yaqinlik(k, a) - yaqinlik(k, b) || a - b);
    qoshni.push(x.slice(0, 12));
  }

  const h = haydovchilar
    .filter(x => (x.sigim || 0) > 0)
    .map(x => ({ id: x.id, sigim: x.sigim, reyslar: Math.max(0, ENG_KOP_REYS - (x.bandReys || 0)), ofset: x.ofset || 0 }));

  /** Yangi holat: bor reyslar (bo'lsa) joyida. */
  const dIndeks = new Map(h.map((x, d) => [x.id, d]));
  const yarat = () => {
    const holat = new Holat(M, w, h, qoshni, burchak);
    const joyda = new Set();
    for (const c of mavjud || []) {
      const d = dIndeks.get(c.driverId);
      if (d === undefined) continue;
      let si = holat.h[d].slotlar.find(x => !holat.slotlar[x].seq.length && !holat.slotlar[x].key);
      // Chegaradan ortiq qo'lda ochilgan reys ham joyida qoladi.
      if (si === undefined) si = holat.yangiSlot(d);
      const seq = c.ids.map(id => indeks.get(id)).filter(Boolean);
      seq.forEach(k => joyda.add(k));
      holat.qabul(new Map([[si, seq]]));
      holat.slotlar[si].key = c.key;
    }
    return { holat, joyda };
  };

  const { holat: birinchi, joyda } = yarat();
  // Joy yetmasa — markazga eng yaqinlari qoladi.
  const yangilar = [];
  for (let k = 1; k <= n; k++) if (!joyda.has(k)) yangilar.push(k);
  const bosh = birinchi.slotlar.reduce((s, x) => s + Math.max(0, x.sigim - x.seq.length), 0);
  const yaqindan = [...yangilar].sort((a, b) => M[a] - M[b] || a - b);
  const qoladiSoni = Math.max(0, yangilar.length - bosh);
  const qoladi = new Set(yaqindan.slice(0, qoladiSoni));
  const zaxira = qoladiSoni ? yaqindan.slice(qoladiSoni, qoladiSoni + TASHLASH_ZAXIRA) : [];
  const joylanadi = yangilar.filter(k => !qoladi.has(k));
  const tashlashBoshi = [...qoladi].reduce((s2, k) => s2 + TASHLASH_VAZNI * M[k], 0);
  /** Qidiruvga: kim qoladi (o'zgarishi mumkin) va kimlar bilan almashishi mumkin. */
  const tashlashga = (holat) => {
    if (mavjud) return;
    holat.qoladi = new Set(qoladi);
    holat.zaxira = new Set(zaxira);
    holat.tashlashNarxi = tashlashBoshi;
  };

  // (a) Uzoqdagilardan boshlab — ular joy tanlashda eng cheklangan.
  const uzoqdan = [...joylanadi].sort((a, b) => M[b] - M[a] || a - b);
  for (const k of uzoqdan) birinchi.joyla(k);
  tashlashga(birinchi);
  const boshlar = [birinchi];

  if (!mavjud && joylanadi.length > 1 && h.length) {
    // (b) Katta aylana va uni eng arzon bo'laklarga kesish. Aylana boshini
    //     markazdan o'tish arzon bo'lgan joylardan (tomonlar chegarasi) tanlaymiz.
    const aylana = kattaAylana(M, w, joylanadi);
    const turMap = new Map();
    for (const x of h) turMap.set(x.sigim, (turMap.get(x.sigim) || 0) + x.reyslar);
    const turlar = [...turMap.entries()].sort((a, b) => b[0] - a[0]).map(([sigim, soni]) => ({ sigim, soni }));
    const chegara = aylana.map((k, i) => {
      const keyingi = aylana[(i + 1) % aylana.length];
      return { i, narx: M[k * w] + M[keyingi] - M[k * w + keyingi] };
    }).sort((a, b) => a.narx - b.narx || a.i - b.i).slice(0, 3);
    for (const { i } of chegara) {
      const qator = [...aylana.slice(i + 1), ...aylana.slice(0, i + 1)];
      const bolaklar = kesish(M, w, qator, turlar, burchak);
      if (!bolaklar) continue;
      const { holat } = yarat();
      // Bo'laklar haydovchilarga: uzunidan boshlab eng kam band haydovchiga (sig'imi mos).
      const band = holat.h.map(() => 0);
      const soni = holat.h.map(() => 0);
      const tartibli = bolaklar.map(b => ({ ...b, st: stat(M, w, b.bolak, burchak) })).sort((a, b) => b.st.yol - a.st.yol);
      let yaroqli = true;
      for (const b of tartibli) {
        let eng = -1;
        holat.h.forEach((x, d) => {
          if (x.sigim !== b.sigim || soni[d] >= x.reyslar) return;
          if (eng < 0 || band[d] < band[eng]) eng = d;
        });
        if (eng < 0) { yaroqli = false; break; }
        holat.qabul(new Map([[holat.h[eng].slotlar[soni[eng]], b.bolak]]));
        band[eng] += b.st.yol + b.st.qayt + TAYYORLOV_DAQIQA;
        soni[eng] += 1;
      }
      if (!yaroqli) continue;
      holat.slotlar.forEach((_, si) => holat.tekisla(si));
      tashlashga(holat);
      boshlar.push(holat);
    }

    // (c) Markaz atrofida burchak bo'yicha bo'laklar (1-reyslar avval).
    const doira = [...joylanadi].sort((a, b) => burchak[a] - burchak[b] || a - b);
    for (const siljish of [0, Math.floor(doira.length / 2)]) {
      const qator = [...doira.slice(siljish), ...doira.slice(0, siljish)];
      const { holat } = yarat();
      const tartib = [];
      for (let r = 0; r < ENG_KOP_REYS; r++) holat.h.forEach(x => { if (x.slotlar[r] !== undefined) tartib.push(x.slotlar[r]); });
      let i = 0;
      for (const si of tartib) {
        const s = holat.slotlar[si];
        const olinadi = qator.slice(i, i + s.sigim - s.seq.length);
        i += olinadi.length;
        if (olinadi.length) holat.qabul(new Map([[si, [...s.seq, ...olinadi]]]));
      }
      if (i < qator.length) continue; // sig'madi — bu boshlanish yaroqsiz
      holat.slotlar.forEach((_, si) => holat.tekisla(si));
      tashlashga(holat);
      boshlar.push(holat);
    }
    boshlar.forEach((holat, i) => {
      jurnal?.(`boshlanish ${i} oldin`, holat.J, holat.reyslar(uylar));
      holat.qidir();
      jurnal?.(`boshlanish ${i} keyin`, holat.J, holat.reyslar(uylar));
    });
  }

  const umumiy = (holat) => holat.J + (holat.tashlashNarxi || 0);
  let eng = boshlar[0];
  for (const holat of boshlar) if (umumiy(holat) < umumiy(eng) - EPS) eng = holat;
  eng.slotlar.forEach((_, si) => eng.tekisla(si, true));

  // Qaysidir boshlanishda sig'magan bola boshqasida joylangan bo'lishi mumkin — faqat haqiqatan joysizlari.
  const joylangan = new Set(eng.slotlar.flatMap(s => s.seq));
  const sigmagan = [];
  for (let k = 1; k <= n; k++) if (!joylangan.has(k)) sigmagan.push(uylar[k - 1].id);
  return { reyslar: eng.reyslar(uylar), sigmagan };
}
