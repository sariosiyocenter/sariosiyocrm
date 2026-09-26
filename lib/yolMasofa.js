/**
 * Yo'l bo'yicha masofa va vaqt (2026-09-27).
 *
 * Ilgari hamma hisob ikki nuqta orasidagi to'g'ri chiziq bilan qilinardi.
 * Sariosiyo tog' va vodiylarda: xaritada 5 km ko'ringan uy yo'l bilan 11 km
 * bo'lishi mumkin, qo'shni vodiydagi qishloqqa esa to'g'ridan-to'g'ri yo'l
 * yo'q. Shuning uchun taqsimot ham, bekatlar tartibi ham endi haqiqiy yo'l
 * bo'yicha — OSRM (OpenStreetMap yo'llari ustidagi ochiq marshrut dasturi).
 *
 * So'rovlar brauzerdan to'g'ridan-to'g'ri OSRM ga ketadi (Vercel orqali emas):
 * ochiq server bitta manzildan soniyasiga bitta so'rovga ruxsat beradi, Vercel
 * ning umumiy manzillari esa boshqa saytlar bilan bo'lishiladi. Serverga
 * faqat nuqtalar ketadi — ism, telefon ketmaydi.
 *
 * OSRM javob bermasa (internet, server band) hech narsa to'xtamaydi:
 * yetishmagan juftlar uchun to'g'ri chiziq bahosi ishlatiladi.
 *
 * O'lchagich ("olchagich") — ikki funksiya: km(a, b) va daqiqa(a, b), nuqtalar
 * [lat, lng]. Rejalash funksiyalari faqat shu bilan ishlaydi, qayerdan
 * kelganini bilmaydi.
 */
import { distanceKm } from './tartib.js';

/** Ochiq OSRM serveri (FOSSGIS). O'z serverimiz bo'lsa — shu manzil almashtiriladi. */
export const OSRM_MANZIL = 'https://router.project-osrm.org';
/** Ochiq serverda bitta jadval so'rovi: manbalar × manzillar ≤ 100 × 100. */
const JADVAL_CHEGARA = 10000;
/** Foydalanish qoidasi: soniyasiga ko'pi bilan bitta so'rov. */
const ORALIQ_MS = 1100;
/** Javob kutish — server javob bermasa admin uzoq kutib qolmasin. */
const KUTISH_MS = 10000;

/** To'g'ri chiziq bo'yicha o'rtacha tezlik (km/soat) — eski hisob bilan bir xil. */
export const TOGRI_TEZLIK = 25;
/**
 * OSRM vaqti yengil mashina uchun, bo'sh yo'lda. Bolalar bilan to'la
 * mikroavtobus qishloq ko'chalarida sekinroq yuradi.
 */
export const YOL_SEKINLIK = 1.25;

/** To'g'ri chiziq o'lchagichi — OSRM yo'q paytdagi va eski hisob. */
export const togriChiziq = {
  yol: false,
  km: (a, b) => distanceKm(a, b),
  daqiqa: (a, b) => (distanceKm(a, b) / TOGRI_TEZLIK) * 60,
};

/** Nuqta kaliti: 5 xona (~1 m) — bitta uydagi aka-uka bitta nuqta. */
export function nuqtaKaliti(n) {
  return `${Number(n[0]).toFixed(5)},${Number(n[1]).toFixed(5)}`;
}

/** Google polyline (5 xona), [lat, lng] ro'yxati → qator. OSRM URL ni 3 barobar qisqartiradi. */
export function polylineKodla(nuqtalar) {
  const qism = (v) => {
    let x = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (x >= 0x20) { s += String.fromCharCode((0x20 | (x & 0x1f)) + 63); x >>= 5; }
    return s + String.fromCharCode(x + 63);
  };
  let lat0 = 0;
  let lng0 = 0;
  let s = '';
  for (const [lat, lng] of nuqtalar) {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    s += qism(la - lat0) + qism(ln - lng0);
    lat0 = la;
    lng0 = ln;
  }
  return s;
}

