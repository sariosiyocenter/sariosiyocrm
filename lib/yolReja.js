/**
 * Bolalarni mashinalarga yo'l bo'yicha taqsimlash (2026-09-27).
 *
 * Ilgari: markaz atrofida burchak bo'yicha "pirog bo'laklari"
 * (lib/rejalash.js → sektorlarga). Yo'llar markazdan nurday tarqalgan joyda
 * yaxshi ishlardi, lekin bitta bo'lakka ikki xil vodiy tushsa haydovchi
 * markaz orqali aylanib o'tardi (egasi xaritada ko'rsatdi: qizil mashina
 * shimoli-sharq va janubi-sharqqa birdan ketgan).
 *
 * Endi hisob har bir juft uy orasidagi haqiqiy yo'l vaqti bilan
 * (lib/yolMasofa.js, OSRM):
 *   1. Boshlang'ich reja: uzoqdagi bolalardan boshlab har biri eng arzon
 *      joyga; yana bir necha variant — markaz atrofida aylana bo'ylab bo'laklar.
 *   2. Mahalliy qidiruv: 1–3 bolani boshqa reysga ko'chirish, bola yoki
 *      guruhlarni almashtirish, ikki reysning davomini almashtirish — umumiy
 *      baho kamaysa qabul qilinadi. Eng arzon variant olinadi.
 *   3. Har reys ichidagi tartib — lib/tartib.js (2-opt, or-opt).
 *
 * Bugungi (2026-09-26) haqiqiy 93 bola, 2 mashina (18 + 7 o'rin) bilan:
 * eski usul 61 bolani 216 km da, oxirgi bola ~8 soatda; yangisi 75 bolani
 * 203 km da, oxirgi bola ~5.5 soatda.
 *
 * Baho (daqiqa) = hamma haydovchining band vaqti yig'indisi
 *               + 2 × eng kech tugatadigan haydovchining vaqti.
 * Birinchisi ortiqcha yurishni jazolaydi (bitta vodiy — bitta mashina),
 * ikkinchisi oxirgi bola kech qolishini (mashinalar parallel ishlasin).
 * Haydovchining vaqti: reyslari qisqasidan boshlab; har reysdan keyin
 * markazga qaytib, 10 daqiqada keyingi bolalarni o'tqazadi. Oxirgi reysdan
 * keyingi qaytish hisobga kirmaydi — bolalar allaqachon uyda.
 *
 * Sig'im qat'iy. Hammaga joy yetmasa, markazga eng yaqin bolalar qoladi:
 * ular piyoda yetadi yoki admin qo'lda joylaydi.
 *
 * Fayl sof: bazaga ham, brauzerga ham bog'liq emas.
 */
import { yolniTekisla } from './tartib.js';
import { togriChiziq } from './yolMasofa.js';
import { BEKAT_DAQIQA } from './rejalash.js';

/** Reysdan keyin markazda keyingi bolalarni o'tqazish, daqiqa. */
export const TAYYORLOV_DAQIQA = 10;
/** Eng kech tugatadigan haydovchi vaqtining vazni (yuqorida). */
export const KECHLIK_VAZNI = 2;
/** Bir haydovchiga kuniga ko'pi bilan shuncha reys (rejaTahrir.js bilan bir xil). */
export const ENG_KOP_REYS = 3;

const EPS = 1e-6;

class Holat {
  /**
   * @param {Float64Array} M — (n+1)×(n+1) vaqt jadvali, 0 — markaz
   * @param {number} w — jadval kengligi
   * @param {{ sigim:number, reyslar:number, ofset:number }[]} h — haydovchilar
   */
  constructor(M, w, h) {
    this.M = M;
    this.w = w;
    this.h = h.map(x => ({ ...x, slotlar: [] }));
    this.slotlar = [];
    this.h.forEach((x, d) => {
      for (let r = 0; r < x.reyslar; r++) {
        x.slotlar.push(this.slotlar.length);
        this.slotlar.push({ d, sigim: x.sigim, seq: [], yol: 0, qotgan: false, key: null });
      }
    });
    this.band = this.h.map(() => 0);
    this.F = this.h.map(x => x.ofset || 0);
    this.bandJami = 0;
    this.J = KECHLIK_VAZNI * Math.max(0, ...this.F);
  }

