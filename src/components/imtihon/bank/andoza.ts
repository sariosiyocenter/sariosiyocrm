import { andozaSavolQoidalari, andozaSavolSoni } from '../../../../lib/imtihon.js';
import { andozadanQoidalar } from '../tuzish/andozadan';
import type { Andoza, AndozaTafsil, BankFan, BelgiGuruhi, TopicRule } from '../../../types';

// Andoza — nomi, savollar soni va bankdan qo'shilgan aniq savollar. Shu fayl — andozani
// ishlatadigan hamma joy uchun umumiy: holati va imtihon blokiga aylantirish.

/** Bitta andozadagi savollar chegarasi (server bilan bir xil). */
export const ANDOZA_MAX = 300;

/**
 * Eski, qoidali andoza: savoli yo'q, qoidalari bor — imtihonga qoida bo'lib tushadi (savollar
 * har safar bankdan tasodifiy olinadi). Savol qo'shilgach oddiy andozaga aylanadi.
 */
export const andozaQoidali = (a: Andoza) => !a.questionIds.length && a.rows.some(r => r.soni > 0);

/** Qoidalarda yozilgan savollar soni (qoidali andozadan shuncha savol tushadi). */
export const qoidalarSoni = (a: Andoza) => a.rows.reduce((s, r) => s + r.soni, 0);

/** Savollar soni maydoni: 1..ANDOZA_MAX (bo'sh yoki noto'g'ri — 0). */
export const sonniOqi = (v: string) => Math.min(ANDOZA_MAX, Math.max(0, parseInt(v.replace(/\D/g, '')) || 0));

/**
 * Andoza → imtihon bloki qoidalari. Oddiy andoza — aynan qo'shilgan savollar (har variantga
 * shular; faol bo'lmagan yoki chala savollar tushmaydi — `tushmaydi` nechtaligini aytadi);
 * qoidali andoza — qatorlari qoida bo'ladi. `a.savollar` — to'liq yoki `?qisqa=1` ko'rinishi.
 */
export function andozaBlokQoidalari(a: AndozaTafsil, fan: BankFan, guruhlar: BelgiGuruhi[], yozmaBal?: number | null): { topicRules: TopicRule[]; savolSoni: number; tushmaydi: number } {
  if (andozaQoidali(a)) {
    return { topicRules: andozadanQoidalar(a, fan, guruhlar, yozmaBal), savolSoni: qoidalarSoni(a), tushmaydi: 0 };
  }
  const tayyor = a.savollar.filter(q => !q.tushmaydi);
  const savolSoni = andozaSavolSoni(tayyor);
  return { topicRules: andozaSavolQoidalari(tayyor, { yozmaBal }) as TopicRule[], savolSoni, tushmaydi: andozaSavolSoni(a.savollar) - savolSoni };
}
