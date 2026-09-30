// Zukko amallari — xodim so'ragan ishni tayyorlab, tasdiqlash kartochkasini beradi.
//
// Egasi (2026-09-30): "har qanday amalni bajara olishi kerak". AI hech narsani
// o'zi yozmaydi. Har amal bazadan kerakli yozuvlarni topadi (ism, telefon, ID
// yoki id bo'yicha), pulga ta'sirini servislarning oldindan ko'rish (preview)
// funksiyasi bilan hisoblaydi va kartochka qaytaradi. Xodim "Tasdiqlash"ni
// bossa, brauzer aynan UI yuboradigan so'rovni odatdagi API ga yuboradi —
// ruxsat (lib/ruxsatApi.js), filial tekshiruvi, jurnal (lib/audit.js, "Zukko
// orqali" belgisi bilan), SMS va Telegram xabarlari qo'lda qilingandagi bilan
// bir xil ishlaydi. Shuning uchun bu yerda API ga yangi yozish yo'li yo'q.
//
// Katalogdan tashqari ishlar (imtihon tuzish, logistika rejasi, sozlamalar,
// ruxsatlar, parollar) — sahifani_ochish vositasi bilan tegishli sahifa.

import prisma from './prisma.js';
import { yetadimi, toliqRuxsatli } from './ruxsatlar.js';
import { isLessonDay } from './lessons.js';
import { jadvalVaqti, daqiqaga } from './jadval.js';
import { kursdaOqiydi } from './oquvchiHolati.js';
import { ochirishQoldi } from './xarajat.js';
import { firstMonthQuote, kursdanChiqish, transferStudent, setKursHisob } from '../services/enrollment.js';
import { kursKuniYuborilganlar, davomatSozlamasi } from '../services/davomatXabari.js';
import { qarzSozlamasi } from '../services/qarzXabari.js';
import { organizationSchoolIds } from '../middleware/auth.js';
import { varaqTuzilmasi, sozlamaniTozala as imtihonSozlamasi } from './imtihon.js';
import {
  VositaXato, xato, som, korinishIsmi, izlashKaliti, moslikBali, butun, sanaOl, kunQosh, uzSana,
  oquvchiWhere, kursWhere, ustozlar, LID_HOLATLARI, OQUVCHI_HOLATLARI, HISOB_TURLARI,
} from './zukkoVositalar.js';

// ---------------------------------------------------------------------------
// Umumiy yordamchilar
// ---------------------------------------------------------------------------

const XARAJAT_TOIFALARI = ['Ish haqi', 'Ijara', 'Kommunal', 'Marketing', 'Boshqa'];
const TUZATISH_MS = 10 * 60 * 1000;   // server.js paymentEditable bilan bir xil
const KUN_NAQSHI = { TOQ: [1, 3, 5], JUFT: [2, 4, 6], HAR_KUNI: [1, 2, 3, 4, 5, 6] };
const KUN_MATNI = { TOQ: 'toq: dushanba, chorshanba, juma', JUFT: 'juft: seshanba, payshanba, shanba', HAR_KUNI: 'har kuni (dushanba–shanba)' };
const DAVOMAT_NOMI = { Keldi: 'Keldi', Kelmapdi: 'Kelmadi', Sababli: 'Sababli', Kechikdi: 'Kechikdi', ErtaKetdi: 'Erta ketdi', "Dars bo'lmadi": "Dars bo'lmadi" };
const KANAL_NOMI = { TELEGRAM: 'Telegram (bepul)', SMS: 'SMS (pullik)', BOTH: 'Telegram, bo\'lmasa SMS' };
const KIMGA_NOMI = { PARENT: 'ota-onasiga', FATHER: 'otasiga', MOTHER: 'onasiga', STUDENT: "o'quvchining o'ziga" };
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

const kerak = (k, kalit, d = 2) => yetadimi(k.ruxsat, kalit, d);
const adminmi = (k) => toliqRuxsatli(k.user?.role);
const kursKaliti = (s) => izlashKaliti(s).replace(/[-_.,/]/g, ' ').replace(/\s+/g, ' ').trim();
const sanaMatni = (s) => (s ? `${String(s).slice(8, 10)}.${String(s).slice(5, 7)}.${String(s).slice(0, 4)}` : '—');
const balansMatni = (b) => (b < -0.5 ? `−${som(-b)} (qarz)` : b > 0.5 ? `+${som(b)}` : '0');
const oyNomi = (ym) => `${OYLAR[Number(String(ym).slice(5, 7)) - 1] || ym} ${String(ym).slice(0, 4)}`;
const royxatOl = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/[,;\n]+/)).map(x => String(x).trim()).filter(Boolean);
const matnOl = (v, maks = 200) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, maks);
const berilganmi = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/** "300 ming", "1,2 mln", "1 200 000", 300000 → butun so'm; tushunarsiz bo'lsa NaN. */
export function summaOl(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : NaN;
  let s = String(v ?? '').toLowerCase().replace(/so['ʻ‘’`]?m|сум|sum/g, '').replace(/\s+/g, '');
  if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  s = s.replace(',', '.');
  const m = /^(\d+(?:\.\d+)?)(mln|million|m|млн|ming|k|тыс)?$/.exec(s);
  if (!m) return NaN;
  const kop = !m[2] ? 1 : /^(mln|million|m|млн)$/.test(m[2]) ? 1e6 : 1e3;
  return Math.round(parseFloat(m[1]) * kop);
}

/** "90 123 45 67", "+998901234567" → "+998 90 123 45 67"; noto'g'ri bo'lsa null. */
export function telefonTozala(v) {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 9) d = `998${d}`;
  if (d.length !== 12 || !d.startsWith('998')) return null;
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}
const raqamOxiri = (p) => String(p || '').replace(/\D/g, '').slice(-9);

export const MANBALAR = [
  { nom: 'Instagram', sozlar: ['insta', 'instagram', 'инста'] },
  { nom: 'Telegram', sozlar: ['telegram', 'tg', 'телеграм'] },
  { nom: 'Facebook', sozlar: ['facebook', 'fb', 'фейсбук'] },
  { nom: 'Tavsiya', sozlar: ['tavsiya', 'tanish', 'dost', "do'st", 'ота-она', 'знаком', 'рекоменд'] },
];

/** Tasdiqlash kartochkasi. sorovlar — tasdiqlangach brauzer ketma-ket yuboradi. */
function karta(k, { tur, sarlavha, maydonlar = [], royxat = [], ogohlantirish = [], xavfli = false, sorovlar, tugma, natija, havola = null, maxsus = null, model = {} }) {
  return {
    model: { taklif: "Tasdiqlash kartochkasi xodimga ko'rsatildi — u tasdiqlamaguncha hech narsa o'zgarmaydi.", ...model },
    amal: {
      tur, sarlavha,
      maydonlar: maydonlar.filter(Boolean),
      royxat: royxat.filter(r => r && r.qatorlar?.length),
      ogohlantirish: ogohlantirish.filter(Boolean),
      xavfli, sorovlar, tugma, natija, havola,
      // Oddiy so'rov emas, brauzerdagi oqim (masalan fayldan savol yuklash oynasi).
      ...(maxsus ? { maxsus } : {}),
      yaratildi: Date.now(),
    },
    xulosa: sarlavha,
  };
}

/** Yangi yozuv qaysi filialga: tanlangani, "hamma filial"da — xodimning o'z filiali. */
function maqsadFilial(k, filial) {
  if (k.maktablar.length === 1) return k.maktablar[0];
  if (berilganmi(filial)) {
    const q = izlashKaliti(filial);
    const id = k.maktablar.find(m => String(m) === String(filial).trim() || izlashKaliti(k.filialNomi(m)).includes(q));
    if (!id) xato(`«${filial}» filiali topilmadi. Filiallar: ${k.maktablar.map(m => k.filialNomi(m)).join(', ')}`);
    return id;
  }
  return k.maktablar.includes(k.user.schoolId) ? k.user.schoolId : k.maktablar[0];
}
const filialQatori = (k, schoolId) => (k.maktablar.length > 1 ? { nom: 'Filial', qiymat: k.filialNomi(schoolId) } : null);

// --- Yozuvni topish: id, 5 xonali ID, telefon yoki ism ------------------------

const OQ_SELECT = {
  id: true, name: true, status: true, balance: true, phone: true, fatherPhone: true, motherPhone: true, schoolId: true,
  comment: true, birthDate: true, address: true, gender: true, fatherName: true, motherName: true,
  studentSchool: true, grade: true, needsTransport: true,
  groups: { select: { id: true, name: true } }, oquvchiKod: { select: { kod: true } },
};
const oquvchiQisqa = (s) => `${korinishIsmi(s.name)}${s.groups?.length ? ` · ${s.groups.map(g => g.name).join(', ')}` : ''}`;
const oquvchiVarianti = (s) => `${korinishIsmi(s.name)} (id ${s.id}${s.groups?.length ? `, ${s.groups.map(g => g.name).join('/')}` : ''}${kursdaOqiydi(s.status) ? '' : `, ${s.status}`})`;

async function oquvchiniTop(k, v) {
  const soz = String(v ?? '').trim();
  if (!soz) xato("O'quvchi ko'rsatilmagan — ismi yoki ID sini so'rang");
  if (/^\d+$/.test(soz) && soz.length <= 6) {
    const n = Number(soz);
    if (soz.length === 5) {
      const kod = await prisma.studentKod.findUnique({ where: { kod: n }, select: { studentId: true } });
      if (kod?.studentId) {
        const s = await prisma.student.findFirst({ where: oquvchiWhere(k, { id: kod.studentId }), select: OQ_SELECT });
        if (s) return s;
      }
    }
    const s = await prisma.student.findFirst({ where: oquvchiWhere(k, { id: n }), select: OQ_SELECT });
    if (s) return s;
    xato(`${soz} raqamli o'quvchi topilmadi yoki sizga ruxsat yo'q`);
  }
  const rows = await prisma.student.findMany({ where: oquvchiWhere(k), select: OQ_SELECT });
  const raqam = soz.replace(/\D/g, '');
  let mos;
  if (raqam.length >= 7 && raqam.length === soz.replace(/[\s+()-]/g, '').length) {
    const oxiri = raqam.slice(-9);
    mos = rows.filter(s => [s.phone, s.fatherPhone, s.motherPhone].some(p => raqamOxiri(p) === oxiri || String(p || '').replace(/\D/g, '').endsWith(oxiri)));
  } else {
    const kalit = izlashKaliti(soz);
    const sozlar = kalit.split(' ').filter(Boolean);
    const ballar = rows.map(s => ({ s, b: moslikBali(s.name, sozlar) })).filter(x => x.b > 0).sort((x, y) => y.b - x.b);
    const aniq = ballar.filter(x => izlashKaliti(x.s.name) === kalit);
    if (aniq.length === 1) return aniq[0].s;
    if (ballar.length > 1 && sozlar.length >= 2 && ballar[0].b > ballar[1].b) return ballar[0].s;
    mos = ballar.map(x => x.s);
  }
  if (mos.length === 1) return mos[0];
  if (!mos.length) xato(`«${soz}» bo'yicha o'quvchi topilmadi`);
  mos.sort((x, y) => (kursdaOqiydi(y.status) ? 1 : 0) - (kursdaOqiydi(x.status) ? 1 : 0));
  xato(`«${soz}» bo'yicha ${mos.length} ta o'quvchi mos keldi: ${mos.slice(0, 6).map(oquvchiVarianti).join('; ')}${mos.length > 6 ? ' …' : ''}. Qaysi biri ekanini xodimdan so'rang.`);
}

const KURS_SELECT = {
  id: true, name: true, schoolId: true, days: true, schedule: true, room: true, teacherId: true, teacher2Id: true, courseId: true,
  course: { select: { name: true, price: true } }, teacher: { select: { name: true } }, teacher2: { select: { name: true } },
  roomRel: { select: { name: true, capacity: true } }, _count: { select: { students: true } },
};

async function kursniTop(k, v, { schoolId = null, select = {} } = {}) {
  const soz = String(v ?? '').trim();
  if (!soz) xato("Kurs ko'rsatilmagan");
  const sel = { ...KURS_SELECT, ...select };
  const qoshimcha = schoolId ? { schoolId } : {};
  if (/^\d+$/.test(soz)) {
    const g = await prisma.group.findFirst({ where: kursWhere(k, { id: Number(soz), ...qoshimcha }), select: sel });
    if (g) return g;
  }
  const rows = await prisma.group.findMany({ where: kursWhere(k, qoshimcha), select: sel });
  const q = kursKaliti(soz);
  const aniq = rows.filter(g => kursKaliti(g.name) === q);
  if (aniq.length === 1) return aniq[0];
  const mos = rows.filter(g => kursKaliti(g.name).includes(q) || kursKaliti(`${g.course?.name || ''} ${g.name}`).includes(q));
  if (mos.length === 1) return mos[0];
  if (!mos.length) xato(`«${soz}» degan kurs topilmadi. Kurslar: ${rows.slice(0, 15).map(g => g.name).join(', ') || "yo'q"}`);
  xato(`«${soz}» bo'yicha ${mos.length} ta kurs mos keldi: ${mos.slice(0, 8).map(g => `${g.name} (id ${g.id})`).join(', ')}. Qaysi biri?`);
}
/** O'quvchining kurslaridan biri: berilgan bo'lsa o'sha, yagona bo'lsa — o'sha. */
async function oquvchiKursi(k, s, v) {
  if (berilganmi(v)) {
    const g = await kursniTop(k, v);
    if (!s.groups.some(x => x.id === g.id)) xato(`${korinishIsmi(s.name)} ${g.name} kursida emas. Kurslari: ${s.groups.map(x => x.name).join(', ') || "yo'q"}`);
    return g;
  }
  if (s.groups.length === 1) return kursniTop(k, String(s.groups[0].id));
  if (!s.groups.length) xato(`${korinishIsmi(s.name)} hech qaysi kursda emas`);
  xato(`Qaysi kurs? ${korinishIsmi(s.name)} kurslari: ${s.groups.map(x => x.name).join(', ')}`);
}

/** Nom bo'yicha tanlash: aniq mos yagona bo'lsa — o'sha, bo'lmasa variantlar bilan xato. */
function nomdanTanla(rows, soz, nomi, nima) {
  if (/^\d+$/.test(soz)) { const r = rows.find(x => x.id === Number(soz)); if (r) return r; }
  const q = kursKaliti(soz);
  const aniq = rows.filter(r => kursKaliti(nomi(r)) === q);
  if (aniq.length === 1) return aniq[0];
  const sozlar = izlashKaliti(soz).split(' ').filter(Boolean);
  const ballar = rows.map(r => ({ r, b: moslikBali(nomi(r), sozlar) || (kursKaliti(nomi(r)).includes(q) ? 1 : 0) }))
    .filter(x => x.b > 0).sort((a, b) => b.b - a.b);
  if (ballar.length === 1 || (ballar.length > 1 && ballar[0].b > ballar[1].b)) return ballar[0].r;
  if (!ballar.length) xato(`«${soz}» degan ${nima} topilmadi. Bor: ${rows.slice(0, 15).map(nomi).join(', ') || "yo'q"}`);
  xato(`«${soz}» bo'yicha ${ballar.length} ta ${nima}: ${ballar.slice(0, 6).map(x => `${nomi(x.r)} (id ${x.r.id})`).join(', ')}. Qaysi biri?`);
}

async function xodimniTop(k, v) {
  const soz = String(v ?? '').trim();
  if (!soz) xato("Xodim ko'rsatilmagan");
  const rows = await prisma.user.findMany({
    where: {
      OR: [{ schoolId: { in: k.maktablar } }, { branches: { some: { id: { in: k.maktablar } } } }],
      role: { not: 'SELLER' }, status: { not: 'Arxiv' },
    },
    select: { id: true, name: true, role: true, position: true, salary: true, schoolId: true },
  });
  return nomdanTanla(rows, soz, u => korinishIsmi(u.name), 'xodim');
}

async function ustozniTop(k, v, schoolId) {
  const soz = String(v ?? '').trim();
  if (!soz) xato("Ustoz ko'rsatilmagan");
  const rows = await prisma.teacher.findMany({
    where: { OR: [{ schoolId }, { user: { is: { branches: { some: { id: schoolId } } } } }] },
    select: { id: true, name: true, status: true },
  });
  return nomdanTanla(rows.filter(t => t.status !== 'Arxiv'), soz, t => korinishIsmi(t.name), 'ustoz');
}

async function fanniTop(k, v, schoolIds) {
  const soz = String(v ?? '').trim();
  if (!soz) xato("Fan ko'rsatilmagan (masalan Matematika)");
  const rows = await prisma.course.findMany({ where: { schoolId: { in: schoolIds } }, select: { id: true, name: true, price: true, schoolId: true } });
  if (/^\d+$/.test(soz)) { const c = rows.find(r => r.id === Number(soz)); if (c) return c; }
  const q = kursKaliti(soz);
  const aniq = rows.filter(c => kursKaliti(c.name) === q);
  if (aniq.length === 1) return aniq[0];
  const mos = rows.filter(c => kursKaliti(c.name).includes(q) || q.includes(kursKaliti(c.name)));
  if (mos.length === 1) return mos[0];
  if (!mos.length) xato(`«${soz}» degan fan topilmadi. Fanlar: ${rows.map(c => c.name).join(', ') || "yo'q"}. Yangi fan kerak bo'lsa — fan_qoshish.`);
  xato(`«${soz}» bo'yicha ${mos.length} ta fan: ${mos.map(c => `${c.name} (id ${c.id})`).join(', ')}. Qaysi biri?`);
}

async function xonaniTop(k, v, schoolIds) {
  const soz = String(v ?? '').trim();
  if (!soz) xato("Xona ko'rsatilmagan");
  const rows = await prisma.room.findMany({ where: { schoolId: { in: schoolIds } }, select: { id: true, name: true, capacity: true, schoolId: true } });
  // "2" → "2-xona" ham topilsin.
  if (/^\d+$/.test(soz)) {
    const nomli = rows.filter(r => new RegExp(`(^|\\D)${soz}(\\D|$)`).test(r.name));
    if (nomli.length === 1) return nomli[0];
  }
  return nomdanTanla(rows, soz, r => r.name, 'xona');
}

const LID_SELECT = {
  id: true, name: true, phone: true, status: true, course: true, source: true, notes: true, schoolId: true, createdAt: true,
  birthDate: true, address: true, studentSchool: true, fatherName: true, fatherPhone: true, motherName: true, motherPhone: true,
  privilegeType: true, certCategory: true, certSubject: true, certType: true, orgType: true, region: true, district: true,
  studyGoal: true, directionId: true,
};

async function lidniTop(k, v) {
  const soz = String(v ?? '').trim();
  if (!soz) xato("Lid ko'rsatilmagan");
  const rows = await prisma.lead.findMany({ where: { schoolId: { in: k.maktablar } }, select: LID_SELECT });
  const raqam = soz.replace(/\D/g, '');
  if (raqam.length >= 7 && raqam.length === soz.replace(/[\s+()-]/g, '').length) {
    const mos = rows.filter(l => raqamOxiri(l.phone) === raqam.slice(-9));
    if (mos.length === 1) return mos[0];
    if (!mos.length) xato(`${soz} raqamli lid topilmadi`);
  }
  return nomdanTanla(rows, soz, l => korinishIsmi(l.name), 'lid');
}

// --- Qiymatlarni tushunish -------------------------------------------------

function tolovTuri(v) {
  const q = izlashKaliti(v);
  if (!q || /naq|cash|nal/.test(q)) return 'Naqd';
  if (/kart|plast|uzcard|humo|card/.test(q)) return 'Karta';
  if (/tkaz|bank|perech|perevod/.test(q)) return "O'tkazma";
  if (/klik|click/.test(q)) return 'Klik';
  if (/payme|peyme/.test(q)) xato("Payme to'lovi ota-ona Payme orqali to'laganda o'zi tushadi. Havola yuborish — o'quvchi profilidagi «Payme» tugmasi.");
  if (/chegirma|skidk/.test(q)) xato("Chegirma to'lov emas: o'quvchiga alohida narx kurs hisobida qo'yiladi (kurs_hisobi).");
  xato(`To'lov turi noma'lum: «${v}». Naqd, Karta, O'tkazma yoki Klik.`);
}

/** Klik chekidagi vaqt: "14:32", "1432" yoki "2026-09-30 14:32" → "2026-09-30T14:32". */
function chekVaqtiOl(v, sana) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  let natija = null;
  const m = /^(\d{1,2})[:.\s]?(\d{2})$/.exec(s);
  if (m) natija = `${sana}T${m[1].padStart(2, '0')}:${m[2]}`;
  else {
    const t = s.replace(' ', 'T').slice(0, 16);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) natija = t;
  }
  if (!natija || Number(natija.slice(11, 13)) > 23 || Number(natija.slice(14, 16)) > 59) xato("Chek vaqti noto'g'ri — masalan 14:32");
  return natija;
}
const chekMatni = (s) => (s ? `${sanaMatni(s.slice(0, 10))} ${s.slice(11, 16)}` : '');