  yolVaqti(seq) {
    const { M, w } = this;
    let s = 0;
    let o = 0;
    for (const i of seq) { s += M[o * w + i]; o = i; }
    return s + seq.length * BEKAT_DAQIQA;
  }

  qaytish(seq) {
    return seq.length ? this.M[seq[seq.length - 1] * this.w] + TAYYORLOV_DAQIQA : 0;
  }

  /** Haydovchining band vaqti va tugashi (`oz` — sinovdagi o'zgarishlar: slot → seq). */
  haydovchi(d, oz = null) {
    const reyslar = [];
    for (const si of this.h[d].slotlar) {
      const bor = oz && oz.has(si);
      const seq = bor ? oz.get(si) : this.slotlar[si].seq;
      if (!seq.length) continue;
      reyslar.push({ yol: bor ? this.yolVaqti(seq) : this.slotlar[si].yol, qayt: this.qaytish(seq) });
    }
    reyslar.sort((a, b) => a.yol - b.yol);
    let band = 0;
    reyslar.forEach((r, i) => { band += r.yol + (i < reyslar.length - 1 ? r.qayt : 0); });
    return { band, F: (this.h[d].ofset || 0) + band };
  }

  /** O'zgarish qo'llansa baho qancha bo'ladi. */
  bahola(oz) {
    const tegdi = new Set([...oz.keys()].map(si => this.slotlar[si].d));
    const yangi = new Map();
    let bandJami = this.bandJami;
    for (const d of tegdi) {
      const x = this.haydovchi(d, oz);
      yangi.set(d, x);
      bandJami += x.band - this.band[d];
    }
    let maxF = 0;
    for (let d = 0; d < this.h.length; d++) {
      const F = yangi.has(d) ? yangi.get(d).F : this.F[d];
      if (F > maxF) maxF = F;
    }
    return { J: bandJami + KECHLIK_VAZNI * maxF, yangi };
  }

  qabul(oz, natija) {
    for (const [si, seq] of oz) {
      this.slotlar[si].seq = seq;
      this.slotlar[si].yol = this.yolVaqti(seq);
    }
    for (const [d, x] of natija.yangi) {
      this.bandJami += x.band - this.band[d];
      this.band[d] = x.band;
      this.F[d] = x.F;
    }
    this.J = natija.J;
  }

  /** Bo'sh reysga faqat haydovchining birinchi bo'sh o'rni — bir xil variantlar ko'paymasin. */
  ochiqmi(si) {
    const s = this.slotlar[si];
    if (s.qotgan || s.seq.length >= s.sigim) return false;
    if (s.seq.length) return true;
    return this.h[s.d].slotlar.find(x => !this.slotlar[x].seq.length) === si;
  }

  engYaxshiJoy(seq, k) {
    const { M, w } = this;
    let engP = 0;
    let engD = Infinity;
    for (let p = 0; p <= seq.length; p++) {
      const a = p === 0 ? 0 : seq[p - 1];
      const b = seq[p];
      const d = M[a * w + k] + (b === undefined ? 0 : M[k * w + b] - M[a * w + b]);
      if (d < engD) { engD = d; engP = p; }
    }
    return engP;
  }

  qoy(seq, k) {
    const p = this.engYaxshiJoy(seq, k);
    return [...seq.slice(0, p), k, ...seq.slice(p)];
  }

  /** Bolani eng arzon joyga qo'yadi. Qaytadi: qo'yildimi. */
  joyla(k) {
    let eng = null;
    for (let si = 0; si < this.slotlar.length; si++) {
      if (!this.ochiqmi(si)) continue;
      const oz = new Map([[si, this.qoy(this.slotlar[si].seq, k)]]);
      const nat = this.bahola(oz);
      if (!eng || nat.J < eng.nat.J - EPS) eng = { oz, nat };
    }
    if (!eng) return false;
    this.qabul(eng.oz, eng.nat);
    return true;
  }

