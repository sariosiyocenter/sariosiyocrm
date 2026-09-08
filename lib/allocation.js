// O'quvchining pulini oylik hisoblarga taqsimlash.
//
// Har (guruh, oy) uchun hisob — "chelak" — ochiladi. To'lovlar shu chelaklarni
// yopadi. Hech narsa bazaga yozilmaydi: hisob har safar Payment yozuvlaridan
// qaytadan chiqariladi, shuning uchun to'lov o'chirilsa yoki tuzatilsa
// taqsimot o'zi to'g'rilanadi.
//
// ASOSIY QOIDA (egasi, 2026-09-09): PUL KURSGA BIRIKTIRILADI.
//
// To'lovda kurs ko'rsatilgan bo'lsa, o'sha pul FAQAT o'sha kursning
// hisoblarini yopadi va boshqa kursga hech qachon o'tmaydi. Ortgani —
// o'sha kursning avansi: keyingi oylarda yana o'sha kursga ketadi.
//
//   1 500 000 keltirdi: 1 000 000 matematikaga, 500 000 fizikaga —
//   ikkita alohida yozuv. Matematikaning ortgani fizikaning qarzini
//   yopmaydi; fizika bo'yicha u qarzdor bo'lib qolaveradi.
//
// Ilgari pul "hamyon"ga tushardi va navbat bilan hamma chelakni yopardi —
// ya'ni matematikaga berilgan pul o'zi fizikaga o'tib ketardi. Egasi buni
// istamadi: "пусть сам скажет, куда и сколько".
//
// Kurs ko'rsatilmagan to'lov (eski yozuvlar, import qilingan boshlang'ich
// qoldiq, "umumiy" to'lov) eski qoidada qoladi: hamyonga tushadi va istalgan
// chelakni yopa oladi. Shuning uchun bazadagi eski tarix o'zgarmaydi.
//
// Ustoz foizini aynan o'z guruhi uchun YOPILGAN puldan oladi, to'lov qilingan
// kunda emas — shuning uchun qaysi to'lov qaysi chelakni yopgani ham shu
// yerda hisoblanadi.

/** Pul kirmagan, faqat hisob yozuvlari. */
export const CHARGE_TYPES = ['Oylik', 'Chegirma'];

/** Kassaga pul kirgan to'lov turlari (Plastik — Kartaning eski nomi). */
export const CASH_TYPES = ['Naqd', 'Karta', 'Plastik', "O'tkazma", 'Peyme', 'Klik'];

/** Eski (guruhsiz) qarz chelagining kaliti. */
export const LEGACY_KEY = 'eski';

const monthOf = (date) => String(date || '').slice(0, 7);

/**
 * Balans bilan yozuvlar yig'indisi mos kelmasa — farq "boshlang'ich qoldiq"
 * sifatida qo'shiladi. O'quvchilar bazaga tayyor balans bilan kiritilgan
 * (import), o'sha balansni tashkil qilgan eski hisoblar yozuv sifatida yo'q.
 *
 * Bu yerda turadi, chunki brauzer ham (Xabarlar sahifasidagi kurs bo'yicha
 * qarzdorlar filtri) xuddi shu hisobni qiladi va natija serverdagi bilan
 * bir xil chiqishi shart.
 */
export function withOpening(rows, balance) {
  const sum = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const diff = Math.round((Number(balance) || 0) - sum);
  if (Math.abs(diff) < 1) return rows;
  return [...rows, { id: null, amount: diff, type: 'Oylik', date: '0000-00-01', groupId: null, courseId: null, description: "[BOSHLANG'ICH QOLDIQ] (hisoblangan)" }];
}

/**
 * @param rows  O'quvchining barcha Payment yozuvlari (istalgan tartibda).
 * @returns {{
 *   buckets: Array<{key, groupId, month, due, covered, remaining}>,
 *   allocations: Array<{paymentId, bucketKey, groupId, month, paidMonth, amount}>,
 *   wallet: number,   // hech qayerga sarflanmagan (avans), jami
 *   debt: number,     // yopilmagan hisoblar yig'indisi
 *   walletByGroup: Array<{groupId, amount}>,  // groupId null — umumiy hamyon
 *   debtByGroup: Array<{groupId, amount}>,    // groupId null — eski qoldiq
 * }}
 */
