// Qarz eslatmasi: qarzdor o'quvchining ota-onasiga "to'lanmagan summa bor"
// xabari.
//
// Egasi (2026-09-26): "у них может быть несколько ставок и несколько курсов
// ... может быть, они знают, или не знают, или думают, что задолженности не
// было. Может быть, они на самом деле уже платили, но мы не написали".
// Shunga ko'ra:
//  - qarz kurslar bo'yicha ko'rsatiladi (har kurs o'z summasi va oylari
//    bilan, o'quvchining o'z narxi bo'yicha hisoblangan), eski qarz alohida —
//    o'quvchi kartasidagi "Balans" bilan bir xil raqamlar (lib/allocation.js);
//  - oxirgi QAYD ETILGAN to'lov sanasi bilan yoziladi: to'lagan, lekin CRM ga
//    kiritilmagan ota-ona buni darhol ko'radi;
//  - Telegram'da "✅ To'laganman" tugmasi va aloqa raqami bor;
//  - SMS qisqa: Shablonlar dagi (Eskiz tasdiqlagan) matn, {ism} va {qarz}.
//    Kurslar ro'yxati SMS ga qo'yilmaydi — uzunligi o'zgarib turadigan matnni
//    Eskiz shablonga moslay olmaydi va SMS ketmay qoladi.
//
// Bu fayl server va brauzer uchun umumiy: sozlama shakli, qarzni kurslar
// bo'yicha yig'ish va Telegram matni. Yuborish — services/qarzXabari.js.

import { KANALLAR } from './tolovXabari.js';

const KIMGA = ['FATHER', 'MOTHER', 'STUDENT'];

// Avtomatik jadval boshida O'CHIQ: yoqilmaguncha eslatma faqat xodim
// "Qarzdorlar ro'yxati"dan tekshirib yuborganda ketadi. Kun, soat va chegara
// eski "Qarzdorlik eslatmasi" qoidasidan olinadi (services/qarzXabari.js).
export const STANDART_SOZLAMA = {
  yoqilgan: false,
  shablonId: null,
  kanal: 'BOTH',          // Telegram (bepul, to'liq tafsilot), bo'lmasa SMS
  kimga: 'FATHER,MOTHER',
  kun: 20,                // oyning shu kunidan boshlab
  soat: '19:00',
  takror: 7,              // keyingisi necha kundan keyin (0 — oyiga bir marta)
  maks: 3,                // bir oyda ko'pi bilan
  minQarz: 100000,        // shundan kam qarzga yuborilmaydi
  aloqa: '',              // Telegram xabaridagi telefon ("savollar bo'lsa")
};

const butun = (v, min, max, std) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std;
};

/** Bazadan yoki so'rovdan kelgan sozlamani tekshirib, bir xil shaklga keltiradi. */
export function sozlamaniTozala(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const kimgaRoyxat = String(s.kimga || '')
    .split(',')
    .map(v => v.trim().toUpperCase())
    .flatMap(v => (v === 'PARENT' ? ['FATHER', 'MOTHER'] : [v]))
    .filter(v => KIMGA.includes(v));
  let soat = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.soat || '')) ? String(s.soat) : STANDART_SOZLAMA.soat;
  // Ota-onaga erta tongda yoki tunda yozilmaydi.
  if (soat < '08:00') soat = '08:00';
  if (soat > '21:00') soat = '21:00';
  const id = Number(s.shablonId);
  return {
    yoqilgan: !!s.yoqilgan,
    shablonId: Number.isInteger(id) && id > 0 ? id : null,
    kanal: KANALLAR.includes(s.kanal) ? s.kanal : STANDART_SOZLAMA.kanal,
    kimga: kimgaRoyxat.length ? [...new Set(kimgaRoyxat)].join(',') : STANDART_SOZLAMA.kimga,
    kun: butun(s.kun, 1, 28, STANDART_SOZLAMA.kun),
    soat,
    takror: butun(s.takror, 0, 31, STANDART_SOZLAMA.takror),
    maks: butun(s.maks, 1, 10, STANDART_SOZLAMA.maks),
    minQarz: butun(s.minQarz, 0, 100000000, STANDART_SOZLAMA.minQarz),
    aloqa: String(s.aloqa || '').replace(/[^\d+\s()-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40),
  };
}

/** Sozlama saqlanmagan bo'lsa — qarz shablonini matni ({qarz}) yoki nomidan topish. */
export function shablonTaxmini(templates) {
  const royxat = [...(templates || [])].sort((a, b) => a.id - b.id);
  const matnda = royxat.find(t => /\{qarz\}/i.test(t.body || ''));
  if (matnda) return matnda.id;
  const nomida = royxat.find(t => /qarz/i.test(t.name || ''));
  return nomida ? nomida.id : null;
}

// --- Qarz tafsiloti -------------------------------------------------------

export const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
export const oyNomi = (ym) => OYLAR[Number(String(ym).slice(5, 7)) - 1] || String(ym || '');

/** ["2026-08", "2026-09"] → "avgust, sentabr"; yil almashsa yil ham: "dekabr 2026, yanvar 2027". */
export function oylarMatni(oylar) {
  const royxat = [...new Set(oylar || [])].filter(m => /^\d{4}-\d{2}$/.test(m)).sort();
  if (!royxat.length) return '';
  const yillar = new Set(royxat.map(m => m.slice(0, 4)));
  return royxat.map(m => (yillar.size > 1 ? `${oyNomi(m)} ${m.slice(0, 4)}` : oyNomi(m))).join(', ');
}