  /** Reys ichidagi tartibni tekislaydi (qotgan reysga tegilmaydi). */
  tekisla(si) {
    const s = this.slotlar[si];
    if (s.qotgan || s.seq.length < 3) return;
    const { yol } = yolniTekisla(this.M, this.w, s.seq);
    const oz = new Map([[si, yol]]);
    this.qabul(oz, this.bahola(oz));
  }

  /** Yaxshilanish topilsa qo'llaydi va ikkala reys tartibini tekislaydi. */
  sina(oz) {
    const nat = this.bahola(oz);
    if (nat.J >= this.J - EPS) return false;
    this.qabul(oz, nat);
    for (const si of oz.keys()) this.tekisla(si);
    return true;
  }

  /**
   * Mahalliy qidiruv, yaxshilanmay qolguncha:
   *  - ko'chirish: 1–3 ta ketma-ket bolani boshqa reysga (bir mahalla birga ko'chadi);
   *  - almashtirish: ikki reysdagi ikki bolani yoki 1–3 bolalik guruhlarni;
   *  - dumlarni almashtirish (2-opt*): A reysning davomi B ga, B niki A ga —
   *    ikki vodiy aralashib qolgan reyslarni ajratadi.
   */
  qidir(chegaraMs = 1500) {
    const boshi = Date.now();
    const S = this.slotlar.length;
    const sig = (si) => this.slotlar[si].sigim;
    for (let aylanish = 0; aylanish < 80; aylanish++) {
      let yaxshilandi = false;

      // Ko'chirish (1–3 bola).
      for (let si = 0; si < S; si++) {
        if (this.slotlar[si].qotgan) continue;
        for (let L = 1; L <= 3; L++) {
          for (let pos = 0; pos + L <= this.slotlar[si].seq.length; pos++) {
            const seq = this.slotlar[si].seq;
            const bolak = seq.slice(pos, pos + L);
            const qolgan = [...seq.slice(0, pos), ...seq.slice(pos + L)];
            let eng = null;
            for (let ti = 0; ti < S; ti++) {
              if (ti === si || !this.ochiqmi(ti)) continue;
              const t = this.slotlar[ti];
              if (t.seq.length + L > t.sigim) continue;
              if (!t.seq.length && t.d === this.slotlar[si].d && !qolgan.length) continue;
              let yangi = t.seq;
              for (const k of bolak) yangi = this.qoy(yangi, k);
              const oz = new Map([[si, qolgan], [ti, yangi]]);
              const nat = this.bahola(oz);
              if (nat.J < this.J - EPS && (!eng || nat.J < eng.nat.J - EPS)) eng = { oz, nat };
            }
            if (eng) {
              this.qabul(eng.oz, eng.nat);
              for (const x of eng.oz.keys()) this.tekisla(x);
              yaxshilandi = true;
              pos = -1;
            }
          }
        }
      }

      // Almashtirish (joyida) va dumlarni almashtirish.
      for (let si = 0; si < S; si++) {
        if (this.slotlar[si].qotgan) continue;
        for (let ti = si + 1; ti < S; ti++) {
          if (this.slotlar[ti].qotgan) continue;
          let A = this.slotlar[si].seq;
          let B = this.slotlar[ti].seq;
          if (!A.length && !B.length) continue;
          for (let p = 0; p < A.length; p++) {
            for (let q = 0; q < B.length; q++) {
              const A2 = [...A];
              const B2 = [...B];
              [A2[p], B2[q]] = [B2[q], A2[p]];
              if (this.sina(new Map([[si, A2], [ti, B2]]))) {
                yaxshilandi = true;
                A = this.slotlar[si].seq;
                B = this.slotlar[ti].seq;
              }
            }
          }
          // Guruh almashtirish: A dagi 1–3 ketma-ket bola B dagi 1–3 bola bilan
          // (har biri yangi reysida eng arzon joyga) — to'la reyslar orasida
          // butun mahallani almashtirish shu bilan bo'ladi.
          for (let La = 1; La <= 3; La++) {
            for (let Lb = 1; Lb <= 3; Lb++) {
              if (La === 1 && Lb === 1) continue;
              for (let p = 0; p + La <= A.length; p++) {
                for (let q = 0; q + Lb <= B.length; q++) {
                  if (A.length - La + Lb > sig(si) || B.length - Lb + La > sig(ti)) continue;
                  let A2 = [...A.slice(0, p), ...A.slice(p + La)];
                  let B2 = [...B.slice(0, q), ...B.slice(q + Lb)];
                  for (const k of B.slice(q, q + Lb)) A2 = this.qoy(A2, k);
                  for (const k of A.slice(p, p + La)) B2 = this.qoy(B2, k);
                  if (this.sina(new Map([[si, A2], [ti, B2]]))) {
                    yaxshilandi = true;
                    A = this.slotlar[si].seq;
                    B = this.slotlar[ti].seq;
                  }
                }
              }
            }
          }
          for (let p = 0; p <= A.length; p++) {
            for (let q = 0; q <= B.length; q++) {
              if ((p === A.length && q === B.length) || (p === 0 && q === 0)) continue;
              const A2 = [...A.slice(0, p), ...B.slice(q)];
              const B2 = [...B.slice(0, q), ...A.slice(p)];
              if (A2.length > sig(si) || B2.length > sig(ti)) continue;
              if (this.sina(new Map([[si, A2], [ti, B2]]))) {
                yaxshilandi = true;
                A = this.slotlar[si].seq;
                B = this.slotlar[ti].seq;
              }
            }
          }
        }
      }
      if (!yaxshilandi || Date.now() - boshi > chegaraMs) break;
    }
  }

