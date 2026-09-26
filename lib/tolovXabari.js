// To'lov xabari: to'lov qabul qilinganda ota-onaga ketadigan SMS.
//
// Egasi (2026-09-24): "to'lov qilinganda sms borishi kerak avtomatik";
// 2026-09-26: "buni jiddiyroq ishlab chiqish kerak, hamma jihatini hisobga
// olib". Birinchi versiyada 11 ta SMS ning hammasi yetib bormagan: qoida matni
// Eskizda tasdiqlangan shablonga harfma-harf mos kelmasdi, Langar filialida
// Eskiz sozlamasi yo'q edi, holatini esa hech kim ko'rmasdi.
//
// Endi matn Xabarlar → Shablonlar dagi bitta shablon (Eskiz holati o'sha
// yerda kuzatiladi), sozlama butun markazga bitta (Organization.tolovXabari),
// har bir to'lovning xabari alohida yozuv (TolovXabari). Bu fayl server va
// brauzer uchun umumiy: sozlama shakli, Eskiz holatlari, SMS matnini tozalash
// va SMS soni hisobi.

export const KANALLAR = ['SMS', 'BOTH', 'TELEGRAM'];
const KIMGA = ['FATHER', 'MOTHER', 'STUDENT'];

export const STANDART_SOZLAMA = { yoqilgan: true, shablonId: null, kanal: 'SMS', kimga: 'FATHER,MOTHER' };

/** Bazadan yoki so'rovdan kelgan sozlamani tekshirib, bir xil shaklga keltiradi. */
export function sozlamaniTozala(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const kanal = KANALLAR.includes(s.kanal) ? s.kanal : STANDART_SOZLAMA.kanal;
  const kimgaRoyxat = String(s.kimga || '')
    .split(',')
    .map(v => v.trim().toUpperCase())
    .flatMap(v => (v === 'PARENT' ? ['FATHER', 'MOTHER'] : [v]))
    .filter(v => KIMGA.includes(v));
  const kimga = kimgaRoyxat.length ? [...new Set(kimgaRoyxat)].join(',') : STANDART_SOZLAMA.kimga;
  const id = Number(s.shablonId);
  return {
    yoqilgan: s.yoqilgan === undefined ? STANDART_SOZLAMA.yoqilgan : !!s.yoqilgan,
    shablonId: Number.isInteger(id) && id > 0 ? id : null,
    kanal,
    kimga,
  };
}

/**
 * Sozlama hali saqlanmagan bo'lsa — to'lov shablonini nomi yoki matnidan
 * topish ("TO'LOV QABUL QILINGANDA-OTA ONALAR UCHUN", {oxirgi_tolov}).
 */
export function shablonTaxmini(templates) {
  const royxat = [...(templates || [])].sort((a, b) => a.id - b.id);
  const matnda = royxat.find(t => /\{(oxirgi_tolov|to_lov_summa)\}/i.test(t.body || ''));
  if (matnda) return matnda.id;
  const nomida = royxat.find(t => /to.?lov/i.test(t.name || ''));
  return nomida ? nomida.id : null;
}

// Eskiz shablon holatlari (GET /api/user/templates): moderation — tekshiruvda,
// inproccess — jarayonda, service — xizmat xabari sifatida tasdiqlangan,
// reklama — reklama sifatida tasdiqlangan, rejected — rad etilgan.
// 'confirmed' — eski yozuvlarda uchraydi.
export const ESKIZ_TASDIQ = ['service', 'reklama', 'confirmed'];
export const eskizYuboradi = (holat) => ESKIZ_TASDIQ.includes(String(holat || ''));
export const eskizRadEtdi = (holat) => /^(rejected|reject)$/.test(String(holat || ''));
export const eskizKutmoqda = (holat) => !eskizYuboradi(holat) && !eskizRadEtdi(holat) && !String(holat || '').startsWith('xato') && !!holat;

