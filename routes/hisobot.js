// Moliya hisobotlari (egasi, 2026-10-01: "kassani ham rivojlantirish, hisobotlarni"):
// kunlik kassa, oylik moliya, qarzdorlik, ustoz oyliklari. Faqat o'qiydi — bazaga
// hech narsa yozmaydi. Raqamlar interfeysdagi bilan bir xil ta'rifda:
//   tushum  = amount > 0 va turi Oylik/Chegirma emas (haqiqiy pul);
//   qarz    = manfiy balans; kurs bo'yicha bo'linishi — lib/allocation.js;
//   hisoblangan/yopilgan — services/ledger.js monthCoverage (oy × kurs).
import prisma from '../lib/prisma.js';
import { authenticate, allowedSchoolIds, ALL_BRANCHES } from '../middleware/auth.js';
import { loadRowsByStudent, rulesForStudents, monthCoverage } from '../services/ledger.js';
import { allocate } from '../lib/allocation.js';
import { USTOZ_NOMLARI, ustozNomlari } from '../lib/ustozlar.js';
import { oylikDaftarlari } from '../lib/oylik.js';
import { joriyOyKaliti } from '../lib/oylikDaftar.js';
import { ROL_NOMLARI } from '../lib/ruxsatlar.js';

const HISOB_TURLARI = ['Chegirma', 'Oylik'];
const USULLAR = [
  { tur: 'Naqd', nom: 'Naqd' }, { tur: 'Karta', nom: 'Karta' }, { tur: 'Klik', nom: 'Klik' },
  { tur: 'Peyme', nom: 'Payme' }, { tur: "O'tkazma", nom: "O'tkazma" },
];
const USTOZ_ROLLAR = ['TEACHER', 'SUPPORT_TEACHER'];
const TASHKENT = 5 * 3600 * 1000;
const bugun = () => new Date(Date.now() + TASHKENT).toISOString().slice(0, 10);
const yaxlit = (n) => Math.round(Number(n) || 0);
const sanaTekshir = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : null);
const oyTekshir = (s) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || '')) ? String(s) : null);
const oldingiOy = (oy) => { const [y, m] = oy.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
const oyFarqi = (a, b) => { const [y1, m1] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number); return (y1 - y2) * 12 + (m1 - m2); };
const kunOldin = (sana) => new Date(Date.parse(`${sana}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const vaqtMatni = (d) => new Date(d.getTime() + TASHKENT).toISOString().slice(11, 16);

async function filiallar(req) {
  const wanted = parseInt(req.query.schoolId);
  if (!Number.isInteger(wanted)) return null;
  return wanted === ALL_BRANCHES ? allowedSchoolIds(req.user) : [wanted];
}

/** Kun oxirida kassadagi naqd: kirim − chiqim − inkassatsiya (shu kungacha, shu kun ham). */
async function naqdQoldiq(schoolIds, sana) {
  const sch = { schoolId: { in: schoolIds }, date: { lte: sana } };
  const [k, c, i] = await Promise.all([
    prisma.payment.aggregate({ where: { ...sch, type: 'Naqd', amount: { gt: 0 } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { ...sch, method: 'Naqd' }, _sum: { amount: true } }),
    prisma.cashHandover.aggregate({ where: sch, _sum: { amount: true } }),
  ]);
  return yaxlit((k._sum.amount || 0) - (c._sum.amount || 0) - (i._sum.amount || 0));
}

async function kunlik(schoolIds, sana) {
  const [tolovlar, xarajatlar, inkass, yopilgan] = await Promise.all([
    prisma.payment.findMany({
      where: { schoolId: { in: schoolIds }, date: sana, amount: { gt: 0 }, type: { notIn: HISOB_TURLARI } },
      select: { id: true, amount: true, type: true, description: true, createdAt: true, student: { select: { name: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.expense.findMany({
      where: { schoolId: { in: schoolIds }, date: sana },
      select: { id: true, amount: true, category: true, method: true, description: true },
      orderBy: { id: 'asc' },
    }),
    prisma.cashHandover.findMany({ where: { schoolId: { in: schoolIds }, date: sana }, orderBy: { id: 'asc' } }),
    prisma.cashDayClose.findMany({ where: { schoolId: { in: schoolIds }, date: sana } }),
  ]);
  const boshlangich = await naqdQoldiq(schoolIds, kunOldin(sana));

  const usullar = USULLAR.map(u => {
    const q = tolovlar.filter(t => t.type === u.tur);
    return { tur: u.tur, nom: u.nom, summa: yaxlit(q.reduce((s, t) => s + t.amount, 0)), soni: q.length };
  });
  const boshqa = tolovlar.filter(t => !USULLAR.some(u => u.tur === t.type));
  if (boshqa.length) usullar.push({ tur: 'boshqa', nom: 'Boshqa', summa: yaxlit(boshqa.reduce((s, t) => s + t.amount, 0)), soni: boshqa.length });
  const chiqimUsul = new Map();
  for (const x of xarajatlar) {
    const o = chiqimUsul.get(x.method) || { tur: x.method, summa: 0, soni: 0 };
    o.summa += x.amount; o.soni++;
    chiqimUsul.set(x.method, o);
  }
  const naqdKirim = usullar.find(u => u.tur === 'Naqd')?.summa || 0;
  const naqdChiqim = yaxlit(xarajatlar.filter(x => x.method === 'Naqd').reduce((s, x) => s + x.amount, 0));
  const inkassatsiya = yaxlit(inkass.reduce((s, h) => s + h.amount, 0));
  const kutilgan = boshlangich + naqdKirim - naqdChiqim - inkassatsiya;
  // Bir nechta filial tanlansa kunni yopish yozuvlari ham bir nechta: yig'indisi.
  const sanalgan = yopilgan.length ? yaxlit(yopilgan.reduce((s, c) => s + c.counted, 0)) : null;
  return {
    sana, filiallar: schoolIds.length,
    kirim: {
      jami: yaxlit(tolovlar.reduce((s, t) => s + t.amount, 0)), soni: tolovlar.length, usullar,
      royxat: tolovlar.slice(0, 500).map(t => ({ id: t.id, vaqt: vaqtMatni(t.createdAt), oquvchi: t.student?.name || '', tur: t.type, summa: yaxlit(t.amount), izoh: t.description || '' })),
    },
    chiqim: {
      jami: yaxlit(xarajatlar.reduce((s, x) => s + x.amount, 0)), soni: xarajatlar.length,
      usullar: [...chiqimUsul.values()].map(u => ({ ...u, summa: yaxlit(u.summa) })),
      royxat: xarajatlar.slice(0, 500).map(x => ({ id: x.id, kategoriya: x.category, usul: x.method, summa: yaxlit(x.amount), izoh: x.description || '' })),
    },
    inkassatsiyalar: inkass.map(h => ({ id: h.id, summa: yaxlit(h.amount), kimga: h.toWhom, izoh: h.note || '' })),
    kassa: {
      boshlangich, naqdKirim, naqdChiqim, inkassatsiya, kutilgan,
      sanalgan, farq: sanalgan === null ? null : sanalgan - kutilgan, yopilgan: yopilgan.length > 0,
      yopishIzohi: yopilgan.map(c => c.note).filter(Boolean).join('; ') || '',
    },
  };
}

async function oylikBir(schoolIds, oy) {
  const sch = { schoolId: { in: schoolIds } };
  const [tolovlar, xarajatlar] = await Promise.all([
    prisma.payment.findMany({
      where: { ...sch, date: { startsWith: oy }, amount: { gt: 0 }, type: { notIn: HISOB_TURLARI } },
      select: { amount: true, type: true, date: true },
    }),
    prisma.expense.findMany({ where: { ...sch, date: { startsWith: oy } }, select: { amount: true, category: true, method: true } }),
  ]);
  return { tolovlar, xarajatlar };
}

async function oylik(schoolIds, oy) {
  const oldin = oldingiOy(oy);
  const [joriy, oldingi, guruhlar] = await Promise.all([
    oylikBir(schoolIds, oy), oylikBir(schoolIds, oldin),
    prisma.group.findMany({
      where: { schoolId: { in: schoolIds } },
      select: { id: true, name: true, course: { select: { name: true } }, ...USTOZ_NOMLARI, students: { select: { id: true } } },
    }),
  ]);
  const jami = (q, f = (x) => x.amount) => yaxlit(q.reduce((s, x) => s + f(x), 0));
  const usullar = USULLAR.map(u => ({
    tur: u.tur, nom: u.nom,
    summa: jami(joriy.tolovlar.filter(t => t.type === u.tur)),
    oldingi: jami(oldingi.tolovlar.filter(t => t.type === u.tur)),
    soni: joriy.tolovlar.filter(t => t.type === u.tur).length,
  }));
  const kategoriyalar = [...new Set([...joriy.xarajatlar, ...oldingi.xarajatlar].map(x => x.category))].map(nom => ({
    nom,
    summa: jami(joriy.xarajatlar.filter(x => x.category === nom)),
    oldingi: jami(oldingi.xarajatlar.filter(x => x.category === nom)),
  })).sort((a, b) => b.summa - a.summa);
  const kunlar = new Map();
  for (const t of joriy.tolovlar) kunlar.set(t.date, (kunlar.get(t.date) || 0) + t.amount);

  // Kurs va fan kesimi: hisoblangan va yopilgan pul (services/ledger.js).
  const oquvchiIds = [...new Set(guruhlar.flatMap(g => g.students.map(s => s.id)))];
  const qamrov = await monthCoverage(oquvchiIds, oy);
  const kurslar = guruhlar.map(g => {
    let hisoblangan = 0, yopilgan = 0, qarzdor = 0;
    for (const s of g.students) {
      const x = qamrov.get(s.id)?.groups.get(g.id);
      if (!x) continue;
      hisoblangan += x.due; yopilgan += x.covered;
      if (x.remaining > 0.5) qarzdor++;
    }
    return {
      id: g.id, nom: g.name, fan: g.course?.name || '', ustoz: ustozNomlari(g), oquvchi: g.students.length, qarzdor,
      hisoblangan: yaxlit(hisoblangan), yopilgan: yaxlit(yopilgan), qoldi: yaxlit(hisoblangan - yopilgan),
      foiz: hisoblangan > 0 ? Math.round(yopilgan / hisoblangan * 100) : null,
    };
  }).filter(k => k.hisoblangan > 0 || k.yopilgan > 0).sort((a, b) => b.hisoblangan - a.hisoblangan);
  const fanlar = new Map();
  for (const k of kurslar) {
    const f = fanlar.get(k.fan || 'Fansiz') || { nom: k.fan || 'Fansiz', kurs: 0, hisoblangan: 0, yopilgan: 0 };
    f.kurs++; f.hisoblangan += k.hisoblangan; f.yopilgan += k.yopilgan;
    fanlar.set(f.nom, f);
  }
  const hisoblangan = kurslar.reduce((s, k) => s + k.hisoblangan, 0);
  const yopilgan = kurslar.reduce((s, k) => s + k.yopilgan, 0);
  const tushum = jami(joriy.tolovlar), xarajat = jami(joriy.xarajatlar);
  const oldTushum = jami(oldingi.tolovlar), oldXarajat = jami(oldingi.xarajatlar);
  return {
    oy, oldingiOy: oldin,
    tushum: { jami: tushum, oldingi: oldTushum, soni: joriy.tolovlar.length, usullar },
    xarajat: {
      jami: xarajat, oldingi: oldXarajat, kategoriyalar,
      ishHaqi: jami(joriy.xarajatlar.filter(x => x.category === 'Ish haqi')),
      naqd: jami(joriy.xarajatlar.filter(x => x.method === 'Naqd')),
    },
    foyda: { jami: tushum - xarajat, oldingi: oldTushum - oldXarajat },
    hisob: { hisoblangan, yopilgan, qoldi: hisoblangan - yopilgan, foiz: hisoblangan > 0 ? Math.round(yopilgan / hisoblangan * 100) : null },
    kunlar: [...kunlar.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([sana, summa]) => ({ sana, summa: yaxlit(summa) })),
    kurslar,
    fanlar: [...fanlar.values()].sort((a, b) => b.hisoblangan - a.hisoblangan),
  };
}

async function qarz(schoolIds) {
  const oquvchilar = await prisma.student.findMany({
    where: { schoolId: { in: schoolIds }, balance: { lt: -0.5 }, status: { not: 'Arxiv' } },
    select: {
      id: true, name: true, phone: true, fatherPhone: true, motherPhone: true, balance: true, status: true,
      groups: { select: { id: true, name: true, ...USTOZ_NOMLARI } },
    },
  });
  const ids = oquvchilar.map(s => s.id);
  const [qatorlar, qoidalar, kodRows, oxirgi] = await Promise.all([
    loadRowsByStudent(ids), rulesForStudents(ids),
    ids.length ? prisma.studentKod.findMany({ where: { studentId: { in: ids } }, select: { kod: true, studentId: true } }) : [],
    ids.length ? prisma.payment.groupBy({
      by: ['studentId'], where: { studentId: { in: ids }, amount: { gt: 0 }, type: { notIn: HISOB_TURLARI } }, _max: { date: true },
    }) : [],
  ]);
  const kodlar = new Map(kodRows.map(k => [k.studentId, k.kod]));
  const oxirgiTolov = new Map(oxirgi.map(x => [x.studentId, x._max.date]));
  const hozirgiOy = bugun().slice(0, 7);
  const guruhNomi = new Map();
  const kurslar = new Map();
  const yosh = [{ nom: 'Shu oy', summa: 0, soni: 0 }, { nom: '1 oy', summa: 0, soni: 0 }, { nom: '2 oy', summa: 0, soni: 0 }, { nom: '3 oy va undan ko‘p', summa: 0, soni: 0 }];
  const royxat = [];
  for (const s of oquvchilar) {
    for (const g of s.groups) guruhNomi.set(g.id, g);
    const q = -s.balance;
    const t = allocate(qatorlar.get(s.id) || [], qoidalar.get(s.id));
    const ochiqHammasi = (t.buckets || []).filter(b => b.remaining > 0.5 && b.month);
    // Kursga bog'lanmagan eski qoldiqning oyi yo'q ("eski") — u eng eski qarz. Ilgari
    // shu chelakning o'zi qolgan o'quvchida oy farqi NaN chiqib, hisobot yiqilardi.
    const ochiq = ochiqHammasi.filter(b => /^\d{4}-\d{2}$/.test(b.month));
    const sanasiz = ochiqHammasi.length > ochiq.length;
    const eski = ochiq.length ? ochiq.map(b => b.month).sort()[0] : null;
    const oylar = sanasiz ? 3 : eski ? Math.max(0, oyFarqi(hozirgiOy, eski)) : 0;
    const guruh = yosh[Math.min(3, oylar)];
    guruh.summa += q; guruh.soni++;
    const kursQarzi = (t.debtByGroup || []).filter(x => x.amount > 0.5).map(x => ({ id: x.groupId ?? null, nom: x.groupId ? (guruhNomi.get(x.groupId)?.name || `Kurs ${x.groupId}`) : 'Eski qoldiq', summa: yaxlit(x.amount) }));
    for (const x of kursQarzi) {
      const g = x.id ? guruhNomi.get(x.id) : null;
      const k = kurslar.get(x.id) || { id: x.id, nom: x.nom, ustoz: g ? ustozNomlari(g) : '', soni: 0, summa: 0 };
      k.soni++; k.summa += x.summa; kurslar.set(x.id, k);
    }
    royxat.push({
      id: s.id, ism: s.name, kod: kodlar.get(s.id) ?? null, holat: s.status, telefon: s.phone || '', otaOnaTel: [s.fatherPhone, s.motherPhone].filter(Boolean).join(', '),
      qarz: yaxlit(q), eskiOy: eski, oylar, oxirgiTolov: oxirgiTolov.get(s.id) || null, kurslar: kursQarzi,
    });
  }
  royxat.sort((a, b) => b.qarz - a.qarz);
  return {
    jami: yaxlit(royxat.reduce((s, x) => s + x.qarz, 0)), soni: royxat.length,
    yosh: yosh.map(y => ({ ...y, summa: yaxlit(y.summa) })),
    kurslar: [...kurslar.values()].sort((a, b) => b.summa - a.summa),
    royxat: royxat.slice(0, 1000),
  };
}

async function ustozOyligi(schoolIds, oy, { kpiHisobla, filialXodimlariWhere }) {
  const xodimlar = await prisma.user.findMany({
    where: { ...filialXodimlariWhere(schoolIds), role: { in: USTOZ_ROLLAR }, status: 'Faol' },
    select: { id: true, name: true, role: true, schoolId: true, salary: true, kpiPercent: true },
    orderBy: { name: 'asc' },
  });
  // Yopilgan oy — qotirilgan hisob va unga tushgan pul (lib/oylikDaftar.js);
  // yopilmagani — joriy hisob-kitob, hali berilmagan.
  const daftarlar = await oylikDaftarlari(xodimlar.map(x => x.id));
  const natija = [];
  // Har ustoz uchun hisob og'ir (taqsimot) — 4 tadan parallel.
  for (let i = 0; i < xodimlar.length; i += 4) {
    const qism = await Promise.all(xodimlar.slice(i, i + 4).map(async (x) => {
      const kpi = await kpiHisobla({ id: x.id, name: x.name, schoolId: x.schoolId, kpiPercent: x.kpiPercent }, oy);
      const daftar = daftarlar.get(x.id);
      const o = daftar?.oylar.find(m => m.month === oy && m.yopiq);
      const asosiy = yaxlit(o ? o.baseSalary : x.salary);
      const kpiSumma = o ? yaxlit(o.kpi) : yaxlit(kpi.kpiAmount);
      const hisoblangan = o ? o.amount : asosiy + kpiSumma;
      const tolangan = o ? o.berilgan : 0;
      const qoldi = o ? o.qoldiq : hisoblangan;
      const oxirgi = o?.tolovlar.at(-1);
      return {
        id: x.id, ism: x.name, lavozim: x.role === 'TEACHER' ? "O'qituvchi" : "Yordamchi o'qituvchi",
        asosiy, kpi: kpiSumma, bonus: o?.bonuses || 0, jarima: o?.fines || 0,
        hisoblangan, tolangan, qoldi, yopiq: !!o, berilgan: !!o && qoldi <= 0,
        sana: oxirgi ? oxirgi.paidAt : null, izoh: o?.note || '',
        jamiQarz: daftar?.yopiqQarz || 0,
        darslar: kpi.totalLessons || 0,
        kurslar: (kpi.groups || []).map(g => ({ id: g.id, nom: g.name, oquvchi: g.studentCount, darslar: g.lessons, tushgan: g.total, haq: g.pay, shart: g.payLabel, ikkinchi: !!g.ikkinchi })),
      };
    }));
    natija.push(...qism);
  }
  return {
    oy,
    jami: {
      asosiy: natija.reduce((s, x) => s + x.asosiy, 0), kpi: natija.reduce((s, x) => s + x.kpi, 0),
      hisoblangan: natija.reduce((s, x) => s + x.hisoblangan, 0), tolangan: natija.reduce((s, x) => s + x.tolangan, 0),
      qoldi: natija.reduce((s, x) => s + x.qoldi, 0), berilgan: natija.filter(x => x.berilgan).length, soni: natija.length,
    },
    ustozlar: natija,
  };
}

/**
 * Xodimlar oyligi bo'yicha markazning qarzi (egasi, 2026-11-02): kimga va qancha
 * berishimiz kerak. Yopilgan oylar — aniq; joriy oy yopilmagan bo'lsa — taxminiy
 * (asosiy + ustozga KPI hozirgi holatda).
 */
async function oylikQarz(schoolIds, { kpiHisobla, filialXodimlariWhere }) {
  const joriyOy = joriyOyKaliti();
  const xodimlar = await prisma.user.findMany({
    // Arxivdagi xodim ham olinadi: ketgan xodimga qarz qolgan bo'lishi mumkin.
    where: { ...filialXodimlariWhere(schoolIds), role: { not: 'SELLER' } },
    select: { id: true, name: true, role: true, position: true, schoolId: true, salary: true, kpiPercent: true, status: true },
    orderBy: { name: 'asc' },
  });
  const daftarlar = await oylikDaftarlari(xodimlar.map(x => x.id), joriyOy);
  const royxat = [];
  for (let i = 0; i < xodimlar.length; i += 4) {
    const qism = await Promise.all(xodimlar.slice(i, i + 4).map(async (x) => {
      const d = daftarlar.get(x.id);
      const arxiv = x.status === 'Arxiv';
      if (arxiv && !(d.yopiqQarz > 0)) return null;
      const joriyYopiq = d.oylar.some(o => o.month === joriyOy && o.yopiq);
      let joriy = 0;
      if (!joriyYopiq && !arxiv) {
        const kpi = USTOZ_ROLLAR.includes(x.role)
          ? await kpiHisobla({ id: x.id, name: x.name, schoolId: x.schoolId, kpiPercent: x.kpiPercent }, joriyOy)
          : { kpiAmount: 0 };
        joriy = yaxlit(x.salary) + yaxlit(kpi.kpiAmount);
      }
      return {
        id: x.id, ism: x.name, lavozim: (x.position || ROL_NOMLARI[x.role] || x.role) + (arxiv ? ' · arxivda' : ''),
        yopiqQarz: d.yopiqQarz, avans: d.avans, joriy, jami: Math.max(0, d.yopiqQarz - d.avans + joriy),
        engEski: d.engEski, yopilmagan: d.oylar.filter(o => !o.yopiq && o.month < joriyOy).map(o => o.month),
      };
    }));
    royxat.push(...qism.filter(Boolean));
  }
  const korinadi = royxat.filter(x => x.yopiqQarz || x.avans || x.joriy);
  korinadi.sort((a, b) => (b.yopiqQarz > 0) - (a.yopiqQarz > 0) || String(a.engEski).localeCompare(String(b.engEski)) || b.jami - a.jami);
  return {
    joriyOy,
    jami: {
      yopiqQarz: korinadi.reduce((s, x) => s + x.yopiqQarz, 0),
      joriy: korinadi.reduce((s, x) => s + x.joriy, 0),
      avans: korinadi.reduce((s, x) => s + x.avans, 0),
      qarzdor: korinadi.filter(x => x.yopiqQarz > 0).length,
    },
    royxat: korinadi,
  };
}

// Telegram botdagi xodim hisobotlari ham aynan shu funksiyalardan oladi (src/bot/adminBot.js).
export { kunlik as kunlikKassa, qarz as qarzdorlik };

export function registerHisobotRoutes(app, deps) {
  const yol = (nom, ish) => app.get(`/api/hisobot/${nom}`, authenticate, async (req, res, next) => {
    try {
      const schoolIds = await filiallar(req);
      if (!schoolIds?.length) return res.status(400).json({ error: 'schoolId kerak' });
      const natija = await ish(req, schoolIds);
      if (natija?.xato) return res.status(400).json({ error: natija.xato });
      res.json(natija);
    } catch (err) { next(err); }
  });
  yol('kunlik', (req, ids) => {
    const sana = req.query.sana ? sanaTekshir(req.query.sana) : bugun();
    return sana ? kunlik(ids, sana) : { xato: "Sana noto'g'ri (YYYY-MM-DD)" };
  });
  yol('oylik', (req, ids) => {
    const oy = req.query.oy ? oyTekshir(req.query.oy) : bugun().slice(0, 7);
    return oy ? oylik(ids, oy) : { xato: "Oy noto'g'ri (YYYY-MM)" };
  });
  yol('qarz', (req, ids) => qarz(ids));
  yol('ustoz-oylik', (req, ids) => {
    const oy = req.query.oy ? oyTekshir(req.query.oy) : bugun().slice(0, 7);
    return oy ? ustozOyligi(ids, oy, deps) : { xato: "Oy noto'g'ri (YYYY-MM)" };
  });
  yol('oylik-qarz', (req, ids) => oylikQarz(ids, deps));
}
