// Zukko — CRM ichidagi AI yordamchining ma'lumot vositalari.
//
// Egasi (2026-09-29): Denta7 dagi AI kabi yordamchi, lekin o'ziga xos va
// ko'proq imkoniyatli — o'ng tomondan chiqadigan panel. Har bir vosita
// bazadan o'qiydi va uch narsa qaytaradi:
//   model  — AI ga beriladigan ixcham ma'lumot (telefon va manzil yo'q);
//   blok   — ekrandagi kartochka: raqamlar va bosiladigan qatorlar. AI aytgan
//            har bir raqamning manbasi shu yerda ko'rinib turadi;
//   xulosa — bir qatorli matn (AI siz ishlaydigan tezkor buyruqlar uchun).
//
// Ruxsat: har vosita lib/ruxsatlar.js bo'limlariga qaraydi — xodim ko'rmaydigan
// ma'lumot AI ga ham, ekranga ham chiqmaydi. Filial va "faqat o'z kurslari"
// cheklovi routes/zukko.js tuzadigan kontekstda (k).
//
// Raqamlar ilovadagi bilan bir xil hisoblanadi: tushum — src/lib/money.ts
// isCashIncome, qarz — manfiy balans (Bosh sahifa), kurs bo'yicha qarz —
// lib/allocation.js (o'quvchi kartochkasi), bugungi darslar — lib/lessons.js.

import prisma from './prisma.js';
import { yetadimi, ROL_NOMLARI, MODULLAR, modulKorinadimi } from './ruxsatlar.js';
import { isLessonDay, toTimeStr } from './lessons.js';
import { jadvalVaqti, daqiqaga, vaqtga } from './jadval.js';
import { allocate, shareOpts } from './allocation.js';
import { loadRowsByStudent } from '../services/ledger.js';

// ---------------------------------------------------------------------------
// Umumiy yordamchilar
// ---------------------------------------------------------------------------

/** Tushum emas: oylik hisob va chegirma (src/lib/money.ts bilan bir xil). */
export const HISOB_TURLARI = ['Chegirma', 'Oylik'];
export const YOPIQ_LID = ["To'lov qildi", 'Kelishdi'];
export const LID_HOLATLARI = ['Yangi', "Bog'lanilmadi", "O'ylayapti", 'Kelishdi', "To'lov qildi"];
export const OQUVCHI_HOLATLARI = ['Faol', 'Sinov', 'Passiv', 'Muzlatilgan', 'Sertifikatli', 'Bitiruvchi', 'Arxiv'];
/** Darsda bo'lgan deb sanaladigan belgilar. */
export const KELGAN = ['Keldi', 'Kechikdi', 'ErtaKetdi'];
const HAFTA = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
export const TOLOV_NOMI = { Peyme: 'Payme' };

/** Ruxsat to'plamlari: ro'yxatdagi biror bo'limni ko'rsa yetadi. */
export const R = {
  oquvchi: ['oquvchilar.royxat'],
  oquvchiRoyxat: ['oquvchilar.royxat', 'kurslar.malumot', 'kunlik.korish', 'bosh.korsatkich'],
  balans: ['oquvchilar.balans', 'moliya.oylik', 'bosh.pul'],
  darslar: ['bosh.korsatkich', 'kurslar.malumot', 'kunlik.korish'],
  davomat: ['kurslar.davomat', 'kunlik.korish', 'oquvchilar.royxat'],
  tushum: ['bosh.pul', 'moliya.hisobot', 'moliya.tolovlar'],
  xarajat: ['moliya.xarajat', 'moliya.hisobot', 'bosh.pul'],
  lidlar: ['lidlar.royxat', 'bosh.hisobot'],
  kurslar: ['kurslar.malumot', 'bosh.korsatkich'],
  xonalar: ['kurslar.malumot', 'bosh.korsatkich', 'sozlamalar.xonalar'],
  narx: ['kurslar.narx', 'bosh.pul'],
};

export const korsa = (k, kalitlar) => !kalitlar?.length || kalitlar.some(x => yetadimi(k.ruxsat, x, 1));

export const som = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\s/g, ' ');
export const qarzMatni = (n) => `−${som(Math.abs(n))}`;

