// O'quvchining pulini oylik hisoblarga taqsimlash.
//
// Muammo: o'quvchi 2 000 000 olib keladi, kurs esa 500 000. Bu pul uning
// hisobida (balansda) turadi va har oy o'sha oyning hisobi shundan yopiladi.
// Keyin u yana bir kurs qo'shsa — "shu bergan pulimdan oling" deydi. Ustoz
// esa foizini aynan o'z guruhi uchun YOPILGAN puldan olishi kerak, to'lov
// qilingan kunda emas.
//
// Shuning uchun to'lov guruhga "yopishtirilmaydi". Hamma to'lov o'quvchining
// hamyoniga tushadi; har (guruh, oy) uchun hisob — "chelak" — ochiladi va
// hamyondagi pul chelaklarni navbat bilan yopadi (eng eskisidan boshlab).
// Qaysi to'lov qaysi chelakni yopgani shu yerda hisoblanadi.
//
// Hech narsa bazaga yozilmaydi: hisob har safar yozuvlardan qaytadan
// chiqariladi, shuning uchun to'lov o'chirilsa yoki tuzatilsa taqsimot o'zi
// to'g'rilanadi.

/** Pul kirmagan, faqat hisob yozuvlari. */
export const CHARGE_TYPES = ['Oylik', 'Chegirma'];

/** Kassaga pul kirgan to'lov turlari (Plastik — Kartaning eski nomi). */
export const CASH_TYPES = ['Naqd', 'Karta', 'Plastik', "O'tkazma", 'Peyme', 'Klik'];

/** Eski (guruhsiz) qarz chelagining kaliti. */
export const LEGACY_KEY = 'eski';

const monthOf = (date) => String(date || '').slice(0, 7);

/**
 * @param rows  O'quvchining barcha Payment yozuvlari (istalgan tartibda).
 * @returns {{
 *   buckets: Array<{key, groupId, month, due, covered, remaining}>,
 *   allocations: Array<{paymentId, bucketKey, groupId, month, paidMonth, amount}>,
 *   wallet: number,   // hech qayerga sarflanmagan (avans)
 *   debt: number,     // yopilmagan hisoblar yig'indisi
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
      credits.push({ id: null, date: b.lastDate || '0000-00-00', amount: -b.due, groupId: null, cash: false });
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

  for (const ev of events) {
    if (ev.kind === 'open') {
      const b = ev.bucket;
      open.push(b);
      // Hamyonda pul bo'lsa — darhol yopiladi.
      while (wallet.length && b.covered < b.due) {
        const w = wallet[0];
        const took = cover(b, w.paymentId, w.remaining, w.paidMonth);
        w.remaining -= took;
        if (w.remaining <= 0) wallet.shift();
      }
      continue;
    }

    if (ev.kind === 'pay') {
      const p = ev.pay;
      let left = p.amount;
      const paidMonth = monthOf(p.date);

      // Navbat:
      //   1) to'lovda ko'rsatilgan guruhning hisoblari;
      //   2) SHU OYNING hisoblari — o'quvchi bu oy olib kelgan pul avvalo bu
      //      oyning ustoziga tegishli. Aks holda eski (import qilingan) qarz
      //      hamma to'lovni yutib, ustozga shu oy uchun hech narsa tegmasdi;
      //   3) qolgan eski hisoblar, eng eskisidan.
      const rank = (b) => (p.groupId && b.groupId === p.groupId ? 0 : b.month === paidMonth ? 1 : 2);
      const queue = open
        .map((b, i) => ({ b, i, r: rank(b) }))
        .sort((x, y) => x.r - y.r || x.i - y.i)
        .map(x => x.b);
      for (const b of queue) {
        if (left <= 0) break;
        left -= cover(b, p.id, left, paidMonth);
      }
      if (left > 0) wallet.push({ paymentId: p.id, paidMonth, remaining: left });
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

  return { buckets: list, allocations, wallet: walletSum, debt };
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
