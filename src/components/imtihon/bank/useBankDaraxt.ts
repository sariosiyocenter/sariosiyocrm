import { useCallback, useEffect, useState } from 'react';
import { useImtihonApi } from '../useImtihonApi';
import type { BankDaraxt, BankFan, BankMavzu } from '../../../types';

/**
 * Savollar banki daraxti (fan → mavzu, har mavzuda qiyinlik va tur bo'yicha
 * sonlar). `til` berilsa — imtihonga olsa bo'ladigan savollar shu tilda sanaladi.
 */
export function useBankDaraxt(til = '') {
  const { soro } = useImtihonApi();
  const [daraxt, setDaraxt] = useState<BankDaraxt | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  const yangila = useCallback(async () => {
    try {
      const d = await soro<BankDaraxt>('GET', `bank/daraxt${til ? `?til=${til}` : ''}`);
      setDaraxt(d);
      setXato(null);
      return d;
    } catch (e: any) {
      setXato(e.message);
      return null;
    }
  }, [soro, til]);

  useEffect(() => { yangila(); }, [yangila]);
  return { daraxt, xato, yangila };
}

/** Fan (id bo'yicha, bo'lmasa nomi bo'yicha — eski imtihonlar uchun). */
export function fanniTop(daraxt: BankDaraxt | null, id?: number | null, nomi?: string): BankFan | null {
  if (!daraxt) return null;
  if (id) { const f = daraxt.fanlar.find(x => x.id === id); if (f) return f; }
  const k = String(nomi || '').trim().toLowerCase();
  return k ? daraxt.fanlar.find(x => x.name.trim().toLowerCase() === k) || null : null;
}

/** Mavzu (id bo'yicha, bo'lmasa nomi bo'yicha). */
export function mavzuniTop(fan: BankFan | null, id?: number | null, nomi?: string): BankMavzu | null {
  if (!fan) return null;
  if (id) { const m = fan.mavzular.find(x => x.id === id); if (m) return m; }
  const k = String(nomi || '').trim().toLowerCase();
  return k ? fan.mavzular.find(x => x.name.trim().toLowerCase() === k) || null : null;
}

/** Mavzularni bo'lim bo'yicha guruhlash (tartib saqlanadi); bo'limsizlar — bo'sh nom bilan. */
export function bolimlarga(mavzular: BankMavzu[]): { bolim: string; mavzular: BankMavzu[] }[] {
  const out: { bolim: string; mavzular: BankMavzu[] }[] = [];
  for (const m of mavzular) {
    const b = (m.section || '').trim();
    const oxirgi = out[out.length - 1];
    if (oxirgi && oxirgi.bolim === b) oxirgi.mavzular.push(m);
    else out.push({ bolim: b, mavzular: [m] });
  }
  return out;
}