/**
 * O'quvchi qarzi kurslar bo'yicha.
 *
 * @param buckets  allocate().buckets — (kurs, oy) hisoblari, `remaining` > 0 — yopilmagani
 * @param kurslar  Map yoki obyekt: groupId → { nom }
 * @param balans   Student.balance (manfiy — qarz)
 * @returns {{ jami, kurslar: [{groupId, nom, qarz, oylar}], eski, avans }}
 *   jami  — umumiy qarz (−balans): o'quvchi kartasi va {qarz} bilan bir xil;
 *   eski  — kursga bog'lanmagan eski qoldiq (import qilingan);
 *   avans — balansda turgan, hali hech bir hisobni yopmagan pul (kursga
 *           biriktirilgan eski avans). Kurslar yig'indisi − avans = jami.
 */
export function qarzTafsiloti(buckets, kurslar, balans) {
  const jami = Math.max(0, Math.round(-(Number(balans) || 0)));
  const nomi = (id) => (kurslar instanceof Map ? kurslar.get(id) : kurslar?.[id])?.nom || `Kurs #${id}`;
  const guruhlar = new Map();
  let eski = 0;
  for (const b of buckets || []) {
    const qoldi = Math.round(Number(b.remaining) || 0);
    if (qoldi <= 0) continue;
    if (b.groupId) {
      const g = guruhlar.get(b.groupId) || { groupId: b.groupId, qarz: 0, oylar: [] };
      g.qarz += qoldi;
      if (/^\d{4}-\d{2}$/.test(b.month) && !g.oylar.includes(b.month)) g.oylar.push(b.month);
      guruhlar.set(b.groupId, g);
    } else {
      eski += qoldi;
    }
  }
  const royxat = [...guruhlar.values()]
    .map(g => ({ groupId: g.groupId, nom: nomi(g.groupId), qarz: g.qarz, oylar: g.oylar.sort() }))
    .sort((a, b) => a.nom.localeCompare(b.nom));
  const yigindi = royxat.reduce((a, g) => a + g.qarz, 0) + eski;
  return { jami, kurslar: royxat, eski, avans: Math.max(0, yigindi - jami) };
}

// --- Telegram matni -------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** "500,000" — SMS dagi {qarz} bilan bir xil ko'rinish. */
export const som = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
export const sanaKor = (d) => (/^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');

/**
 * Telegram xabari (HTML). Tugmalar (Payme, "To'laganman") alohida qo'shiladi.
 *
 * @param o.ism          o'quvchi ismi (ko'rinadigan shaklda)
 * @param o.kimga        FATHER | MOTHER | STUDENT — kimga yozilyapti
 * @param o.tafsil       qarzTafsiloti() natijasi
 * @param o.oxirgiTolov  { sana: 'YYYY-MM-DD', summa } | null
 * @param o.aloqa        telefon ("savollar bo'lsa")
 * @param o.markaz       markaz nomi
 */
export function telegramMatni(o) {
  const t = o.tafsil || { jami: 0, kurslar: [], eski: 0, avans: 0 };
  const q = ["💸 <b>To'lov eslatmasi</b>", ''];
  q.push(o.kimga === 'STUDENT'
    ? `Hurmatli <b>${esc(o.ism)}</b>! Hisobimizda o'qish to'lovingiz bo'yicha to'lanmagan summa bor:`
    : `Hurmatli ota-ona! Hisobimizda farzandingiz <b>${esc(o.ism)}</b> bo'yicha to'lanmagan summa bor:`);
  q.push('');
  const qatorlar = [];
  for (const k of t.kurslar) {
    const oylar = oylarMatni(k.oylar);
    qatorlar.push(`📚 ${esc(k.nom)}${oylar ? ` (${oylar})` : ''} — <b>${som(k.qarz)}</b> so'm`);
  }
  if (t.eski > 0) qatorlar.push(`🗂 Oldingi qarz — <b>${som(t.eski)}</b> so'm`);
  if (t.avans > 0) qatorlar.push(`➖ Balansdagi pul — ${som(t.avans)} so'm`);
  q.push(...qatorlar);
  if (qatorlar.length !== 1) q.push(`💰 Jami: <b>${som(t.jami)} so'm</b>`);
  q.push('');
  q.push(o.oxirgiTolov
    ? `🧾 Oxirgi qayd etilgan to'lov: ${sanaKor(o.oxirgiTolov.sana)}, ${som(o.oxirgiTolov.summa)} so'm`
    : "🧾 Bizda hali to'lov qayd etilmagan.");
  q.push('');
  q.push(`Agar to'lagan bo'lsangiz, «✅ To'laganman» tugmasini bosing — tekshirib, tuzatamiz.${o.aloqa ? ` Savollar bo'lsa: ${esc(o.aloqa)}` : ''}`);
  if (o.markaz) q.push(`<i>${esc(o.markaz)}</i>`);
  return q.join('\n');
}

// Yozuv holatlari (ro'yxatda).
export const HOLAT_NOMI = {
  kutmoqda: 'navbatda',
  yuborilmoqda: 'yuborilmoqda',
  yuborildi: 'yuborildi',
  yetkazildi: 'yetib bordi',
  yetkazilmadi: 'yetib bormadi',
  xato: 'ketmadi',
  bekor: 'bekor qilindi',
};

export const JAVOB_NATIJA = {
  kiritildi: "To'lov kiritildi",
  togri: "Qarz to'g'ri",
};
