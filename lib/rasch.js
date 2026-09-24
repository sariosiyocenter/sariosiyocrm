// Rasch modeli (dixotomik): savol qiyinligi va o'quvchi qobiliyati bitta
// shkalada (logit). Milliy sertifikat uslubidagi sinov uchun: to'g'ri javoblar
// soni emas, qaysi savolni topgani muhim — qiyin savolni topgan yuqoriroq turadi,
// har smenaga boshqa savol tushsa ham ballar solishtiriladi.
//
// Baholash — JML (joint maximum likelihood), Nyuton qadamlari bilan. Hammasini
// topgan yoki hech birini topmagan o'quvchi (va savol) baholashdan chiqariladi,
// keyin 0,3 tuzatish bilan (r = 0,3 yoki n − 0,3) alohida hisoblanadi.
// Shkala: T-ball = 50 + 10·z (shu imtihon qatnashchilari bo'yicha).

const P = (theta, b) => 1 / (1 + Math.exp(b - theta));
const qadam = (x) => Math.max(-1, Math.min(1, x));

/** Bitta parametrni (qolganlari ma'lum) Nyuton bilan topish: sum P = maqsad. */
function yech(maqsad, ehtimollar, boshlangich = 0, belgi = 1) {
  let x = boshlangich;
  for (let k = 0; k < 60; k++) {
    let kutilgan = 0, dispersiya = 0;
    for (const f of ehtimollar) {
      const p = f(x);
      kutilgan += p;
      dispersiya += p * (1 - p);
    }
    if (dispersiya < 1e-9) break;
    const d = qadam((maqsad - kutilgan) / dispersiya) * belgi;
    x += d;
    if (Math.abs(d) < 1e-4) break;
  }
  return x;
}

/**
 * @param {Array<Record<string, 0|1>>} javoblar — har o'quvchi: {savolId: 1 (to'g'ri) | 0}.
 *   Berilmagan savol — o'sha o'quvchiga tushmagan (hisobga olinmaydi).
 * @returns {{ theta: number[], qiyinlik: Map<string, number>, iteratsiya: number, yaqinlashdi: boolean }}
 */