/** Eskiz holati — odam tushunadigan so'z bilan. */
export function eskizHolatMatni(holat) {
  if (!holat) return "Eskizga yuborilmagan";
  if (holat === 'service' || holat === 'confirmed') return 'Eskiz tasdiqlagan';
  if (holat === 'reklama') return 'Eskiz tasdiqlagan (reklama sifatida)';
  if (eskizRadEtdi(holat)) return "Eskiz rad etgan — matnni o'zgartiring";
  if (String(holat).startsWith('xato')) return `Eskizga yuborilmadi: ${String(holat).replace(/^xato:\s*/, '')}`;
  return 'Eskiz tekshiruvida';
}

// --- SMS matni -------------------------------------------------------------

/**
 * SMS matnini Eskizga yuboriladigan ko'rinishga keltiradi. Tutuq belgisining
 * turli shakllari (ʻ ʼ ’ ‘ ` ´) oddiy ' ga: aks holda matn GSM-7 dan chiqib
 * ikki barobar qimmat (70 belgili) SMS ga aylanadi va Eskizdagi shablonga mos
 * kelmay qolishi mumkin. Shablonlar ham Eskizga shu ko'rinishda yuboriladi —
 * ikkalasi bir xil bo'lishi shart. Oddiy bo'lmagan bo'shliqlar — probelga.
 */
export function smsMatni(text) {
  return String(text || '')
    .replace(/[\u02BB\u02BC\u2018\u2019\u0060\u00B4\u02B9\u02BF]/g, "'")
    .replace(/[\u00A0\u2007\u202F\u2009]/g, ' ')
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');
}

/**
 * Ism SMS uchun: harf, tutuq belgisi, chiziqcha va probel; ko'pi bilan 4 so'z
 * (Eskiz shablonidagi {ism} — %w{1,5}: 1–5 so'z; ortig'i matnni shablondan
 * chiqarib yuboradi).
 */
export function smsIsm(name) {
  return smsMatni(name)
    .replace(/[^\p{L}' -]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(' ');
}

const GSM7 = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
);
const GSM7_KENG = new Set('^{}\\[~]|€');

/** Matn nechta SMS bo'lib ketadi (narx shunga qarab). */
export function smsSoni(text) {
  const t = String(text || '');
  let gsm = true;
  let uzunlik = 0;
  for (const c of t) {
    if (GSM7.has(c)) uzunlik += 1;
    else if (GSM7_KENG.has(c)) uzunlik += 2;
    else { gsm = false; break; }
  }
  if (gsm) return { belgi: uzunlik, soni: uzunlik <= 160 ? 1 : Math.ceil(uzunlik / 153), kodlash: 'GSM-7' };
  const n = [...t].length;
  return { belgi: n, soni: n <= 70 ? 1 : Math.ceil(n / 67), kodlash: 'UCS-2' };
}

/**
 * O'zbek mobil raqami: 998 + 9 raqam. 9 raqam kiritilgan bo'lsa 998 qo'shiladi.
 * Noto'g'ri raqamda null — Eskizga umuman yuborilmaydi.
 */
export function uzRaqam(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  return /^998\d{9}$/.test(d) ? d : null;
}

/** "+998 90 *** 57 52" — ro'yxatda raqamni to'liq ko'rsatmaslik uchun. */
export const raqamYashir = (d) => {
  const r = uzRaqam(d);
  return r ? `+${r.slice(0, 3)} ${r.slice(3, 5)} *** ${r.slice(8, 10)} ${r.slice(10, 12)}` : String(d || '');
};

export const KIMGA_NOMI = { FATHER: 'otasi', MOTHER: 'onasi', STUDENT: "o'quvchi" };

// Yozuv holatlari va ularning so'zi (ro'yxat va chek ostidagi qator uchun).
export const HOLAT_NOMI = {
  kutmoqda: 'navbatda',
  yuborilmoqda: 'yuborilmoqda',
  yuborildi: 'yuborildi',
  yetkazildi: 'yetkazildi',
  yetkazilmadi: 'yetib bormadi',
  xato: 'ketmadi',
  bekor: "bekor qilindi (to'lov o'chirildi)",
};
