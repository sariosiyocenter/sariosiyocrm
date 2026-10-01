import { QIYINLIK } from '../bank/qiyinlik';
import type { Andoza, BankFan, BelgiGuruhi, TopicRule } from '../../../types';

// Andoza (Addmen "Blueprint") → imtihon bloki qoidalari. Imtihon tuzishda
// ("Andozadan") va chop etishda ("Andozadan savol qog'ozi") bir xil ishlatiladi.

/** Andoza qatorlari → blok qoidalari (nusxa: andoza keyin o'zgarsa ham imtihon o'zgarmaydi). */
export function andozadanQoidalar(a: Andoza, fan: BankFan, guruhlar: BelgiGuruhi[], yozmaBal?: number | null): TopicRule[] {
  const belgiNomi = new Map(guruhlar.flatMap(g => g.tags.map(x => [x.id, x.name] as const)));
  return a.rows.filter(r => r.soni > 0).map(r => {
    const m = r.mavzuId ? fan.mavzular.find(x => x.id === r.mavzuId) : null;
    const label = [r.bolim, m?.name, r.qiyinlik ? QIYINLIK[r.qiyinlik - 1].nom : '', r.manba, ...r.tagIds.map(id => belgiNomi.get(id) || '')].filter(Boolean).join(' · ');
    return {
      topic: m?.name || '', ...(m ? { mavzuId: m.id } : {}), ...(r.bolim ? { section: r.bolim } : {}), ...(r.manba ? { source: r.manba } : {}),
      ...(r.tagIds.length ? { tagIds: r.tagIds } : {}), ...(r.qiyinlik ? { difficulty: r.qiyinlik } : {}),
      type: r.tur, count: r.soni, label: label || 'Istalgan', ...(r.tur === 'yozma' && yozmaBal != null ? { points: yozmaBal } : {}),
    };
  });
}
