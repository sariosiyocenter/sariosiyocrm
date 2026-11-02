/**
 * Xodim oyligi daftari: har oy uchun hisoblangan summa, berilgan pul va qoldiq.
 *
 * Egasi (2026-11-02): "10 mln berishimiz kerak, 5 mln berdik — 5 mln qarz qoladi;
 * noyabrda shu oyga va umuman qancha berishimiz kerakligi ko'rinsin". Ilgari oyga
 * bitta to'lov yozilar va u bo'lsa oy "to'langan" sanalardi — qisman berilgan
 * pulning qolgani hech qayerda qolmasdi.
 *
 * Ikki tushuncha ajratiladi:
 *   hisob  (SalaryAccrual) — oy yopilganda qotirilgan summa: asosiy + KPI + bonus − jarima;
 *   to'lov (SalaryPayment) — haqiqatan berilgan pul, oyga bir nechta bo'lishi mumkin.
 * To'lovlar sana tartibida eng eski qarzni birinchi yopadi. Hech qaysi yopiq oyga
 * sig'magan pul — avans: keyingi oy yopilganda o'sha oyga tushadi.
 *
 * Eski yozuvlar: avval to'lov oyni o'zi bilan olib kelardi (SalaryPayment.month).
 * Shunday to'lovi bor va hisobi yo'q oy "yopilgan, hisob = berilgan" deb olinadi —
 * qarz 0. Bazaga hech narsa yozilmaydi; o'sha oyga haqiqiy hisob kiritilsa, u ustun.
 *
 * Toza funksiyalar: server ham, xodim kartasidagi oldindan ko'rish ham shuni ishlatadi.
 */

/** CRM ga o'tishdan oldingi qarz shu "oy" bilan saqlanadi — doim ro'yxat boshida. */
export const AVVALGI_OY = '0000-00';

const OY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const oyTogri = (s) => OY_RE.test(String(s || ''));

