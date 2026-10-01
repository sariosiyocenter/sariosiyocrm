import { varaqTuzilmasi } from '../../../lib/imtihon.js';
import type { VaraqParametrlari } from '../../lib/omr/layout';
import type { Exam } from '../../types';

// Imtihondan javob varaqasi parametrlari — chop etish, skaner, tekshirish va kalit
// varag'i bir xil geometriyani olishi shart (aks holda varaq o'qilmaydi).
export function varaqParametrlari(exam: Pick<Exam, 'blocks' | 'scoring' | 'settings'>): VaraqParametrlari {
  const s = exam.settings;
  return {
    tuzilma: varaqTuzilmasi(exam.blocks, exam.scoring) as VaraqParametrlari['tuzilma'],
    optionCount: s.optionCount, variantCount: s.variantCount, variantBubble: s.variantBubble,
    sorovnoma: s.source === 'sorovnoma' && s.sorovnoma ? { savollar: s.sorovnoma.savollar, shkala: s.sorovnoma.shkala, anonim: s.sorovnoma.anonim } : null,
  };
}
