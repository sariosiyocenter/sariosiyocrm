// Ish o'lchovi (src/lib/olchagich.ts yuboradi): kirishni tekshirish. Brauzer yuborgani ishonchsiz —
// faqat ruxsat etilgan joy, o'lchami cheklangan va faqat kerakli maydonlar saqlanadi.

/** Qaysi oynalar o'lchanadi. */
export const OLCHOV_JOYLARI = ['fayldan-yuklash'];
/** Bitta yozuvning eng katta hajmi (JSON belgilari). */
export const OLCHOV_MAKS = 64_000;
/** Shundan eski yozuvlar o'chiriladi (kun). */
export const OLCHOV_KUN = 30;

const SESSIYA = /^[A-Za-z0-9-]{8,64}$/;
const royxat = (v, n) => (Array.isArray(v) ? v.slice(-n) : []);
const obyekt = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/**
 * So'rov tanasi → { sessiya, joy, malumot } yoki { xato }. `malumot` — saqlanadigan qismi
 * (sabab, vaqtlar, brauzer, kontekst, xulosa, bosqichlar, qotishlar, hodisalar).
 */
export function olchovniTekshir(body) {
  const b = obyekt(body);
  if (!SESSIYA.test(String(b.sessiya ?? ''))) return { xato: 'Sessiya noto\'g\'ri' };
  if (!OLCHOV_JOYLARI.includes(b.joy)) return { xato: 'Joy noto\'g\'ri' };
  const malumot = {
    sabab: String(b.sabab ?? '').slice(0, 40),
    boshlandi: String(b.boshlandi ?? '').slice(0, 40),
    davom: Number.isFinite(b.davom) ? Math.round(b.davom) : null,
    brauzer: obyekt(b.brauzer),
    kontekst: obyekt(b.kontekst),
    xulosa: obyekt(b.xulosa),
    bosqichlar: royxat(b.bosqichlar, 300),
    qotishlar: royxat(b.qotishlar, 200),
    hodisalar: royxat(b.hodisalar, 300),
  };
  if (JSON.stringify(malumot).length > OLCHOV_MAKS) return { xato: 'O\'lchov juda katta' };
  return { sessiya: b.sessiya, joy: b.joy, malumot };
}
