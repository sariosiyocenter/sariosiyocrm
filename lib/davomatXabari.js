// Davomat xabari: kurs yo'qlamasidan keyin ota-onaga ketadigan matn.
//
// Egasi (2026-09-26): "kursda yo'qlamada xabar yuborish — shablon kiritib
// qo'yilgan xabar ketishi kerak". Ilgari kurs sahifasidagi tugma qattiq
// yozilgan "Davomat xabarnomasi / Holat: Kelmapdi / Guruh: …" ni, SMS tugmasi
// esa Eskizda tasdiqlanmagan matnni yuborardi (hammasi FAILED).
//
// Endi har holat uchun Xabarlar → Shablonlar dagi bitta shablon tanlanadi.
// Sozlama butun markazga bitta (Organization.davomatXabari). Bu fayl server
// va brauzer uchun umumiy: holatlar ro'yxati, sozlamani tozalash va
// hali saqlanmagan sozlama uchun shablon nomidan taxmin.

/** Xabar ketishi mumkin bo'lgan holatlar, ko'rsatish tartibida. */
export const DAVOMAT_HOLATLARI = [
  { key: 'Kelmapdi', nom: 'Kelmadi' },
  { key: 'Sababli', nom: 'Sababli' },
  { key: 'Kechikdi', nom: 'Kechikdi' },
  { key: 'ErtaKetdi', nom: 'Erta ketdi' },
  { key: 'Keldi', nom: 'Keldi' },
];

const KALITLAR = DAVOMAT_HOLATLARI.map(h => h.key);

/**
 * Yo'qlama holatini sozlama kalitiga keltiradi. "Kelmadi" — eski yozuvlar.
 * "Dars bo'lmadi" va boshqa holatlarga xabar ketmaydi — null.
 */
export function holatKaliti(status) {
  if (status === 'Kelmadi') return 'Kelmapdi';
  return KALITLAR.includes(status) ? status : null;
}

export const KANALLAR = ['BOTH', 'SMS', 'TELEGRAM'];
const KIMGA = ['FATHER', 'MOTHER', 'STUDENT'];

export const STANDART_SOZLAMA = { kanal: 'BOTH', kimga: 'FATHER,MOTHER', shablon: {} };

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
  const shablon = {};
  const manba = s.shablon && typeof s.shablon === 'object' ? s.shablon : {};
  for (const k of KALITLAR) {
    const id = Number(manba[k]);
    if (Number.isInteger(id) && id > 0) shablon[k] = id;
  }
  return { kanal, kimga, shablon };
}

/**
 * Sozlama hali saqlanmagan bo'lsa — shablon nomi va matnidan taxmin.
 * Egasi davomat uchun shablonlarni "DAVOMAD-KELMAGANLARNI…", "…SABALI…",
 * "…KECHIKKANLARNI…", "…VAQTLI KETGANLARNI…" deb yaratgan; tartib muhim:
 * sababli ham "qatnashmadi" deydi, shuning uchun u "kelmadi"dan oldin.
 * Taxmin faqat boshlang'ich qiymat — kurs oynasida aniq qaysi matn ketishi
 * ko'rinib turadi va bir bosishda o'zgartiriladi.
 */
export function shablonTaxmini(templates) {
  const out = {};
  const qoidalar = [
    ['Sababli', /sabab|uzrli/i],
    ['ErtaKetdi', /erta\s*ket|vaqtli|javob olib/i],
    ['Kechikdi', /kechik|kech\s*qol/i],
    ['Kelmapdi', /kelma|qatnashma|qoldir/i],
  ];
  const royxat = [...(templates || [])]
    .filter(t => /davom|dars/i.test(`${t.name} ${t.body}`))
    .sort((a, b) => a.id - b.id);
  for (const t of royxat) {
    const matn = `${t.name} ${t.body}`;
    const topildi = qoidalar.find(([, re]) => re.test(matn));
    if (topildi && !out[topildi[0]]) out[topildi[0]] = t.id;
  }
  return out;
}

/** Eskiz shablon holati: SMS yetib boradimi. */
export const eskizTasdiqlangan = (holat) => holat === 'confirmed' || holat === 'service';
