import { useEffect, useState } from 'react';
import { useImtihonApi } from './useImtihonApi';

/** AI ulanganmi (serverda GEMINI_API_KEY) — sahifalar orasida bir marta so'raladi. */
export interface AiHolat { yoqilgan: boolean; model: string | null }

let kesh: Promise<AiHolat> | null = null;

export const AI_SOZLANMAGAN = "AI sozlanmagan: Vercel muhitiga GEMINI_API_KEY qo'shilishi kerak";

export function useAiHolat(): AiHolat | null {
  const { soro } = useImtihonApi();
  const [holat, setHolat] = useState<AiHolat | null>(null);
  useEffect(() => {
    if (!kesh) kesh = soro<AiHolat>('GET', 'ai/holat').catch(() => { kesh = null; return { yoqilgan: false, model: null }; });
    let tirik = true;
    kesh.then(h => { if (tirik) setHolat(h); });
    return () => { tirik = false; };
  }, [soro]);
  return holat;
}