export function oyQosh(oy, n) {
  const [y, m] = oy.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

const OYLAR = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
/** "2026-10" → "Oktabr 2026"; avvalgi qarz — o'z nomi bilan. */
export const oyMatni = (oy) => oy === AVVALGI_OY ? 'Avvalgi qarz'
  : oyTogri(oy) ? `${OYLAR[Number(oy.slice(5, 7)) - 1]} ${oy.slice(0, 4)}` : String(oy || '');

const TASHKENT_MS = 5 * 3600 * 1000;
/** Toshkent vaqti bo'yicha joriy oy, "YYYY-MM". */
export const joriyOyKaliti = (sana = new Date()) => new Date(sana.getTime() + TASHKENT_MS).toISOString().slice(0, 7);

const butun = (v) => Math.round(Number(v) || 0);
export const hisobJami = (h) => butun(h.baseSalary) + butun(h.kpi) + butun(h.bonuses) - butun(h.fines);

/** Eski (oyi yozilgan) to'lovdan o'sha oyning hisobini tiklaydi. */
function eskiHisob(month, tolovlar) {
  const amount = tolovlar.reduce((s, t) => s + butun(t.amount), 0);
  const birinchi = tolovlar[0];
  const baseSalary = butun(birinchi.baseSalary);
  const bonuses = butun(birinchi.bonuses);
  const fines = butun(birinchi.fines);
  return {
    month, eski: true, baseSalary, bonuses, fines, amount,
    kpi: amount - baseSalary - bonuses + fines,
    note: birinchi.note || null, closedAt: birinchi.paidAt,
  };
}

/**
 * @param {{ hisoblar: object[], tolovlar: object[], joriyOy: string }} p
 * @returns {{ oylar: object[], tolovlar: object[], yopiqQarz: number, avans: number, engEski: string|null, joriyOy: string }}
 *   oylar — eskidan yangiga; yopilmagan oylar `yopiq: false` (birinchi hisobdan joriy oygacha).
 */
export function oylikDaftari({ hisoblar = [], tolovlar = [], joriyOy }) {
  const haqiqiy = new Map(hisoblar.map(h => [h.month, { ...h, amount: butun(h.amount) }]));
  const eskiOylar = new Map();
  for (const t of tolovlar) {
    if (!t.month || haqiqiy.has(t.month)) continue;
    eskiOylar.set(t.month, [...(eskiOylar.get(t.month) || []), t]);
  }
  const yopiqlar = [
    ...haqiqiy.values(),
    ...[...eskiOylar].map(([m, ts]) => eskiHisob(m, ts)),
  ].sort((a, b) => a.month.localeCompare(b.month));

  // Yopilmagan oylar: birinchi haqiqiy oydan joriy oygacha bo'shliqlar ham
  // ko'rinsin — yopilmay qolgan oy unutilib ketmasin.
  const yopiqOylar = new Set(yopiqlar.map(h => h.month));
  const haqiqiyOylar = yopiqlar.map(h => h.month).filter(m => m !== AVVALGI_OY);
  const ochiqlar = [];
  for (let m = haqiqiyOylar[0] && haqiqiyOylar[0] < joriyOy ? haqiqiyOylar[0] : joriyOy; m <= joriyOy; m = oyQosh(m, 1)) {
    if (!yopiqOylar.has(m)) ochiqlar.push({ month: m, yopiq: false, amount: 0 });
  }

  const qatorlar = yopiqlar.map(h => ({ ...h, yopiq: true, berilgan: 0, qoldiq: h.amount, tolovlar: [] }));
  const tartib = [...tolovlar].sort((a, b) => new Date(a.paidAt) - new Date(b.paidAt) || a.id - b.id);
  let i = 0;
  let avans = 0;
  const tushir = (q, t, s, taqsim) => {
    q.qoldiq -= s; q.berilgan += s;
    q.tolovlar.push({ tolovId: t.id, paidAt: t.paidAt, summa: s, note: t.note || null });
    taqsim.push({ month: q.month, summa: s });
  };
  const tolovQatorlari = tartib.map(t => {
    let qol = Math.max(0, butun(t.amount));
    const taqsim = [];
    // Eski to'lov aniq bir oy uchun berilgan — avval o'sha oyga tushadi, eng eski
    // qarz qoidasi uni boshqa oyga (masalan keyin kiritilgan avvalgi qarzga) olib ketmasin.
    const ozOyi = t.month ? qatorlar.find(q => q.month === t.month) : null;
    if (ozOyi && ozOyi.qoldiq > 0 && qol > 0) {
      const s = Math.min(ozOyi.qoldiq, qol);
      tushir(ozOyi, t, s, taqsim);
      qol -= s;
    }
    while (qol > 0 && i < qatorlar.length) {
      const q = qatorlar[i];
      if (q.qoldiq <= 0) { i++; continue; }
      const s = Math.min(q.qoldiq, qol);
      tushir(q, t, s, taqsim);
      qol -= s;
    }
    avans += qol;
    return { ...t, taqsim, avans: qol };
  });

  const oylar = [...qatorlar, ...ochiqlar.map(o => ({ ...o, berilgan: 0, qoldiq: 0, tolovlar: [] }))]
    .sort((a, b) => a.month.localeCompare(b.month));
  const qarzli = qatorlar.find(q => q.qoldiq > 0);
  return {
    oylar,
    tolovlar: tolovQatorlari,
    yopiqQarz: qatorlar.reduce((s, q) => s + Math.max(0, q.qoldiq), 0),
    avans,
    engEski: qarzli ? qarzli.month : null,
    joriyOy,
  };
}

/** Yangi to'lov qayerga tushishini oldindan ko'rsatadi (oylikDaftari bilan bir xil qoida). */
export function taqsimla(daftar, summa) {
  let qol = Math.max(0, butun(summa));
  const qismlar = [];
  for (const o of daftar.oylar) {
    if (!o.yopiq || o.qoldiq <= 0 || qol <= 0) continue;
    const s = Math.min(o.qoldiq, qol);
    qol -= s;
    qismlar.push({ month: o.month, summa: s, keyin: o.qoldiq - s });
  }
  return { qismlar, avans: qol };
}