  /** Natija: haydovchi bo'yicha, har haydovchida qisqa reys birinchi. */
  reyslar(uylar) {
    const out = [];
    this.h.forEach((x, d) => {
      const bu = x.slotlar.map(si => this.slotlar[si]).filter(s => s.seq.length || s.key);
      bu.sort((a, b) => a.yol - b.yol);
      for (const s of bu) out.push({ key: s.key, driverId: x.id, ids: s.seq.map(k => uylar[k - 1].id), daqiqa: s.yol });
    });
    return out;
  }
}

/**
 * Taqsimlash.
 *
 * Bir necha xil boshlang'ich reja qidiruvdan o'tkaziladi va eng arzoni
 * olinadi: (1) uzoqdagilardan boshlab eng arzon joyga qo'yish, (2) markaz
 * atrofida aylana bo'ylab ketma-ket bo'laklar (har xil burchakdan
 * boshlab). Mahalliy qidiruv bitta boshlanishdan chiqib keta olmaydigan
 * "chuqurchalar" shunday aylanib o'tiladi. Hammasi ~1.5 soniyagacha.
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
 * @param {number} [p.vaqtMs] — qidiruvga ajratilgan vaqt
 * @returns {{ reyslar: { key:string|null, driverId:number, ids:number[], daqiqa:number }[], sigmagan:number[] }}
 *   reyslar — haydovchi bo'yicha, har haydovchida qisqa reys birinchi.
 */