/** Ism bazada ko'pincha bosh harflarda — o'qishga qulay ko'rinish (src/lib/displayName.ts). */
export function korinishIsmi(raw) {
  const s = String(raw || '').trim();
  if (!s || s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s-])([a-zà-ÿ‘’'])/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

const KIRIL = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '',
  ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

/** Qidiruv uchun: kichik harf, kirill → lotin, tutuq belgilarsiz. "O‘G‘LI" va "ogli" bir xil. */
export function izlashKaliti(s) {
  return String(s || '').toLowerCase()
    .replace(/[а-яёўқғҳ]/g, ch => KIRIL[ch] ?? ch)
    .replace(/[ʻʼ'`‘’"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** So'z bo'yicha moslik bali: 0 — mos emas. Har bir so'z ismdagi biror so'zning boshi bo'lsa kuchliroq. */
export function moslikBali(ism, sozlar) {
  const kalit = izlashKaliti(ism);
  const qismlar = kalit.split(' ');
  let bal = 0;
  for (const s of sozlar) {
    if (qismlar.some(q => q.startsWith(s))) bal += 2;
    else if (kalit.includes(s)) bal += 1;
    else return 0;
  }
  return bal;
}

export const butun = (v) => {
  const n = parseInt(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
export const oraliq = (v, min, max, standart) => {
  const n = parseInt(v);
  return Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : standart;
};

// --- Sanalar (hammasi "YYYY-MM-DD" satr, O'zbekiston kuni) -----------------

export function sanaOl(v) {
  const s = String(v ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}
export function kunQosh(s, n) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const kunlarOrasi = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
export const haftaKuni = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
export const haftaKuniNomi = (s) => HAFTA[haftaKuni(s)];

/** "2026-09-29" → "29-sentabr" (boshqa yil bo'lsa yili bilan). */
export function uzSana(s, bugun) {
  const t = sanaOl(String(s || '').slice(0, 10));
  if (!t) return String(s || '');
  if (bugun && t === bugun) return 'bugun';
  if (bugun && t === kunQosh(bugun, -1)) return 'kecha';
  const [y, m, d] = t.split('-');
  return `${Number(d)}-${OYLAR[Number(m) - 1]}${bugun && y !== bugun.slice(0, 4) ? ` ${y}` : ''}`;
}
const davrMatni = (dan, gacha, bugun) => (dan === gacha ? uzSana(dan, bugun) : `${uzSana(dan, bugun)} — ${uzSana(gacha, bugun)}`);

/** Kun o'rniga davr: berilmasa — bugun (yoki shu oy boshidan bugungacha). */
function davr(a, k, { standart = 'kun', maks = 400 } = {}) {
  let dan = sanaOl(a?.sana_dan);
  let gacha = sanaOl(a?.sana_gacha);
  if (!dan && !gacha) {
    gacha = k.bugun;
    dan = standart === 'oy' ? `${k.bugun.slice(0, 8)}01` : k.bugun;
  }
  dan = dan || gacha;
  gacha = gacha || dan;
  if (gacha < dan) [dan, gacha] = [gacha, dan];
  if (kunlarOrasi(dan, gacha) > maks) dan = kunQosh(gacha, -maks);
  return { dan, gacha };
}

/** Satr sanali maydon uchun oraliq ("2026-09-29T10:00" ham kiradi). */
export const sanaOraligi = (dan, gacha) => ({ gte: dan, lt: kunQosh(gacha, 1) });
/** Toshkent vaqtidagi kun boshlanishi (createdAt kabi DateTime maydonlar uchun). */
export const kunBoshi = (s) => new Date(`${s}T00:00:00+05:00`);

export function vaqtOraligi(schedule) {
  const { boshi, oxiri } = jadvalVaqti(schedule);
  return { boshi, oxiri, matn: boshi ? (oxiri ? `${boshi}–${oxiri}` : boshi) : null };
}

export const ustozlar = (g) => [g.teacher?.name, g.teacher2?.name].filter(Boolean).map(korinishIsmi).join(', ');

/** O'quvchi so'rovlari uchun filial va "faqat o'z kurslari" sharti. */
export const oquvchiWhere = (k, qoshimcha = {}) => ({
  schoolId: { in: k.maktablar },
  ...(k.oz ? { id: { in: [...k.oz.studentIds] } } : {}),
  ...qoshimcha,
});
export const kursWhere = (k, qoshimcha = {}) => ({
  schoolId: { in: k.maktablar },
  ...(k.oz ? { id: { in: [...k.oz.groupIds] } } : {}),
  ...qoshimcha,
});

const filialIzohi = (k, schoolId) => (k.maktablar.length > 1 ? k.filialNomi(schoolId) : null);

export class VositaXato extends Error {}
export const xato = (m) => { throw new VositaXato(m); };

async function kursniOl(k, id) {
  const kurs = await prisma.group.findFirst({ where: kursWhere(k, { id }), select: { id: true, name: true } });
  if (!kurs) xato('Kurs topilmadi yoki sizga biriktirilmagan');
  return kurs;
}

// ---------------------------------------------------------------------------
// O'quvchilar
// ---------------------------------------------------------------------------

async function oquvchiQidir(k, a) {
  const soz = String(a?.soz ?? '').trim().slice(0, 80);
  const limit = oraliq(a?.limit, 1, 30, 10);
  const balansKor = korsa(k, R.balans);
  const qoshimcha = {};
  const holat = OQUVCHI_HOLATLARI.find(h => izlashKaliti(h) === izlashKaliti(a?.holat));
  if (holat) qoshimcha.status = holat;
  const kursId = butun(a?.kursId);
  if (kursId) qoshimcha.groups = { some: { id: kursId } };

  const rows = await prisma.student.findMany({
    where: oquvchiWhere(k, qoshimcha),
    select: {
      id: true, name: true, status: true, balance: true, phone: true, fatherPhone: true, motherPhone: true,
      schoolId: true, groups: { select: { id: true, name: true } }, oquvchiKod: { select: { kod: true } },
    },
  });

  let topildi;
  const raqam = soz.replace(/\D/g, '');
  if (/^\d{5}$/.test(soz)) {
    topildi = rows.filter(s => s.oquvchiKod?.kod === Number(soz));
  } else if (raqam.length >= 4 && raqam.length === soz.replace(/[\s+()-]/g, '').length) {
    const mos = (t) => String(t || '').replace(/\D/g, '').includes(raqam);
    topildi = rows.filter(s => mos(s.phone) || mos(s.fatherPhone) || mos(s.motherPhone));
  } else if (soz) {
    const sozlar = izlashKaliti(soz).split(' ').filter(Boolean);
    topildi = rows
      .map(s => ({ s, bal: moslikBali(s.name, sozlar) }))
      .filter(x => x.bal > 0)
      .sort((x, y) => y.bal - x.bal || (x.s.status === 'Faol' ? -1 : 0) - (y.s.status === 'Faol' ? -1 : 0))
      .map(x => x.s);
  } else {
    topildi = [...rows].sort((x, y) => x.name.localeCompare(y.name));
  }

  const kor = topildi.slice(0, limit);
  return {
    model: {
      topildi: topildi.length,
      royxat: kor.map(s => ({
        id: s.id,
        ism: korinishIsmi(s.name),
        holat: s.status,
        kod: s.oquvchiKod?.kod ?? null,
        kurslar: s.groups.map(g => g.name),
        ...(balansKor ? { balans: Math.round(s.balance || 0) } : {}),
        ...(k.maktablar.length > 1 ? { filial: k.filialNomi(s.schoolId) } : {}),
      })),
    },
    blok: {
      tur: 'royxat',
      sarlavha: soz ? `Qidiruv: «${soz}»` : "O'quvchilar",
      izoh: `${topildi.length} ta topildi`,
      bolimlar: [{
        qatorlar: kor.map(s => ({
          tur: 'oquvchi', id: s.id, nom: korinishIsmi(s.name),
          izoh: [s.groups.map(g => g.name).join(', ') || 'kurssiz', s.status !== 'Faol' ? s.status : null, s.phone || null, filialIzohi(k, s.schoolId)].filter(Boolean).join(' · '),
          qiymat: balansKor && s.balance < 0 ? qarzMatni(s.balance) : null,
          ton: balansKor && s.balance < 0 ? 'xato' : null,
          havola: `/students/${s.id}`,
        })),
        yana: Math.max(0, topildi.length - kor.length),
      }],
    },
    xulosa: topildi.length ? `${topildi.length} ta o'quvchi topildi` : "O'quvchi topilmadi",
  };
}

async function oquvchiKartasi(k, a) {
  const id = butun(a?.id);
  if (!id) xato("O'quvchi id si kerak — avval oquvchi_qidir bilan toping");
  const s = await prisma.student.findFirst({
    where: oquvchiWhere(k, { id }),
    select: {
      id: true, name: true, status: true, balance: true, joinedDate: true, comment: true, payShare: true, schoolId: true,
      phone: true, fatherPhone: true, motherPhone: true, statusChangedAt: true, leaveReason: true, needsTransport: true,
      oquvchiKod: { select: { kod: true } },
      groups: {
        select: {
          id: true, name: true, schedule: true, days: true,
          course: { select: { name: true } }, teacher: { select: { name: true } }, teacher2: { select: { name: true } },
        },
      },
    },
  });
  if (!s) xato("O'quvchi topilmadi yoki sizga ruxsat yo'q");

  const balansKor = korsa(k, R.balans);
  const dan30 = kunQosh(k.bugun, -30);
  const [davomatlar, tolovlar, qatorlar] = await Promise.all([
    prisma.attendance.findMany({ where: { studentId: id, date: { gte: dan30 } }, select: { date: true, status: true, groupId: true } }),
    balansKor
      ? prisma.payment.findMany({
        where: { studentId: id, amount: { gt: 0 }, type: { notIn: HISOB_TURLARI } },
        select: { id: true, amount: true, type: true, date: true },
        orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 5,
      })
      : [],
    balansKor ? loadRowsByStudent([id]) : null,
  ]);

  // Kurs bo'yicha qarz — kartochkadagi bilan bir xil taqsimot.
  const kursQarzi = new Map();
  if (balansKor && qatorlar) {
    const natija = allocate(qatorlar.get(id) || [], shareOpts(s.payShare));
    for (const x of natija.debtByGroup || []) if (x.amount > 0) kursQarzi.set(x.groupId ?? null, x.amount);
  }

  const sanoq = { Keldi: 0, Kelmapdi: 0, Sababli: 0, boshqa: 0 };
  for (const d of davomatlar) {
    if (d.status === "Dars bo'lmadi") continue;
    if (KELGAN.includes(d.status)) sanoq.Keldi++;
    else if (d.status in sanoq) sanoq[d.status]++;
    else sanoq.boshqa++;
  }
  const jamiDars = sanoq.Keldi + sanoq.Kelmapdi + sanoq.Sababli;
  const foiz = jamiDars ? Math.round((sanoq.Keldi / jamiDars) * 100) : null;
  const kelmaganKunlar = davomatlar.filter(d => d.status === 'Kelmapdi').map(d => d.date.slice(0, 10)).sort().reverse().slice(0, 5);
  const ism = korinishIsmi(s.name);
  const kurslar = s.groups.map(g => ({ g, vaqt: vaqtOraligi(g.schedule).matn }));

  return {
    model: {
      id: s.id,
      ism,
      holat: s.status,
      kod: s.oquvchiKod?.kod ?? null,
      kelgan_sana: s.joinedDate,
      ...(s.status !== 'Faol' && s.leaveReason ? { ketish_sababi: s.leaveReason } : {}),
      transportda: s.needsTransport,
      kurslar: kurslar.map(({ g, vaqt }) => ({
        id: g.id, nom: g.name, fan: g.course?.name, vaqt, kunlar: g.days, ustoz: ustozlar(g),
        ...(balansKor ? { qarz: Math.round(kursQarzi.get(g.id) || 0) } : {}),
      })),
      ...(balansKor ? {
        balans: Math.round(s.balance || 0),
        ...(kursQarzi.get(null) ? { kursga_boglanmagan_qarz: Math.round(kursQarzi.get(null)) } : {}),
        oxirgi_tolovlar: tolovlar.map(p => ({ sana: p.date.slice(0, 10), summa: Math.round(p.amount), tur: TOLOV_NOMI[p.type] || p.type })),
      } : {}),
      davomat_30_kun: { keldi: sanoq.Keldi, kelmadi: sanoq.Kelmapdi, sababli: sanoq.Sababli, foiz },
      oxirgi_kelmagan_kunlar: kelmaganKunlar,
      izoh: s.comment ? String(s.comment).slice(0, 600) : null,
    },
    blok: {
      tur: 'karta',
      sarlavha: ism,
      izoh: [s.status, s.oquvchiKod?.kod ? `ID ${s.oquvchiKod.kod}` : null, filialIzohi(k, s.schoolId)].filter(Boolean).join(' · '),
      havola: `/students/${s.id}`,
      havolaMatni: 'Profilni ochish',
      maydonlar: [
        ...(balansKor ? [{ nom: 'Balans', qiymat: s.balance < 0 ? qarzMatni(s.balance) : som(s.balance), ton: s.balance < 0 ? 'xato' : s.balance > 0 ? 'yaxshi' : null }] : []),
        { nom: 'Davomat · 30 kun', qiymat: foiz === null ? '—' : `${foiz}%`, izoh: jamiDars ? `${sanoq.Kelmapdi} marta kelmadi` : "yo'qlama yo'q", ton: foiz !== null && foiz < 70 ? 'ogoh' : null },
        { nom: 'Kelgan sana', qiymat: uzSana(s.joinedDate, k.bugun) || '—' },
        ...(s.phone ? [{ nom: 'Telefon', qiymat: s.phone, tel: true }] : []),
        ...((s.fatherPhone || s.motherPhone) ? [{ nom: 'Ota-ona', qiymat: s.fatherPhone || s.motherPhone, tel: true }] : []),
      ],
      bolimlar: [
        {
          sarlavha: 'Kurslari',
          qatorlar: kurslar.map(({ g, vaqt }) => ({
            tur: 'kurs', id: g.id, nom: g.name,
            izoh: [vaqt, ustozlar(g)].filter(Boolean).join(' · '),
            qiymat: balansKor && kursQarzi.get(g.id) ? qarzMatni(kursQarzi.get(g.id)) : null,
            ton: balansKor && kursQarzi.get(g.id) ? 'xato' : null,
            havola: `/courses/${g.id}`,
          })),
        },
        ...(tolovlar.length ? [{
          sarlavha: "Oxirgi to'lovlar",
          qatorlar: tolovlar.map(p => ({ tur: 'tolov', id: p.id, nom: `${som(p.amount)} so'm`, izoh: `${uzSana(p.date, k.bugun)} · ${TOLOV_NOMI[p.type] || p.type}`, ton: 'yaxshi' })),
        }] : []),
      ],
      ...(s.comment ? { eslatma: String(s.comment).slice(0, 400) } : {}),
    },
    xulosa: ism,
  };
}

async function qarzdorlar(k, a) {
  const limit = oraliq(a?.limit, 1, 50, 15);
  const engKam = Math.max(0, Number(a?.eng_kam) || 0);
  const kursId = butun(a?.kursId);
  const kurs = kursId ? await kursniOl(k, kursId) : null;

  let royxat;
  if (kurs) {
    // Shu kurs bo'yicha qarz: umumiy balans emas, kursga taqsimlangani.
    const talabalar = await prisma.student.findMany({
      where: oquvchiWhere(k, { groups: { some: { id: kurs.id } } }),
      select: { id: true, name: true, status: true, balance: true, phone: true, payShare: true, schoolId: true, groups: { select: { id: true, name: true } } },
    });
    const qatorlar = await loadRowsByStudent(talabalar.map(s => s.id));
    royxat = talabalar.map(s => {
      const natija = allocate(qatorlar.get(s.id) || [], shareOpts(s.payShare));
      const q = (natija.debtByGroup || []).find(x => x.groupId === kurs.id)?.amount || 0;
      return { ...s, qarz: q };
    }).filter(s => s.qarz > 0.5);
  } else {
    const rows = await prisma.student.findMany({
      where: oquvchiWhere(k, { balance: { lt: -0.5 } }),
      select: { id: true, name: true, status: true, balance: true, phone: true, schoolId: true, groups: { select: { id: true, name: true } } },
    });
    royxat = rows.map(s => ({ ...s, qarz: -s.balance }));
  }
  if (engKam) royxat = royxat.filter(s => s.qarz >= engKam);
  royxat.sort((x, y) => y.qarz - x.qarz);

  // Oxirgi haqiqiy to'lov sanasi — "30 kundan beri to'lamagan" (Bosh sahifadagi kabi).
  const ids = royxat.map(s => s.id);
  const oxirgi = ids.length
    ? await prisma.payment.groupBy({ by: ['studentId'], where: { studentId: { in: ids }, amount: { gt: 0 }, type: { notIn: HISOB_TURLARI } }, _max: { date: true } })
    : [];
  const oxirgiSana = new Map(oxirgi.map(r => [r.studentId, r._max.date?.slice(0, 10) || null]));
  const chegara = kunQosh(k.bugun, -30);
  const eskirgan = royxat.filter(s => { const d = oxirgiSana.get(s.id); return !d || d < chegara; });
  const jami = royxat.reduce((n, s) => n + s.qarz, 0);
  const kor = royxat.slice(0, limit);

  return {
    model: {
      ...(kurs ? { kurs: kurs.name, izoh: "kurs bo'yicha taqsimlangan qarz" } : {}),
      qarzdorlar_soni: royxat.length,
      jami_qarz: Math.round(jami),
      otiz_kundan_beri_tolamagan: eskirgan.length,
      royxat: kor.map(s => ({
        id: s.id, ism: korinishIsmi(s.name), qarz: Math.round(s.qarz), holat: s.status,
        kurslar: s.groups.map(g => g.name), oxirgi_tolov: oxirgiSana.get(s.id) || null,
      })),
    },
    blok: {
      tur: 'royxat',
      sarlavha: kurs ? `Qarzdorlar · ${kurs.name}` : 'Qarzdorlar',
      izoh: `${uzSana(k.bugun, null)} holatiga`,
      havola: kurs ? `/courses/${kurs.id}` : '/students?filter=debt',
      havolaMatni: kurs ? 'Kursni ochish' : "Hammasini ko'rish",
      maydonlar: [
        { nom: 'Qarzdorlar', qiymat: String(royxat.length) },
        { nom: 'Jami qarz', qiymat: som(jami), ton: jami > 0 ? 'xato' : null },
        { nom: "30+ kun to'lamagan", qiymat: String(eskirgan.length), ton: eskirgan.length ? 'ogoh' : null },
      ],
      bolimlar: [{
        qatorlar: kor.map(s => {
          const d = oxirgiSana.get(s.id);
          return {
            tur: 'oquvchi', id: s.id, nom: korinishIsmi(s.name),
            izoh: [s.groups.map(g => g.name).join(', ') || 'kurssiz', d ? `oxirgi to'lov ${uzSana(d, k.bugun)}` : "to'lov yo'q", s.phone || null].filter(Boolean).join(' · '),
            qiymat: qarzMatni(s.qarz), ton: 'xato', havola: `/students/${s.id}`,
          };
        }),
        yana: Math.max(0, royxat.length - kor.length),
      }],
    },
    xulosa: royxat.length ? `${royxat.length} ta qarzdor, jami ${som(jami)} so'm` : "Qarzdor yo'q",
  };
}

// ---------------------------------------------------------------------------
// Darslar va davomat
// ---------------------------------------------------------------------------

async function darslar(k, a) {
  const sana = sanaOl(a?.sana) || k.bugun;
  const kurslar = await prisma.group.findMany({
    where: kursWhere(k),
    select: {
      id: true, name: true, days: true, schedule: true, schoolId: true,
      roomRel: { select: { name: true } }, course: { select: { name: true } },
      teacher: { select: { name: true } }, teacher2: { select: { name: true } },
      _count: { select: { students: true } },
    },
  });
  const kunlik = kurslar.filter(g => isLessonDay(g.days, sana));
  const ids = kunlik.map(g => g.id);
  const belgilar = ids.length
    ? await prisma.attendance.groupBy({ by: ['groupId', 'status'], where: { groupId: { in: ids }, date: sanaOraligi(sana, sana) }, _count: { _all: true } })
    : [];
  const davomat = new Map();
  for (const b of belgilar) {
    const d = davomat.get(b.groupId) || { keldi: 0, kelmadi: 0, sababli: 0, jami: 0 };
    const n = b._count._all;
    d.jami += n;
    if (KELGAN.includes(b.status)) d.keldi += n;
    else if (b.status === 'Kelmapdi') d.kelmadi += n;
    else if (b.status === 'Sababli') d.sababli += n;
    davomat.set(b.groupId, d);
  }

  const hozir = sana === k.bugun ? daqiqaga(toTimeStr()) : null;
  const royxat = kunlik.map(g => {
    const v = vaqtOraligi(g.schedule);
    const bosh = daqiqaga(v.boshi), oxir = daqiqaga(v.oxiri);
    const holat = hozir === null || bosh === null || oxir === null ? null : hozir > oxir ? 'tugadi' : hozir >= bosh ? 'hozir' : 'keladi';
    return { g, v, bosh, holat, d: davomat.get(g.id) || null };
  }).sort((x, y) => (x.bosh ?? 9999) - (y.bosh ?? 9999) || x.g.name.localeCompare(y.g.name));

  const belgilanmagan = royxat.filter(x => !x.d);
  const hozirgi = royxat.filter(x => x.holat === 'hozir').length;
  const HOLAT = { tugadi: 'tugadi', hozir: 'hozir ketyapti', keladi: 'hali boshlanmagan' };

  return {
    model: {
      sana, hafta_kuni: haftaKuniNomi(sana),
      darslar_soni: royxat.length,
      davomati_belgilanmagan: belgilanmagan.length,
      royxat: royxat.map(({ g, v, holat, d }) => ({
        id: g.id, nom: g.name, fan: g.course?.name, vaqt: v.matn, xona: g.roomRel?.name || null, ustoz: ustozlar(g),
        oquvchilar: g._count.students,
        davomat: d ? { keldi: d.keldi, kelmadi: d.kelmadi, sababli: d.sababli } : 'belgilanmagan',
        ...(holat ? { holat: HOLAT[holat] } : {}),
        ...(k.maktablar.length > 1 ? { filial: k.filialNomi(g.schoolId) } : {}),
      })),
    },
    blok: {
      tur: 'royxat',
      sarlavha: sana === k.bugun ? 'Bugungi darslar' : `Darslar · ${uzSana(sana, k.bugun)}`,
      izoh: `${uzSana(sana, null)}, ${haftaKuniNomi(sana)}`,
      maydonlar: [
        { nom: 'Darslar', qiymat: String(royxat.length) },
        ...(sana === k.bugun ? [{ nom: 'Hozir ketyapti', qiymat: String(hozirgi), ton: hozirgi ? 'brand' : null }] : []),
        { nom: 'Yo\'qlama qilinmagan', qiymat: String(belgilanmagan.length), ton: belgilanmagan.length ? 'ogoh' : 'yaxshi' },
      ],
      bolimlar: [{
        qatorlar: royxat.map(({ g, v, holat, d }) => ({
          tur: 'kurs', id: g.id, nom: g.name,
          izoh: [v.matn || "vaqti yo'q", g.roomRel?.name, ustozlar(g), holat === 'hozir' ? 'hozir' : null, filialIzohi(k, g.schoolId)].filter(Boolean).join(' · '),
          qiymat: d ? `${d.keldi}/${g._count.students}` : "yo'qlama yo'q",
          ton: d ? (d.kelmadi ? 'ogoh' : 'yaxshi') : holat === 'tugadi' ? 'xato' : 'sokin',
          havola: `/courses/${g.id}`,
        })),
      }],
    },
    xulosa: royxat.length ? `${royxat.length} ta dars, ${belgilanmagan.length} tasida yo'qlama yo'q` : "Bu kunga dars yo'q",
  };
}

async function davomat(k, a) {
  const { dan, gacha } = davr(a, k, { maks: 92 });
  const where = { schoolId: { in: k.maktablar }, date: sanaOraligi(dan, gacha) };
  if (k.oz) where.groupId = { in: [...k.oz.groupIds] };
  const kursId = butun(a?.kursId);
  let kurs = null;
  if (kursId) { kurs = await kursniOl(k, kursId); where.groupId = kurs.id; }
  const oquvchiId = butun(a?.oquvchiId);
  let oquvchi = null;
  if (oquvchiId) {
    oquvchi = await prisma.student.findFirst({ where: oquvchiWhere(k, { id: oquvchiId }), select: { id: true, name: true } });
    if (!oquvchi) xato("O'quvchi topilmadi yoki sizga ruxsat yo'q");
    where.studentId = oquvchi.id;
  }
  const faqatKelmagan = a?.faqat_kelmaganlar === true || a?.faqat_kelmaganlar === 'true';

  const rows = await prisma.attendance.findMany({ where, select: { studentId: true, groupId: true, date: true, status: true } });
  const [talabalar, guruhlar] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: [...new Set(rows.map(r => r.studentId))] } }, select: { id: true, name: true, phone: true } }),
    prisma.group.findMany({ where: { id: { in: [...new Set(rows.map(r => r.groupId))] } }, select: { id: true, name: true } }),
  ]);
  const ismi = new Map(talabalar.map(s => [s.id, s]));
  const kursNomi = new Map(guruhlar.map(g => [g.id, g.name]));

  const holatlar = {};
  const boyicha = new Map();
  const kursda = new Map();
  for (const r of rows) {
    holatlar[r.status] = (holatlar[r.status] || 0) + 1;
    if (r.status === "Dars bo'lmadi") continue;
    const s = boyicha.get(r.studentId) || { kelmadi: 0, sababli: 0, jami: 0, kurslar: new Set(), sanalar: [] };
    s.jami++;
    if (r.status === 'Kelmapdi') { s.kelmadi++; s.sanalar.push(r.date.slice(0, 10)); s.kurslar.add(r.groupId); }
    if (r.status === 'Sababli') { s.sababli++; s.kurslar.add(r.groupId); }
    boyicha.set(r.studentId, s);
    const g = kursda.get(r.groupId) || { keldi: 0, jami: 0, kelmadi: 0 };
    g.jami++;
    if (KELGAN.includes(r.status)) g.keldi++;
    if (r.status === 'Kelmapdi') g.kelmadi++;
    kursda.set(r.groupId, g);
  }
  const kelgan = KELGAN.reduce((n, h) => n + (holatlar[h] || 0), 0);
  const hisobli = rows.length - (holatlar["Dars bo'lmadi"] || 0);
  const foiz = hisobli ? Math.round((kelgan / hisobli) * 100) : null;

  const kelmaganlar = [...boyicha.entries()]
    .filter(([, s]) => s.kelmadi > 0 || (faqatKelmagan && s.sababli > 0))
    .sort((x, y) => y[1].kelmadi - x[1].kelmadi || y[1].sababli - x[1].sababli);
  const bittaKun = dan === gacha;
  const kor = kelmaganlar.slice(0, 40);
  const kurslarRoyxat = [...kursda.entries()]
    .map(([id, g]) => ({ id, nom: kursNomi.get(id) || `#${id}`, foiz: g.jami ? Math.round((g.keldi / g.jami) * 100) : null, kelmadi: g.kelmadi }))
    .sort((x, y) => (x.foiz ?? 101) - (y.foiz ?? 101));

  const oquvchiQatori = ([id, s]) => {
    const o = ismi.get(id);
    return {
      tur: 'oquvchi', id, nom: korinishIsmi(o?.name) || `#${id}`,
      izoh: [[...s.kurslar].map(g => kursNomi.get(g)).filter(Boolean).join(', '), !bittaKun && s.sanalar.length ? `oxirgi: ${uzSana(s.sanalar.sort().at(-1), k.bugun)}` : null, o?.phone || null].filter(Boolean).join(' · '),
      qiymat: bittaKun ? (s.kelmadi ? 'kelmadi' : 'sababli') : `${s.kelmadi} marta`,
      ton: s.kelmadi ? 'xato' : 'ogoh',
      havola: `/students/${id}`,
    };
  };

  return {
    model: {
      davr: { dan, gacha },
      ...(kurs ? { kurs: kurs.name } : {}),
      ...(oquvchi ? { oquvchi: korinishIsmi(oquvchi.name) } : {}),
      yozuvlar: rows.length,
      holatlar,
      davomat_foizi: foiz,
      kelmaganlar: kor.slice(0, 25).map(([id, s]) => ({ id, ism: korinishIsmi(ismi.get(id)?.name), kelmadi: s.kelmadi, sababli: s.sababli, kurslar: [...s.kurslar].map(g => kursNomi.get(g)).filter(Boolean) })),
      kurslar: kurslarRoyxat.slice(0, 20),
      ...(oquvchi ? { kunlar: rows.map(r => ({ sana: r.date.slice(0, 10), holat: r.status, kurs: kursNomi.get(r.groupId) })).sort((x, y) => y.sana.localeCompare(x.sana)).slice(0, 30) } : {}),
    },
    blok: {
      tur: 'royxat',
      sarlavha: faqatKelmagan && bittaKun && dan === k.bugun ? 'Bugun kelmaganlar' : `Davomat${kurs ? ` · ${kurs.name}` : ''}${oquvchi ? ` · ${korinishIsmi(oquvchi.name)}` : ''}`,
      izoh: davrMatni(dan, gacha, k.bugun),
      maydonlar: [
        { nom: 'Davomat', qiymat: foiz === null ? '—' : `${foiz}%`, ton: foiz !== null && foiz < 75 ? 'ogoh' : 'yaxshi' },
        { nom: 'Kelmadi', qiymat: String(holatlar.Kelmapdi || 0), ton: holatlar.Kelmapdi ? 'xato' : null },
        { nom: 'Sababli', qiymat: String(holatlar.Sababli || 0) },
      ],
      bolimlar: [
        ...(rows.length === 0 ? [] : [{
          sarlavha: bittaKun ? 'Kelmaganlar' : "Eng ko'p kelmaganlar",
          qatorlar: kor.map(oquvchiQatori),
          yana: Math.max(0, kelmaganlar.length - kor.length),
        }]),
        ...(!kurs && !oquvchi && !faqatKelmagan && kurslarRoyxat.length > 1 ? [{
          sarlavha: "Kurslar bo'yicha",
          qatorlar: kurslarRoyxat.slice(0, 12).map(g => ({ tur: 'kurs', id: g.id, nom: g.nom, izoh: `${g.kelmadi} marta kelmadi`, qiymat: g.foiz === null ? '—' : `${g.foiz}%`, ton: g.foiz !== null && g.foiz < 75 ? 'ogoh' : null, havola: `/courses/${g.id}` })),
        }] : []),
      ],
      ...(rows.length === 0 ? { bosh: bittaKun && dan === k.bugun ? "Bugun hali yo'qlama qilinmagan" : "Bu davrda yo'qlama yozuvi yo'q" } : {}),
    },
    xulosa: rows.length ? `Davomat ${foiz ?? '—'}%, ${kelmaganlar.length} ta o'quvchi kelmagan` : "Yo'qlama yozuvi yo'q",
  };
}

// ---------------------------------------------------------------------------
// Pul
// ---------------------------------------------------------------------------

async function tushum(k, a) {
  const { dan, gacha } = davr(a, k, { standart: 'oy', maks: 400 });
  const kunlar = kunlarOrasi(dan, gacha) + 1;
  const asos = { schoolId: { in: k.maktablar }, amount: { gt: 0 }, type: { notIn: HISOB_TURLARI } };
  if (k.oz) asos.studentId = { in: [...k.oz.studentIds] };
  const oldinDan = kunQosh(dan, -kunlar);
  const [rows, oldingi] = await Promise.all([
    prisma.payment.findMany({
      where: { ...asos, date: sanaOraligi(dan, gacha) },
      select: { id: true, amount: true, type: true, date: true, studentId: true, groupId: true },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    }),
    prisma.payment.aggregate({ where: { ...asos, date: sanaOraligi(oldinDan, kunQosh(dan, -1)) }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const jami = rows.reduce((n, p) => n + p.amount, 0);
  const oldingiJami = oldingi._sum.amount || 0;
  const ozgarish = oldingiJami > 0 ? Math.round(((jami - oldingiJami) / oldingiJami) * 100) : null;

  const turlar = {};
  for (const p of rows) { const t = TOLOV_NOMI[p.type] || p.type; turlar[t] = (turlar[t] || 0) + p.amount; }
  const kursSumma = new Map();
  for (const p of rows) kursSumma.set(p.groupId ?? 0, (kursSumma.get(p.groupId ?? 0) || 0) + p.amount);
  const kursIds = [...kursSumma.keys()].filter(Boolean);
  const [guruhlar, talabalar] = await Promise.all([
    kursIds.length ? prisma.group.findMany({ where: { id: { in: kursIds } }, select: { id: true, name: true } }) : [],
    prisma.student.findMany({ where: { id: { in: [...new Set(rows.slice(0, 12).map(p => p.studentId))] } }, select: { id: true, name: true } }),
  ]);
  const kursNomi = new Map(guruhlar.map(g => [g.id, g.name]));
  const ismi = new Map(talabalar.map(s => [s.id, s.name]));
  const kurslar = [...kursSumma.entries()]
    .map(([id, summa]) => ({ id, nom: id ? kursNomi.get(id) || `#${id}` : "Kursga bog'lanmagan", summa }))
    .sort((x, y) => y.summa - x.summa);

  // Grafik: 62 kungacha — kunlar, undan ko'p — oylar.
  let grafik;
  if (kunlar <= 62) {
    const kun = new Map();
    for (const p of rows) kun.set(p.date.slice(0, 10), (kun.get(p.date.slice(0, 10)) || 0) + p.amount);
    grafik = Array.from({ length: kunlar }, (_, i) => { const s = kunQosh(dan, i); return { x: s, y: Math.round(kun.get(s) || 0) }; });
  } else {
    const oy = new Map();
    for (const p of rows) oy.set(p.date.slice(0, 7), (oy.get(p.date.slice(0, 7)) || 0) + p.amount);
    grafik = [...oy.entries()].sort().map(([x, y]) => ({ x, y: Math.round(y) }));
  }
  const turRoyxat = Object.entries(turlar).sort((x, y) => y[1] - x[1]);

  return {
    model: {
      davr: { dan, gacha, kunlar },
      jami: Math.round(jami),
      tolovlar_soni: rows.length,
      turlar: Object.fromEntries(turRoyxat.map(([t, s]) => [t, Math.round(s)])),
      oldingi_davr: { dan: oldinDan, gacha: kunQosh(dan, -1), jami: Math.round(oldingiJami), ozgarish_foiz: ozgarish },
      kurslar: kurslar.slice(0, 10).map(x => ({ nom: x.nom, summa: Math.round(x.summa) })),
      ...(kunlar <= 62 && kunlar > 1 ? { eng_yaxshi_kun: grafik.reduce((m, x) => (x.y > m.y ? x : m), { x: null, y: 0 }) } : {}),
    },
    blok: {
      tur: 'korsatkich',
      sarlavha: dan === gacha ? `Tushum · ${uzSana(dan, k.bugun)}` : 'Tushum',
      izoh: davrMatni(dan, gacha, k.bugun),
      havola: '/finance',
      havolaMatni: 'Moliyani ochish',
      maydonlar: [
        { nom: 'Tushum', qiymat: som(jami), ton: 'yaxshi', izoh: ozgarish === null ? null : `${ozgarish >= 0 ? '+' : ''}${ozgarish}% oldingi davrga` },
        { nom: "To'lovlar", qiymat: String(rows.length) },
        ...turRoyxat.slice(0, 4).map(([t, s]) => ({ nom: t, qiymat: som(s), ulush: jami ? Math.round((s / jami) * 100) : 0 })),
      ],
      ...(grafik.length > 1 ? { grafik } : {}),
      bolimlar: [
        ...(kurslar.length > 1 ? [{
          sarlavha: "Kurslar bo'yicha",
          qatorlar: kurslar.slice(0, 8).map(x => ({ tur: 'kurs', id: x.id || null, nom: x.nom, qiymat: som(x.summa), ulush: jami ? Math.round((x.summa / jami) * 100) : 0, havola: x.id ? `/courses/${x.id}` : null })),
        }] : []),
        ...(rows.length ? [{
          sarlavha: "Oxirgi to'lovlar",
          qatorlar: rows.slice(0, 8).map(p => ({
            tur: 'oquvchi', id: p.studentId, nom: korinishIsmi(ismi.get(p.studentId)) || "O'chirilgan o'quvchi",
            izoh: `${uzSana(p.date, k.bugun)} · ${TOLOV_NOMI[p.type] || p.type}${p.groupId && kursNomi.get(p.groupId) ? ` · ${kursNomi.get(p.groupId)}` : ''}`,
            qiymat: `+${som(p.amount)}`, ton: 'yaxshi', havola: `/students/${p.studentId}`,
          })),
        }] : []),
      ],
      ...(rows.length === 0 ? { bosh: "Bu davrda to'lov yo'q" } : {}),
    },
    xulosa: `${som(jami)} so'm, ${rows.length} ta to'lov`,
  };
}

async function xarajatlar(k, a) {
  const { dan, gacha } = davr(a, k, { standart: 'oy', maks: 400 });
  const rows = await prisma.expense.findMany({
    where: { schoolId: { in: k.maktablar }, date: sanaOraligi(dan, gacha) },
    select: { id: true, amount: true, category: true, date: true, description: true, method: true },
    orderBy: [{ amount: 'desc' }],
  });
  const jami = rows.reduce((n, e) => n + e.amount, 0);
  const toifalar = {};
  for (const e of rows) toifalar[e.category || 'Boshqa'] = (toifalar[e.category || 'Boshqa'] || 0) + e.amount;
  const toifaRoyxat = Object.entries(toifalar).sort((x, y) => y[1] - x[1]);
  let tushumJami = null;
  if (korsa(k, R.tushum)) {
    const t = await prisma.payment.aggregate({ where: { schoolId: { in: k.maktablar }, amount: { gt: 0 }, type: { notIn: HISOB_TURLARI }, date: sanaOraligi(dan, gacha) }, _sum: { amount: true } });
    tushumJami = t._sum.amount || 0;
  }
  return {
    model: {
      davr: { dan, gacha },
      jami: Math.round(jami),
      soni: rows.length,
      toifalar: Object.fromEntries(toifaRoyxat.map(([t, s]) => [t, Math.round(s)])),
      eng_kattalari: rows.slice(0, 8).map(e => ({ sana: e.date.slice(0, 10), summa: Math.round(e.amount), toifa: e.category, izoh: e.description ? String(e.description).slice(0, 80) : null })),
      ...(tushumJami !== null ? { shu_davr_tushumi: Math.round(tushumJami), farq: Math.round(tushumJami - jami) } : {}),
    },
    blok: {
      tur: 'korsatkich',
      sarlavha: 'Xarajatlar',
      izoh: davrMatni(dan, gacha, k.bugun),
      havola: '/finance',
      havolaMatni: 'Moliyani ochish',
      maydonlar: [
        { nom: 'Xarajat', qiymat: som(jami), ton: 'xato' },
        ...(tushumJami !== null ? [{ nom: 'Tushum − xarajat', qiymat: som(tushumJami - jami), ton: tushumJami - jami >= 0 ? 'yaxshi' : 'xato' }] : []),
        ...toifaRoyxat.slice(0, 4).map(([t, s]) => ({ nom: t, qiymat: som(s), ulush: jami ? Math.round((s / jami) * 100) : 0 })),
      ],
      bolimlar: rows.length ? [{
        sarlavha: 'Eng kattalari',
        qatorlar: rows.slice(0, 8).map(e => ({ tur: 'xarajat', id: e.id, nom: e.description ? String(e.description).slice(0, 60) : e.category, izoh: `${uzSana(e.date, k.bugun)} · ${e.category}`, qiymat: `−${som(e.amount)}`, ton: 'xato' })),
        yana: Math.max(0, rows.length - 8),
      }] : [],
      ...(rows.length === 0 ? { bosh: "Bu davrda xarajat yo'q" } : {}),
    },
    xulosa: `${som(jami)} so'm, ${rows.length} ta xarajat`,
  };
}

// ---------------------------------------------------------------------------
// Lidlar, kurslar, xonalar
// ---------------------------------------------------------------------------

async function lidlar(k, a) {
  const limit = oraliq(a?.limit, 1, 40, 15);
  const where = { schoolId: { in: k.maktablar } };
  if (a?.sana_dan || a?.sana_gacha) {
    const { dan, gacha } = davr(a, k, { maks: 400 });
    where.createdAt = { gte: kunBoshi(dan), lt: kunBoshi(kunQosh(gacha, 1)) };
  }
  const holat = LID_HOLATLARI.find(h => izlashKaliti(h) === izlashKaliti(a?.holat));
  if (holat) where.status = holat;
  else if (a?.faqat_ochiq === true || a?.faqat_ochiq === 'true') where.status = { notIn: YOPIQ_LID };
  if (a?.manba) where.source = { contains: String(a.manba).slice(0, 40), mode: 'insensitive' };

  const rows = await prisma.lead.findMany({
    where,
    select: { id: true, name: true, phone: true, course: true, source: true, status: true, createdAt: true, notes: true, schoolId: true },
    orderBy: { createdAt: 'desc' },
  });
  const yoshi = (l) => Math.max(0, Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000));
  const holatlar = {}, manbalar = {};
  for (const l of rows) {
    holatlar[l.status] = (holatlar[l.status] || 0) + 1;
    manbalar[l.source || '—'] = (manbalar[l.source || '—'] || 0) + 1;
  }
  const ochiq = rows.filter(l => !YOPIQ_LID.includes(l.status));
  const javobsiz = ochiq.filter(l => yoshi(l) >= 2);
  // Ochiq lidlar ro'yxatida eng uzoq kutayotgani tepada — birinchi qo'ng'iroq shunga.
  const tartib = where.status && typeof where.status === 'object' ? [...rows].sort((x, y) => yoshi(y) - yoshi(x)) : rows;
  const kor = tartib.slice(0, limit);
  const telKor = korsa(k, ['lidlar.royxat']);

  return {
    model: {
      jami: rows.length,
      holatlar,
      manbalar,
      ochiq: ochiq.length,
      ikki_kundan_beri_javobsiz: javobsiz.length,
      ...(rows.length ? { tolov_qilgani_foiz: Math.round(((holatlar["To'lov qildi"] || 0) / rows.length) * 100) } : {}),
      royxat: kor.map(l => ({ id: l.id, ism: korinishIsmi(l.name), kurs: l.course, holat: l.status, manba: l.source, necha_kun_oldin: yoshi(l), izoh: l.notes ? String(l.notes).slice(0, 120) : null })),
    },
    blok: {
      tur: 'royxat',
      sarlavha: where.status && typeof where.status === 'object' ? 'Ochiq lidlar' : holat ? `Lidlar · ${holat}` : 'Lidlar',
      izoh: a?.sana_dan || a?.sana_gacha ? davrMatni(...Object.values(davr(a, k, { maks: 400 })), k.bugun) : 'barcha vaqt',
      havola: '/leads',
      havolaMatni: 'Lidlarni ochish',
      maydonlar: [
        { nom: 'Lidlar', qiymat: String(rows.length) },
        { nom: 'Ochiq', qiymat: String(ochiq.length), ton: ochiq.length ? 'brand' : null },
        { nom: '2+ kun javobsiz', qiymat: String(javobsiz.length), ton: javobsiz.length ? 'ogoh' : 'yaxshi' },
      ],
      bolimlar: [{
        qatorlar: kor.map(l => ({
          tur: 'lid', id: l.id, nom: korinishIsmi(l.name),
          izoh: [l.course, l.source, yoshi(l) ? `${yoshi(l)} kun oldin` : 'bugun', telKor ? l.phone : null, filialIzohi(k, l.schoolId)].filter(Boolean).join(' · '),
          qiymat: l.status,
          ton: l.status === "To'lov qildi" ? 'yaxshi' : !YOPIQ_LID.includes(l.status) && yoshi(l) >= 2 ? 'ogoh' : null,
          havola: '/leads',
        })),
        yana: Math.max(0, rows.length - kor.length),
      }],
    },
    xulosa: `${rows.length} ta lid, ${ochiq.length} tasi ochiq`,
  };
}

async function kurslar(k, a) {
  const kursId = butun(a?.kursId);
  const narxKor = korsa(k, R.narx);
  const balansKor = korsa(k, R.balans);
  if (kursId) return kursTafsiloti(k, kursId, { narxKor, balansKor });

  const soz = izlashKaliti(a?.soz);
  const rows = await prisma.group.findMany({
    where: kursWhere(k),
    select: {
      id: true, name: true, days: true, schedule: true, schoolId: true,
      roomRel: { select: { name: true } }, course: { select: { name: true, price: true } },
      teacher: { select: { name: true } }, teacher2: { select: { name: true } },
      _count: { select: { students: true } },
    },
    orderBy: { name: 'asc' },
  });
  const topildi = soz
    ? rows.filter(g => [g.name, g.course?.name, g.teacher?.name, g.teacher2?.name].some(x => izlashKaliti(x).includes(soz)))
    : rows;
  const kor = topildi.slice(0, 30);
  const oquvchilar = topildi.reduce((n, g) => n + g._count.students, 0);
  return {
    model: {
      kurslar_soni: topildi.length,
      oquvchilar_jami: oquvchilar,
      royxat: kor.map(g => ({
        id: g.id, nom: g.name, fan: g.course?.name, vaqt: vaqtOraligi(g.schedule).matn, kunlar: g.days, xona: g.roomRel?.name || null,
        ustoz: ustozlar(g), oquvchilar: g._count.students, ...(narxKor ? { oylik_narx: Math.round(g.course?.price || 0) } : {}),
      })),
    },
    blok: {
      tur: 'royxat',
      sarlavha: soz ? `Kurslar · «${a.soz}»` : 'Kurslar',
      izoh: `${topildi.length} ta kurs · ${oquvchilar} o'quvchi`,
      havola: '/courses',
      havolaMatni: 'Kurslarni ochish',
      bolimlar: [{
        qatorlar: kor.map(g => ({
          tur: 'kurs', id: g.id, nom: g.name,
          izoh: [vaqtOraligi(g.schedule).matn, g.days && !/belgilanmagan/i.test(g.days) ? g.days.replace('HAR_KUNI', 'har kuni').toLowerCase() : null, g.roomRel?.name, ustozlar(g), filialIzohi(k, g.schoolId)].filter(Boolean).join(' · '),
          qiymat: `${g._count.students} o'quvchi`,
          havola: `/courses/${g.id}`,
        })),
        yana: Math.max(0, topildi.length - kor.length),
      }],
    },
    xulosa: `${topildi.length} ta kurs`,
  };
}

async function kursTafsiloti(k, kursId, { narxKor, balansKor }) {
  const g = await prisma.group.findFirst({
    where: kursWhere(k, { id: kursId }),
    select: {
      id: true, name: true, days: true, schedule: true, schoolId: true,
      roomRel: { select: { name: true, capacity: true } }, course: { select: { name: true, price: true } },
      teacher: { select: { name: true } }, teacher2: { select: { name: true } },
      students: { select: { id: true, name: true, status: true, balance: true, payShare: true, phone: true } },
    },
  });
  if (!g) xato('Kurs topilmadi yoki sizga biriktirilmagan');
  const dan30 = kunQosh(k.bugun, -30);
  const [davomat, qatorlar] = await Promise.all([
    prisma.attendance.findMany({ where: { groupId: g.id, date: { gte: dan30 } }, select: { studentId: true, status: true, date: true } }),
    balansKor ? loadRowsByStudent(g.students.map(s => s.id)) : null,
  ]);
  const qarz = new Map();
  if (qatorlar) {
    for (const s of g.students) {
      const natija = allocate(qatorlar.get(s.id) || [], shareOpts(s.payShare));
      const q = (natija.debtByGroup || []).find(x => x.groupId === g.id)?.amount || 0;
      if (q > 0.5) qarz.set(s.id, q);
    }
  }
  const kelmadi = new Map();
  let keldi = 0, hisobli = 0;
  for (const d of davomat) {
    if (d.status === "Dars bo'lmadi") continue;
    hisobli++;
    if (KELGAN.includes(d.status)) keldi++;
    if (d.status === 'Kelmapdi') kelmadi.set(d.studentId, (kelmadi.get(d.studentId) || 0) + 1);
  }
  const foiz = hisobli ? Math.round((keldi / hisobli) * 100) : null;
  const darsKunlari = new Set(davomat.map(d => d.date.slice(0, 10))).size;
  const jamiQarz = [...qarz.values()].reduce((n, x) => n + x, 0);
  const oquvchilar = [...g.students].sort((x, y) => (qarz.get(y.id) || 0) - (qarz.get(x.id) || 0) || x.name.localeCompare(y.name));
  const v = vaqtOraligi(g.schedule);
  const bugunDarsmi = isLessonDay(g.days, k.bugun);

  return {
    model: {
      id: g.id, nom: g.name, fan: g.course?.name, vaqt: v.matn, kunlar: g.days, bugun_dars_bormi: bugunDarsmi,
      xona: g.roomRel ? { nom: g.roomRel.name, sigim: g.roomRel.capacity } : null,
      ustoz: ustozlar(g), ...(narxKor ? { oylik_narx: Math.round(g.course?.price || 0) } : {}),
      oquvchilar_soni: g.students.length,
      davomat_30_kun: { foiz, dars_kunlari: darsKunlari },
      ...(balansKor ? { qarzdorlar_soni: qarz.size, jami_qarz: Math.round(jamiQarz) } : {}),
      oquvchilar: oquvchilar.slice(0, 60).map(s => ({
        id: s.id, ism: korinishIsmi(s.name), holat: s.status,
        ...(balansKor ? { qarz: Math.round(qarz.get(s.id) || 0) } : {}),
        kelmadi_30_kun: kelmadi.get(s.id) || 0,
      })),
    },
    blok: {
      tur: 'karta',
      sarlavha: g.name,
      izoh: [g.course?.name, v.matn, g.roomRel?.name, filialIzohi(k, g.schoolId)].filter(Boolean).join(' · '),
      havola: `/courses/${g.id}`,
      havolaMatni: 'Kursni ochish',
      maydonlar: [
        { nom: "O'quvchilar", qiymat: String(g.students.length), izoh: g.roomRel?.capacity ? `${g.roomRel.capacity} o'rinli xona` : null },
        { nom: 'Davomat · 30 kun', qiymat: foiz === null ? '—' : `${foiz}%`, izoh: `${darsKunlari} dars kuni`, ton: foiz !== null && foiz < 75 ? 'ogoh' : null },
        ...(balansKor ? [{ nom: 'Kurs qarzi', qiymat: som(jamiQarz), izoh: `${qarz.size} o'quvchi`, ton: jamiQarz > 0 ? 'xato' : 'yaxshi' }] : []),
        ...(narxKor && g.course?.price ? [{ nom: 'Oylik narx', qiymat: som(g.course.price) }] : []),
        { nom: 'Ustoz', qiymat: ustozlar(g) || '—' },
      ],
      bolimlar: [{
        sarlavha: "O'quvchilar",
        qatorlar: oquvchilar.slice(0, 40).map(s => ({
          tur: 'oquvchi', id: s.id, nom: korinishIsmi(s.name),
          izoh: [s.status !== 'Faol' ? s.status : null, kelmadi.get(s.id) ? `30 kunda ${kelmadi.get(s.id)} marta kelmadi` : null, s.phone || null].filter(Boolean).join(' · '),
          qiymat: balansKor && qarz.get(s.id) ? qarzMatni(qarz.get(s.id)) : null,
          ton: balansKor && qarz.get(s.id) ? 'xato' : null,
          havola: `/students/${s.id}`,
        })),
        yana: Math.max(0, oquvchilar.length - 40),
      }],
    },
    xulosa: `${g.name}: ${g.students.length} o'quvchi`,
  };
}

async function xonalar(k, a) {
  let sana = sanaOl(a?.sana);
  const kunNomi = izlashKaliti(a?.hafta_kuni);
  if (!sana && kunNomi) {
    const i = HAFTA.findIndex(h => h.startsWith(kunNomi.slice(0, 4)));
    if (i >= 0) sana = kunQosh(k.bugun, (i - haftaKuni(k.bugun) + 7) % 7);
  }
  sana = sana || k.bugun;
  const vaqtMatn = String(a?.vaqt ?? '').trim();
  const t0 = daqiqaga(vaqtMatn);
  const davomiylik = oraliq(a?.davomiylik_daqiqa, 15, 360, 90);

  const [rooms, groups] = await Promise.all([
    prisma.room.findMany({ where: { schoolId: { in: k.maktablar } }, select: { id: true, name: true, capacity: true, schoolId: true }, orderBy: { name: 'asc' } }),
    prisma.group.findMany({ where: { schoolId: { in: k.maktablar }, room: { not: null } }, select: { id: true, name: true, days: true, schedule: true, room: true } }),
  ]);
  const kunlik = groups.filter(g => isLessonDay(g.days, sana));
  // "Faqat o'z kurslari": boshqa kurslarning nomi ko'rsatilmaydi, faqat "band".
  const nomi = (g) => (!k.oz || k.oz.groupIds.has(g.id) ? g.name : 'band');

  const royxat = rooms.map(r => {
    const bandlar = kunlik.filter(g => g.room === r.id).map(g => {
      const v = vaqtOraligi(g.schedule);
      return { g, v, bosh: daqiqaga(v.boshi), oxir: daqiqaga(v.oxiri) };
    }).sort((x, y) => (x.bosh ?? 9999) - (y.bosh ?? 9999));
    let holat = null;
    if (t0 !== null) {
      const t1 = t0 + davomiylik;
      const toqnash = bandlar.filter(b => b.bosh !== null && (b.oxir ?? b.bosh + 90) > t0 && b.bosh < t1);
      const nomalum = bandlar.some(b => b.bosh === null);
      holat = toqnash.length ? { band: true, kurslar: toqnash.map(b => nomi(b.g)) } : { band: false, noaniq: nomalum };
    }
    return { r, bandlar, holat };
  });
  const boshlar = royxat.filter(x => x.holat && !x.holat.band);

  return {
    model: {
      sana, hafta_kuni: haftaKuniNomi(sana),
      ...(t0 !== null ? { vaqt: `${vaqtga(t0)}–${vaqtga(t0 + davomiylik)}`, bosh_xonalar: boshlar.map(x => ({ nom: x.r.name, sigim: x.r.capacity, ...(x.holat.noaniq ? { izoh: "vaqti kiritilmagan kurs bor" } : {}) })) } : {}),
      xonalar: royxat.map(({ r, bandlar, holat }) => ({
        nom: r.name, sigim: r.capacity,
        darslar: bandlar.map(b => ({ kurs: nomi(b.g), vaqt: b.v.matn || "vaqti yo'q" })),
        ...(holat ? { shu_vaqtda: holat.band ? `band (${holat.kurslar.join(', ')})` : "bo'sh" } : {}),
      })),
    },
    blok: {
      tur: 'royxat',
      sarlavha: t0 !== null ? `Bo'sh xonalar · ${vaqtga(t0)}–${vaqtga(t0 + davomiylik)}` : 'Xonalar bandligi',
      izoh: `${uzSana(sana, k.bugun)}, ${haftaKuniNomi(sana)}`,
      maydonlar: t0 !== null
        ? [{ nom: "Bo'sh", qiymat: String(boshlar.length), ton: boshlar.length ? 'yaxshi' : 'xato' }, { nom: 'Band', qiymat: String(royxat.length - boshlar.length) }]
        : [{ nom: 'Xonalar', qiymat: String(rooms.length) }, { nom: 'Shu kun darslar', qiymat: String(kunlik.length) }],
      bolimlar: [{
        qatorlar: [...royxat].sort((x, y) => (x.holat?.band ? 1 : 0) - (y.holat?.band ? 1 : 0)).map(({ r, bandlar, holat }) => ({
          tur: 'xona', id: r.id, nom: `${r.name}${r.capacity ? ` · ${r.capacity} o'rin` : ''}`,
          izoh: bandlar.length ? bandlar.map(b => `${b.v.matn || '?'} ${nomi(b.g)}`).join('; ') : "kun bo'yi bo'sh",
          qiymat: holat ? (holat.band ? 'band' : "bo'sh") : `${bandlar.length} dars`,
          ton: holat ? (holat.band ? 'xato' : 'yaxshi') : bandlar.length ? null : 'yaxshi',
        })),
      }],
      ...(rooms.length === 0 ? { bosh: "Xonalar kiritilmagan (Sozlamalar → Xonalar)" } : {}),
    },
    xulosa: t0 !== null ? `${boshlar.length} ta xona bo'sh` : `${rooms.length} ta xona, ${kunlik.length} ta dars`,
  };
}

// ---------------------------------------------------------------------------
// Umumiy ko'rsatkichlar (AI ga qisqa holat ham shu yerdan)
// ---------------------------------------------------------------------------

export async function korsatkichlar(k) {
  const oy = k.bugun.slice(0, 7);
  const oyBoshi = `${oy}-01`;
  // Har bir bo'lak o'z ruxsati bilan: o'quvchilarni ko'rmaydigan xodimga ularning soni ham chiqmaydi.
  const umumiyKor = korsa(k, R.oquvchiRoyxat);
  const balansKor = korsa(k, R.balans), tushumKor = korsa(k, R.tushum), lidKor = korsa(k, R.lidlar);
  const oqW = oquvchiWhere(k);
  // Tushum vositasidagi bilan bir xil: "faqat o'z kurslari" — o'z o'quvchilarining to'lovlari.
  const tolovW = { schoolId: { in: k.maktablar }, amount: { gt: 0 }, type: { notIn: HISOB_TURLARI }, ...(k.oz ? { studentId: { in: [...k.oz.studentIds] } } : {}) };
  const [holatlar, yangi, ketgan, kurslarSoni, ustozlarSoni, qarz, bugungiTushum, oylikTushum, lidOy, lidOchiq, lidJavobsiz] = await Promise.all([
    umumiyKor ? prisma.student.groupBy({ by: ['status'], where: oqW, _count: { _all: true } }) : null,
    umumiyKor ? prisma.student.count({ where: { ...oqW, joinedDate: { startsWith: oy } } }) : null,
    umumiyKor ? prisma.student.count({ where: { ...oqW, status: { in: ['Passiv', 'Arxiv'] }, statusChangedAt: { gte: kunBoshi(oyBoshi) } } }) : null,
    umumiyKor ? prisma.group.count({ where: kursWhere(k) }) : null,
    umumiyKor && !k.oz ? prisma.teacher.count({ where: { schoolId: { in: k.maktablar }, status: 'Faol' } }) : null,
    balansKor ? prisma.student.aggregate({ where: { ...oqW, balance: { lt: -0.5 } }, _sum: { balance: true }, _count: { _all: true } }) : null,
    tushumKor ? prisma.payment.aggregate({ where: { ...tolovW, date: sanaOraligi(k.bugun, k.bugun) }, _sum: { amount: true }, _count: { _all: true } }) : null,
    tushumKor ? prisma.payment.aggregate({ where: { ...tolovW, date: sanaOraligi(oyBoshi, k.bugun) }, _sum: { amount: true }, _count: { _all: true } }) : null,
    lidKor ? prisma.lead.count({ where: { schoolId: { in: k.maktablar }, createdAt: { gte: kunBoshi(oyBoshi) } } }) : null,
    lidKor ? prisma.lead.count({ where: { schoolId: { in: k.maktablar }, status: { notIn: YOPIQ_LID } } }) : null,
    lidKor ? prisma.lead.count({ where: { schoolId: { in: k.maktablar }, status: { notIn: YOPIQ_LID }, createdAt: { lt: new Date(Date.now() - 2 * 86400000) } } }) : null,
  ]);
  const h = holatlar ? Object.fromEntries(holatlar.map(x => [x.status, x._count._all])) : null;
  return {
    ...(h ? {
      oquvchilar: { faol: h.Faol || 0, sinov: h.Sinov || 0, holatlar: h, bu_oy_qoshilgan: yangi, bu_oy_ketgan: ketgan },
      kurslar: kurslarSoni,
    } : {}),
    ...(ustozlarSoni !== null ? { ustozlar: ustozlarSoni } : {}),
    ...(qarz ? { qarz: { qarzdorlar: qarz._count._all, jami: Math.round(-(qarz._sum.balance || 0)) } } : {}),
    ...(bugungiTushum ? { tushum: { bugun: Math.round(bugungiTushum._sum.amount || 0), bugun_soni: bugungiTushum._count._all, bu_oy: Math.round(oylikTushum._sum.amount || 0), bu_oy_soni: oylikTushum._count._all } } : {}),
    ...(lidKor ? { lidlar: { bu_oy: lidOy, ochiq: lidOchiq, ikki_kundan_beri_javobsiz: lidJavobsiz } } : {}),
  };
}

async function korsatkichVositasi(k) {
  const m = await korsatkichlar(k);
  return {
    model: m,
    blok: {
      tur: 'korsatkich',
      sarlavha: "Umumiy ko'rsatkichlar",
      izoh: uzSana(k.bugun, null),
      maydonlar: [
        ...(m.oquvchilar ? [
          { nom: "Faol o'quvchilar", qiymat: String(m.oquvchilar.faol), izoh: m.oquvchilar.sinov ? `+${m.oquvchilar.sinov} sinovda` : null },
          { nom: "Bu oy qo'shildi", qiymat: String(m.oquvchilar.bu_oy_qoshilgan), ton: 'yaxshi' },
          { nom: 'Bu oy ketdi', qiymat: String(m.oquvchilar.bu_oy_ketgan), ton: m.oquvchilar.bu_oy_ketgan ? 'ogoh' : null },
          { nom: 'Kurslar', qiymat: String(m.kurslar) },
        ] : []),
        ...(m.qarz ? [{ nom: 'Qarz', qiymat: som(m.qarz.jami), izoh: `${m.qarz.qarzdorlar} o'quvchi`, ton: 'xato' }] : []),
        ...(m.tushum ? [{ nom: 'Bu oy tushum', qiymat: som(m.tushum.bu_oy), izoh: `bugun ${som(m.tushum.bugun)}`, ton: 'yaxshi' }] : []),
        ...(m.lidlar ? [{ nom: 'Ochiq lidlar', qiymat: String(m.lidlar.ochiq), izoh: `bu oy ${m.lidlar.bu_oy} ta yangi` }] : []),
      ],
      bolimlar: [],
      ...(Object.keys(m).length === 0 ? { bosh: "Ko'rsatkichlarni ko'rishga ruxsatingiz yo'q" } : {}),
    },
    xulosa: m.oquvchilar ? `${m.oquvchilar.faol} faol o'quvchi, ${m.kurslar} kurs` : "Ko'rsatkichlar",
  };
}

// ---------------------------------------------------------------------------
// Amallar uchun kerak bo'ladigan ro'yxatlar: to'lovlar (id bilan — tuzatish va
// o'chirishga), xodimlar, Klik tasdig'ini kutayotganlar, sahifani ochish.
// ---------------------------------------------------------------------------

async function tolovlar(k, a) {
  const limit = oraliq(a?.limit, 1, 40, 15);
  const where = { schoolId: { in: k.maktablar } };
  if (k.oz) where.studentId = { in: [...k.oz.studentIds] };
  const oquvchiId = butun(a?.oquvchiId);
  let oquvchi = null;
  if (oquvchiId) {
    oquvchi = await prisma.student.findFirst({ where: oquvchiWhere(k, { id: oquvchiId }), select: { id: true, name: true } });
    if (!oquvchi) xato("O'quvchi topilmadi yoki sizga ruxsat yo'q");
    where.studentId = oquvchi.id;
  }
  if (a?.sana_dan || a?.sana_gacha) {
    const { dan, gacha } = davr(a, k, { maks: 400 });
    where.date = sanaOraligi(dan, gacha);
  }
  const tur = String(a?.tur || '').trim();
  if (tur) where.type = tur === 'Payme' ? 'Peyme' : tur;
  else if (a?.hisoblar !== true) { where.amount = { gt: 0 }; where.type = { notIn: HISOB_TURLARI }; }
  const rows = await prisma.payment.findMany({
    where,
    select: { id: true, amount: true, type: true, date: true, description: true, createdAt: true, studentId: true, student: { select: { name: true } } },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return {
    model: {
      ...(oquvchi ? { oquvchi: korinishIsmi(oquvchi.name) } : {}),
      royxat: rows.map(p => ({
        id: p.id, oquvchiId: p.studentId, oquvchi: korinishIsmi(p.student?.name), summa: Math.round(p.amount),
        tur: TOLOV_NOMI[p.type] || p.type, sana: p.date.slice(0, 10),
        kiritilgan_daqiqa_oldin: Math.round((Date.now() - new Date(p.createdAt).getTime()) / 60000),
        izoh: p.description ? String(p.description).slice(0, 80) : null,
      })),
    },
    blok: {
      tur: 'royxat',
      sarlavha: oquvchi ? `To'lovlar · ${korinishIsmi(oquvchi.name)}` : "To'lovlar",
      izoh: `${rows.length} ta yozuv`,
      bolimlar: [{
        qatorlar: rows.map(p => ({
          tur: 'tolov', id: p.id, nom: `${p.amount < 0 ? '−' : ''}${som(Math.abs(p.amount))} so'm`,
          izoh: [oquvchi ? null : korinishIsmi(p.student?.name), uzSana(p.date, k.bugun), TOLOV_NOMI[p.type] || p.type, `#${p.id}`].filter(Boolean).join(' · '),
          ton: p.amount > 0 ? 'yaxshi' : 'xato',
          havola: `/students/${p.studentId}`,
        })),
      }],
      ...(rows.length === 0 ? { bosh: "To'lov topilmadi" } : {}),
    },
    xulosa: `${rows.length} ta to'lov`,
  };
}

async function xodimlar(k, a) {
  const maoshKor = korsa(k, ['xodimlar.maosh']);
  const rows = await prisma.user.findMany({
    where: {
      OR: [{ schoolId: { in: k.maktablar } }, { branches: { some: { id: { in: k.maktablar } } } }],
      role: { not: 'SELLER' },
      status: { not: 'Arxiv' },
    },
    select: { id: true, name: true, role: true, position: true, salary: true, schoolId: true },
    orderBy: { name: 'asc' },
  });
  const soz = izlashKaliti(a?.soz);
  const topildi = soz ? rows.filter(u => izlashKaliti(`${u.name} ${u.position || ''} ${ROL_NOMLARI[u.role] || ''}`).includes(soz)) : rows;
  const ids = topildi.map(u => u.id);
  const oy = k.bugun.slice(0, 7);
  const [davomatlar, maoshlar] = await Promise.all([
    ids.length ? prisma.staffAttendance.findMany({ where: { userId: { in: ids }, date: k.bugun }, select: { userId: true, status: true } }) : [],
    maoshKor && ids.length ? prisma.salaryPayment.findMany({ where: { userId: { in: ids }, month: oy }, select: { userId: true, amount: true } }) : [],
  ]);
  const bugun = new Map(davomatlar.map(d => [d.userId, d.status]));
  const berilgan = new Map(maoshlar.map(m => [m.userId, m.amount]));
  const kor = topildi.slice(0, 40);
  return {
    model: {
      soni: topildi.length,
      royxat: kor.map(u => ({
        id: u.id, ism: korinishIsmi(u.name), lavozim: u.position || ROL_NOMLARI[u.role] || u.role,
        bugungi_davomat: bugun.get(u.id) || null,
        ...(maoshKor ? { oylik: u.salary || 0, shu_oy_berilgan: berilgan.has(u.id) ? berilgan.get(u.id) : null } : {}),
      })),
    },
    blok: {
      tur: 'royxat',
      sarlavha: 'Xodimlar',
      izoh: `${topildi.length} ta · bugun ${uzSana(k.bugun, null)}`,
      havola: '/hr',
      havolaMatni: 'Xodimlarni ochish',
      bolimlar: [{
        qatorlar: kor.map(u => ({
          tur: 'oquvchi', id: u.id, nom: korinishIsmi(u.name),
          izoh: [u.position || ROL_NOMLARI[u.role], maoshKor && berilgan.has(u.id) ? `${oy} oyligi berilgan` : null].filter(Boolean).join(' · '),
          qiymat: bugun.get(u.id) || null,
          ton: bugun.get(u.id) === 'Keldi' ? 'yaxshi' : bugun.get(u.id) === 'Kelmadi' ? 'xato' : bugun.get(u.id) ? 'ogoh' : null,
          havola: `/hr/${u.id}`,
        })),
        yana: Math.max(0, topildi.length - kor.length),
      }],
    },
    xulosa: `${topildi.length} ta xodim`,
  };
}

async function klikKutayotganlar(k) {
  const rows = await prisma.tolovTasdiq.findMany({
    where: { schoolId: { in: k.maktablar }, status: 'kutilmoqda' },
    orderBy: { id: 'desc' },
    take: 30,
  });
  const talabalar = rows.length ? await prisma.student.findMany({ where: { id: { in: [...new Set(rows.map(r => r.studentId))] } }, select: { id: true, name: true } }) : [];
  const ismi = new Map(talabalar.map(t => [t.id, korinishIsmi(t.name)]));
  const vaqt = (p) => (p ? `${p.slice(8, 10)}.${p.slice(5, 7)} ${p.slice(11, 16)}` : '');
  return {
    model: {
      soni: rows.length,
      royxat: rows.map(r => ({ id: r.id, oquvchiId: r.studentId, oquvchi: ismi.get(r.studentId), summa: Math.round(r.amount), tur: r.type, chek_vaqti: r.paidAt, yubordi: r.createdByName, izoh: r.note })),
    },
    blok: {
      tur: 'royxat',
      sarlavha: "Tasdiq kutayotgan Klik to'lovlari",
      izoh: `${rows.length} ta`,
      havola: '/finance',
      havolaMatni: 'Moliyani ochish',
      bolimlar: [{
        qatorlar: rows.map(r => ({
          tur: 'tolov', id: r.id, nom: ismi.get(r.studentId) || `#${r.studentId}`,
          izoh: [`chek ${vaqt(r.paidAt)}`, r.createdByName, `#${r.id}`].filter(Boolean).join(' · '),
          qiymat: `${som(r.amount)}`, ton: 'ogoh', havola: `/students/${r.studentId}`,
        })),
      }],
      ...(rows.length === 0 ? { bosh: "Tasdiq kutayotgan to'lov yo'q" } : {}),
    },
    xulosa: `${rows.length} ta Klik tasdiq kutmoqda`,
  };
}

/** Katalogdan tashqari ishlar (imtihon tuzish, logistika, sozlamalar) — kerakli sahifa. */
const SAHIFA_YOLLARI = {
  bosh: ['/', 'Bosh sahifa', 'bosh'], lidlar: ['/leads', 'Lidlar', 'lidlar'], kurslar: ['/courses', 'Kurslar', 'kurslar'],
  oquvchilar: ['/students', "O'quvchilar", 'oquvchilar'], qarzdorlar: ['/students?filter=debt', 'Qarzdorlar', 'oquvchilar'],
  kunlik: ['/daily', "Kunlik ro'yxat", 'kunlik'], oquv_reja: ['/syllabus', "O'quv reja", 'dastur'], moliya: ['/finance', 'Moliya', 'moliya'],
  logistika: ['/logistics', 'Logistika', 'logistika'], imtihonlar: ['/exams', 'Imtihonlar', 'imtihonlar'], xabarlar: ['/messaging', 'Xabarlar', 'xabarlar'],
  xodimlar: ['/hr', 'Xodimlar', 'xodimlar'], jurnal: ['/journal', 'Amallar jurnali', 'jurnal'], sozlamalar: ['/settings', 'Sozlamalar', 'sozlamalar'],
};

async function sahifaniOchish(k, a) {
  const oquvchiId = butun(a?.oquvchiId), kursId = butun(a?.kursId);
  let yol, nom;
  if (oquvchiId) {
    const o = await prisma.student.findFirst({ where: oquvchiWhere(k, { id: oquvchiId }), select: { id: true, name: true } });
    if (!o) xato("O'quvchi topilmadi");
    yol = `/students/${o.id}`; nom = korinishIsmi(o.name);
  } else if (kursId) {
    const g = await prisma.group.findFirst({ where: kursWhere(k, { id: kursId }), select: { id: true, name: true } });
    if (!g) xato('Kurs topilmadi');
    yol = `/courses/${g.id}`; nom = g.name;
  } else {
    const t = SAHIFA_YOLLARI[String(a?.sahifa || '')];
    if (!t) xato(`Sahifa: ${Object.keys(SAHIFA_YOLLARI).join(', ')}`);
    if (!modulKorinadimi(k.ruxsat, t[2])) xato("Bu sahifa sizga ochiq emas");
    [yol, nom] = t;
  }
  return {
    model: { ochildi: false, izoh: "Xodimga sahifani ochish tugmasi ko'rsatildi", sahifa: nom },
    blok: { tur: 'korsatkich', belgi: 'havola', sarlavha: nom, izoh: String(a?.izoh || '').slice(0, 200) || undefined, havola: yol, havolaMatni: 'Sahifani ochish', bolimlar: [] },
    xulosa: nom,
  };
}

// ---------------------------------------------------------------------------
// Vositalar jadvali — AI ga shu ro'yxat (ruxsatga qarab qisqartirilgan) beriladi.
// ---------------------------------------------------------------------------

const SANA = { type: 'string', description: 'Sana YYYY-MM-DD' };
const ID = (tavsif) => ({ type: 'integer', description: tavsif });

export const VOSITALAR = [
  {
    nom: 'oquvchi_qidir',
    tavsif: "O'quvchini ism/familiya, telefon yoki 5 xonali ID bo'yicha qidiradi (holat yoki kurs bo'yicha ham). Qaytaradi: id, holat, kurslar, balans.",
    ruxsat: R.oquvchiRoyxat,
    parametrlar: {
      type: 'object',
      properties: {
        soz: { type: 'string', description: "Ism, familiya, telefon yoki ID. Bo'sh — hammasi" },
        holat: { type: 'string', enum: OQUVCHI_HOLATLARI },
        kursId: ID('Faqat shu kursdagilar'),
        limit: { type: 'integer', description: 'Nechta qaytarish (standart 10, eng ko\'pi 30)' },
      },
    },
    bajar: oquvchiQidir,
    qadam: (a) => (a?.soz ? `«${String(a.soz).slice(0, 30)}» qidirilmoqda` : "O'quvchilar ro'yxati"),
  },
  {
    nom: 'oquvchi_kartasi',
    tavsif: "Bitta o'quvchining to'liq kartochkasi: kurslari, balans va kurs bo'yicha qarzi, oxirgi to'lovlari, 30 kunlik davomati, izohi.",
    ruxsat: R.oquvchi,
    parametrlar: { type: 'object', properties: { id: ID("O'quvchi id si") }, required: ['id'] },
    bajar: oquvchiKartasi,
    qadam: () => "O'quvchi kartochkasi o'qilmoqda",
  },
  {
    nom: 'qarzdorlar',
    tavsif: "Qarzdor o'quvchilar (manfiy balans), qarz miqdori bo'yicha kamayish tartibida; kursId berilsa — shu kurs bo'yicha taqsimlangan qarz. 30 kundan beri to'lamaganlar soni ham.",
    ruxsat: R.balans,
    parametrlar: {
      type: 'object',
      properties: {
        kursId: ID('Faqat shu kurs qarzi'),
        eng_kam: { type: 'number', description: "Shu summadan (so'm) katta qarzlar" },
        limit: { type: 'integer', description: "Ro'yxatda nechta (standart 15, eng ko'pi 50)" },
      },
    },
    bajar: qarzdorlar,
    qadam: () => "Qarzdorlar ro'yxati hisoblanmoqda",
  },
  {
    nom: 'darslar',
    tavsif: "Berilgan kundagi (standart bugun) darslar: kurs, vaqt, xona, ustoz, o'quvchilar soni, yo'qlama qilinganmi (keldi/kelmadi).",
    ruxsat: R.darslar,
    parametrlar: { type: 'object', properties: { sana: SANA } },
    bajar: darslar,
    qadam: (a) => (a?.sana ? `${a.sana} darslari` : 'Bugungi darslar'),
  },
  {
    nom: 'davomat',
    tavsif: "Davomat (yo'qlama) statistikasi davr bo'yicha: holatlar, foiz, eng ko'p kelmaganlar, kurslar kesimida. Standart — bugun. Bitta kurs yoki o'quvchi uchun ham.",
    ruxsat: R.davomat,
    parametrlar: {
      type: 'object',
      properties: {
        sana_dan: SANA, sana_gacha: SANA,
        kursId: ID('Faqat shu kurs'), oquvchiId: ID("Faqat shu o'quvchi"),
        faqat_kelmaganlar: { type: 'boolean', description: 'Faqat kelmaganlar ro\'yxati' },
      },
    },
    bajar: davomat,
    qadam: () => "Yo'qlama yozuvlari o'qilmoqda",
  },
  {
    nom: 'tushum',
    tavsif: "Kassaga kelgan pul (to'lovlar) davr bo'yicha: jami, to'lov turlari (Naqd, Karta, Payme, Klik...), kunlar grafigi, kurslar kesimi, oldingi teng davr bilan solishtirish. Standart — shu oy boshidan bugungacha.",
    ruxsat: R.tushum,
    parametrlar: { type: 'object', properties: { sana_dan: SANA, sana_gacha: SANA } },
    bajar: tushum,
    qadam: () => "To'lovlar hisoblanmoqda",
  },
  {
    nom: 'xarajatlar',
    tavsif: "Xarajatlar davr bo'yicha: jami, toifalar, eng kattalari, tushumdan farqi. Standart — shu oy.",
    ruxsat: R.xarajat,
    parametrlar: { type: 'object', properties: { sana_dan: SANA, sana_gacha: SANA } },
    bajar: xarajatlar,
    qadam: () => 'Xarajatlar hisoblanmoqda',
  },
  {
    nom: 'lidlar',
    tavsif: "Lidlar (potentsial o'quvchilar): holat va manba bo'yicha soni, ochiq va 2+ kun javobsizlari, ro'yxat (id bilan). Davr — lid kelgan sana.",
    ruxsat: R.lidlar,
    parametrlar: {
      type: 'object',
      properties: {
        holat: { type: 'string', enum: LID_HOLATLARI },
        manba: { type: 'string', description: 'Instagram, Telegram, Facebook, Tavsiya...' },
        faqat_ochiq: { type: 'boolean', description: "Faqat hali to'lov qilmagan va kelishilmaganlar" },
        sana_dan: SANA, sana_gacha: SANA,
        limit: { type: 'integer' },
      },
    },
    bajar: lidlar,
    qadam: () => "Lidlar o'qilmoqda",
  },
  {
    nom: 'kurslar',
    tavsif: "Kurslar ro'yxati (nom, fan yoki ustoz bo'yicha qidiruv) yoki kursId bilan bitta kurs tafsiloti: o'quvchilari, kurs qarzi, 30 kunlik davomati.",
    ruxsat: R.kurslar,
    parametrlar: { type: 'object', properties: { soz: { type: 'string' }, kursId: ID('Bitta kurs tafsiloti') } },
    bajar: kurslar,
    qadam: (a) => (a?.kursId ? "Kurs ma'lumoti o'qilmoqda" : "Kurslar ro'yxati"),
  },
  {
    nom: 'xonalar',
    tavsif: "Xonalar bandligi shu kuni; vaqt berilsa — shu vaqtda qaysi xonalar bo'sh. Yangi kurs uchun xona topishda ishlating.",
    ruxsat: R.xonalar,
    parametrlar: {
      type: 'object',
      properties: {
        sana: SANA,
        hafta_kuni: { type: 'string', description: 'dushanba ... shanba (sana berilmasa, eng yaqin shu kun)' },
        vaqt: { type: 'string', description: 'Boshlanish vaqti HH:MM' },
        davomiylik_daqiqa: { type: 'integer', description: 'Standart 90' },
      },
    },
    bajar: xonalar,
    qadam: () => 'Xonalar jadvali tekshirilmoqda',
  },
  {
    nom: 'korsatkichlar',
    tavsif: "Markazning umumiy ko'rsatkichlari: faol/sinov o'quvchilar, bu oy qo'shilgan va ketganlar, kurslar, ustozlar, qarz, tushum, lidlar.",
    ruxsat: [],
    parametrlar: { type: 'object', properties: {} },
    bajar: korsatkichVositasi,
    qadam: () => "Ko'rsatkichlar yig'ilmoqda",
  },
  {
    nom: 'tolovlar',
    tavsif: "To'lovlar ro'yxati id bilan (tuzatish yoki o'chirish uchun kerak): o'quvchi, davr yoki tur bo'yicha. kiritilgan_daqiqa_oldin — 10 daqiqalik tuzatish muddatini bilish uchun.",
    ruxsat: ['oquvchilar.balans', 'moliya.tolovlar', 'moliya.hisobot', 'bosh.pul'],
    parametrlar: {
      type: 'object',
      properties: {
        oquvchiId: ID("O'quvchi id si"), sana_dan: SANA, sana_gacha: SANA,
        tur: { type: 'string', enum: ['Naqd', 'Karta', "O'tkazma", 'Klik', 'Payme', 'Oylik', 'Chegirma'] },
        hisoblar: { type: 'boolean', description: 'Oylik hisob yozuvlari ham chiqsin' },
        limit: { type: 'integer' },
      },
    },
    bajar: tolovlar,
    qadam: () => "To'lovlar ro'yxati o'qilmoqda",
  },
  {
    nom: 'xodimlar',
    tavsif: "Xodimlar ro'yxati id bilan: lavozimi, bugungi davomati, oyligi va shu oy berilganmi. Xodim davomati yoki oylik berishdan oldin id topish uchun.",
    ruxsat: ['xodimlar.royxat', 'xodimlar.davomat', 'xodimlar.maosh'],
    parametrlar: { type: 'object', properties: { soz: { type: 'string', description: 'Ism yoki lavozim' } } },
    bajar: xodimlar,
    qadam: () => "Xodimlar ro'yxati o'qilmoqda",
  },
  {
    nom: 'klik_kutayotganlar',
    tavsif: "Administrator tasdig'ini kutayotgan Klik to'lovlari (id bilan).",
    ruxsat: ['oquvchilar.tolov', 'oquvchilar.balans', 'moliya.tolovlar'],
    parametrlar: { type: 'object', properties: {} },
    bajar: klikKutayotganlar,
    qadam: () => "Klik to'lovlari tekshirilmoqda",
  },
  {
    nom: 'sahifani_ochish',
    tavsif: "Xodimga kerakli sahifani ochish tugmasini beradi. Amallar ro'yxatida yo'q ishlar uchun (imtihon tuzish, logistika rejasi, sozlamalar, ruxsatlar, Payme sozlamasi) — shu sahifani taklif qiling.",
    ruxsat: [],
    parametrlar: {
      type: 'object',
      properties: {
        sahifa: { type: 'string', enum: Object.keys(SAHIFA_YOLLARI) },
        oquvchiId: ID("O'quvchi profili"), kursId: ID('Kurs sahifasi'),
        izoh: { type: 'string', description: "Sahifada nima qilish kerakligi (qisqa)" },
      },
    },
    bajar: sahifaniOchish,
    qadam: () => 'Sahifa havolasi tayyorlanmoqda',
  },
];

/** Xodimga ruxsat etilgan vositalar. */
export function ruxsatliVositalar(k) {
  return VOSITALAR.filter(v => korsa(k, v.ruxsat));
}

/** Vositani bajaradi; xato bo'lsa { xato } — AI xodimga tushuntiradi. */
export async function vositaniBajar(k, nom, args) {
  const v = ruxsatliVositalar(k).find(x => x.nom === nom);
  if (!v) return { xato: "Bu ma'lumotga ruxsatingiz yo'q yoki bunday vosita yo'q" };
  try {
    return await v.bajar(k, args || {});
  } catch (e) {
    if (e instanceof VositaXato) return { xato: e.message };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Tezkor buyruqlar — AI siz, bir bosishda. Panel bosh sahifasi shulardan.
// ---------------------------------------------------------------------------

export const BUYRUQLAR = [
  { kalit: 'darslar', nom: 'Bugungi darslar', ruxsat: R.darslar, vosita: 'darslar', args: () => ({}) },
  { kalit: 'kelmaganlar', nom: 'Bugun kelmaganlar', ruxsat: R.davomat, vosita: 'davomat', args: () => ({ faqat_kelmaganlar: true }) },
  { kalit: 'qarzdorlar', nom: 'Qarzdorlar', ruxsat: R.balans, vosita: 'qarzdorlar', args: () => ({}) },
  { kalit: 'bugungi-tushum', nom: 'Bugungi tushum', ruxsat: R.tushum, vosita: 'tushum', args: (k) => ({ sana_dan: k.bugun, sana_gacha: k.bugun }) },
  { kalit: 'tushum', nom: 'Shu oy tushum', ruxsat: R.tushum, vosita: 'tushum', args: () => ({}) },
  { kalit: 'lidlar', nom: 'Ochiq lidlar', ruxsat: R.lidlar, vosita: 'lidlar', args: () => ({ faqat_ochiq: true }) },
  { kalit: 'xonalar', nom: 'Xonalar bandligi', ruxsat: R.xonalar, vosita: 'xonalar', args: () => ({}) },
  { kalit: 'xarajatlar', nom: 'Shu oy xarajatlar', ruxsat: R.xarajat, vosita: 'xarajatlar', args: () => ({}) },
  { kalit: 'korsatkichlar', nom: "Umumiy ko'rsatkichlar", ruxsat: [], vosita: 'korsatkichlar', args: () => ({}) },
  // Sahifaga bog'liq: id panel yuborgan kontekstdan.
  { kalit: 'oquvchi', nom: "Shu o'quvchi", ruxsat: R.oquvchi, vosita: 'oquvchi_kartasi', args: (_k, p) => ({ id: p?.id }), sahifa: 'oquvchi' },
  { kalit: 'kurs', nom: 'Shu kurs', ruxsat: R.kurslar, vosita: 'kurslar', args: (_k, p) => ({ kursId: p?.id }), sahifa: 'kurs' },
  { kalit: 'kurs-qarzi', nom: 'Shu kurs qarzdorlari', ruxsat: R.balans, vosita: 'qarzdorlar', args: (_k, p) => ({ kursId: p?.id }), sahifa: 'kurs' },
];

export const ruxsatliBuyruqlar = (k) => BUYRUQLAR.filter(b => korsa(k, b.ruxsat));

export async function buyruqniBajar(k, kalit, param) {
  const b = ruxsatliBuyruqlar(k).find(x => x.kalit === kalit);
  if (!b) return { xato: "Bu buyruq sizga ochiq emas" };
  return vositaniBajar(k, b.vosita, b.args(k, param));
}

// ---------------------------------------------------------------------------
// Sahifa konteksti: xodim qaysi sahifada — "bu o'quvchi", "shu kurs" uchun.
// ---------------------------------------------------------------------------

const SAHIFALAR = {
  '/': 'Bosh sahifa', '/leads': 'Lidlar', '/courses': 'Kurslar', '/students': "O'quvchilar", '/daily': 'Kunlik ro\'yxat',
  '/finance': 'Moliya', '/logistics': 'Logistika', '/messaging': 'Xabarlar', '/hr': 'Xodimlar', '/exams': 'Imtihonlar',
  '/settings': 'Sozlamalar', '/syllabus': "O'quv reja", '/journal': 'Jurnal',
};

export async function sahifaKonteksti(k, yol) {
  const p = String(yol || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const m = /^\/(students|courses)\/(\d+)$/.exec(p);
  if (m && m[1] === 'students' && korsa(k, R.oquvchi)) {
    const s = await prisma.student.findFirst({ where: oquvchiWhere(k, { id: Number(m[2]) }), select: { id: true, name: true, status: true } });
    if (s) return { tur: 'oquvchi', id: s.id, nom: korinishIsmi(s.name), holat: s.status, sahifa: "O'quvchi profili" };
  }
  if (m && m[1] === 'courses' && korsa(k, R.kurslar)) {
    const g = await prisma.group.findFirst({ where: kursWhere(k, { id: Number(m[2]) }), select: { id: true, name: true } });
    if (g) return { tur: 'kurs', id: g.id, nom: g.name, sahifa: 'Kurs sahifasi' };
  }
  return { tur: 'sahifa', sahifa: SAHIFALAR[p] || SAHIFALAR[`/${p.split('/')[1]}`] || null };
}
