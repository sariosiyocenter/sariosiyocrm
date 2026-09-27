import { useEffect, useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';

/** AI holati: kalit markazniki (Sozlamalar → Integratsiyalar) yoki serverniki. Sahifalar orasida bir marta so'raladi. */
export interface AiHolat {
  yoqilgan: boolean;
  model: string | null;
  manba: 'markaz' | 'server' | null;
  /** Administrator — kalitni kirita oladi. */
  sozlay: boolean;
  /** Markaz kalitining oxirgi 4 belgisi (faqat administratorga). */
  kalitOxiri: string | null;
}

const BOSH: AiHolat = { yoqilgan: false, model: null, manba: null, sozlay: false, kalitOxiri: null };

// Kesh foydalanuvchi (token) bo'yicha: boshqa xodim kirsa — qayta so'raladi.
let kesh: { token: string | null; p: Promise<AiHolat> } | null = null;
const tinglovchilar = new Set<(h: AiHolat) => void>();

export const AI_SOZLANMAGAN = "AI yoqilmagan — administrator Sozlamalar → Integratsiyalar bo'limida AI kalitini kiritadi";

/** Kalit saqlangach — ochiq sahifalarning hammasi yangi holatni ko'radi. */
export function aiHolatiniQoy(h: AiHolat) {
  if (kesh) kesh = { token: kesh.token, p: Promise.resolve(h) };
  tinglovchilar.forEach(f => f(h));
}

export function useAiHolat(): AiHolat | null {
  const { token } = useCRM();
  const { soro } = useImtihonApi();
  const [holat, setHolat] = useState<AiHolat | null>(null);
  useEffect(() => {
    if (!kesh || kesh.token !== token) {
      kesh = { token, p: soro<AiHolat>('GET', 'ai/holat').then(h => ({ ...BOSH, ...h })).catch(() => { kesh = null; return BOSH; }) };
    }
    let tirik = true;
    kesh.p.then(h => { if (tirik) setHolat(h); });
    const f = (h: AiHolat) => { if (tirik) setHolat(h); };
    tinglovchilar.add(f);
    return () => { tirik = false; tinglovchilar.delete(f); };
  }, [soro, token]);
  return holat;
}