export function allocate(rows) {
  // 1. Chelaklar: (guruh, oy) bo'yicha sof hisob. Manfiy Oylik — hisob,
  //    musbat Oylik/Chegirma — o'sha guruhning hisobini kamaytiradi.
  const buckets = new Map();
  const credits = [];   // pul kirmagan, lekin hamyonga tushadigan yozuvlar
  const payments = [];  // kassaga kirgan to'lovlar
  const withdrawals = []; // naqd qaytarish

  for (const r of rows) {
    const amount = Number(r.amount) || 0;
    if (!amount) continue;

    if (CHARGE_TYPES.includes(r.type)) {
      const key = r.groupId ? `${r.groupId}:${monthOf(r.date)}` : LEGACY_KEY;
      const b = buckets.get(key) || {
        key, groupId: r.groupId || null,
        month: r.groupId ? monthOf(r.date) : LEGACY_KEY,
        due: 0, covered: 0, remaining: 0, lastDate: '',
      };
      b.due -= amount;
      if (r.date > b.lastDate) b.lastDate = r.date;
      buckets.set(key, b);
      continue;
    }

    if (amount > 0) {
      payments.push({ id: r.id, date: r.date, amount, groupId: r.groupId || null, cash: CASH_TYPES.includes(r.type) });
    } else {
      withdrawals.push({ id: r.id, date: r.date, amount: -amount });
    }
  }

  // Hisobi manfiy chiqqan chelak (chegirma hisobdan ko'p bo'lsa) — bu
  // o'quvchining foydasiga ortiqcha; hamyonga o'tadi.
  for (const b of buckets.values()) {
    if (b.due < 0) {
      // Ortiqcha chegirma o'sha kursning avansi bo'lib qoladi — boshqa
      // kursga o'tmaydi (guruhsiz chelakda groupId baribir null).
      credits.push({ id: null, date: b.lastDate || '0000-00-00', amount: -b.due, groupId: b.groupId || null, cash: false });
      b.due = 0;
    }
    b.due = Math.round(b.due);
  }

  // 2. Voqealar sanasi bo'yicha: chelak ochilishi (oy boshida), to'lov, qaytarish.
  //    Bir kunda avval chelak ochiladi, keyin to'lov — 1-sanadagi to'lov o'sha
  //    oyni yopsin.
  const events = [];
  for (const b of buckets.values()) {
    if (b.due <= 0) continue;
    events.push({ kind: 'open', date: b.month === LEGACY_KEY ? '0000-00-00' : b.month + '-01', order: 0, bucket: b });
  }
  for (const p of [...payments, ...credits]) events.push({ kind: 'pay', date: p.date, order: 1, pay: p });
  for (const w of withdrawals) events.push({ kind: 'out', date: w.date, order: 2, out: w });
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order));

  const open = [];        // ochiq chelaklar, eng eskisi birinchi
  const wallet = [];      // sarflanmagan pul navbati: {paymentId, paidMonth, remaining}
  const allocations = [];

  const cover = (bucket, source, amount, paidMonth) => {
    const take = Math.min(amount, bucket.due - bucket.covered);
    if (take <= 0) return 0;
    bucket.covered += take;
    // Hisob qaysi oyga yozilishi: to'lov oldin kelgan bo'lsa — chelak oyi
    // (avans), kech kelgan bo'lsa — to'lov oyi (qarz yopildi).
    const month = bucket.month === LEGACY_KEY ? paidMonth : (paidMonth > bucket.month ? paidMonth : bucket.month);
    allocations.push({ paymentId: source, bucketKey: bucket.key, groupId: bucket.groupId, month, paidMonth, amount: take });
    return take;
  };

  /** Bo'shab qolgan avans yozuvlarini olib tashlaydi (tartib saqlanadi). */
  const drainWallet = () => {
    for (let i = wallet.length - 1; i >= 0; i--) {
      if (wallet[i].remaining <= 0) wallet.splice(i, 1);
    }
  };

  /** Shu chelakni yopa oladigan avanslar: avval o'sha kursniki, keyin umumiy. */
  const usableFor = (bucket) => wallet
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.groupId == null || w.groupId === bucket.groupId)
    .sort((x, y) => (x.w.groupId === bucket.groupId ? 0 : 1) - (y.w.groupId === bucket.groupId ? 0 : 1) || x.i - y.i)
    .map(({ w }) => w);

  for (const ev of events) {
    if (ev.kind === 'open') {
      const b = ev.bucket;
      open.push(b);
      // Hamyonda shu kursga tegishli avans bo'lsa — darhol yopiladi.
      // Boshqa kursning avansiga tegilmaydi.
      for (const w of usableFor(b)) {
        if (b.covered >= b.due) break;
        w.remaining -= cover(b, w.paymentId, w.remaining, w.paidMonth);
      }
      drainWallet();
      continue;
    }

    if (ev.kind === 'pay') {
      const p = ev.pay;
      let left = p.amount;
      const paidMonth = monthOf(p.date);

      let queue;
      if (p.groupId) {
        // Kursga biriktirilgan to'lov — FAQAT o'sha kursning chelaklari,
        // eng eskisidan boshlab. Boshqa kursga bir tiyin ham o'tmaydi;
        // ortgani pastda o'sha kursning avansi bo'lib qoladi.
        queue = open.filter(b => b.groupId === p.groupId);
      } else {
        // Kurs ko'rsatilmagan (eski yozuv, boshlang'ich qoldiq, "umumiy"
        // to'lov) — eski qoida:
        //   1) SHU OYNING hisoblari — o'quvchi bu oy olib kelgan pul avvalo
        //      bu oyning ustoziga tegishli. Aks holda eski (import qilingan)
        //      qarz hamma to'lovni yutib, ustozga hech narsa tegmasdi;
        //   2) qolgan eski hisoblar, eng eskisidan.
        queue = open
          .map((b, i) => ({ b, i, r: b.month === paidMonth ? 0 : 1 }))
          .sort((x, y) => x.r - y.r || x.i - y.i)
          .map(x => x.b);
      }
      for (const b of queue) {
        if (left <= 0) break;
        left -= cover(b, p.id, left, paidMonth);
      }
      if (left > 0) wallet.push({ paymentId: p.id, paidMonth, remaining: left, groupId: p.groupId || null });
      continue;
    }

    if (ev.kind === 'out') {
      // Naqd qaytarish sarflanmagan puldan olinadi. Hamyonda yetmasa
      // (bunday bo'lmasligi kerak, lekin yozuv qo'lda kiritilgan bo'lishi
      // mumkin) — qolgani alohida qarz bo'lib turadi, yo'qolib ketmaydi.
      let left = ev.out.amount;
      while (left > 0 && wallet.length) {
        const w = wallet[wallet.length - 1];
        const take = Math.min(left, w.remaining);
        w.remaining -= take;
        left -= take;
        if (w.remaining <= 0) wallet.pop();
      }
      drainWallet();
      if (left > 0) {
        const b = { key: 'qaytarish:' + ev.out.id, groupId: null, month: monthOf(ev.date), due: Math.round(left), covered: 0, remaining: 0, lastDate: ev.date };
        buckets.set(b.key, b);
        open.push(b);
      }
    }
  }

  const list = [...buckets.values()].map(b => ({
    key: b.key, groupId: b.groupId, month: b.month,
    due: b.due, covered: Math.round(b.covered), remaining: Math.round(b.due - b.covered),
  })).sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : (a.groupId || 0) - (b.groupId || 0)));

  const walletSum = Math.round(wallet.reduce((s, w) => s + w.remaining, 0));
  const debt = list.reduce((s, b) => s + b.remaining, 0);

  // Kurs kesimidagi hisob. Endi bular alohida ma'noga ega: matematikaning
  // avansi fizikaning qarzini yopmaydi, ya'ni o'quvchi bir vaqtning o'zida
  // bir kursda avansda, boshqasida qarzdor bo'lishi mumkin.
  const byGroup = (pairs) => {
    const m = new Map();
    for (const [gid, amount] of pairs) {
      if (!amount) continue;
      m.set(gid, (m.get(gid) || 0) + amount);
    }
    return [...m].map(([groupId, amount]) => ({ groupId, amount: Math.round(amount) }))
      .filter(x => x.amount !== 0);
  };

  return {
    buckets: list,
    allocations,
    wallet: walletSum,
    debt,
    walletByGroup: byGroup(wallet.map(w => [w.groupId ?? null, w.remaining])),
    debtByGroup: byGroup(list.map(b => [b.groupId ?? null, b.remaining])),
  };
}

