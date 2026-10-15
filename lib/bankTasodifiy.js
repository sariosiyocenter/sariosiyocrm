// Bankdan tasodifiy savol tanlash («Savol qo'shish» oynasidagi «Tasodifiy tanlash»): filtrga mos
// savollardan N tasini oladi. Bazasiz — tanlash mantig'i shu yerda, ma'lumotni `yukla` beradi
// (routes/savolBanki.js: GET /api/bank/royxat?tasodifiy=N). Guruhli savol (MS-33-35, MS-36-45)
// va bitta matnga bog'langan savollar butunligicha olinadi — SavolTanlash.bos() bilan bir xil qoida;
// N shu oynadagi hisobda: qismli savolning qismlari — bitta savol.
import { randomInt } from 'node:crypto';

/** Bir so'rovda ko'pi bilan nechta savol (birlik) tanlanadi. */
export const TASODIFIY_MAX = 200;
/** Qismli savol (a, b…) imtihon varag'iga sig'adigan eng ko'p qism soni. */
export const QISMLI_MAX = 4;
const GURUHLI = ['juft', 'qismli'];
const guruhlimi = turi => GURUHLI.includes(turi);

/** [0, 1) oralig'ida kriptografik tasodifiy son. */
export const kriptoTasodif = () => randomInt(0, 2 ** 32) / 2 ** 32;

/** Fisher–Yates: yangi aralashgan nusxa (asl ro'yxat o'zgarmaydi). */
export function aralashtir(royxat, tasodif = kriptoTasodif) {
  const a = [...royxat];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(tasodif() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Nomzod savollarni birliklarga ajratadi: matnga bog'lanmagan savol — o'zi bitta birlik, bitta
 * matnning savollari — bitta birlik (matn). Andozada bor yakka savollar darhol tashlanadi.
 */
export function birliklarga(nomzodlar, istisno = new Set()) {
  const birliklar = [];
  const korilgan = new Set();
  for (const q of nomzodlar) {
    if (!q.passageId) {
      if (!istisno.has(q.id)) birliklar.push({ id: q.id });
      continue;
    }
    if (korilgan.has(q.passageId)) continue;
    korilgan.add(q.passageId);
    birliklar.push({ pa: q.passageId, guruhli: guruhlimi(q.type), turi: q.type });
  }
  return birliklar;
}

/**
 * Bitta birlikni tekshiradi: yaroqli bo'lsa `{ idlar, soni }` (soni — oynadagi hisobda), aks holda null.
 * @param azolar passageId → shu matnning hamma savoli (holati va xatosi bilan)
 */
export function birlikniTekshir(birlik, yakka, azolar, istisno) {
  const yaroqli = x => x.status === 'faol' && !x.xato;
  if (birlik.id !== undefined) {
    const x = yakka.get(birlik.id);
    return x && yaroqli(x) && !istisno.has(x.id) ? { idlar: [x.id], soni: 1 } : null;
  }
  const hammasi = (azolar.get(birlik.pa) || []).filter(x => guruhlimi(x.type) === birlik.guruhli);
  if (birlik.guruhli) {
    // Guruhli savol butunligicha: bir bo'lagi faol bo'lmasa, chala bo'lsa yoki andozada bo'lsa — yo'q.
    if (!hammasi.length || hammasi.some(x => !yaroqli(x) || istisno.has(x.id))) return null;
    if (birlik.turi === 'qismli' && hammasi.length > QISMLI_MAX) return null;
    return { idlar: hammasi.map(x => x.id), soni: birlik.turi === 'qismli' ? 1 : hammasi.length };
  }
  // Bitta matnning savollari birga (imtihonga tayyorlari, andozada yo'qlari).
  const tayyor = hammasi.filter(x => yaroqli(x) && !istisno.has(x.id));
  return tayyor.length ? { idlar: tayyor.map(x => x.id), soni: tayyor.length } : null;
}

/**
 * `soni` ta savolni tasodifiy tanlaydi (birliklar bo'yicha; sig'maydigan birlik tashlanib, boshqasi olinadi).
 * @param nomzodlar filtrga mos savollar: `{ id, type, passageId }`
 * @param istisno andozada bor (qayta olinmaydigan) savollar id si
 * @param yukla `({ idlar, passageIdlar }) → Promise<{ id, type, passageId, status, xato, bankTopicId, hasAnswers }[]>`:
 *   yakka savollar va matnlarning HAMMA savoli (holatidan qat'i nazar) — tekshirish uchun
 * @returns `{ tanlandi, soni }`: tanlangan savollar (yuklangan ma'lumoti bilan) va ularning oynadagi soni
 */
export async function tasodifiyTanla({ nomzodlar, soni, istisno = [], yukla, tasodif = kriptoTasodif, paket = 40 }) {
  const chegara = Math.min(TASODIFIY_MAX, Math.max(0, Math.floor(Number(soni)) || 0));
  const bor = new Set(istisno);
  const tanlandi = [];
  let jami = 0;
  const birliklar = aralashtir(birliklarga(nomzodlar, bor), tasodif);
  for (let i = 0; i < birliklar.length && jami < chegara; i += paket) {
    const bolak = birliklar.slice(i, i + paket);
    const ma = await yukla({
      idlar: bolak.filter(b => b.id !== undefined).map(b => b.id),
      passageIdlar: bolak.filter(b => b.pa !== undefined).map(b => b.pa),
    });
    const yakka = new Map(ma.map(x => [x.id, x]));
    const azolar = new Map();
    for (const x of ma) if (x.passageId) azolar.set(x.passageId, [...(azolar.get(x.passageId) || []), x]);
    for (const b of bolak) {
      if (jami >= chegara) break;
      const r = birlikniTekshir(b, yakka, azolar, bor);
      if (!r || jami + r.soni > chegara) continue;
      jami += r.soni;
      for (const id of r.idlar) tanlandi.push(yakka.get(id) || (azolar.get(b.pa) || []).find(x => x.id === id));
    }
  }
  return { tanlandi, soni: jami };
}