function holatOl(v) {
  const q = izlashKaliti(v);
  if (/^faol|activ|aktiv/.test(q)) return 'Faol';
  if (/sinov|trial|prob/.test(q)) return 'Sinov';
  if (/passiv|ketdi|ketgan|chiqdi|toxtat|ushel|ushyol/.test(q)) return 'Passiv';
  if (/muzla|freez|zamor/.test(q)) return 'Muzlatilgan';
  if (/arxiv|archive/.test(q)) return 'Arxiv';
  if (/bitir|graduat|vipusk/.test(q)) return 'Bitiruvchi';
  if (/sertif|certif/.test(q)) return 'Sertifikatli';
  xato(`Holat: ${OQUVCHI_HOLATLARI.join(', ')}`);
}

function lidHolatiOl(v) {
  const q = izlashKaliti(v);
  const aniq = LID_HOLATLARI.find(h => izlashKaliti(h) === q);
  if (aniq) return aniq;
  if (/yangi|new/.test(q)) return 'Yangi';
  if (/boglanil|javob ber|olmadi|kotarma|ko'tarma/.test(q)) return "Bog'lanilmadi";
  if (/oyla|dumaet/.test(q)) return "O'ylayapti";
  if (/kelish|rozi|agree/.test(q)) return 'Kelishdi';
  if (/tolov|toladi|oplat/.test(q)) return "To'lov qildi";
  xato(`Lid holati: ${LID_HOLATLARI.join(', ')}`);
}

/** Shu oy hisobi (kursdan chiqishda): o'zgarmaydi | kelgan_darslar | olinmasin | summa. */
function shuOyTanlovi(v) {
  if (!berilganmi(v)) return 'ozgarmaydi';
  if (typeof v === 'number') return v >= 0 ? Math.round(v) : xato("Summa noto'g'ri");
  const q = izlashKaliti(v);
  if (/ozgarm|qoldir|tegma|standart/.test(q)) return 'ozgarmaydi';
  if (/kelgan|dars|hisobla/.test(q)) return 'kelgan_darslar';
  if (/olinma|bepul|^0$|yoq|nol/.test(q)) return 'olinmasin';
  const n = summaOl(v);
  if (Number.isFinite(n) && n >= 0) return n;
  xato("Shu oy hisobi: «o'zgarmaydi», «kelgan darslar uchun», «olinmasin» yoki summa");
}

function kunlarOl(v) {
  const q = izlashKaliti(v);
  if (!q) xato("Dars kunlarini ayting: toq (du, chor, ju), juft (se, pay, sha) yoki har kuni");
  if (/^(toq|odd)$|toq kun|nechet/.test(q)) return 'TOQ';
  if (/^(juft|even)$|juft kun|^chet/.test(q)) return 'JUFT';
  if (/har kun|every|kajd|^har_kuni$/.test(q)) return 'HAR_KUNI';
  const KUN = { dushanba: 1, du: 1, mon: 1, pn: 1, seshanba: 2, se: 2, tue: 2, vt: 2, chorshanba: 3, chor: 3, cho: 3, wed: 3, sr: 3,
    payshanba: 4, pay: 4, pa: 4, thu: 4, cht: 4, juma: 5, ju: 5, fri: 5, pt: 5, shanba: 6, sha: 6, sat: 6, sb: 6 };
  const kunlar = new Set(q.split(/[\s,\-–/]+/).map(t => KUN[t]).filter(Boolean));
  const teng = (arr) => arr.length === kunlar.size && arr.every(d => kunlar.has(d));
  if (teng(KUN_NAQSHI.TOQ)) return 'TOQ';
  if (teng(KUN_NAQSHI.JUFT)) return 'JUFT';
  if (teng(KUN_NAQSHI.HAR_KUNI)) return 'HAR_KUNI';
  xato("CRM jadvali uch xil: toq (dushanba, chorshanba, juma), juft (seshanba, payshanba, shanba) yoki har kuni");
}

/** "14:00-15:30", "14 dan 16 gacha" → "14:00 - 16:00". */
function vaqtOl(v) {
  const t = [...String(v ?? '').matchAll(/(\d{1,2})(?:[:.](\d{2}))?/g)]
    .map(m => `${m[1].padStart(2, '0')}:${m[2] || '00'}`)
    .filter(x => daqiqaga(x) !== null);
  if (t.length < 2) xato("Dars vaqtini boshlanishi va tugashi bilan ayting (masalan 14:00–15:30)");
  if (daqiqaga(t[1]) <= daqiqaga(t[0])) xato("Tugash vaqti boshlanishdan keyin bo'lsin");
  return `${t[0]} - ${t[1]}`;
}

function kanalOl(v, standart = 'TELEGRAM') {
  const q = izlashKaliti(v);
  if (!q) return standart;
  if (/ikkala|both|ikkisi|hammasi/.test(q)) return 'BOTH';
  if (/sms/.test(q)) return 'SMS';
  if (/telegram|tg/.test(q)) return 'TELEGRAM';
  return standart;
}
function kimgaOl(v) {
  const q = izlashKaliti(v);
  if (!q || /ota ona|ota-ona|parent|roditel/.test(q)) return 'PARENT';
  if (/^ota|otasi|father|otts|papa/.test(q)) return 'FATHER';
  if (/ona|mother|mama|mam/.test(q)) return 'MOTHER';
  if (/oquvchi|ozi|student|ucheni/.test(q)) return 'STUDENT';
  return 'PARENT';
}

/** Shu xonada shu kunlar va vaqtda boshqa kurs bormi. */
async function xonaBandligi({ schoolId, roomId, days, schedule, istisno = null }) {
  if (!roomId) return [];
  const { boshi, oxiri } = jadvalVaqti(schedule);
  const b = daqiqaga(boshi), e = daqiqaga(oxiri);
  if (b === null || e === null) return [];
  const kunlar = KUN_NAQSHI[days] || [];
  const boshqalar = await prisma.group.findMany({
    where: { schoolId, room: roomId, ...(istisno ? { id: { not: istisno } } : {}) },
    select: { name: true, days: true, schedule: true },
  });
  return boshqalar.filter(g => {
    if (!(KUN_NAQSHI[g.days] || []).some(d => kunlar.includes(d))) return false;
    const v = jadvalVaqti(g.schedule);
    const b2 = daqiqaga(v.boshi);
    const e2 = daqiqaga(v.oxiri) ?? (b2 !== null ? b2 + 90 : null);
    return b2 !== null && b2 < e && e2 > b;
  }).map(g => `${g.name} (${g.schedule})`);
}

// ---------------------------------------------------------------------------
// To'lovlar
// ---------------------------------------------------------------------------

async function tolovQabul(k, a) {
  const s = await oquvchiniTop(k, a.oquvchi);
  const summa = summaOl(a.summa);
  if (!Number.isFinite(summa) || summa <= 0) xato("To'lov summasini aniq so'rang");
  const tur = tolovTuri(a.tur);
  const admin = adminmi(k);
  let sana = sanaOl(a.sana) || k.bugun;
  if (sana > k.bugun) xato("To'lov sanasi kelajakda bo'lishi mumkin emas");
  let chek = null;
  if (tur === 'Klik') {
    chek = chekVaqtiOl(a.chek_vaqti, sana);
    if (!admin && !chek) xato("Klik to'lovi administrator tasdig'iga boradi — chekdagi vaqtni so'rang (masalan 14:32)");
    if (chek) sana = chek.slice(0, 10);
    if (sana > k.bugun) xato("Chek sanasi kelajakda bo'lishi mumkin emas");
  }
  const izoh = matnOl(a.izoh, 300);
  const ogoh = [];
  const takror = await prisma.payment.findFirst({
    where: { studentId: s.id, amount: summa, date: { gte: sana, lt: kunQosh(sana, 1) }, type: { notIn: HISOB_TURLARI } },
    select: { type: true },
  });
  if (takror) ogoh.push(`Shu kuni shu summada to'lov allaqachon bor (${takror.type}) — takror emasligini tekshiring`);
  if (!kursdaOqiydi(s.status)) ogoh.push(`O'quvchi holati: ${s.status}`);
  if (summa >= 5_000_000) ogoh.push('Summa katta — raqamni tekshiring');
  const maydonlar = [
    { nom: "O'quvchi", qiymat: oquvchiQisqa(s) },
    { nom: 'Summa', qiymat: `${som(summa)} so'm` },
    { nom: 'Turi', qiymat: tur },
    { nom: 'Sana', qiymat: sanaMatni(sana) },
    chek && { nom: 'Chek vaqti', qiymat: chekMatni(chek) },
    izoh && { nom: 'Izoh', qiymat: izoh },
  ];
  const model = { oquvchi: korinishIsmi(s.name), summa, tur, sana };
  if (tur === 'Klik' && !admin) {
    return karta(k, {
      tur: 'tolov_qabul', sarlavha: "Klik to'lovi — administrator tasdig'iga",
      maydonlar: [...maydonlar, { nom: 'Balans', qiymat: "administrator tasdiqlagach o'zgaradi" }],
      ogohlantirish: ogoh,
      sorovlar: [{ usul: 'POST', yol: '/api/tolov-tasdiq', nom: "Klik to'lovi", body: { schoolId: s.schoolId, studentId: s.id, amount: summa, type: 'Klik', paidAt: chek, note: izoh } }],
      tugma: 'Tasdiqqa yuborish', natija: 'Administratorga yuborildi', havola: `/students/${s.id}`, model,
    });
  }
  maydonlar.push({ nom: 'Balans', eski: balansMatni(s.balance), qiymat: balansMatni(s.balance + summa) });
  return karta(k, {
    tur: 'tolov_qabul', sarlavha: "To'lov qabul qilish", maydonlar, ogohlantirish: ogoh,
    sorovlar: [{
      usul: 'POST', yol: '/api/payments', nom: "To'lov",
      body: {
        schoolId: s.schoolId, studentId: s.id, amount: summa, type: tur, date: sana,
        description: [chek ? `Chek: ${chekMatni(chek)}` : '', izoh].filter(Boolean).join(' · '),
        groupId: null, courseId: null, ...(chek ? { chekVaqti: chek } : {}),
      },
    }],
    tugma: "To'lovni qabul qilish", natija: "To'lov qabul qilindi", havola: `/students/${s.id}`, model,
  });
}

async function tolovniTop(k, v) {
  const id = butun(v);
  if (!id) xato("To'lov id si kerak — avval «tolovlar» vositasi bilan toping");
  const p = await prisma.payment.findFirst({
    where: { id, schoolId: { in: k.maktablar }, ...(k.oz ? { studentId: { in: [...k.oz.studentIds] } } : {}) },
    select: { id: true, amount: true, type: true, date: true, description: true, createdAt: true, studentId: true, schoolId: true, student: { select: { name: true, balance: true } } },
  });
  if (!p) xato("To'lov topilmadi");
  return p;
}
function tolovTuzatiladimi(k, p, ochirish) {
  const matn = ochirish ? "o'chirib" : 'tuzatib';
  if (p.type === 'Oylik') xato(`Bu — tizim yozgan oylik hisob, uni ${matn} bo'lmaydi (kurs hisobi orqali o'zgaradi)`);
  if (p.type === 'Peyme') xato(`Payme orqali kelgan to'lovni ${matn} bo'lmaydi`);
  if (adminmi(k)) return;
  if (Date.now() - new Date(p.createdAt).getTime() > TUZATISH_MS) {
    xato(`To'lovni faqat kiritilgandan keyin 10 daqiqa ichida ${ochirish ? "o'chirish" : 'tuzatish'} mumkin — administratorga murojaat qiling`);
  }
}

async function tolovTuzatish(k, a) {
  const p = await tolovniTop(k, a.tolovId);
  tolovTuzatiladimi(k, p, false);
  const body = { schoolId: p.schoolId };
  const maydonlar = [{ nom: "O'quvchi", qiymat: korinishIsmi(p.student?.name) }];
  let delta = 0;
  if (berilganmi(a.summa)) {
    let n = summaOl(a.summa);
    if (!Number.isFinite(n) || n === 0) xato("Summa noto'g'ri");
    if (p.amount < 0 && n > 0) n = -n;
    if (n !== Math.round(p.amount)) { body.amount = n; delta = n - p.amount; maydonlar.push({ nom: 'Summa', eski: som(p.amount), qiymat: som(n) }); }
  }
  if (berilganmi(a.tur)) {
    const t = tolovTuri(a.tur);
    if (t !== p.type) { body.type = t; maydonlar.push({ nom: 'Turi', eski: p.type, qiymat: t }); }
  }
  if (berilganmi(a.sana)) {
    const d = sanaOl(a.sana);
    if (!d || d > k.bugun) xato("Sana noto'g'ri");
    if (d !== p.date.slice(0, 10)) { body.date = d; maydonlar.push({ nom: 'Sana', eski: sanaMatni(p.date), qiymat: sanaMatni(d) }); }
  }
  if (a.izoh !== undefined && a.izoh !== null) {
    const iz = matnOl(a.izoh, 500);
    if (iz !== (p.description || '')) { body.description = iz; maydonlar.push({ nom: 'Izoh', eski: p.description || '—', qiymat: iz || '—' }); }
  }
  if (Object.keys(body).length === 1) xato("O'zgarish yo'q — nimani tuzatish kerakligini so'rang");
  if (delta) maydonlar.push({ nom: 'Balans', eski: balansMatni(p.student.balance), qiymat: balansMatni(p.student.balance + delta) });
  return karta(k, {
    tur: 'tolov_tuzatish', sarlavha: `To'lovni tuzatish #${p.id}`, maydonlar,
    sorovlar: [{ usul: 'PUT', yol: `/api/payments/${p.id}`, body, nom: "To'lov" }],
    tugma: 'Saqlash', natija: "To'lov tuzatildi", havola: `/students/${p.studentId}`,
    model: { tolov: p.id, ozgaradi: Object.keys(body).filter(x => x !== 'schoolId') },
  });
}

async function tolovOchirish(k, a) {
  const p = await tolovniTop(k, a.tolovId);
  tolovTuzatiladimi(k, p, true);
  return karta(k, {
    tur: 'tolov_ochirish', sarlavha: `To'lovni o'chirish #${p.id}`, xavfli: true,
    maydonlar: [
      { nom: "O'quvchi", qiymat: korinishIsmi(p.student?.name) },
      { nom: 'Summa', qiymat: `${som(p.amount)} so'm · ${p.type}` },
      { nom: 'Sana', qiymat: sanaMatni(p.date) },
      { nom: 'Balans', eski: balansMatni(p.student.balance), qiymat: balansMatni(p.student.balance - p.amount) },
    ],
    ogohlantirish: ["To'lov butunlay o'chadi, balans shu summaga qaytadi. Ota-onaga hali ketmagan to'lov SMS i bekor bo'ladi."],
    sorovlar: [{ usul: 'DELETE', yol: `/api/payments/${p.id}`, nom: "To'lov" }],
    tugma: "Ha, o'chirish", natija: "To'lov o'chirildi", havola: `/students/${p.studentId}`,
    model: { tolov: p.id, summa: p.amount },
  });
}

async function klikQaror(k, a) {
  const id = butun(a.tasdiqId);
  if (!id) xato("Tasdiq id si kerak — klik_kutayotganlar vositasidan");
  const r = await prisma.tolovTasdiq.findFirst({ where: { id, schoolId: { in: k.maktablar } } });
  if (!r) xato('Tasdiq topilmadi');
  if (r.status !== 'kutilmoqda') xato(`Bu to'lov allaqachon ko'rib chiqilgan (${r.status})`);
  const s = await prisma.student.findUnique({ where: { id: r.studentId }, select: { name: true, balance: true } });
  const rad = /rad|yoq|bekor|reject|otkaz/.test(izlashKaliti(a.qaror));
  const sabab = matnOl(a.sabab, 200) || 'Pul kelmagan';
  const maydonlar = [
    { nom: "O'quvchi", qiymat: korinishIsmi(s?.name) },
    { nom: 'Summa', qiymat: `${som(r.amount)} so'm · ${r.type}` },
    { nom: 'Chek vaqti', qiymat: chekMatni(r.paidAt) },
    r.createdByName && { nom: 'Yubordi', qiymat: r.createdByName },
    rad ? { nom: 'Sabab', qiymat: sabab } : { nom: 'Balans', eski: balansMatni(s?.balance || 0), qiymat: balansMatni((s?.balance || 0) + r.amount) },
  ];
  return karta(k, {
    tur: 'klik_qaror', sarlavha: rad ? "Klik to'lovini rad etish" : "Klik to'lovini tasdiqlash", xavfli: rad, maydonlar,
    ogohlantirish: rad ? [] : ["Pul bank ilovasida kelganini ko'rgach tasdiqlang — balansga tushadi va ota-onaga xabar ketadi"],
    sorovlar: [{ usul: 'POST', yol: `/api/tolov-tasdiq/${r.id}/${rad ? 'rad' : 'tasdiqlash'}`, body: rad ? { reason: sabab } : {}, nom: 'Klik' }],
    tugma: rad ? 'Rad etish' : 'Tasdiqlash', natija: rad ? 'Rad etildi' : "Tasdiqlandi — balansga tushdi", havola: `/students/${r.studentId}`,
    model: { tasdiq: r.id, qaror: rad ? 'rad' : 'tasdiqlash' },
  });
}

// ---------------------------------------------------------------------------
// O'quvchilar
// ---------------------------------------------------------------------------

async function oquvchiQoshish(k, a) {
  const schoolId = maqsadFilial(k, a.filial);
  const ism = matnOl(a.ism, 120);
  if (ism.length < 3) xato("O'quvchining to'liq ismini so'rang");
  const tel = (v, nom) => { if (!berilganmi(v)) return ''; const t = telefonTozala(v); if (!t) xato(`${nom} noto'g'ri — 9 xonali raqam kerak`); return t; };
  const phone = tel(a.telefon, 'Telefon'), fatherPhone = tel(a.ota_telefon, 'Otasining telefoni'), motherPhone = tel(a.ona_telefon, 'Onasining telefoni');
  const holat = /sinov|trial|проб/i.test(String(a.holat || '')) ? 'Sinov' : 'Faol';
  const kelgan = sanaOl(a.kelgan_sana) || k.bugun;
  const tugilgan = berilganmi(a.tugilgan_sana) ? (sanaOl(a.tugilgan_sana) || xato("Tug'ilgan sana YYYY-MM-DD ko'rinishida bo'lsin")) : '';
  const jinsi = berilganmi(a.jinsi) ? (/ayol|qiz|female|жен|девоч/i.test(String(a.jinsi)) ? 'Ayol' : 'Erkak') : undefined;
  const kurslar = [];
  for (const nom of royxatOl(a.kurslar).slice(0, 5)) kurslar.push(await kursniTop(k, nom, { schoolId }));

  const ogoh = [];
  const bor = await prisma.student.findMany({ where: { schoolId: { in: k.maktablar } }, select: { id: true, name: true, phone: true, status: true } });
  const oz = phone && bor.find(s => raqamOxiri(s.phone) === raqamOxiri(phone));
  if (oz) ogoh.push(`Bu telefon ${korinishIsmi(oz.name)} (${oz.status}) da bor — takror qo'shilmayaptimi?`);
  const nomdosh = bor.find(s => izlashKaliti(s.name) === izlashKaliti(ism));
  if (nomdosh && nomdosh !== oz) ogoh.push(`Shu ismli o'quvchi bor: ${korinishIsmi(nomdosh.name)} (${nomdosh.status})`);

  const qatorlar = [];
  let jami = 0;
  for (const g of kurslar) {
    if (holat === 'Sinov') { qatorlar.push(`${g.name} — sinov: pul yozilmaydi`); continue; }
    const q = await firstMonthQuote({ groupId: g.id, date: kelgan, schoolId });
    if (q.error) xato(q.error);
    if (q.suggested === null) { qatorlar.push(`${g.name} — jadvali yo'q, birinchi oy hisobi yozilmaydi`); continue; }
    const keyin = kelgan.slice(0, 7) > k.bugun.slice(0, 7);
    if (!keyin) jami += q.suggested;
    qatorlar.push(q.suggested === 0 && !keyin ? `${g.name} — bu oyda dars qolmagan, hisob keyingi oydan` : `${g.name} — birinchi oy ${som(q.suggested)} so'm${q.lessons ? ` (${q.lessons} dars)` : ''}${keyin ? ', oy boshida yoziladi' : ''}`);
  }
  const body = {
    schoolId, name: ism, phone, birthDate: tugilgan, address: matnOl(a.manzil, 200), joinedDate: k.bugun, status: holat,
    ...(jinsi ? { gender: jinsi } : {}),
    ...(berilganmi(a.ota_ismi) ? { fatherName: matnOl(a.ota_ismi, 100) } : {}), ...(fatherPhone ? { fatherPhone } : {}),
    ...(berilganmi(a.ona_ismi) ? { motherName: matnOl(a.ona_ismi, 100) } : {}), ...(motherPhone ? { motherPhone } : {}),
    ...(berilganmi(a.maktab) ? { studentSchool: matnOl(a.maktab, 100) } : {}),
    ...(berilganmi(a.sinf) ? { grade: matnOl(a.sinf, 20) } : {}),
    ...(berilganmi(a.izoh) ? { comment: matnOl(a.izoh, 500) } : {}),
    groups: kurslar.map(g => g.id),
    ...(kurslar.length && kelgan !== k.bugun ? { startDate: kelgan } : {}),
  };
  return karta(k, {
    tur: 'oquvchi_qoshish', sarlavha: "Yangi o'quvchi",
    maydonlar: [
      { nom: 'Ism', qiymat: ism },
      phone && { nom: 'Telefon', qiymat: phone },
      tugilgan && { nom: "Tug'ilgan sana", qiymat: sanaMatni(tugilgan) },
      (body.fatherName || fatherPhone) && { nom: 'Otasi', qiymat: [body.fatherName, fatherPhone].filter(Boolean).join(' · ') },
      (body.motherName || motherPhone) && { nom: 'Onasi', qiymat: [body.motherName, motherPhone].filter(Boolean).join(' · ') },
      { nom: 'Holat', qiymat: holat },
      kurslar.length && kelgan !== k.bugun && { nom: 'Kursga kelgan sana', qiymat: sanaMatni(kelgan) },
      jami > 0 && { nom: 'Balans', qiymat: `${balansMatni(-jami)} — birinchi oy hisobi` },
      filialQatori(k, schoolId),
    ],
    royxat: [{ sarlavha: `Kurslar (${kurslar.length})`, qatorlar }],
    ogohlantirish: ogoh,
    sorovlar: [{ usul: 'POST', yol: '/api/students', body, nom: "O'quvchi" }],
    tugma: "O'quvchini qo'shish", natija: "O'quvchi qo'shildi",
    model: { ism, holat, kurslar: kurslar.map(g => g.name), birinchi_oy_jami: jami },
  });
}

const OQ_MAYDONLAR = [
  ['ism', 'name', 'Ism'], ['telefon', 'phone', 'Telefon', 'tel'], ['tugilgan_sana', 'birthDate', "Tug'ilgan sana", 'sana'],
  ['manzil', 'address', 'Manzil'], ['jinsi', 'gender', 'Jinsi', 'jins'],
  ['ota_ismi', 'fatherName', 'Otasi'], ['ota_telefon', 'fatherPhone', 'Otasining telefoni', 'tel'],
  ['ona_ismi', 'motherName', 'Onasi'], ['ona_telefon', 'motherPhone', 'Onasining telefoni', 'tel'],
  ['maktab', 'studentSchool', 'Maktab'], ['sinf', 'grade', 'Sinf'], ['transport', 'needsTransport', 'Transportda qatnaydi', 'bool'],
];

async function oquvchiTahrirlash(k, a) {
  const s = await oquvchiniTop(k, a.oquvchi);
  const body = { schoolId: s.schoolId };
  const maydonlar = [{ nom: "O'quvchi", qiymat: oquvchiQisqa(s) }];
  const korin = (v, tur) => (tur === 'bool' ? (v ? 'ha' : "yo'q") : tur === 'sana' ? (v ? sanaMatni(v) : '—') : (v || '—'));
  for (const [p, f, nom, tur] of OQ_MAYDONLAR) {
    if (a[p] === undefined || a[p] === null) continue;
    let v = a[p];
    if (tur === 'tel') { v = String(v).trim() ? telefonTozala(v) : ''; if (v === null) xato(`${nom} noto'g'ri — 9 xonali raqam kerak`); }
    else if (tur === 'sana') { v = String(v).trim() ? sanaOl(v) : ''; if (v === null) xato(`${nom} YYYY-MM-DD ko'rinishida bo'lsin`); }
    else if (tur === 'jins') v = /ayol|qiz|жен/i.test(String(v)) ? 'Ayol' : 'Erkak';
    else if (tur === 'bool') v = v === true || /^(ha|true|kerak|yes|да)/i.test(String(v));
    else v = matnOl(v, 200);
    const eski = s[f] ?? (tur === 'bool' ? false : '');
    if (String(eski) === String(v)) continue;
    if (f === 'name' && v.length < 3) xato('Ism juda qisqa');
    body[f] = v;
    maydonlar.push({ nom, eski: korin(eski, tur), qiymat: korin(v, tur) });
  }
  if (Object.keys(body).length === 1) xato("O'zgarish yo'q — nimani o'zgartirish kerakligini so'rang");
  return karta(k, {
    tur: 'oquvchi_tahrirlash', sarlavha: "O'quvchi ma'lumotini o'zgartirish", maydonlar,
    sorovlar: [{ usul: 'PUT', yol: `/api/students/${s.id}`, body, nom: "O'quvchi" }],
    tugma: 'Saqlash', natija: "Ma'lumot saqlandi", havola: `/students/${s.id}`,
    model: { oquvchi: korinishIsmi(s.name), ozgaradi: Object.keys(body).filter(x => x !== 'schoolId') },
  });
}

async function oquvchiIzoh(k, a) {
  const s = await oquvchiniTop(k, a.oquvchi);
  const matn = matnOl(a.izoh, 500);
  if (matn.length < 2) xato('Izoh matni kerak');
  const [y, m, d] = k.bugun.split('-');
  const qator = `${d}.${m}.${y}: ${matn}`;
  const yangi = s.comment ? `${String(s.comment).trimEnd()}\n${qator}` : qator;
  return karta(k, {
    tur: 'oquvchi_izoh', sarlavha: "O'quvchiga izoh qo'shish",
    maydonlar: [{ nom: "O'quvchi", qiymat: oquvchiQisqa(s) }, { nom: 'Yangi qator', qiymat: qator }],
    sorovlar: [{ usul: 'PUT', yol: `/api/students/${s.id}`, body: { schoolId: s.schoolId, comment: yangi }, nom: 'Izoh' }],
    tugma: "Izohni qo'shish", natija: "Izoh qo'shildi", havola: `/students/${s.id}`,
    model: { oquvchi: korinishIsmi(s.name), qator },
  });
}

/** Kursdan chiqishda shu oy hisobi — servisdagi oldindan ko'rish bilan. */
async function chiqishOldindan(s, guruhlar, tanlov, sana) {
  const bosh = await kursdanChiqish({ studentId: s.id, kurslar: guruhlar.map(g => ({ groupId: g.id, summa: null })), date: sana, schoolId: s.schoolId, apply: false });
  if (bosh.error) xato(bosh.error);
  if (typeof tanlov === 'number' && bosh.lines.length > 1) xato("Summani har kurs uchun alohida ayting yoki «kelgan darslar uchun» / «olinmasin» ni tanlang");
  const summalar = {};
  const qatorlar = [];
  let farq = 0;
  for (const l of bosh.lines) {
    let summa = null;
    if (!bosh.trial) {
      if (tanlov === 'olinmasin') summa = 0;
      else if (tanlov === 'kelgan_darslar') summa = l.taklif ?? null;
      else if (typeof tanlov === 'number') summa = tanlov;
    }
    if (summa !== null && summa !== l.yozilgan) { summalar[l.groupId] = summa; farq += l.yozilgan - summa; }
    const dars = l.darsSoni !== null ? ` · ${l.darsSoni} dars ${l.kelganDars !== null ? 'kelgan' : "o'tgan"}` : '';
    qatorlar.push(bosh.trial
      ? `${l.groupName} — sinov, pul hisobi yo'q`
      : `${l.groupName}: ${bosh.oy} hisobi ${som(l.yozilgan)}${summalar[l.groupId] !== undefined ? ` → ${som(summalar[l.groupId])}` : " (o'zgarmaydi)"}${dars}${tanlov === 'ozgarmaydi' && l.taklif !== null && l.taklif !== l.yozilgan ? ` · kelgan darslar uchun ${som(l.taklif)} bo'lardi` : ''}`);
  }
  return { trial: bosh.trial, oy: bosh.oy, summalar, farq, qatorlar };
}

async function oquvchiHolati(k, a) {
  const s = await oquvchiniTop(k, a.oquvchi);
  const yangi = holatOl(a.holat);
  if (yangi === s.status) xato(`O'quvchi allaqachon «${yangi}» holatida`);
  const body = { schoolId: s.schoolId, status: yangi };
  const maydonlar = [{ nom: "O'quvchi", qiymat: oquvchiQisqa(s) }, { nom: 'Holat', eski: s.status, qiymat: yangi }];
  const royxat = [];
  const ogoh = [];
  const sabab = matnOl(a.sabab, 200);
  const ketadi = !kursdaOqiydi(yangi) && kursdaOqiydi(s.status);
  if (!kursdaOqiydi(yangi) && sabab) { body.leaveReason = sabab; maydonlar.push({ nom: 'Sabab', qiymat: sabab }); }
  let balans = s.balance;
  if (ketadi && s.groups.length) {
    const sana = sanaOl(a.sana) || k.bugun;
    const ch = await chiqishOldindan(s, s.groups, shuOyTanlovi(a.shu_oy), sana);
    royxat.push({ sarlavha: `Kurslardan chiqariladi (${s.groups.length})`, qatorlar: ch.qatorlar });
    if (Object.keys(ch.summalar).length) {
      if (!kerak(k, 'oquvchilar.kursHisobi')) xato("Shu oy hisobini o'zgartirishga ruxsatingiz yo'q — «o'zgarmaydi» bilan davom etish mumkin");
      body.chiqish = { sana, summalar: ch.summalar };
      balans += ch.farq;
    }
  } else if (s.status === 'Sinov' && yangi === 'Faol' && s.groups.length) {
    const qatorlar = [];
    for (const g of s.groups) {
      const q = await firstMonthQuote({ groupId: g.id, date: k.bugun, schoolId: s.schoolId, studentId: s.id });
      if (q.error || q.suggested === null) { qatorlar.push(`${g.name} — jadvali yo'q, hisob yozilmaydi`); continue; }
      balans -= q.suggested;
      qatorlar.push(`${g.name} — shu oy ${som(q.suggested)} so'm (${q.lessons} dars)`);
    }
    royxat.push({ sarlavha: "Faol bo'lgach yoziladigan hisob (taxminan)", qatorlar });
  } else if (!kursdaOqiydi(s.status) && kursdaOqiydi(yangi)) {
    ogoh.push("O'quvchi kurslarga o'zi qaytmaydi — kerak bo'lsa «kursga qo'shish»ni so'rang");
  }
  if (Math.round(balans) !== Math.round(s.balance)) maydonlar.push({ nom: 'Balans', eski: balansMatni(s.balance), qiymat: balansMatni(balans) });
  return karta(k, {
    tur: 'oquvchi_holati', sarlavha: `Holat: ${s.status} → ${yangi}`, maydonlar, royxat, ogohlantirish: ogoh, xavfli: ketadi,
    sorovlar: [{ usul: 'PUT', yol: `/api/students/${s.id}`, body, nom: "O'quvchi" }],
    tugma: yangi === 'Arxiv' ? 'Arxivga olish' : "Holatni o'zgartirish", natija: `Holat: ${yangi}`, havola: `/students/${s.id}`,
    model: { oquvchi: korinishIsmi(s.name), eski: s.status, yangi, balans_keyin: Math.round(balans) },
  });
}

async function kursgaQoshish(k, a) {
  const s = await oquvchiniTop(k, a.oquvchi);
  const g = await kursniTop(k, a.kurs);
  if (g.schoolId !== s.schoolId) xato('Kurs boshqa filialda');
  if (s.groups.some(x => x.id === g.id)) xato(`${korinishIsmi(s.name)} allaqachon ${g.name} kursida`);
  const kelgan = sanaOl(a.kelgan_sana) || k.bugun;
  const q = await firstMonthQuote({ groupId: g.id, date: kelgan, schoolId: g.schoolId, studentId: s.id });
  if (q.error) xato(q.error);
  const ogoh = [];
  const maydonlar = [
    { nom: "O'quvchi", qiymat: oquvchiQisqa(s) },
    { nom: 'Kurs', qiymat: [g.name, ustozlar(g), g.schedule].filter(Boolean).join(' · ') },
    { nom: 'Kelgan sana', qiymat: sanaMatni(kelgan) },
  ];
  let charge;
  if (s.status === 'Sinov') {
    maydonlar.push({ nom: 'Hisob', qiymat: 'sinov — pul yozilmaydi' });
  } else {
    if (berilganmi(a.birinchi_oy)) {
      charge = summaOl(a.birinchi_oy);
      if (!Number.isFinite(charge) || charge < 0) xato("Birinchi oy summasi noto'g'ri");
    }
    const due = charge ?? q.suggested;
    const keyin = kelgan.slice(0, 7) > k.bugun.slice(0, 7);
    maydonlar.push({ nom: 'Oylik narx', qiymat: `${som(q.price)} so'm` });
    if (due === null) ogoh.push("Kurs jadvali belgilanmagan — birinchi oy hisobi yozilmaydi");
    else {
      maydonlar.push({ nom: 'Birinchi oy', qiymat: due === 0 && charge === undefined && !keyin ? "bu oyda dars qolmagan — hisob keyingi oydan" : `${som(due)} so'm${charge !== undefined ? " (qo'lda)" : q.lessons ? ` (${q.lessons} dars)` : ''}${keyin ? ' — oy boshida yoziladi' : ''}` });
      if (!keyin) maydonlar.push({ nom: 'Balans', eski: balansMatni(s.balance), qiymat: balansMatni(s.balance - due) });
    }
  }
  if (!kursdaOqiydi(s.status)) ogoh.push(`O'quvchi hozir ${s.status} — kursga qo'shilgach Faol bo'ladi`);
  if (g.roomRel?.capacity && g._count.students >= g.roomRel.capacity) ogoh.push(`${g.roomRel.name} sig'imi ${g.roomRel.capacity} — kursda allaqachon ${g._count.students} o'quvchi`);
  return karta(k, {
    tur: 'kursga_qoshish', sarlavha: `Kursga qo'shish: ${g.name}`, maydonlar, ogohlantirish: ogoh,
    sorovlar: [{ usul: 'POST', yol: `/api/groups/${g.id}/students`, nom: 'Kurs', body: { schoolId: g.schoolId, studentId: s.id, ...(kelgan !== k.bugun ? { startDate: kelgan } : {}), ...(charge !== undefined ? { charge } : {}) } }],
    tugma: "Kursga qo'shish", natija: "Kursga qo'shildi", havola: `/courses/${g.id}`,
    model: { oquvchi: korinishIsmi(s.name), kurs: g.name, birinchi_oy: charge ?? q.suggested },
  });
}

async function kursdanChiqarish(k, a) {
  const s = await oquvchiniTop(k, a.oquvchi);
  if (!s.groups.length) xato(`${korinishIsmi(s.name)} hech qaysi kursda emas`);
  let guruhlar;
  if (berilganmi(a.kurs) && !/^(hammasi|barchasi|hamma|all)/.test(izlashKaliti(a.kurs))) guruhlar = [await oquvchiKursi(k, s, a.kurs)];
  else if (berilganmi(a.kurs) || s.groups.length === 1) guruhlar = s.groups;
  else xato(`Qaysi kursdan? ${s.groups.map(g => g.name).join(', ')} (yoki «hammasi»)`);
  const sana = sanaOl(a.sana) || k.bugun;
  const ch = await chiqishOldindan(s, guruhlar, shuOyTanlovi(a.shu_oy), sana);
  if (Object.keys(ch.summalar).length && !kerak(k, 'oquvchilar.kursHisobi')) xato("Shu oy hisobini o'zgartirishga ruxsatingiz yo'q — «o'zgarmaydi» bilan davom etish mumkin");
  const ogoh = [];
  if (guruhlar.length === s.groups.length && kursdaOqiydi(s.status)) ogoh.push(`O'quvchi holati ${s.status} qoladi (kurssiz). Umuman ketgan bo'lsa — holatini «Passiv» qiling`);
  return karta(k, {
    tur: 'kursdan_chiqarish', sarlavha: `Kursdan chiqarish: ${korinishIsmi(s.name)}`, xavfli: true,
    maydonlar: [
      { nom: "O'quvchi", qiymat: korinishIsmi(s.name) },
      { nom: 'Sana', qiymat: sanaMatni(sana) },
      ch.farq ? { nom: 'Balans', eski: balansMatni(s.balance), qiymat: balansMatni(s.balance + ch.farq) } : null,
    ],
    royxat: [{ sarlavha: 'Kurslar', qatorlar: ch.qatorlar }],
    ogohlantirish: ogoh,
    sorovlar: [{ usul: 'POST', yol: `/api/students/${s.id}/kursdan-chiqarish`, nom: 'Kursdan chiqarish', body: { schoolId: s.schoolId, date: sana, kurslar: guruhlar.map(g => ({ groupId: g.id, summa: ch.summalar[g.id] ?? null })) } }],
    tugma: 'Kursdan chiqarish', natija: 'Kursdan chiqarildi', havola: `/students/${s.id}`,
    model: { oquvchi: korinishIsmi(s.name), kurslar: guruhlar.map(g => g.name), balans_ozgarishi: ch.farq },
  });
}

async function kursgaKochirish(k, a) {
  const s = await oquvchiniTop(k, a.oquvchi);
  const yangi = await kursniTop(k, a.yangi_kurs);
  let eski = null;
  if (berilganmi(a.eski_kurs)) eski = await oquvchiKursi(k, s, a.eski_kurs);
  else if (s.groups.length === 1) eski = s.groups[0];
  else if (s.groups.length > 1) xato(`Qaysi kursdan ko'chiriladi? ${s.groups.map(g => g.name).join(', ')}`);
  const sana = sanaOl(a.sana) || k.bugun;
  const r = await transferStudent({ studentId: s.id, fromGroupId: eski?.id ?? null, toGroupId: yangi.id, date: sana, schoolId: s.schoolId, apply: false });
  if (r.error) xato(r.error);
  const ogoh = ["Pul o'zgarmaydi — faqat kurs almashadi"];
  if (r.from && r.from.price !== r.to.price) ogoh.push(`Narx boshqa: ${som(r.from.price)} → ${som(r.to.price)} so'm (keyingi oy hisobidan)`);
  return karta(k, {
    tur: 'kursga_kochirish', sarlavha: `Boshqa kursga ko'chirish`,
    maydonlar: [
      { nom: "O'quvchi", qiymat: korinishIsmi(s.name) },
      { nom: 'Kurs', eski: r.from ? `${r.from.name}${r.from.teacher ? ` · ${r.from.teacher}` : ''}` : '—', qiymat: `${r.to.name}${r.to.teacher ? ` · ${r.to.teacher}` : ''}` },
      { nom: 'Sana', qiymat: sanaMatni(sana) },
    ],
    ogohlantirish: ogoh,
    sorovlar: [{ usul: 'POST', yol: `/api/students/${s.id}/transfer`, nom: "Ko'chirish", body: { schoolId: s.schoolId, fromGroupId: eski?.id ?? null, toGroupId: yangi.id, date: sana } }],
    tugma: "Ko'chirish", natija: "Ko'chirildi", havola: `/students/${s.id}`,
    model: { oquvchi: korinishIsmi(s.name), eski: r.from?.name || null, yangi: r.to.name },
  });
}

async function kursHisobi(k, a) {
  const s = await oquvchiniTop(k, a.oquvchi);
  const g = await oquvchiKursi(k, s, a.kurs);
  const sana = sanaOl(a.kelgan_sana);
  if (!sana) xato("Kursga kelgan sanani so'rang (YYYY-MM-DD)");
  let price;
  if (berilganmi(a.oylik_narx)) {
    if (/standart|asl|kurs narx/.test(izlashKaliti(a.oylik_narx))) price = null;
    else { price = summaOl(a.oylik_narx); if (!Number.isFinite(price) || price < 0) xato("Oylik narx noto'g'ri"); }
    if (!kerak(k, 'oquvchilar.narx')) xato("O'quvchiga alohida narx qo'yishga ruxsatingiz yo'q");
  }
  let firstMonthDue;
  if (berilganmi(a.birinchi_oy)) {
    if (/hisobla|avto|tizim/.test(izlashKaliti(a.birinchi_oy))) firstMonthDue = null;
    else { firstMonthDue = summaOl(a.birinchi_oy); if (!Number.isFinite(firstMonthDue) || firstMonthDue < 0) xato("Birinchi oy summasi noto'g'ri"); }
  }
  const r = await setKursHisob({ studentId: s.id, groupId: g.id, startDate: sana, price, firstMonthDue, schoolId: s.schoolId, apply: false });
  if (r.error) xato(r.error);
  const qatorlar = r.lines.map(l => `${oyNomi(l.month)}: ${l.keyinroq ? `oy boshida ${som(l.due)} yoziladi` : `yozilgan ${som(l.alreadyCharged)} → ${som(l.due)}`}${l.lessons != null ? ` (${l.lessons} dars)` : ''}`);
  return karta(k, {
    tur: 'kurs_hisobi', sarlavha: `Kurs hisobi: ${g.name}`,
    maydonlar: [
      { nom: "O'quvchi", qiymat: korinishIsmi(s.name) },
      { nom: 'Kelgan sana', eski: r.oldStart ? sanaMatni(r.oldStart) : '—', qiymat: sanaMatni(sana) },
      r.price !== r.oldPrice ? { nom: 'Oylik narx', eski: som(r.oldPrice), qiymat: som(r.price) } : { nom: 'Oylik narx', qiymat: `${som(r.price)} so'm` },
      firstMonthDue ? { nom: 'Birinchi oy', qiymat: `${som(firstMonthDue)} so'm (qo'lda)` } : r.suggested !== null ? { nom: 'Birinchi oy', qiymat: `${som(r.suggested)} so'm (${r.suggestedLessons} dars, hisoblangan)` } : null,
      r.balanceDelta ? { nom: 'Balans', eski: balansMatni(r.balanceBefore), qiymat: balansMatni(r.balanceAfter) } : { nom: 'Balans', qiymat: "o'zgarmaydi" },
    ],
    royxat: [{ sarlavha: 'Oylar', qatorlar }],
    ogohlantirish: [r.warning, r.trial ? "Sinovdagi o'quvchi — pul qayta sanalmaydi" : null],
    sorovlar: [{ usul: 'POST', yol: `/api/students/${s.id}/kurs-hisob`, nom: 'Kurs hisobi', body: { schoolId: s.schoolId, groupId: g.id, startDate: sana, ...(price !== undefined ? { price } : {}), ...(firstMonthDue !== undefined ? { firstMonthDue } : {}) } }],
    tugma: 'Hisobni saqlash', natija: 'Kurs hisobi saqlandi', havola: `/students/${s.id}`,
    model: { oquvchi: korinishIsmi(s.name), kurs: g.name, balans_ozgarishi: r.balanceDelta },
  });
}

async function oquvchiOchirish(k, a) {
  const s = await oquvchiniTop(k, a.oquvchi);
  const [tolov, davomat, ball] = await Promise.all([
    prisma.payment.count({ where: { studentId: s.id } }),
    prisma.attendance.count({ where: { studentId: s.id } }),
    prisma.score.count({ where: { studentId: s.id } }),
  ]);
  const tarix = [tolov && `${tolov} ta to'lov`, davomat && `${davomat} ta davomat`, ball && `${ball} ta baho`].filter(Boolean);
  return karta(k, {
    tur: 'oquvchi_ochirish', sarlavha: "O'quvchini butunlay o'chirish", xavfli: true,
    maydonlar: [{ nom: "O'quvchi", qiymat: oquvchiQisqa(s) }, { nom: 'Holat', qiymat: s.status }, { nom: 'Balans', qiymat: balansMatni(s.balance) }],
    ogohlantirish: [
      tarix.length ? `${tarix.join(', ')} ham o'chib ketadi, Moliyadagi o'tgan tushum kamayadi.` : null,
      "Qaytarib bo'lmaydi. Xavfsizroq yo'l — holatini «Arxiv» qilish (tarix saqlanadi).",
    ],
    sorovlar: [{ usul: 'DELETE', yol: `/api/students/${s.id}?force=1`, nom: "O'quvchi" }],
    tugma: "Ha, butunlay o'chirish", natija: "O'quvchi o'chirildi",
    model: { oquvchi: korinishIsmi(s.name), tarix },
  });
}

async function ballQoyish(k, a) {
  const s = await oquvchiniTop(k, a.oquvchi);
  const g = await oquvchiKursi(k, s, a.kurs);
  const ball = Number(String(a.ball ?? '').replace(',', '.'));
  if (!Number.isFinite(ball)) xato('Ballni son bilan ayting');
  const sana = sanaOl(a.sana) || k.bugun;
  const izoh = matnOl(a.izoh, 200);
  return karta(k, {
    tur: 'ball_qoyish', sarlavha: "Ball qo'yish",
    maydonlar: [{ nom: "O'quvchi", qiymat: korinishIsmi(s.name) }, { nom: 'Kurs', qiymat: g.name }, { nom: 'Ball', qiymat: String(ball) }, { nom: 'Sana', qiymat: sanaMatni(sana) }, izoh && { nom: 'Izoh', qiymat: izoh }],
    sorovlar: [{ usul: 'POST', yol: '/api/scores', nom: 'Ball', body: { schoolId: g.schoolId, studentId: s.id, groupId: g.id, date: sana, value: ball, ...(izoh ? { comment: izoh } : {}) } }],
    tugma: "Ball qo'yish", natija: "Ball qo'yildi", havola: `/students/${s.id}`,
    model: { oquvchi: korinishIsmi(s.name), kurs: g.name, ball },
  });
}

// ---------------------------------------------------------------------------
// Kurslar va yo'qlama
// ---------------------------------------------------------------------------

async function yoqlama(k, a) {
  const g = await kursniTop(k, a.kurs, { select: { students: { select: { id: true, name: true, status: true } } } });
  const sana = sanaOl(a.sana) || k.bugun;
  if (sana > k.bugun) xato("Kelajakdagi kunga yo'qlama qilib bo'lmaydi");
  const talabalar = g.students;
  if (!talabalar.length) xato(`${g.name} kursida o'quvchi yo'q`);
  const topKursdan = (nom) => {
    const soz = String(nom).trim();
    if (/^\d+$/.test(soz)) { const t = talabalar.find(x => x.id === Number(soz)); if (t) return t; }
    const sozlar = izlashKaliti(soz).split(' ').filter(Boolean);
    const b = talabalar.map(t => ({ t, b: moslikBali(t.name, sozlar) })).filter(x => x.b > 0).sort((x, y) => y.b - x.b);
    if (b.length === 1 || (b.length > 1 && b[0].b > b[1].b)) return b[0].t;
    if (!b.length) xato(`«${soz}» ${g.name} kursida topilmadi`);
    xato(`«${soz}» bo'yicha kursda ${b.length} ta o'quvchi: ${b.slice(0, 5).map(x => korinishIsmi(x.t.name)).join(', ')} — qaysi biri?`);
  };
  const holatlar = new Map();
  if (a.dars_bolmadi === true) {
    for (const t of talabalar) holatlar.set(t.id, "Dars bo'lmadi");
  } else {
    for (const [maydon, holat] of [['kelmaganlar', 'Kelmapdi'], ['sababli', 'Sababli'], ['kechikkanlar', 'Kechikdi'], ['erta_ketganlar', 'ErtaKetdi'], ['kelganlar', 'Keldi']]) {
      for (const nom of royxatOl(a[maydon])) holatlar.set(topKursdan(nom).id, holat);
    }
    const qolgan = /kelma/.test(izlashKaliti(a.qolganlar)) ? 'Kelmapdi' : 'Keldi';
    for (const t of talabalar) if (!holatlar.has(t.id)) holatlar.set(t.id, qolgan);
  }
  const records = talabalar.map(t => ({ studentId: t.id, status: holatlar.get(t.id) }));
  const ogoh = [];
  const bor = await prisma.attendance.findMany({ where: { groupId: g.id, date: sana }, select: { studentId: true, status: true } });
  if (bor.length) {
    const eski = new Map(bor.map(b => [b.studentId, b.status]));
    const ozgaradi = records.filter(r => eski.has(r.studentId) && eski.get(r.studentId) !== r.status).length;
    ogoh.push(`Bu kunga yo'qlama allaqachon bor — ${ozgaradi} ta o'quvchining belgisi o'zgaradi`);
  }
  if (!isLessonDay(g.days, sana)) ogoh.push(`${uzSana(sana, k.bugun)} kursning jadvalidagi dars kuni emas`);
  const sanoq = {};
  for (const r of records) sanoq[r.status] = (sanoq[r.status] || 0) + 1;
  const ism = (id) => korinishIsmi(talabalar.find(t => t.id === id)?.name);
  const royxat = Object.keys(sanoq).filter(st => st !== 'Keldi' && st !== "Dars bo'lmadi")
    .map(st => ({ sarlavha: `${DAVOMAT_NOMI[st]} (${sanoq[st]})`, qatorlar: records.filter(r => r.status === st).map(r => ism(r.studentId)) }));
  const maydonlar = [
    { nom: 'Kurs', qiymat: [g.name, g.schedule].filter(Boolean).join(' · ') },
    { nom: 'Sana', qiymat: `${sanaMatni(sana)}` },
    { nom: 'Belgilar', qiymat: Object.entries(sanoq).map(([st, n]) => `${DAVOMAT_NOMI[st]}: ${n}`).join(' · ') },
  ];
  const sorovlar = [{ usul: 'POST', yol: '/api/attendances/batch', nom: "Yo'qlama", body: { schoolId: g.schoolId, groupId: g.id, date: sana, records } }];
  if (a.ota_onaga_xabar === true) {
    const d = await davomatSozlamasi(g.schoolId);
    let kanal = kanalOl(a.kanal, d?.sozlama?.kanal || 'TELEGRAM');
    if (kanal !== 'TELEGRAM' && !kerak(k, 'xabarlar.yuborish')) { kanal = 'TELEGRAM'; ogoh.push("SMS yuborishga ruxsatingiz yo'q — faqat Telegram"); }
    const yuborilgan = await kursKuniYuborilganlar(g.id, sana);
    const olgan = new Set([...(yuborilgan instanceof Map ? yuborilgan.keys() : Object.keys(yuborilgan || {}))].map(Number));
    const ids = records.map(r => r.studentId).filter(id => !olgan.has(id));
    if (!ids.length) ogoh.push("Bu kun uchun ota-onalarga xabar allaqachon ketgan");
    else {
      sorovlar.push({ usul: 'POST', yol: '/api/attendances/notify', nom: 'Ota-onaga xabar', body: { schoolId: g.schoolId, groupId: g.id, date: sana, studentIds: ids, kanal } });
      maydonlar.push({ nom: 'Ota-onaga xabar', qiymat: `${KANAL_NOMI[kanal]} · har holatga o'z shabloni` });
      if (kanal !== 'TELEGRAM') ogoh.push('SMS pullik');
    }
  }
  return karta(k, {
    tur: 'yoqlama', sarlavha: `Yo'qlama: ${g.name}`, maydonlar, royxat, ogohlantirish: ogoh, sorovlar,
    tugma: "Yo'qlamani saqlash", natija: "Yo'qlama saqlandi", havola: `/courses/${g.id}`,
    model: { kurs: g.name, sana, belgilar: sanoq },
  });
}

async function kursOchish(k, a) {
  const schoolId = maqsadFilial(k, a.filial);
  const nom = matnOl(a.nom, 80);
  if (nom.length < 2) xato('Kurs nomini ayting (masalan «Matematika-5»)');
  const fan = await fanniTop(k, a.fan, [schoolId]);
  const ustoz = await ustozniTop(k, a.ustoz, schoolId);
  const ustoz2 = berilganmi(a.ikkinchi_ustoz) ? await ustozniTop(k, a.ikkinchi_ustoz, schoolId) : null;
  if (ustoz2 && ustoz2.id === ustoz.id) xato("Ikkinchi ustoz asosiy ustozdan boshqa bo'lsin");
  const days = kunlarOl(a.kunlar);
  const schedule = vaqtOl(a.vaqt);
  const xona = berilganmi(a.xona) ? await xonaniTop(k, a.xona, [schoolId]) : null;
  const ogoh = [];
  const bor = await prisma.group.findFirst({ where: { schoolId, name: { equals: nom, mode: 'insensitive' } }, select: { id: true } });
  if (bor) ogoh.push(`«${nom}» nomli kurs allaqachon bor`);
  const band = await xonaBandligi({ schoolId, roomId: xona?.id, days, schedule });
  if (band.length) ogoh.push(`${xona.name} shu vaqtda band: ${band.join(', ')}`);
  if (!xona) ogoh.push("Xona biriktirilmadi — keyin qo'shish mumkin");
  return karta(k, {
    tur: 'kurs_ochish', sarlavha: 'Yangi kurs ochish',
    maydonlar: [
      { nom: 'Nomi', qiymat: nom },
      { nom: 'Fan', qiymat: `${fan.name}${kerak(k, 'kurslar.narx', 1) ? ` · ${som(fan.price)} so'm/oy` : ''}` },
      { nom: 'Ustoz', qiymat: [ustoz.name, ustoz2?.name].filter(Boolean).map(korinishIsmi).join(', ') },
      { nom: 'Kunlar', qiymat: KUN_MATNI[days] },
      { nom: 'Vaqt', qiymat: schedule },
      xona && { nom: 'Xona', qiymat: `${xona.name}${xona.capacity ? ` · ${xona.capacity} o'rin` : ''}` },
      filialQatori(k, schoolId),
    ],
    ogohlantirish: ogoh,
    sorovlar: [{ usul: 'POST', yol: '/api/groups', nom: 'Kurs', body: { schoolId, name: nom, courseId: fan.id, teacherId: ustoz.id, schedule, days, ...(xona ? { room: xona.id } : {}), ...(ustoz2 ? { teacher2Id: ustoz2.id } : {}) } }],
    tugma: 'Kursni ochish', natija: 'Kurs ochildi', havola: '/courses',
    model: { nom, fan: fan.name, ustoz: korinishIsmi(ustoz.name), kunlar: days, vaqt: schedule, xona: xona?.name || null },
  });
}

async function kursTahrirlash(k, a) {
  const g = await kursniTop(k, a.kurs);
  const body = { schoolId: g.schoolId };
  const maydonlar = [{ nom: 'Kurs', qiymat: g.name }];
  const olib = (v) => /^(yoq|olib|bekor|kerak emas|null)/.test(izlashKaliti(v));
  if (berilganmi(a.nom)) {
    const n = matnOl(a.nom, 80);
    if (n.length >= 2 && n !== g.name) { body.name = n; maydonlar.push({ nom: 'Nomi', eski: g.name, qiymat: n }); }
  }
  if (berilganmi(a.ustoz)) {
    const u = await ustozniTop(k, a.ustoz, g.schoolId);
    if (u.id !== g.teacherId) { body.teacherId = u.id; maydonlar.push({ nom: 'Ustoz', eski: korinishIsmi(g.teacher?.name) || '—', qiymat: korinishIsmi(u.name) }); }
  }
  if (a.ikkinchi_ustoz !== undefined && a.ikkinchi_ustoz !== null) {
    if (olib(a.ikkinchi_ustoz) || !String(a.ikkinchi_ustoz).trim()) {
      if (g.teacher2Id) { body.teacher2Id = null; maydonlar.push({ nom: 'Ikkinchi ustoz', eski: korinishIsmi(g.teacher2?.name), qiymat: '—' }); }
    } else {
      const u = await ustozniTop(k, a.ikkinchi_ustoz, g.schoolId);
      if (u.id !== g.teacher2Id) { body.teacher2Id = u.id; maydonlar.push({ nom: 'Ikkinchi ustoz', eski: korinishIsmi(g.teacher2?.name) || '—', qiymat: korinishIsmi(u.name) }); }
    }
  }
  if (berilganmi(a.kunlar)) {
    const d = kunlarOl(a.kunlar);
    if (d !== g.days) { body.days = d; maydonlar.push({ nom: 'Kunlar', eski: KUN_MATNI[g.days] || g.days, qiymat: KUN_MATNI[d] }); }
  }
  if (berilganmi(a.vaqt)) {
    const sch = vaqtOl(a.vaqt);
    if (sch !== g.schedule) { body.schedule = sch; maydonlar.push({ nom: 'Vaqt', eski: g.schedule || '—', qiymat: sch }); }
  }
  let xonaId = g.room;
  if (a.xona !== undefined && a.xona !== null) {
    if (olib(a.xona)) { if (g.room) { body.room = null; xonaId = null; maydonlar.push({ nom: 'Xona', eski: g.roomRel?.name || '—', qiymat: '—' }); } }
    else {
      const x = await xonaniTop(k, a.xona, [g.schoolId]);
      if (x.id !== g.room) { body.room = x.id; xonaId = x.id; maydonlar.push({ nom: 'Xona', eski: g.roomRel?.name || '—', qiymat: x.name }); }
    }
  }
  if (Object.keys(body).length === 1) xato("O'zgarish yo'q — nimani o'zgartirish kerakligini so'rang");
  const ogoh = [];
  if (body.days || body.schedule || body.room) {
    const band = await xonaBandligi({ schoolId: g.schoolId, roomId: xonaId, days: body.days || g.days, schedule: body.schedule || g.schedule, istisno: g.id });
    if (band.length) ogoh.push(`Xona shu vaqtda band: ${band.join(', ')}`);
  }
  if (body.days) ogoh.push("Kunlar o'zgarsa bitta dars narxi va keyingi hisoblar yangi jadval bo'yicha sanaladi");
  return karta(k, {
    tur: 'kurs_tahrirlash', sarlavha: `Kursni o'zgartirish: ${g.name}`, maydonlar, ogohlantirish: ogoh,
    sorovlar: [{ usul: 'PUT', yol: `/api/groups/${g.id}`, body, nom: 'Kurs' }],
    tugma: 'Saqlash', natija: 'Kurs saqlandi', havola: `/courses/${g.id}`,
    model: { kurs: g.name, ozgaradi: Object.keys(body).filter(x => x !== 'schoolId') },
  });
}

async function kursOchirish(k, a) {
  const g = await kursniTop(k, a.kurs, { select: { _count: { select: { students: true, attendances: true, scores: true } } } });
  return karta(k, {
    tur: 'kurs_ochirish', sarlavha: `Kursni o'chirish: ${g.name}`, xavfli: true,
    maydonlar: [{ nom: 'Kurs', qiymat: [g.name, ustozlar(g), g.schedule].filter(Boolean).join(' · ') }, { nom: "O'quvchilar", qiymat: String(g._count.students) }],
    ogohlantirish: [
      `${g._count.students} ta o'quvchi kursdan chiqadi (yozilgan hisoblarga tegilmaydi), ${g._count.attendances} ta davomat va ${g._count.scores} ta baho butunlay o'chadi.`,
      "Qaytarib bo'lmaydi.",
    ],
    sorovlar: [{ usul: 'DELETE', yol: `/api/groups/${g.id}`, nom: 'Kurs' }],
    tugma: "Ha, kursni o'chirish", natija: "Kurs o'chirildi", havola: '/courses',
    model: { kurs: g.name, oquvchilar: g._count.students },
  });
}

async function fanQoshish(k, a) {
  const schoolId = maqsadFilial(k, a.filial);
  const nom = matnOl(a.nom, 80);
  if (nom.length < 2) xato('Fan nomini ayting');
  const bor = await prisma.course.findFirst({ where: { schoolId, name: { equals: nom, mode: 'insensitive' } }, select: { id: true } });
  if (bor) xato(`«${nom}» fani allaqachon bor`);
  let price;
  if (berilganmi(a.narx)) {
    price = summaOl(a.narx);
    if (!Number.isFinite(price) || price < 0) xato("Narx noto'g'ri");
    if (!kerak(k, 'kurslar.narx')) xato("Narx qo'yishga ruxsatingiz yo'q");
  }
  return karta(k, {
    tur: 'fan_qoshish', sarlavha: "Yangi fan",
    maydonlar: [{ nom: 'Fan', qiymat: nom }, price !== undefined && { nom: 'Oylik narx', qiymat: `${som(price)} so'm` }, filialQatori(k, schoolId)],
    ogohlantirish: [price === undefined ? "Narx kiritilmadi (0) — keyin qo'yish mumkin" : null],
    sorovlar: [{ usul: 'POST', yol: '/api/courses', nom: 'Fan', body: { schoolId, name: nom, ...(price !== undefined ? { price } : {}) } }],
    tugma: "Fanni qo'shish", natija: "Fan qo'shildi", havola: '/courses',
    model: { fan: nom, narx: price ?? null },
  });
}

async function fanTahrirlash(k, a) {
  const f = await fanniTop(k, a.fan, k.maktablar);
  const body = { schoolId: f.schoolId };
  const maydonlar = [{ nom: 'Fan', qiymat: f.name }];
  if (berilganmi(a.nom)) { const n = matnOl(a.nom, 80); if (n.length >= 2 && n !== f.name) { body.name = n; maydonlar.push({ nom: 'Nomi', eski: f.name, qiymat: n }); } }
  const ogoh = [];
  if (berilganmi(a.narx)) {
    const n = summaOl(a.narx);
    if (!Number.isFinite(n) || n < 0) xato("Narx noto'g'ri");
    if (!kerak(k, 'kurslar.narx')) xato("Narxni o'zgartirishga ruxsatingiz yo'q");
    if (n !== Math.round(f.price)) {
      body.price = n;
      maydonlar.push({ nom: 'Oylik narx', eski: som(f.price), qiymat: som(n) });
      const kurslar = await prisma.group.findMany({ where: { courseId: f.id }, select: { _count: { select: { students: true } } } });
      ogoh.push(`${kurslar.length} ta kurs, ${kurslar.reduce((x, g) => x + g._count.students, 0)} ta o'quvchi: keyingi oylik hisoblar yangi narxda yoziladi`);
    }
  }
  if (Object.keys(body).length === 1) xato("O'zgarish yo'q");
  return karta(k, {
    tur: 'fan_tahrirlash', sarlavha: `Fanni o'zgartirish: ${f.name}`, maydonlar, ogohlantirish: ogoh, xavfli: body.price !== undefined,
    sorovlar: [{ usul: 'PUT', yol: `/api/courses/${f.id}`, body, nom: 'Fan' }],
    tugma: 'Saqlash', natija: 'Fan saqlandi', havola: '/courses',
    model: { fan: f.name, ozgaradi: Object.keys(body).filter(x => x !== 'schoolId') },
  });
}

// ---------------------------------------------------------------------------
// Lidlar
// ---------------------------------------------------------------------------

async function lidQoshish(k, a) {
  const schoolId = maqsadFilial(k, a.filial);
  const ism = matnOl(a.ism, 100);
  if (ism.length < 2) xato('Lidning ismi kerak');
  const telefon = telefonTozala(a.telefon);
  if (!telefon) xato("Telefon raqam noto'g'ri — 9 xonali raqam kerak (masalan 90 123 45 67)");
  const fanlar = await prisma.course.findMany({ where: { schoolId: { in: k.maktablar } }, select: { name: true } });
  const soralgan = kursKaliti(a.kurs);
  const fan = soralgan
    ? fanlar.find(f => kursKaliti(f.name) === soralgan) || fanlar.find(f => kursKaliti(f.name).includes(soralgan) || soralgan.includes(kursKaliti(f.name)))
    : null;
  const kurs = fan?.name || (berilganmi(a.kurs) ? matnOl(a.kurs, 80) : 'Aniqlanmagan');
  const manbaSoz = izlashKaliti(a.manba);
  const manba = MANBALAR.find(m => m.sozlar.some(s => manbaSoz.includes(izlashKaliti(s))))?.nom
    || (berilganmi(a.manba) ? matnOl(a.manba, 40) : 'Boshqa');
  const izoh = matnOl(a.izoh, 500);
  const raqam = raqamOxiri(telefon);
  const [lidlar, oquvchilar] = await Promise.all([
    prisma.lead.findMany({ where: { schoolId: { in: k.maktablar } }, select: { name: true, phone: true, status: true } }),
    prisma.student.findMany({ where: { schoolId: { in: k.maktablar } }, select: { name: true, phone: true, fatherPhone: true, motherPhone: true } }),
  ]);
  const borLid = lidlar.find(l => raqamOxiri(l.phone) === raqam);
  const borOquvchi = oquvchilar.find(s => [s.phone, s.fatherPhone, s.motherPhone].some(p => raqamOxiri(p) === raqam));
  const malumot = { schoolId, name: ism, phone: telefon, course: kurs, source: manba, status: 'Yangi', ...(izoh ? { notes: izoh } : {}) };
  return karta(k, {
    tur: 'lid_qoshish', sarlavha: "Yangi lid qo'shish",
    maydonlar: [{ nom: 'Ism', qiymat: ism }, { nom: 'Telefon', qiymat: telefon }, { nom: 'Fan', qiymat: kurs }, { nom: 'Manba', qiymat: manba }, izoh && { nom: 'Izoh', qiymat: izoh }, filialQatori(k, schoolId)],
    ogohlantirish: [
      borLid && `Bu raqam bilan lid bor: ${korinishIsmi(borLid.name)} (${borLid.status})`,
      borOquvchi && `Bu raqam o'quvchida bor: ${korinishIsmi(borOquvchi.name)}`,
      !fan && berilganmi(a.kurs) && fanlar.length ? `«${a.kurs}» degan fan topilmadi — lid shu nom bilan yoziladi` : null,
    ],
    sorovlar: [{ usul: 'POST', yol: '/api/leads', body: malumot, nom: 'Lid' }],
    tugma: "Lidni qo'shish", natija: "Lid qo'shildi", havola: '/leads',
    model: { ism, kurs, manba },
  });
}

async function lidTahrirlash(k, a) {
  const l = await lidniTop(k, a.lid);
  const body = { schoolId: l.schoolId };
  const maydonlar = [{ nom: 'Lid', qiymat: `${korinishIsmi(l.name)} · ${l.course}` }];
  if (berilganmi(a.holat)) { const h = lidHolatiOl(a.holat); if (h !== l.status) { body.status = h; maydonlar.push({ nom: 'Holat', eski: l.status, qiymat: h }); } }
  if (berilganmi(a.ism)) { const n = matnOl(a.ism, 100); if (n !== l.name) { body.name = n; maydonlar.push({ nom: 'Ism', eski: l.name, qiymat: n }); } }
  if (berilganmi(a.telefon)) { const t = telefonTozala(a.telefon); if (!t) xato("Telefon noto'g'ri"); if (t !== l.phone) { body.phone = t; maydonlar.push({ nom: 'Telefon', eski: l.phone || '—', qiymat: t }); } }
  if (berilganmi(a.kurs)) { const n = matnOl(a.kurs, 80); if (n !== l.course) { body.course = n; maydonlar.push({ nom: 'Fan', eski: l.course || '—', qiymat: n }); } }
  if (berilganmi(a.manba)) {
    const q = izlashKaliti(a.manba);
    const n = MANBALAR.find(m => m.sozlar.some(s => q.includes(izlashKaliti(s))))?.nom || matnOl(a.manba, 40);
    if (n !== l.source) { body.source = n; maydonlar.push({ nom: 'Manba', eski: l.source || '—', qiymat: n }); }
  }
  if (berilganmi(a.izoh)) {
    const [y, m, d] = k.bugun.split('-');
    const qator = `${d}.${m}.${y}: ${matnOl(a.izoh, 300)}`;
    body.notes = l.notes ? `${String(l.notes).trimEnd()}\n${qator}` : qator;
    maydonlar.push({ nom: 'Izohga', qiymat: qator });
  }
  if (Object.keys(body).length === 1) xato("O'zgarish yo'q");
  return karta(k, {
    tur: 'lid_tahrirlash', sarlavha: "Lidni o'zgartirish", maydonlar,
    sorovlar: [{ usul: 'PUT', yol: `/api/leads/${l.id}`, body, nom: 'Lid' }],
    tugma: 'Saqlash', natija: 'Lid saqlandi', havola: '/leads',
    model: { lid: korinishIsmi(l.name), ozgaradi: Object.keys(body).filter(x => x !== 'schoolId') },
  });
}

async function lidOchirish(k, a) {
  const l = await lidniTop(k, a.lid);
  return karta(k, {
    tur: 'lid_ochirish', sarlavha: "Lidni o'chirish", xavfli: true,
    maydonlar: [{ nom: 'Lid', qiymat: korinishIsmi(l.name) }, { nom: 'Telefon', qiymat: l.phone || '—' }, { nom: 'Holat', qiymat: l.status }],
    sorovlar: [{ usul: 'DELETE', yol: `/api/leads/${l.id}`, nom: 'Lid' }],
    tugma: "Ha, o'chirish", natija: "Lid o'chirildi", havola: '/leads',
    model: { lid: korinishIsmi(l.name) },
  });
}

async function lidniOquvchiga(k, a) {
  const l = await lidniTop(k, a.lid);
  const kurs = berilganmi(a.kurs) ? await kursniTop(k, a.kurs, { schoolId: l.schoolId }) : null;
  const holat = /sinov|trial/i.test(String(a.holat || '')) ? 'Sinov' : 'Faol';
  const qatorlar = [];
  let jami = 0;
  if (kurs) {
    if (holat === 'Sinov') qatorlar.push(`${kurs.name} — sinov: pul yozilmaydi`);
    else {
      const q = await firstMonthQuote({ groupId: kurs.id, date: k.bugun, schoolId: l.schoolId });
      if (!q.error && q.suggested) { jami = q.suggested; qatorlar.push(`${kurs.name} — birinchi oy ${som(q.suggested)} so'm (${q.lessons} dars)`); }
      else if (!q.error && q.suggested === 0) qatorlar.push(`${kurs.name} — bu oyda dars qolmagan, hisob keyingi oydan`);
      else qatorlar.push(`${kurs.name} — jadvali yo'q, hisob yozilmaydi`);
    }
  }
  const body = {
    schoolId: l.schoolId, name: l.name, phone: l.phone || '', birthDate: l.birthDate || '', address: l.address || 'Kiritilmagan',
    status: holat, joinedDate: k.bugun, balance: 0, groups: kurs ? [kurs.id] : [],
    fatherName: l.fatherName || undefined, fatherPhone: l.fatherPhone || undefined, motherName: l.motherName || undefined, motherPhone: l.motherPhone || undefined,
    studentSchool: l.studentSchool || undefined,
    comment: `Lid edi. Manba: ${l.source || '—'}. Fan: ${l.course || '—'}${l.notes ? `. ${String(l.notes).slice(0, 300)}` : ''}`,
    privilegeType: l.privilegeType || 'None', certCategory: l.certCategory || '', certSubject: l.certSubject || '', certType: l.certType || '',
    orgType: l.orgType || null, region: l.region || null, district: l.district || null,
    studyGoal: l.studyGoal || null, directionId: l.directionId || null, customPrices: {},
  };
  const sorovlar = [{ usul: 'POST', yol: '/api/students', body, nom: "O'quvchi" }];
  const ogoh = [];
  // Lidlar sahifasidagi kabi: o'quvchiga aylangan lid o'chiriladi; o'chirish
  // ruxsati bo'lmasa — «To'lov qildi» holatiga o'tadi.
  if (kerak(k, 'lidlar.ochirish')) sorovlar.push({ usul: 'DELETE', yol: `/api/leads/${l.id}`, nom: "Lid ro'yxatdan" });
  else if (kerak(k, 'lidlar.royxat')) { sorovlar.push({ usul: 'PUT', yol: `/api/leads/${l.id}`, body: { schoolId: l.schoolId, status: "To'lov qildi" }, nom: 'Lid holati' }); ogoh.push("Lid o'chirilmaydi (ruxsat yo'q) — «To'lov qildi» holatiga o'tadi"); }
  else ogoh.push("Lidlarni o'zgartirishga ruxsatingiz yo'q — lid ro'yxatda qoladi");
  return karta(k, {
    tur: 'lidni_oquvchiga', sarlavha: "Lidni o'quvchiga aylantirish",
    maydonlar: [{ nom: 'Lid', qiymat: `${korinishIsmi(l.name)} · ${l.phone || '—'}` }, { nom: 'Holat', qiymat: holat }, jami ? { nom: 'Balans', qiymat: `${balansMatni(-jami)} — birinchi oy hisobi` } : null],
    royxat: [{ sarlavha: 'Kurs', qatorlar }], ogohlantirish: ogoh, sorovlar,
    tugma: "O'quvchiga aylantirish", natija: "O'quvchi qo'shildi", havola: '/students',
    model: { lid: korinishIsmi(l.name), kurs: kurs?.name || null },
  });
}

// ---------------------------------------------------------------------------
// Moliya
// ---------------------------------------------------------------------------

function toifaOl(v) {
  const q = izlashKaliti(v);
  if (!q) return 'Boshqa';
  if (/ijara|arend/.test(q)) return 'Ijara';
  if (/kommun|svet|elektr|gaz|suv|voda|internet|issiq/.test(q)) return 'Kommunal';
  if (/market|reklam|target|banner/.test(q)) return 'Marketing';
  if (/ish haqi|oylik|maosh|zarplat/.test(q)) return 'Ish haqi';
  return XARAJAT_TOIFALARI.find(t => izlashKaliti(t) === q) || matnOl(v, 40);
}

async function xarajatQoshish(k, a) {
  const schoolId = maqsadFilial(k, a.filial);
  const summa = summaOl(a.summa);
  if (!Number.isFinite(summa) || summa <= 0) xato('Xarajat summasini aniq so\'rang');
  const toifa = toifaOl(a.toifa);
  const uq = izlashKaliti(a.usul);
  const usul = /kart|plast/.test(uq) ? 'Karta' : /tkaz|bank|perech/.test(uq) ? "O'tkazma" : 'Naqd';
  const sana = sanaOl(a.sana) || k.bugun;
  if (sana > k.bugun) xato('Sana kelajakda');
  const izoh = matnOl(a.izoh, 300);
  return karta(k, {
    tur: 'xarajat_qoshish', sarlavha: "Xarajat qo'shish",
    maydonlar: [
      { nom: 'Summa', qiymat: `${som(summa)} so'm` }, { nom: 'Toifa', qiymat: toifa }, { nom: 'Usul', qiymat: `${usul}${usul === 'Naqd' ? ' (kassadan)' : ''}` },
      { nom: 'Sana', qiymat: sanaMatni(sana) }, izoh && { nom: 'Izoh', qiymat: izoh }, filialQatori(k, schoolId),
    ],
    ogohlantirish: [toifa === 'Ish haqi' ? "Xodim oyligini «oylik berish» orqali kiritsangiz, xodim kartasida ham ko'rinadi" : null, "Xarajatni kiritilgandan keyin 15 daqiqa ichida o'chirish mumkin"],
    sorovlar: [{ usul: 'POST', yol: '/api/expenses', nom: 'Xarajat', body: { schoolId, amount: summa, category: toifa, date: sana, description: izoh || null, method: usul } }],
    tugma: "Xarajatni qo'shish", natija: "Xarajat qo'shildi", havola: '/finance',
    model: { summa, toifa, usul, sana },
  });
}

async function xarajatOchirish(k, a) {
  const id = butun(a.xarajatId);
  if (!id) xato("Xarajat id si kerak — xarajatlar vositasidan");
  const x = await prisma.expense.findFirst({ where: { id, schoolId: { in: k.maktablar } } });
  if (!x) xato('Xarajat topilmadi');
  if (ochirishQoldi(x.createdAt) <= 0) xato("Xarajat faqat kiritilgandan keyin 15 daqiqa ichida o'chiriladi");
  const oylik = await prisma.salaryPayment.findFirst({ where: { expenseId: id }, select: { id: true } });
  if (oylik) xato("Bu xodim oyligi — uni Xodimlar bo'limidagi oylik yozuvidan o'chiring");
  return karta(k, {
    tur: 'xarajat_ochirish', sarlavha: "Xarajatni o'chirish", xavfli: true,
    maydonlar: [{ nom: 'Summa', qiymat: `${som(x.amount)} so'm` }, { nom: 'Toifa', qiymat: x.category }, { nom: 'Sana', qiymat: sanaMatni(x.date) }, x.description && { nom: 'Izoh', qiymat: x.description }],
    sorovlar: [{ usul: 'DELETE', yol: `/api/expenses/${x.id}`, nom: 'Xarajat' }],
    tugma: "Ha, o'chirish", natija: "Xarajat o'chirildi", havola: '/finance',
    model: { xarajat: x.id },
  });
}

// ---------------------------------------------------------------------------
// Xabarlar
// ---------------------------------------------------------------------------

async function qarzEslatmasi(k, a) {
  let talabalar;
  if (berilganmi(a.oquvchilar)) {
    talabalar = [];
    for (const nom of royxatOl(a.oquvchilar).slice(0, 50)) talabalar.push(await oquvchiniTop(k, nom));
  } else {
    const sozl = await qarzSozlamasi(k.maktablar[0]);
    const engKam = berilganmi(a.eng_kam) ? summaOl(a.eng_kam) : (sozl?.sozlama?.minQarz ?? 0);
    const where = oquvchiWhere(k, { status: 'Faol', balance: { lt: -Math.max(0.5, Number(engKam) || 0) } });
    if (berilganmi(a.kurs)) { const g = await kursniTop(k, a.kurs); where.groups = { some: { id: g.id } }; }
    talabalar = await prisma.student.findMany({ where, select: OQ_SELECT, orderBy: { balance: 'asc' }, take: 300 });
  }
  talabalar = talabalar.filter(s => s.balance < -0.5);
  if (!talabalar.length) xato('Eslatma yuboriladigan qarzdor topilmadi');
  const sozl = await qarzSozlamasi(talabalar[0].schoolId);
  const kanal = sozl?.sozlama?.kanal || 'BOTH';
  const jami = talabalar.reduce((n, s) => n - s.balance, 0);
  return karta(k, {
    tur: 'qarz_eslatmasi', sarlavha: 'Qarz eslatmasi yuborish',
    maydonlar: [
      { nom: "O'quvchilar", qiymat: `${talabalar.length} ta` },
      { nom: 'Jami qarz', qiymat: `${som(jami)} so'm` },
      { nom: 'Kanal', qiymat: KANAL_NOMI[kanal] || kanal },
      { nom: 'Kimga', qiymat: 'ota-onasiga (sozlamadagi shablon bilan)' },
    ],
    royxat: [{ sarlavha: "Ro'yxat", qatorlar: talabalar.slice(0, 30).map(s => `${korinishIsmi(s.name)} — ${som(-s.balance)}`), yana: Math.max(0, talabalar.length - 30) }],
    ogohlantirish: [
      "Oxirgi 10 daqiqada eslatma olganlarga takror ketmaydi",
      kanal !== 'TELEGRAM' ? "Telegram'i yo'qlarga SMS ketadi — SMS pullik" : null,
      "Qarz CRM dagi balansdan — ro'yxatni tekshirib yuboring",
    ],
    sorovlar: [{ usul: 'POST', yol: '/api/qarz-xabari/yubor', nom: 'Qarz eslatmasi', body: { studentIds: talabalar.map(s => s.id) } }],
    tugma: `${talabalar.length} ta eslatma yuborish`, natija: 'Eslatmalar navbatga qo\'yildi', havola: '/messaging',
    model: { soni: talabalar.length, jami_qarz: Math.round(jami), kanal },
  });
}

async function xabarYuborish(k, a) {
  const matn = String(a.matn ?? '').trim();
  if (matn.length < 3) xato('Xabar matnini so\'rang');
  if (matn.length > 1000) xato('Matn juda uzun (1000 belgigacha)');
  const kanal = kanalOl(a.kanal, 'TELEGRAM');
  const kimga = kimgaOl(a.kimga);
  const kim = izlashKaliti(a.kimlarga);
  let talabalar;
  let tavsif;
  if (berilganmi(a.oquvchilar)) {
    talabalar = [];
    for (const nom of royxatOl(a.oquvchilar).slice(0, 50)) talabalar.push(await oquvchiniTop(k, nom));
    tavsif = `${talabalar.length} ta tanlangan o'quvchi`;
  } else if (berilganmi(a.kurs)) {
    const g = await kursniTop(k, a.kurs);
    talabalar = await prisma.student.findMany({ where: oquvchiWhere(k, { groups: { some: { id: g.id } } }), select: OQ_SELECT });
    tavsif = `${g.name} kursi`;
  } else if (/qarzdor/.test(kim)) {
    talabalar = await prisma.student.findMany({ where: oquvchiWhere(k, { status: 'Faol', balance: { lt: -0.5 } }), select: OQ_SELECT });
    tavsif = 'qarzdorlar';
  } else if (/hamma|barcha|all|faol/.test(kim)) {
    talabalar = await prisma.student.findMany({ where: oquvchiWhere(k, { status: { in: ['Faol', 'Sinov'] } }), select: OQ_SELECT });
    tavsif = "barcha o'qiyotgan o'quvchilar";
  } else xato("Kimlarga yuborilsin: o'quvchilar ismi, kurs, qarzdorlar yoki hammaga");
  // Xabarlar sahifasidagi yuborish xodimning o'z filiali o'quvchilariga ishlaydi.
  const ozi = talabalar.filter(s => s.schoolId === k.user.schoolId);
  const ogoh = [];
  if (ozi.length < talabalar.length) ogoh.push(`${talabalar.length - ozi.length} ta boshqa filial o'quvchisi — ularga bu yerdan yuborilmaydi`);
  if (!ozi.length) xato("Xabar faqat o'z filialingiz o'quvchilariga yuboriladi");
  if (kanal !== 'TELEGRAM') ogoh.push(`SMS pullik (~${ozi.length} ta). Eskiz tasdiqlagan shablonga mos bo'lmasa yetib bormasligi mumkin — Telegram bepul`);
  const ids = ozi.map(s => s.id);
  return karta(k, {
    tur: 'xabar_yuborish', sarlavha: 'Xabar yuborish', xavfli: kanal !== 'TELEGRAM',
    maydonlar: [
      { nom: 'Kimlarga', qiymat: `${tavsif} — ${ozi.length} ta, ${KIMGA_NOMI[kimga]}` },
      { nom: 'Kanal', qiymat: KANAL_NOMI[kanal] },
      { nom: 'Matn', qiymat: matn },
    ],
    royxat: [{ sarlavha: 'Qabul qiluvchilar', qatorlar: ozi.slice(0, 20).map(s => korinishIsmi(s.name)), yana: Math.max(0, ozi.length - 20) }],
    ogohlantirish: [...ogoh, /\{[a-z_]+\}/.test(matn) ? "{ism}, {qarz}, {kurs} kabi o'rinlarga har kimning o'z ma'lumoti qo'yiladi" : null],
    sorovlar: [{ usul: 'POST', yol: '/api/messaging/send-batch', nom: 'Xabar', body: { studentIds: ids, sendList: ids.map(id => ({ studentId: id, recipientTo: kimga })), audience: 'STUDENTS', message: matn, channel: kanal, recipientTo: kimga, filters: { manba: 'zukko', tavsif } } }],
    tugma: `${ozi.length} ta xabar yuborish`, natija: 'Xabarlar yuborildi', havola: '/messaging',
    model: { soni: ozi.length, kanal, kimga },
  });
}

// ---------------------------------------------------------------------------
// Xodimlar va sozlamalar
// ---------------------------------------------------------------------------

async function xodimDavomati(k, a) {
  const x = await xodimniTop(k, a.xodim);
  const sana = sanaOl(a.sana) || k.bugun;
  if (sana > k.bugun) xato('Sana kelajakda');
  const q = izlashKaliti(a.holat);
  const holat = /olib|bekor|ochir|tozal/.test(q) ? null : /kelma|yoq|absent/.test(q) ? 'Kelmadi' : /sabab|uzr|kasal|ruxsat/.test(q) ? 'Sababli' : 'Keldi';
  const bor = await prisma.staffAttendance.findUnique({ where: { userId_date: { userId: x.id, date: sana } }, select: { status: true } });
  if (holat === null) {
    if (!bor) xato('Bu kunga belgi yo\'q');
    return karta(k, {
      tur: 'xodim_davomati', sarlavha: 'Xodim davomati belgisini olib tashlash',
      maydonlar: [{ nom: 'Xodim', qiymat: korinishIsmi(x.name) }, { nom: 'Sana', qiymat: sanaMatni(sana) }, { nom: 'Belgi', eski: bor.status, qiymat: '—' }],
      sorovlar: [{ usul: 'DELETE', yol: `/api/staff-attendance?userId=${x.id}&date=${sana}`, nom: 'Davomat' }],
      tugma: 'Olib tashlash', natija: 'Belgi olib tashlandi', havola: `/hr/${x.id}`, model: { xodim: korinishIsmi(x.name), sana },
    });
  }
  if (bor?.status === holat) xato(`${korinishIsmi(x.name)} ${sanaMatni(sana)} kuni allaqachon «${holat}»`);
  return karta(k, {
    tur: 'xodim_davomati', sarlavha: 'Xodim davomati',
    maydonlar: [{ nom: 'Xodim', qiymat: `${korinishIsmi(x.name)}${x.position ? ` · ${x.position}` : ''}` }, { nom: 'Sana', qiymat: sanaMatni(sana) }, { nom: 'Belgi', eski: bor?.status || '—', qiymat: holat }],
    sorovlar: [{ usul: 'POST', yol: '/api/staff-attendance', nom: 'Davomat', body: { userId: x.id, date: sana, status: holat } }],
    tugma: 'Belgilash', natija: 'Belgilandi', havola: `/hr/${x.id}`,
    model: { xodim: korinishIsmi(x.name), sana, holat },
  });
}

async function oylikBerish(k, a) {
  const x = await xodimniTop(k, a.xodim);
  const oy = /^\d{4}-\d{2}$/.test(String(a.oy || '')) ? String(a.oy) : k.bugun.slice(0, 7);
  const bonus = berilganmi(a.bonus) ? summaOl(a.bonus) : 0;
  const ushlanma = berilganmi(a.ushlanma) ? summaOl(a.ushlanma) : 0;
  if (!Number.isFinite(bonus) || !Number.isFinite(ushlanma) || bonus < 0 || ushlanma < 0) xato("Bonus yoki ushlanma noto'g'ri");
  let summa = berilganmi(a.summa) ? summaOl(a.summa) : NaN;
  if (!Number.isFinite(summa)) {
    if (!x.salary) xato("Beriladigan summani so'rang (xodim kartasida oylik yozilmagan)");
    summa = x.salary + bonus - ushlanma;
  }
  if (summa <= 0) xato("Summa noto'g'ri");
  const bor = await prisma.salaryPayment.findUnique({ where: { userId_month: { userId: x.id, month: oy } }, select: { amount: true } });
  if (bor) xato(`${korinishIsmi(x.name)}ga ${oyNomi(oy)} oyligi allaqachon berilgan (${som(bor.amount)} so'm). Tuzatish — Xodimlar sahifasida`);
  const izoh = matnOl(a.izoh, 200);
  return karta(k, {
    tur: 'oylik_berish', sarlavha: 'Oylik berish',
    maydonlar: [
      { nom: 'Xodim', qiymat: `${korinishIsmi(x.name)}${x.position ? ` · ${x.position}` : ''}` },
      { nom: 'Oy', qiymat: oyNomi(oy) },
      x.salary ? { nom: 'Belgilangan oylik', qiymat: `${som(x.salary)} so'm` } : null,
      bonus ? { nom: 'Bonus', qiymat: `+${som(bonus)}` } : null,
      ushlanma ? { nom: 'Ushlanma', qiymat: `−${som(ushlanma)}` } : null,
      { nom: 'Beriladi', qiymat: `${som(summa)} so'm` },
      izoh && { nom: 'Izoh', qiymat: izoh },
    ],
    ogohlantirish: ["Xarajatlarga «Ish haqi» bo'lib yoziladi, xodimga Telegram xabar ketadi"],
    sorovlar: [{ usul: 'POST', yol: '/api/salary-payments', nom: 'Oylik', body: { userId: x.id, month: oy, amount: summa, baseSalary: x.salary || 0, bonuses: bonus, fines: ushlanma, note: izoh || null } }],
    tugma: 'Oylikni berish', natija: 'Oylik berildi', havola: `/hr/${x.id}`,
    model: { xodim: korinishIsmi(x.name), oy, summa },
  });
}

async function xonaQoshish(k, a) {
  const schoolId = maqsadFilial(k, a.filial);
  const nom = matnOl(a.nom, 60);
  if (nom.length < 1) xato('Xona nomini ayting');
  const sigim = Math.round(Number(a.sigim));
  if (!Number.isFinite(sigim) || sigim <= 0) xato("Xona sig'imini (o'rinlar sonini) ayting");
  const bor = await prisma.room.findFirst({ where: { schoolId, name: { equals: nom, mode: 'insensitive' } }, select: { id: true } });
  if (bor) xato(`«${nom}» xonasi allaqachon bor`);
  return karta(k, {
    tur: 'xona_qoshish', sarlavha: "Yangi xona",
    maydonlar: [{ nom: 'Xona', qiymat: nom }, { nom: "Sig'imi", qiymat: `${sigim} o'rin` }, filialQatori(k, schoolId)],
    sorovlar: [{ usul: 'POST', yol: '/api/rooms', nom: 'Xona', body: { schoolId, name: nom, capacity: sigim } }],
    tugma: "Xonani qo'shish", natija: "Xona qo'shildi", havola: '/settings',
    model: { xona: nom, sigim },
  });
}

async function xonaTahrirlash(k, a) {
  const x = await xonaniTop(k, a.xona, k.maktablar);
  const body = { schoolId: x.schoolId };
  const maydonlar = [{ nom: 'Xona', qiymat: x.name }];
  if (berilganmi(a.nom)) { const n = matnOl(a.nom, 60); if (n && n !== x.name) { body.name = n; maydonlar.push({ nom: 'Nomi', eski: x.name, qiymat: n }); } }
  if (berilganmi(a.sigim)) { const n = Math.round(Number(a.sigim)); if (!Number.isFinite(n) || n <= 0) xato("Sig'im noto'g'ri"); if (n !== x.capacity) { body.capacity = n; maydonlar.push({ nom: "Sig'imi", eski: String(x.capacity), qiymat: String(n) }); } }
  if (Object.keys(body).length === 1) xato("O'zgarish yo'q");
  return karta(k, {
    tur: 'xona_tahrirlash', sarlavha: `Xonani o'zgartirish: ${x.name}`, maydonlar,
    sorovlar: [{ usul: 'PUT', yol: `/api/rooms/${x.id}`, body, nom: 'Xona' }],
    tugma: 'Saqlash', natija: 'Xona saqlandi', havola: '/settings',
    model: { xona: x.name },
  });
}

// ---------------------------------------------------------------------------
// Imtihon savollari — fayldan bankka va imtihonga
//
// Egasi (2026-09-30): "zukkoga fayl tashlasam, imtihonlarga shu fayldagi
// savollarni qo'shib ber desam". Ajratish, tekshirish va ko'rib chiqish —
// Imtihonlar → Savollar banki dagi "Savol qo'shish" oynasining o'zi
// (src/components/imtihon/bank/SavolYuklash.tsx): Zukko uni fan tanlangan,
// fayllar yuklangan holda ochadi. Saqlangandan keyin faol savollar imtihonga
// "tanlangan savollar" qoidasi bo'lib qo'shiladi (imtihon tuzishdagi kabi).
// ---------------------------------------------------------------------------

async function imtihonniTop(k, v) {
  const soz = String(v ?? '').trim();
  if (!soz) xato("Imtihon ko'rsatilmagan");
  const rows = await prisma.exam.findMany({
    where: { OR: [{ schoolId: { in: k.maktablar } }, { branchIds: { hasSome: k.maktablar } }] },
    select: { id: true, name: true, date: true, status: true, lockedAt: true, blocks: true, scoring: true, settings: true, schoolId: true, totalQuestions: true, maxScore: true },
    orderBy: { id: 'desc' },
    take: 300,
  });
  return nomdanTanla(rows, soz, e => e.name, 'imtihon');
}

/** Ball: 104.5 → «104,5» (yaxlitlash xatosi ko'rinmasin). */
const ballMatni = (n) => String(Math.round(Number(n) * 100) / 100).replace('.', ',');

/** Imtihonga savol qo'shsa bo'ladimi: qulflanmagan va savollar bankdan olinadi. */
function imtihonOchiqmi(e) {
  if (e.lockedAt) xato(`«${e.name}» qulflangan (${e.status}) — unga savol qo'shib bo'lmaydi. Savollarni bankka qo'shish mumkin.`);
  if (imtihonSozlamasi(e.settings).source === 'kalit') xato(`«${e.name}» «faqat kalit» rejimida — savollar bankdan olinmaydi`);
}

async function savolYuklash(k, a) {
  const orgIds = await organizationSchoolIds(k.user);
  const fanlar = await prisma.questionSubject.findMany({
    where: { schoolId: { in: orgIds } },
    select: { id: true, name: true, topics: { select: { id: true, name: true } } },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
  let imtihon = null;
  if (berilganmi(a.imtihon)) {
    if (!kerak(k, 'imtihonlar.imtihon')) xato("Imtihonni o'zgartirishga ruxsatingiz yo'q — savollarni faqat bankka qo'shish mumkin");
    imtihon = await imtihonniTop(k, a.imtihon);
    imtihonOchiqmi(imtihon);
  }
  let fan = null;
  if (berilganmi(a.fan)) {
    if (!fanlar.length) xato("Savollar bankida hali fan yo'q — Imtihonlar → Savollar banki'da fan qo'shing");
    fan = nomdanTanla(fanlar, String(a.fan).trim(), f => f.name, 'fan');
  } else if (imtihon) {
    const bloklar = Array.isArray(imtihon.blocks) ? imtihon.blocks : [];
    if (bloklar.length === 1) fan = fanlar.find(f => f.id === bloklar[0].fanId) || fanlar.find(f => izlashKaliti(f.name) === izlashKaliti(bloklar[0].subject)) || null;
    if (!fan) xato(`Qaysi fan? «${imtihon.name}» da: ${bloklar.map(b => b.subject).join(', ') || "fan yo'q"}`);
  } else {
    xato(`Qaysi fan? Bankdagi fanlar: ${fanlar.map(f => f.name).join(', ') || "yo'q"}`);
  }
  const mavzu = berilganmi(a.mavzu) ? fan.topics.find(t => kursKaliti(t.name) === kursKaliti(a.mavzu)) || null : null;
  return karta(k, {
    tur: 'savol_yuklash', sarlavha: 'Fayldagi savollarni bankka qo\'shish',
    maydonlar: [
      { nom: 'Fan', qiymat: fan.name },
      { nom: 'Mavzu', qiymat: mavzu?.name || "AI har savolni fan mavzulariga o'zi ajratadi" },
      imtihon && { nom: 'Imtihon', qiymat: `${imtihon.name} · ${sanaOl(imtihon.date) ? sanaMatni(imtihon.date) : imtihon.date} · hozir ${imtihon.totalQuestions} ta savol` },
      {
        nom: 'Jarayon',
        qiymat: `AI savollarni ajratadi, javoblarini qayta yechib tekshiradi → natijani ko'rib, o'zingiz saqlaysiz${imtihon ? " → faol savollarni imtihonga qo'shishni alohida tasdiqlaysiz" : ''}`,
      },
    ],
    ogohlantirish: [
      berilganmi(a.mavzu) && !mavzu ? `«${a.mavzu}» mavzusi bankda yo'q — AI mavzularga o'zi ajratadi` : null,
    ],
    sorovlar: [],
    maxsus: { tur: 'savol_yuklash', fanId: fan.id, fanNomi: fan.name, mavzuId: mavzu?.id ?? null, imtihon: imtihon ? { id: imtihon.id, nom: imtihon.name } : null },
    tugma: 'Savollarni ajratish', natija: "Savollar bankka qo'shildi", havola: '/exams?tab=savollar',
    model: { fan: fan.name, mavzu: mavzu?.name || null, imtihon: imtihon?.name || null },
  });
}

async function imtihongaSavolQoshish(k, a) {
  const imtihon = await imtihonniTop(k, a.imtihon);
  imtihonOchiqmi(imtihon);
  const idlar = [...new Set((Array.isArray(a.savolIdlar) ? a.savolIdlar : royxatOl(a.savolIdlar)).map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 600);
  if (!idlar.length) xato("Qaysi savollar? Savol id lari kerak");
  const orgIds = await organizationSchoolIds(k.user);
  const savollar = await prisma.question.findMany({
    where: { id: { in: idlar }, schoolId: { in: orgIds } },
    select: { id: true, status: true, type: true, subject: true, bankTopic: { select: { subjectId: true } } },
  });
  const faol = savollar.filter(q => q.status === 'faol');
  const qoralama = savollar.length - faol.length;
  if (!faol.length) xato(qoralama ? `${qoralama} ta savol hali qoralama — bankda tekshirib faol qiling, keyin imtihonga qo'shiladi` : 'Savollar topilmadi');
  const bloklar = JSON.parse(JSON.stringify(Array.isArray(imtihon.blocks) ? imtihon.blocks : []));
  const bor = new Set(bloklar.flatMap(b => (b.topicRules || []).flatMap(r => (Array.isArray(r.questionIds) ? r.questionIds : []))));
  const yangi = faol.filter(q => !bor.has(q.id));
  if (!yangi.length) xato('Bu savollar imtihonda allaqachon bor');

  // Fan bo'yicha: imtihonning shu fan bloki (bo'lmasa yangi blok), turi bo'yicha
  // "tanlangan savollar" qoidasi — imtihon tuzishdagi qo'lda tanlash bilan bir xil.
  const fanIdlari = [...new Set(yangi.map(q => q.bankTopic?.subjectId).filter(Boolean))];
  const fanNomlari = new Map((fanIdlari.length ? await prisma.questionSubject.findMany({ where: { id: { in: fanIdlari } }, select: { id: true, name: true } }) : []).map(f => [f.id, f.name]));
  const guruhlar = new Map();
  for (const q of yangi) {
    const fanId = q.bankTopic?.subjectId ?? null;
    const nom = (fanId && fanNomlari.get(fanId)) || q.subject || 'Fan';
    const kalit = fanId ? `f${fanId}` : `n${izlashKaliti(nom)}`;
    if (!guruhlar.has(kalit)) guruhlar.set(kalit, { fanId, nom, savollar: [] });
    guruhlar.get(kalit).savollar.push(q);
  }
  const eski = varaqTuzilmasi(bloklar, imtihon.scoring);
  const qatorlar = [];
  for (const g of guruhlar.values()) {
    let blok = bloklar.find(b => (g.fanId && b.fanId === g.fanId) || izlashKaliti(b.subject) === izlashKaliti(g.nom));
    const yangiBlok = !blok;
    if (!blok) {
      blok = { id: `b${Date.now().toString(36)}${bloklar.length}`, subject: g.nom, ...(g.fanId ? { fanId: g.fanId } : {}), pointsPerQuestion: bloklar[0]?.pointsPerQuestion ?? 1, topicRules: [] };
      bloklar.push(blok);
    }
    blok.topicRules = Array.isArray(blok.topicRules) ? blok.topicRules : [];
    const turlar = { yopiq: [], raqamli: [], yozma: [] };
    for (const q of g.savollar) (turlar[q.type] || turlar.yopiq).push(q.id);
    for (const [tur, ids] of Object.entries(turlar)) {
      const qoldi = [...ids];
      let qoida = blok.topicRules.find(r => Array.isArray(r.questionIds) && r.questionIds.length && (r.type || 'yopiq') === tur && r.questionIds.length < 300);
      while (qoldi.length) {
        if (!qoida) { qoida = { topic: '', type: tur, count: 0, questionIds: [] }; blok.topicRules.push(qoida); }
        qoida.questionIds.push(...qoldi.splice(0, 300 - qoida.questionIds.length));
        qoida.count = qoida.questionIds.length;
        qoida = null;
      }
    }
    const tarkib = Object.entries(turlar).filter(([, l]) => l.length).map(([t, l]) => `${t} ${l.length}`).join(', ');
    qatorlar.push(`${g.nom}${yangiBlok ? ' — yangi blok' : ''}: +${g.savollar.length} ta (${tarkib})`);
  }
  const keyin = varaqTuzilmasi(bloklar, imtihon.scoring);
  return karta(k, {
    tur: 'imtihonga_savol_qoshish', sarlavha: `Imtihonga qo'shish: ${imtihon.name}`,
    maydonlar: [
      { nom: 'Imtihon', qiymat: `${imtihon.name} · ${sanaOl(imtihon.date) ? sanaMatni(imtihon.date) : imtihon.date}` },
      { nom: 'Savollar', eski: String(eski.jami), qiymat: String(keyin.jami) },
      keyin.maks !== eski.maks ? { nom: 'Eng yuqori ball', eski: ballMatni(eski.maks), qiymat: ballMatni(keyin.maks) } : null,
    ],
    royxat: [{ sarlavha: 'Tanlangan savollar sifatida (har variantga tushadi)', qatorlar }],
    ogohlantirish: [
      qoralama ? `${qoralama} ta savol qoralama — bankda faol qilinmaguncha imtihonga qo'shilmaydi` : null,
      faol.length - yangi.length ? `${faol.length - yangi.length} tasi imtihonda allaqachon bor` : null,
    ],
    sorovlar: [{ usul: 'PUT', yol: `/api/exams/${imtihon.id}`, nom: 'Imtihon', body: { schoolId: imtihon.schoolId, blocks: bloklar } }],
    tugma: `${yangi.length} ta savolni qo'shish`, natija: "Savollar imtihonga qo'shildi", havola: `/exams/${imtihon.id}`,
    model: { imtihon: imtihon.name, qoshiladi: yangi.length, qoralama, jami_keyin: keyin.jami },
  });
}

// ---------------------------------------------------------------------------
// Katalog — AI ga (ruxsatga qarab) shu ro'yxat beriladi.
// ruxsat: [[bo'lim, daraja], ...] — biri yetarli; 'admin' — faqat administrator.
// Har amalning ruxsati o'zi chaqiradigan API yo'li qoidasi bilan bir xil
// (lib/ruxsatApi.js) — AI ko'rsatgan kartochka tasdiqlanganda 403 bermasin.
// ---------------------------------------------------------------------------

const S = (d) => ({ type: 'string', description: d });
const N = (d) => ({ type: 'number', description: d });
const B = (d) => ({ type: 'boolean', description: d });
const L = (d) => ({ type: 'array', items: { type: 'string' }, description: d });
const OQUVCHI = S("O'quvchi: ism-familiya, telefon, 5 xonali ID yoki id");
const KURS = S('Kurs nomi yoki id (masalan «Matematika-4»)');
const SANA = S('Sana YYYY-MM-DD (berilmasa — bugun)');
const SHU_OY = S("Shu oy hisobi: «o'zgarmaydi» (standart), «kelgan darslar uchun», «olinmasin» yoki summa");
const obj = (properties, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });

export const AMALLAR = [
  // To'lovlar
  { nom: 'tolov_qabul', guruh: "To'lovlar", misol: "Aliyev Validan 300 000 naqd to'lov qabul qil", ruxsat: [['oquvchilar.tolov', 2]],
    tavsif: "O'quvchidan to'lov qabul qilish (Naqd, Karta, O'tkazma, Klik). Pul balansga tushadi, ota-onaga to'lov xabari ketadi. Klik'ni administrator bo'lmagan xodim kiritsa — chek vaqti bilan administrator tasdig'iga boradi.",
    parametrlar: obj({ oquvchi: OQUVCHI, summa: N("So'm"), tur: S("Naqd (standart), Karta, O'tkazma yoki Klik"), sana: SANA, chek_vaqti: S('Klik chekidagi vaqt, masalan 14:32'), izoh: S('Izoh') }, ['oquvchi', 'summa']),
    tayyorla: tolovQabul, qadam: "To'lov kartochkasi tayyorlanmoqda" },
  { nom: 'tolov_tuzatish', guruh: "To'lovlar", misol: "#1234 to'lovni 250 000 ga tuzat", ruxsat: [['oquvchilar.tolovTuzatish', 2]],
    tavsif: "Kiritilgan to'lovni tuzatish: summa, tur, sana yoki izoh. Administrator bo'lmasa — faqat kiritilgandan keyin 10 daqiqa ichida. tolovId — «tolovlar» vositasidan.",
    parametrlar: obj({ tolovId: N("To'lov id"), summa: N('Yangi summa'), tur: S('Yangi tur'), sana: SANA, izoh: S('Yangi izoh') }, ['tolovId']),
    tayyorla: tolovTuzatish, qadam: "To'lov tuzatish kartochkasi" },
  { nom: 'tolov_ochirish', guruh: "To'lovlar", misol: "Oxirgi xato to'lovni o'chir", ruxsat: [['oquvchilar.tolovTuzatish', 2]],
    tavsif: "To'lovni o'chirish (balans qaytadi). Administrator bo'lmasa — 10 daqiqa ichida. tolovId — «tolovlar» dan.",
    parametrlar: obj({ tolovId: N("To'lov id") }, ['tolovId']),
    tayyorla: tolovOchirish, qadam: "O'chirish kartochkasi tayyorlanmoqda" },
  { nom: 'klik_qaror', guruh: "To'lovlar", misol: "Kutayotgan Klik to'lovlarini tasdiqla", ruxsat: 'admin',
    tavsif: "Klik to'lovini tasdiqlash yoki rad etish (faqat administrator). tasdiqId — «klik_kutayotganlar» dan.",
    parametrlar: obj({ tasdiqId: N('Tasdiq id'), qaror: S('tasdiqlash yoki rad'), sabab: S('Rad sababi: Pul kelmagan, Summa boshqa, Takroriy chek') }, ['tasdiqId', 'qaror']),
    tayyorla: klikQaror, qadam: 'Klik kartochkasi tayyorlanmoqda' },

  // O'quvchilar
  { nom: 'oquvchi_qoshish', guruh: "O'quvchilar", misol: "Yangi o'quvchi: Karimov Aziz, 90 123 45 67, Matematika-4 kursiga", ruxsat: [['oquvchilar.royxat', 2]],
    tavsif: "Yangi o'quvchi qo'shish; kurslar berilsa — kursga ham qo'shiladi (Faol bo'lsa birinchi oy hisobi yoziladi, Sinovda — yo'q).",
    parametrlar: obj({
      ism: S('Familiya va ism'), telefon: S("O'quvchi telefoni"), tugilgan_sana: S('YYYY-MM-DD'), manzil: S('Manzil'), jinsi: S('Erkak yoki Ayol'),
      ota_ismi: S('Otasi'), ota_telefon: S('Otasining telefoni'), ona_ismi: S('Onasi'), ona_telefon: S('Onasining telefoni'),
      holat: S('Faol (standart) yoki Sinov'), kurslar: L('Kurs nomlari'), kelgan_sana: S('Kursga kelgan sana (standart bugun)'),
      maktab: S('Maktabi'), sinf: S('Sinfi'), izoh: S('Izoh'), filial: S('Filial (bir nechta filial bo\'lsa)'),
    }, ['ism']),
    tayyorla: oquvchiQoshish, qadam: "O'quvchi kartochkasi tayyorlanmoqda" },
  { nom: 'oquvchi_tahrirlash', guruh: "O'quvchilar", misol: "Aliyev Valining otasining telefonini 91 555 44 33 ga o'zgartir", ruxsat: [['oquvchilar.royxat', 2]],
    tavsif: "O'quvchi ma'lumotini o'zgartirish: ism, telefon, tug'ilgan sana, manzil, jinsi, ota-ona ismi va telefoni, maktab, sinf, transport. Faqat berilgan maydonlar o'zgaradi.",
    parametrlar: obj({
      oquvchi: OQUVCHI, ism: S('Yangi ism'), telefon: S('Telefon'), tugilgan_sana: S('YYYY-MM-DD'), manzil: S('Manzil'), jinsi: S('Erkak/Ayol'),
      ota_ismi: S('Otasi'), ota_telefon: S('Otasining telefoni'), ona_ismi: S('Onasi'), ona_telefon: S('Onasining telefoni'),
      maktab: S('Maktab'), sinf: S('Sinf'), transport: B('Transportda qatnaydimi'),
    }, ['oquvchi']),
    tayyorla: oquvchiTahrirlash, qadam: "Tahrir kartochkasi tayyorlanmoqda" },
  { nom: 'oquvchi_izoh', guruh: "O'quvchilar", misol: "Aliyev Valining izohiga yoz: onasi 5-oktabrda to'laydi", ruxsat: [['oquvchilar.royxat', 2]],
    tavsif: "O'quvchi izohiga bugungi sana bilan yangi qator qo'shish.",
    parametrlar: obj({ oquvchi: OQUVCHI, izoh: S('Izoh matni') }, ['oquvchi', 'izoh']),
    tayyorla: oquvchiIzoh, qadam: 'Izoh kartochkasi tayyorlanmoqda' },
  { nom: 'oquvchi_holati', guruh: "O'quvchilar", misol: "Aliyev Valini Passiv qil, shu oy kelgan darslari uchun olinsin", ruxsat: [['oquvchilar.royxat', 2]],
    tavsif: "O'quvchi holatini o'zgartirish: Faol, Sinov, Passiv, Muzlatilgan, Arxiv, Bitiruvchi, Sertifikatli. O'qimaydigan holatga o'tsa — barcha kurslaridan chiqadi (shu oy hisobini tanlash mumkin). Sinov→Faol — shu kundan hisob boshlanadi. Arxivlash ham shu yerda.",
    parametrlar: obj({ oquvchi: OQUVCHI, holat: S('Yangi holat'), sabab: S('Ketish sababi'), shu_oy: SHU_OY, sana: SANA }, ['oquvchi', 'holat']),
    tayyorla: oquvchiHolati, qadam: 'Holat kartochkasi tayyorlanmoqda' },
  { nom: 'kursga_qoshish', guruh: "O'quvchilar", misol: "Aliyev Valini Fizika-2 kursiga qo'sh", ruxsat: [['kurslar.tarkib', 2]],
    tavsif: "Mavjud o'quvchini kursga qo'shish. Faol bo'lsa kelgan sanadan oy oxirigacha birinchi oy hisobi yoziladi (summani qo'lda berish mumkin).",
    parametrlar: obj({ oquvchi: OQUVCHI, kurs: KURS, kelgan_sana: S('Kursga kelgan sana (standart bugun)'), birinchi_oy: N("Birinchi oy summasi (qo'lda)") }, ['oquvchi', 'kurs']),
    tayyorla: kursgaQoshish, qadam: 'Kursga qo\'shish kartochkasi' },
  { nom: 'kursdan_chiqarish', guruh: "O'quvchilar", misol: "Aliyev Valini Matematika-4 dan chiqar, shu oy hisobi o'zgarmasin", ruxsat: [['kurslar.tarkib', 2]],
    tavsif: "O'quvchini kursdan (yoki «hammasi» — barcha kurslaridan) chiqarish; shu oy hisobini tanlash mumkin. Holat o'zgarmaydi — umuman ketgan bo'lsa oquvchi_holati.",
    parametrlar: obj({ oquvchi: OQUVCHI, kurs: S('Kurs nomi yoki «hammasi»'), shu_oy: SHU_OY, sana: SANA }, ['oquvchi']),
    tayyorla: kursdanChiqarish, qadam: 'Kursdan chiqarish kartochkasi' },
  { nom: 'kursga_kochirish', guruh: "O'quvchilar", misol: "Aliyev Valini Matematika-4 dan Matematika-5 ga ko'chir", ruxsat: [['oquvchilar.kochirish', 2]],
    tavsif: "O'quvchini bir kursdan boshqasiga ko'chirish (pul o'zgarmaydi).",
    parametrlar: obj({ oquvchi: OQUVCHI, yangi_kurs: KURS, eski_kurs: S('Qaysi kursdan (bir nechta kursda bo\'lsa)'), sana: SANA }, ['oquvchi', 'yangi_kurs']),
    tayyorla: kursgaKochirish, qadam: "Ko'chirish kartochkasi" },
  { nom: 'kurs_hisobi', guruh: "O'quvchilar", misol: "Aliyev Valining Matematika-4 dagi kelgan sanasi 15-sentabr, birinchi oy 300 000", ruxsat: [['oquvchilar.kursHisobi', 2]],
    tavsif: "O'quvchining kursdagi hisobi: kursga kelgan sana, alohida oylik narx, birinchi oy summasi. Oylar qayta sanaladi, farqi balansga tushadi.",
    parametrlar: obj({ oquvchi: OQUVCHI, kurs: KURS, kelgan_sana: S('YYYY-MM-DD'), oylik_narx: S("Shu o'quvchi uchun oylik narx yoki «standart»"), birinchi_oy: S("Birinchi oy summasi yoki «hisoblangan»") }, ['oquvchi', 'kelgan_sana']),
    tayyorla: kursHisobi, qadam: 'Kurs hisobi hisoblanmoqda' },
  { nom: 'ball_qoyish', guruh: "O'quvchilar", misol: "Aliyev Valiga Matematika-4 dan bugun 5 ball qo'y", ruxsat: [['oquvchilar.ballar', 2]],
    tavsif: "O'quvchiga kurs bo'yicha ball (baho) qo'yish.",
    parametrlar: obj({ oquvchi: OQUVCHI, kurs: KURS, ball: N('Ball'), sana: SANA, izoh: S('Izoh') }, ['oquvchi', 'ball']),
    tayyorla: ballQoyish, qadam: 'Ball kartochkasi' },
  { nom: 'oquvchi_ochirish', guruh: "O'quvchilar", misol: "Xato qo'shilgan o'quvchini butunlay o'chir", ruxsat: [['oquvchilar.ochirish', 2]],
    tavsif: "O'quvchini butunlay o'chirish (to'lov va davomat tarixi bilan). Ko'p hollarda arxivlash (oquvchi_holati: Arxiv) to'g'ri — avval shuni taklif qiling.",
    parametrlar: obj({ oquvchi: OQUVCHI }, ['oquvchi']),
    tayyorla: oquvchiOchirish, qadam: "O'chirish kartochkasi" },

  // Kurslar
  { nom: 'yoqlama', guruh: 'Kurslar', misol: "Matematika-4 bugun: hamma keldi, Aliyev va Karimov kelmadi, ota-onaga xabar yubor", ruxsat: [['kurslar.davomat', 2]],
    tavsif: "Kursga yo'qlama qilish (bir kun): kelmaganlar, sababli, kechikkanlar, erta ketganlar ro'yxati; qolganlar — Keldi. Ixtiyoriy: ota-onalarga davomat xabari (holatiga mos shablon bilan).",
    parametrlar: obj({
      kurs: KURS, sana: SANA, kelmaganlar: L('Kelmaganlar ismi'), sababli: L('Sababli'), kechikkanlar: L('Kechikkanlar'), erta_ketganlar: L('Erta ketganlar'),
      kelganlar: L('Keldi (qolganlar kelmagan bo\'lsa)'), qolganlar: S('Qolganlar: Keldi (standart) yoki Kelmadi'), dars_bolmadi: B("Dars bo'lmadi"),
      ota_onaga_xabar: B('Ota-onalarga davomat xabari yuborilsinmi'), kanal: S('TELEGRAM, SMS yoki BOTH'),
    }, ['kurs']),
    tayyorla: yoqlama, qadam: "Yo'qlama kartochkasi tayyorlanmoqda" },
  { nom: 'kurs_ochish', guruh: 'Kurslar', misol: "Yangi kurs: Matematika-5, fan Matematika, ustoz Suvonqulov, toq kunlar 14:00-15:30, 2-xona", ruxsat: [['kurslar.malumot', 2]],
    tavsif: "Yangi kurs (o'quv guruhi) ochish: nom, fan, ustoz, kunlar (toq/juft/har kuni), vaqt, xona. Xona bandligi tekshiriladi.",
    parametrlar: obj({ nom: S('Kurs nomi'), fan: S('Fan'), ustoz: S('Ustoz'), ikkinchi_ustoz: S('Ikkinchi ustoz'), kunlar: S('toq, juft, har kuni yoki kun nomlari'), vaqt: S('14:00-15:30'), xona: S('Xona'), filial: S('Filial') }, ['nom', 'fan', 'ustoz', 'kunlar', 'vaqt']),
    tayyorla: kursOchish, qadam: 'Kurs kartochkasi tayyorlanmoqda' },
  { nom: 'kurs_tahrirlash', guruh: 'Kurslar', misol: "Fizika-1 kursini 3-xonaga, 15:00-17:00 ga o'tkaz", ruxsat: [['kurslar.malumot', 2]],
    tavsif: "Kursni o'zgartirish: nom, ustoz, ikkinchi ustoz («yo'q» — olib tashlash), kunlar, vaqt, xona.",
    parametrlar: obj({ kurs: KURS, nom: S('Yangi nom'), ustoz: S('Ustoz'), ikkinchi_ustoz: S("Ikkinchi ustoz yoki «yo'q»"), kunlar: S('Kunlar'), vaqt: S('Vaqt'), xona: S("Xona yoki «yo'q»") }, ['kurs']),
    tayyorla: kursTahrirlash, qadam: 'Kurs tahriri kartochkasi' },
  { nom: 'kurs_ochirish', guruh: 'Kurslar', misol: "DEMOKURS ni o'chir", ruxsat: [['kurslar.ochirish', 2]],
    tavsif: "Kursni butunlay o'chirish (davomati va baholari ham o'chadi).",
    parametrlar: obj({ kurs: KURS }, ['kurs']),
    tayyorla: kursOchirish, qadam: "O'chirish kartochkasi" },
  { nom: 'fan_qoshish', guruh: 'Kurslar', misol: "Yangi fan: Robototexnika, oyiga 400 000", ruxsat: [['kurslar.malumot', 2]],
    tavsif: "Yangi fan (predmet) qo'shish, ixtiyoriy oylik narx bilan.",
    parametrlar: obj({ nom: S('Fan nomi'), narx: N("Oylik narx, so'm"), filial: S('Filial') }, ['nom']),
    tayyorla: fanQoshish, qadam: 'Fan kartochkasi' },
  { nom: 'fan_tahrirlash', guruh: 'Kurslar', misol: "Matematika fanining narxini 550 000 qil", ruxsat: [['kurslar.malumot', 2]],
    tavsif: "Fan nomi yoki oylik narxini o'zgartirish (narx — keyingi hisoblarga ta'sir qiladi).",
    parametrlar: obj({ fan: S('Fan nomi yoki id'), nom: S('Yangi nom'), narx: N('Yangi oylik narx') }, ['fan']),
    tayyorla: fanTahrirlash, qadam: 'Fan tahriri kartochkasi' },

  // Lidlar
  { nom: 'lid_qoshish', guruh: 'Lidlar', misol: 'Yangi lid: Aziz Karimov, 90 123 45 67, matematika, Instagramdan', ruxsat: [['lidlar.royxat', 2]],
    tavsif: "Yangi lid (potentsial o'quvchi) qo'shish. Shu raqam lid yoki o'quvchida bo'lsa ogohlantiradi.",
    parametrlar: obj({ ism: S('Ism'), telefon: S('Telefon'), kurs: S('Fan'), manba: S('Instagram, Telegram, Facebook, Tavsiya...'), izoh: S('Izoh'), filial: S('Filial') }, ['ism', 'telefon']),
    tayyorla: lidQoshish, qadam: 'Lid kartochkasi tayyorlanmoqda' },
  { nom: 'lid_tahrirlash', guruh: 'Lidlar', misol: "Aziz Karimovni «Kelishdi» ga o'tkaz", ruxsat: [['lidlar.royxat', 2]],
    tavsif: "Lidni o'zgartirish: holat (Yangi, Bog'lanilmadi, O'ylayapti, Kelishdi, To'lov qildi), ism, telefon, fan, manba, izohga qator.",
    parametrlar: obj({ lid: S('Lid ismi, telefoni yoki id'), holat: S('Yangi holat'), ism: S('Ism'), telefon: S('Telefon'), kurs: S('Fan'), manba: S('Manba'), izoh: S("Izohga qo'shiladigan qator") }, ['lid']),
    tayyorla: lidTahrirlash, qadam: 'Lid tahriri kartochkasi' },
  { nom: 'lidni_oquvchiga', guruh: 'Lidlar', misol: "Aziz Karimov lidini o'quvchiga aylantir, Matematika-4 kursiga", ruxsat: [['oquvchilar.royxat', 2]],
    tavsif: "Lidni o'quvchiga aylantirish (ma'lumotlari ko'chadi, ixtiyoriy kursga qo'shiladi); lid ro'yxatdan chiqadi.",
    parametrlar: obj({ lid: S('Lid ismi, telefoni yoki id'), kurs: KURS, holat: S('Faol (standart) yoki Sinov') }, ['lid']),
    tayyorla: lidniOquvchiga, qadam: "Aylantirish kartochkasi" },
  { nom: 'lid_ochirish', guruh: 'Lidlar', misol: "Takror qo'shilgan lidni o'chir", ruxsat: [['lidlar.ochirish', 2]],
    tavsif: "Lidni o'chirish.",
    parametrlar: obj({ lid: S('Lid ismi, telefoni yoki id') }, ['lid']),
    tayyorla: lidOchirish, qadam: "O'chirish kartochkasi" },

  // Moliya
  { nom: 'xarajat_qoshish', guruh: 'Moliya', misol: "Xarajat: ijara 3 mln naqd", ruxsat: [['moliya.xarajat', 2]],
    tavsif: "Xarajat qo'shish: summa, toifa (Ijara, Kommunal, Marketing, Ish haqi, Boshqa yoki boshqa nom), usul (Naqd — kassadan, Karta, O'tkazma).",
    parametrlar: obj({ summa: N("So'm"), toifa: S('Toifa'), usul: S("Naqd (standart), Karta, O'tkazma"), sana: SANA, izoh: S('Izoh'), filial: S('Filial') }, ['summa']),
    tayyorla: xarajatQoshish, qadam: 'Xarajat kartochkasi' },
  { nom: 'xarajat_ochirish', guruh: 'Moliya', misol: "Hozir kiritgan xarajatimni o'chir", ruxsat: [['moliya.xarajat', 2]],
    tavsif: "Xarajatni o'chirish (kiritilgandan keyin 15 daqiqa ichida). xarajatId — «xarajatlar» vositasidan.",
    parametrlar: obj({ xarajatId: N('Xarajat id') }, ['xarajatId']),
    tayyorla: xarajatOchirish, qadam: "O'chirish kartochkasi" },

  // Xabarlar
  { nom: 'qarz_eslatmasi', guruh: 'Xabarlar', misol: "500 mingdan ko'p qarzi borlarga qarz eslatmasi yubor", ruxsat: [['moliya.oylik', 2], ['xabarlar.yuborish', 2]],
    tavsif: "Qarzdorlarning ota-onalariga qarz eslatmasi (sozlamadagi shablon, Telegram yoki SMS). Ro'yxat: tanlangan o'quvchilar yoki filtr (kurs, eng kam qarz).",
    parametrlar: obj({ oquvchilar: L("Aniq o'quvchilar"), kurs: KURS, eng_kam: N("Shu summadan ko'p qarzi borlar") }),
    tayyorla: qarzEslatmasi, qadam: "Qarzdorlar ro'yxati tayyorlanmoqda" },
  { nom: 'xabar_yuborish', guruh: 'Xabarlar', misol: "Matematika-4 ota-onalariga Telegramdan: ertaga dars 15:00 da", ruxsat: [['xabarlar.yuborish', 2]],
    tavsif: "O'quvchilar yoki ota-onalarga xabar (Telegram bepul, SMS pullik). Kimlarga: tanlangan o'quvchilar, kurs, qarzdorlar yoki hamma. Matnda {ism}, {kurs}, {qarz}, {fan}, {ustoz} o'rinbosarlari ishlaydi.",
    parametrlar: obj({ matn: S('Xabar matni'), oquvchilar: L("O'quvchilar"), kurs: KURS, kimlarga: S("«qarzdorlar» yoki «hammaga» (o'quvchilar/kurs berilmasa)"), kimga: S("ota-ona (standart), ota, ona yoki o'quvchi"), kanal: S('TELEGRAM (standart), SMS yoki BOTH') }, ['matn']),
    tayyorla: xabarYuborish, qadam: 'Xabar kartochkasi tayyorlanmoqda' },

  // Xodimlar
  { nom: 'xodim_davomati', guruh: 'Xodimlar', misol: "Bugun Suvonqulov Hasan keldi deb belgila", ruxsat: [['xodimlar.davomat', 2]],
    tavsif: "Xodim davomati: Keldi, Kelmadi, Sababli yoki «olib tashlash».",
    parametrlar: obj({ xodim: S('Xodim ismi yoki id'), holat: S('Keldi, Kelmadi, Sababli yoki olib tashlash'), sana: SANA }, ['xodim', 'holat']),
    tayyorla: xodimDavomati, qadam: 'Davomat kartochkasi' },
  { nom: 'oylik_berish', guruh: 'Xodimlar', misol: "Suvonqulov Hasanga sentabr oyligini ber, 200 ming bonus bilan", ruxsat: [['xodimlar.maosh', 2]],
    tavsif: "Xodimga oylik berish (bir oyga bir marta): summa berilmasa — kartasidagi oylik + bonus − ushlanma. Xarajatga yoziladi, xodimga Telegram xabar ketadi.",
    parametrlar: obj({ xodim: S('Xodim ismi yoki id'), oy: S('YYYY-MM (standart — shu oy)'), summa: N('Beriladigan summa'), bonus: N('Bonus'), ushlanma: N('Ushlanma'), izoh: S('Izoh') }, ['xodim']),
    tayyorla: oylikBerish, qadam: 'Oylik kartochkasi' },

  // Imtihonlar
  { nom: 'savol_yuklash', guruh: 'Imtihonlar', misol: "Shu fayldagi savollarni Matematikaga, 7-imtihonga qo'sh", ruxsat: [['imtihonlar.savollar', 2]],
    tavsif: "Biriktirilgan fayl(lar)dagi (PDF, rasm, Excel) savollarni savollar bankiga qo'shish, xohlansa imtihonga ham: savol yuklash oynasi fan tanlangan, fayllar yuklangan holda ochiladi — AI savollarni ajratadi va javoblarini tekshiradi, xodim ko'rib saqlaydi. Xabarda biriktirilgan fayl bo'lsa va savollarni qo'shish so'ralsa chaqiring. fan — bankdagi fan (imtihon bitta fanli bo'lsa shart emas).",
    parametrlar: obj({ fan: S('Bankdagi fan nomi'), mavzu: S("Hammasi bitta mavzu bo'lsa — mavzu nomi"), imtihon: S("Qo'shiladigan imtihon nomi yoki id") }),
    tayyorla: savolYuklash, qadam: 'Savol yuklash oynasi tayyorlanmoqda' },
  { nom: 'imtihonga_savol_qoshish', guruh: 'Imtihonlar', misol: "Bankdagi 120 va 121-savollarni 7-imtihonga qo'sh", ruxsat: [['imtihonlar.imtihon', 2]],
    tavsif: "Bankdagi faol savollarni (id bo'yicha) qulflanmagan imtihonga «tanlangan savollar» qilib qo'shish — har variantga tushadi.",
    parametrlar: obj({ imtihon: S('Imtihon nomi yoki id'), savolIdlar: { type: 'array', items: { type: 'integer' }, description: 'Savol id lari' } }, ['imtihon', 'savolIdlar']),
    tayyorla: imtihongaSavolQoshish, qadam: "Imtihonga qo'shish kartochkasi" },

  // Sozlamalar
  { nom: 'xona_qoshish', guruh: 'Sozlamalar', misol: "Yangi xona: 5-xona, 20 o'rin", ruxsat: [['sozlamalar.xonalar', 2]],
    tavsif: "Yangi xona qo'shish (nom va sig'im).",
    parametrlar: obj({ nom: S('Xona nomi'), sigim: N("O'rinlar soni"), filial: S('Filial') }, ['nom', 'sigim']),
    tayyorla: xonaQoshish, qadam: 'Xona kartochkasi' },
  { nom: 'xona_tahrirlash', guruh: 'Sozlamalar', misol: "2-xona sig'imini 24 qil", ruxsat: [['sozlamalar.xonalar', 2]],
    tavsif: "Xona nomi yoki sig'imini o'zgartirish.",
    parametrlar: obj({ xona: S('Xona'), nom: S('Yangi nom'), sigim: N("Yangi sig'im") }, ['xona']),
    tayyorla: xonaTahrirlash, qadam: 'Xona tahriri kartochkasi' },
];

function amalRuxsati(k, a) {
  if (a.ruxsat === 'admin') return adminmi(k);
  return a.ruxsat.some(([kalit, d]) => yetadimi(k.ruxsat, kalit, d));
}

export const ruxsatliAmallar = (k) => AMALLAR.filter(a => amalRuxsati(k, a));

/** Amalni tayyorlaydi (hech narsa yozmaydi); xato bo'lsa { xato } — AI xodimga tushuntiradi. */
export async function amalniTayyorla(k, nom, args) {
  const a = ruxsatliAmallar(k).find(x => x.nom === nom);
  if (!a) return { xato: "Bu amalga ruxsatingiz yo'q yoki bunday amal yo'q" };
  try {
    return await a.tayyorla(k, args || {});
  } catch (e) {
    if (e instanceof VositaXato) return { xato: e.message };
    throw e;
  }
}