/**
 * Bitta kurs bo'yicha o'quvchining holati: qarzi va avansi.
 * Manfiy `balance` — qarz, musbat — avans (umumiy balans bilan bir xil belgi).
 */
export function groupStanding(result, groupId) {
  const debt = (result.debtByGroup.find(x => x.groupId === groupId) || {}).amount || 0;
  const advance = (result.walletByGroup.find(x => x.groupId === groupId) || {}).amount || 0;
  return { debt, advance, balance: advance - debt };
}

/**
 * Bir nechta o'quvchining yozuvlari bo'yicha: shu oyda har bir guruhga
 * YOPILGAN pul. Ustozning foizi shundan olinadi.
 *
 * @param rowsByStudent Map<studentId, rows[]>
 * @returns Map<groupId, amount>
 */
export function receivedByGroup(rowsByStudent, month) {
  const out = new Map();
  for (const rows of rowsByStudent.values()) {
    const { allocations } = allocate(rows);
    for (const a of allocations) {
      if (!a.groupId || a.month !== month) continue;
      out.set(a.groupId, (out.get(a.groupId) || 0) + a.amount);
    }
  }
  for (const [k, v] of out) out.set(k, Math.round(v));
  return out;
}

/** Yozuvlarni o'quvchi bo'yicha guruhlash. */
export function groupRows(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.studentId)) map.set(r.studentId, []);
    map.get(r.studentId).push(r);
  }
  return map;
}