export function raschBaholash(javoblar) {
  const n = javoblar.length;
  const savollar = [...new Set(javoblar.flatMap(j => Object.keys(j)))];
  const theta = new Array(n).fill(0);
  const b = new Map(savollar.map(q => [q, 0]));

  // Chekka o'quvchi va savollarni ketma-ket chiqarish (biri chiqsa, boshqasi chekkaga aylanishi mumkin).
  const faolO = new Set(javoblar.map((_, i) => i));
  const faolS = new Set(savollar);
  for (let o = 0; o < 20; o++) {
    let ozgardi = false;
    for (const i of [...faolO]) {
      let r = 0, m = 0;
      for (const [q, x] of Object.entries(javoblar[i])) if (faolS.has(q)) { r += x; m++; }
      if (m === 0 || r === 0 || r === m) { faolO.delete(i); ozgardi = true; }
    }
    for (const q of [...faolS]) {
      let s = 0, m = 0;
      for (const i of faolO) if (q in javoblar[i]) { s += javoblar[i][q]; m++; }
      if (m === 0 || s === 0 || s === m) { faolS.delete(q); ozgardi = true; }
    }
    if (!ozgardi) break;
  }

  // Boshlang'ich qiymatlar: logit ulushlar.
  for (const q of faolS) {
    let s = 0, m = 0;
    for (const i of faolO) if (q in javoblar[i]) { s += javoblar[i][q]; m++; }
    b.set(q, Math.log((m - s) / s));
  }
  const markaz = () => {
    const l = [...faolS].map(q => b.get(q));
    const ort = l.length ? l.reduce((a, x) => a + x, 0) / l.length : 0;
    for (const q of faolS) b.set(q, b.get(q) - ort);
  };
  markaz();
  for (const i of faolO) {
    let r = 0, m = 0;
    for (const [q, x] of Object.entries(javoblar[i])) if (faolS.has(q)) { r += x; m++; }
    theta[i] = Math.log(r / (m - r));
  }

  let iteratsiya = 0, yaqinlashdi = faolS.size === 0 || faolO.size === 0;
  while (!yaqinlashdi && iteratsiya < 200) {
    iteratsiya++;
    let eng = 0;
    for (const i of faolO) {
      let r = 0, kut = 0, dis = 0;
      for (const [q, x] of Object.entries(javoblar[i])) {
        if (!faolS.has(q)) continue;
        const p = P(theta[i], b.get(q));
        r += x; kut += p; dis += p * (1 - p);
      }
      const d = qadam((r - kut) / Math.max(dis, 1e-9));
      theta[i] += d;
      eng = Math.max(eng, Math.abs(d));
    }
    for (const q of faolS) {
      let s = 0, kut = 0, dis = 0;
      for (const i of faolO) {
        if (!(q in javoblar[i])) continue;
        const p = P(theta[i], b.get(q));
        s += javoblar[i][q]; kut += p; dis += p * (1 - p);
      }
      const d = qadam((s - kut) / Math.max(dis, 1e-9));
      b.set(q, b.get(q) - d);
      eng = Math.max(eng, Math.abs(d));
    }
    markaz();
    if (eng < 1e-3) yaqinlashdi = true;
  }

  // JML ning qiyinlikdagi sistematik siljishi — Rayt tuzatishi (L − 1) / L.
  const L = faolS.size;
  if (L > 1) for (const q of faolS) b.set(q, b.get(q) * (L - 1) / L);

  // Chekka savollar: 0,3 tuzatish bilan (hamma topgan — juda oson, hech kim — juda qiyin).
  for (const q of savollar) {
    if (faolS.has(q)) continue;
    let s = 0;
    const ehtimollar = [];
    for (const i of faolO) if (q in javoblar[i]) { s += javoblar[i][q]; ehtimollar.push(bq => P(theta[i], bq)); }
    const m = ehtimollar.length;
    if (!m) { b.set(q, 0); continue; }
    const maqsad = Math.min(m - 0.3, Math.max(0.3, s));
    // P(theta, b) b ga nisbatan kamayadi — Nyuton qadami teskari belgi bilan.
    b.set(q, yech(maqsad, ehtimollar, 0, -1));
  }

  // Barcha o'quvchilar (chekkalari ham) — yakuniy qiyinliklar bo'yicha.
  for (let i = 0; i < n; i++) {
    const ehtimollar = [];
    let r = 0;
    for (const [q, x] of Object.entries(javoblar[i])) { r += x; ehtimollar.push(t => P(t, b.get(q))); }
    const m = ehtimollar.length;
    if (!m) { theta[i] = NaN; continue; }
    const maqsad = Math.min(m - 0.3, Math.max(0.3, r));
    theta[i] = yech(maqsad, ehtimollar, faolO.has(i) ? theta[i] : 0, 1);
  }
  return { theta, qiyinlik: b, iteratsiya, yaqinlashdi };
}

/** Standart darajalar (Milliy sertifikat uslubi, T-ball bo'yicha). */
export const RASCH_DARAJALAR = [
  { label: 'A+', min: 70 },
  { label: 'A', min: 65 },
  { label: 'B+', min: 60 },
  { label: 'B', min: 55 },
  { label: 'C+', min: 50 },
  { label: 'C', min: 46 },
];

/** T-ball: 50 + 10·z; hamma bir xil bo'lsa — 50. */
export function tBallar(theta) {
  const l = theta.filter(Number.isFinite);
  if (!l.length) return theta.map(() => null);
  const ort = l.reduce((a, x) => a + x, 0) / l.length;
  const sd = Math.sqrt(l.reduce((a, x) => a + (x - ort) ** 2, 0) / l.length);
  return theta.map(t => (Number.isFinite(t) ? Math.round((50 + (sd > 1e-9 ? (10 * (t - ort)) / sd : 0)) * 10) / 10 : null));
}

/** Balldan daraja; hech bir chegaraga yetmasa — null. */
export function raschDarajasi(ball, darajalar = RASCH_DARAJALAR) {
  if (!Number.isFinite(ball)) return null;
  const l = [...darajalar].sort((a, b) => b.min - a.min);
  return l.find(d => ball >= d.min)?.label ?? null;
}