export function yolBilanTaqsimlash({ markaz, uylar, haydovchilar, olchagich = togriChiziq, mavjud = null, vaqtMs = 700 }) {
  const boshi = Date.now();
  const n = uylar.length;
  const w = n + 1;
  const nuqta = [markaz, ...uylar.map(u => u.nuqta)];
  const M = new Float64Array(w * w);
  for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) M[i * w + j] = i === j ? 0 : olchagich.daqiqa(nuqta[i], nuqta[j]);
  const indeks = new Map(uylar.map((u, i) => [u.id, i + 1]));

  const h = haydovchilar
    .filter(x => (x.sigim || 0) > 0)
    .map(x => ({ id: x.id, sigim: x.sigim, reyslar: Math.max(0, ENG_KOP_REYS - (x.bandReys || 0)), ofset: x.ofset || 0 }));
  const dIndeks = new Map(h.map((x, d) => [x.id, d]));

  /** Yangi holat: bor reyslar (bo'lsa) joyida. */
  const yarat = () => {
    const holat = new Holat(M, w, h);
    const joyda = new Set();
    for (const c of mavjud || []) {
      const d = dIndeks.get(c.driverId);
      if (d === undefined) continue;
      let si = holat.h[d].slotlar.find(x => !holat.slotlar[x].seq.length && !holat.slotlar[x].key);
      if (si === undefined) {
        // Chegaradan ortiq qo'lda ochilgan reys ham joyida qoladi.
        si = holat.slotlar.length;
        holat.h[d].slotlar.push(si);
        holat.slotlar.push({ d, sigim: holat.h[d].sigim, seq: [], yol: 0, qotgan: false, key: null });
      }
      const seq = c.ids.map(id => indeks.get(id)).filter(Boolean);
      seq.forEach(k => joyda.add(k));
      const oz = new Map([[si, seq]]);
      holat.qabul(oz, holat.bahola(oz));
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
  const qoladi = new Set(yaqindan.slice(0, Math.max(0, yangilar.length - bosh)));
  const joylanadi = yangilar.filter(k => !qoladi.has(k));

  // 1) Uzoqdagilardan boshlab — ular joy tanlashda eng cheklangan.
  const sigmaganK = [];
  const uzoqdan = [...joylanadi].sort((a, b) => M[b] - M[a] || a - b);
  for (const k of uzoqdan) if (!birinchi.joyla(k)) sigmaganK.push(k);
  let eng = birinchi;

  if (!mavjud && joylanadi.length > 1) {
    birinchi.qidir(vaqtMs / 3);
    // 2) Aylana bo'ylab bo'laklar: reyslar (1-reyslar avval) ketma-ket to'ldiriladi.
    const burchak = (k) => Math.atan2(nuqta[k][0] - markaz[0], (nuqta[k][1] - markaz[1]) * Math.cos(markaz[0] * Math.PI / 180));
    const aylana = [...joylanadi].sort((a, b) => burchak(a) - burchak(b) || a - b);
    const boshlanishlar = 8;
    for (let b = 0; b < boshlanishlar && Date.now() - boshi < vaqtMs; b++) {
      const siljish = Math.floor((b * aylana.length) / boshlanishlar);
      const qator = [...aylana.slice(siljish), ...aylana.slice(0, siljish)];
      const { holat } = yarat();
      const tartib = [];
      for (let r = 0; r < ENG_KOP_REYS; r++) holat.h.forEach(x => { if (x.slotlar[r] !== undefined) tartib.push(x.slotlar[r]); });
      let i = 0;
      for (const si of tartib) {
        const s = holat.slotlar[si];
        const olinadi = qator.slice(i, i + s.sigim - s.seq.length);
        i += olinadi.length;
        if (!olinadi.length) continue;
        const oz = new Map([[si, [...s.seq, ...olinadi]]]);
        holat.qabul(oz, holat.bahola(oz));
        holat.tekisla(si);
      }
      if (i < qator.length) continue; // sig'madi — bu boshlanish yaroqsiz
      holat.qidir(Math.max(100, (vaqtMs - (Date.now() - boshi)) / 2));
      if (holat.J < eng.J - EPS) eng = holat;
    }
  }
  eng.slotlar.forEach((s, si) => { if (!s.key) eng.tekisla(si); });

  const sigmagan = [...sigmaganK, ...qoladi].map(k => uylar[k - 1].id);
  // Qidiruv "sig'maganlar"ni boshqa holatda joylagan bo'lishi mumkin — faqat haqiqatan joysizlari.
  const joylangan = new Set(eng.slotlar.flatMap(s => s.seq));
  return { reyslar: eng.reyslar(uylar), sigmagan: sigmagan.filter(id => !joylangan.has(indeks.get(id))) };
}