/** Polyline qatori → [lat, lng] ro'yxati. */
export function polylineOch(s) {
  const out = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const son = () => {
    let b;
    let shift = 0;
    let r = 0;
    do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  while (i < s.length) {
    lat += son();
    lng += son();
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

/**
 * URL dagi nuqtalar qismi. Polyline qisqa, lekin ikki ketma-ket nuqtaning
 * kengligi yoki uzunligi bir xil bo'lsa unda "?" chiqadi va OSRM uni so'rov
 * boshi deb o'qiydi ("Query string malformed") — unda oddiy "lng,lat;…".
 */
function nuqtalarQatori(nuqtalar) {
  const p = polylineKodla(nuqtalar);
  if (!p.includes('?')) return `polyline(${encodeURIComponent(p)})`;
  return nuqtalar.map(([lat, lng]) => `${Number(lng).toFixed(5)},${Number(lat).toFixed(5)}`).join(';');
}

const kut = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * OSRM bilan ishlovchi kesh. Bir sahifa uchun bitta nusxa: bir marta
 * o'qilgan juft qayta so'ralmaydi (bola qo'shilsa faqat yangi uy so'raladi).
 */
export class YolManbai {
  constructor({ manzil = OSRM_MANZIL, fetchFn = null } = {}) {
    this.manzil = String(manzil).replace(/\/+$/, '');
    this.fetchFn = fetchFn;
    /** nuqta kaliti → butun son (juftlar shu son bilan saqlanadi — xotira kam ketadi). */
    this.idlar = new Map();
    this.kmM = new Map();
    this.daqM = new Map();
    this.chiziqlar = new Map();
    this.navbat = Promise.resolve();
    this.oxirgi = 0;
  }

  id(kalit) {
    let i = this.idlar.get(kalit);
    if (i === undefined) { i = this.idlar.size; this.idlar.set(kalit, i); }
    return i;
  }

  juft(ia, ib) { return ia * 1048576 + ib; }

  /** OSRM so'rovi: navbat bilan, oralig'i kamida ORALIQ_MS. */
  sorov(url) {
    const ish = this.navbat.then(async () => {
      const qoldi = this.oxirgi + ORALIQ_MS - Date.now();
      if (qoldi > 0) await kut(qoldi);
      this.oxirgi = Date.now();
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = ctrl ? setTimeout(() => ctrl.abort(), KUTISH_MS) : null;
      try {
        const f = this.fetchFn || globalThis.fetch;
        const r = await f(url, ctrl ? { signal: ctrl.signal } : undefined);
        const j = await r.json().catch(() => null);
        if (!j) throw new Error(`OSRM javob bermadi (${r.status})`);
        if (j.code !== 'Ok') throw new Error(j.message || j.code || `OSRM ${r.status}`);
        return j;
      } finally {
        if (t) clearTimeout(t);
      }
    });
    // Xato navbatni to'xtatmasin.
    this.navbat = ish.catch(() => {});
    return ish;
  }

  /** Shu nuqtalar orasidagi hamma juft ma'lummi. */
  toliqmi(nuqtalar) {
    const ids = [...new Set(nuqtalar.map(nuqtaKaliti))].map(k => this.idlar.get(k));
    if (ids.some(i => i === undefined)) return ids.length < 2;
    for (const a of ids) for (const b of ids) if (a !== b && !this.kmM.has(this.juft(a, b))) return false;
    return true;
  }

  /**
   * Nuqtalar orasidagi yo'l masofalarini o'qiydi (yetishmaganlarini).
   * 100 tagacha nuqta — bitta so'rov; ko'p bo'lsa qatorlab bo'linadi.
   * @returns {Promise<{ ok: boolean, xato?: string }>}
   */
  async tayyorla(nuqtalar, { onProgress } = {}) {
    const kalitlar = [...new Set(nuqtalar.map(nuqtaKaliti))];
    const n = kalitlar.length;
    if (n < 2) return { ok: true };
    const ids = kalitlar.map(k => this.id(k));
    const yetmaydi = () => ids.map((a, i) => i).filter(i => ids.some(b => b !== ids[i] && !this.kmM.has(this.juft(ids[i], b))));
    if (!yetmaydi().length) return { ok: true };

    const koord = kalitlar.map(k => k.split(',').map(Number));
    const yol = `${this.manzil}/table/v1/driving/${nuqtalarQatori(koord)}`;
    const bolak = Math.max(1, Math.floor(JADVAL_CHEGARA / n));
    // Avval umuman yangi uylar (ularning qatori eskilarga teskari yo'nalishni ham
    // to'ldiradi), keyin qolgan bo'shliqlar — bitta bola qo'shilsa bitta qator so'raladi.
    for (let bosqich = 0; bosqich < 2; bosqich++) {
      const yangi = yetmaydi();
      if (!yangi.length) break;
      const tamoman = yangi.filter(i => ids.every(b => b === ids[i] || !this.kmM.has(this.juft(ids[i], b))));
      const tanlov = bosqich === 0 && tamoman.length ? tamoman : yangi;
      for (let s = 0; s < tanlov.length; s += bolak) {
        const qator = tanlov.slice(s, s + bolak);
        let j;
        try {
          j = await this.sorov(`${yol}?annotations=distance,duration&sources=${qator.join(';')}`);
        } catch (e) {
          return { ok: false, xato: e?.name === 'AbortError' ? 'OSRM javob bermadi' : (e?.message || 'OSRM xatosi') };
        }
        qator.forEach((i, r) => {
          const a = ids[i];
          for (let c = 0; c < n; c++) {
            if (c === i) continue;
            const b = ids[c];
            const m = j.distances?.[r]?.[c];
            const sek = j.durations?.[r]?.[c];
            // Yo'l topilmadi (null) — NaN: qayta so'ralmaydi, o'lchagich bahoga o'tadi.
            const km = m == null ? NaN : m / 1000;
            const dq = sek == null ? NaN : sek / 60;
            this.kmM.set(this.juft(a, b), km);
            this.daqM.set(this.juft(a, b), dq);
            // Teskari yo'nalish deyarli bir xil (farq ~0.2%) — kerak bo'lguncha shu.
            if (!this.kmM.has(this.juft(b, a))) {
              this.kmM.set(this.juft(b, a), km);
              this.daqM.set(this.juft(b, a), dq);
            }
          }
        });
        onProgress?.(Math.min(1, (s + qator.length) / tanlov.length));
      }
    }
    return { ok: true };
  }

  /** Yo'l o'lchagichi. Noma'lum juft — to'g'ri chiziq bahosi. */
  olchagich() {
    const qiymat = (M, a, b) => {
      const ka = nuqtaKaliti(a);
      const kb = nuqtaKaliti(b);
      if (ka === kb) return 0;
      const ia = this.idlar.get(ka);
      const ib = this.idlar.get(kb);
      if (ia === undefined || ib === undefined) return null;
      const v = M.get(this.juft(ia, ib));
      return Number.isFinite(v) ? v : null;
    };
    return {
      yol: true,
      km: (a, b) => { const v = qiymat(this.kmM, a, b); return v === null ? togriChiziq.km(a, b) : v; },
      daqiqa: (a, b) => { const v = qiymat(this.daqM, a, b); return v === null ? togriChiziq.daqiqa(a, b) : v * YOL_SEKINLIK; },
    };
  }

  /**
   * Nuqtalar ketma-ketligi bo'ylab yo'l chizig'i (xarita uchun).
   * @returns {Promise<[number, number][] | null>}
   */
  async chiziq(nuqtalar) {
    if (nuqtalar.length < 2) return null;
    const kalit = nuqtalar.map(nuqtaKaliti).join(';');
    if (this.chiziqlar.has(kalit)) return this.chiziqlar.get(kalit);
    try {
      const j = await this.sorov(`${this.manzil}/route/v1/driving/${nuqtalarQatori(nuqtalar)}?overview=full&geometries=polyline&steps=false`);
      const g = j.routes?.[0]?.geometry;
      const natija = g ? polylineOch(g) : null;
      if (this.chiziqlar.size > 200) this.chiziqlar.clear();
      this.chiziqlar.set(kalit, natija);
      return natija;
    } catch {
      return null;
    }
  }
}
