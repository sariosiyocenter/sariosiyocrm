import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Eskiz (SMS provayder) balansi — Xabarlar sahifasi sarlavhasida, hamma tabda.
 *
 * Egasi (2026-10-10): "eskiz balans ko'rinib tursin xabarlarda". Ilgari balans
 * faqat kampaniyani tasdiqlash oynasida ko'rinardi; 2026-10-02 da pul kampaniya
 * o'rtasida tugab, 392 ta SMS ketmay qolgan edi. Tasdiqlash oynasi ham shu
 * qiymatni ishlatadi (useEskizBalansi) — ikkinchi so'rov va holat yo'q.
 */

// 1 ta SMS (bir qism) ning o'rtacha narxi. 2026-10-02 kampaniyasining Eskizdagi
// haqiqiy hisobi: 252 225 so'm / 1 155 qism ≈ 218 so'm (operatorga qarab 95–350).
export const SMS_ORTACHA_NARX = 220;
// Bundan kam — "juda kam": ≈135 ta SMS, avtomatik xabarlarga (to'lov, davomat) bir-ikki kunlik.
const JUDA_KAM = 30_000;
// Bundan kam — "kam": ≈680 ta SMS, hamma ota-onaga bitta umumiy xabarga yetmasligi mumkin.
const KAM = 150_000;

/** undefined — yuklanmoqda, null — bilib bo'lmadi (Eskiz javob bermadi yoki sozlanmagan). */
export type Balans = number | null | undefined;

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

/** "354 075" — minglar orasida bo'shliq. */
export const pulMatni = (n: number) => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');

/** "354 075 so'm" | "…" | "bilib bo'lmadi". */
export const balansMatni = (b: Balans) => (b === undefined ? '…' : b === null ? "bilib bo'lmadi" : `${pulMatni(b)} so'm`);

/** Balans taxminan nechta SMS ga yetadi — aniq son emas, shuning uchun yaxlitlanadi. */
export function taxminiySmsSoni(balans: number): number {
  const n = Math.max(0, Math.floor(balans / SMS_ORTACHA_NARX));
  return n >= 100 ? Math.floor(n / 10) * 10 : n;
}

type Daraja = 'yaxshi' | 'kam' | 'judaKam';
const daraja = (b: number): Daraja => (b < JUDA_KAM ? 'judaKam' : b < KAM ? 'kam' : 'yaxshi');

/**
 * Balansni bir marta oladi va yangilash funksiyasini beradi. Filial almashganda
 * qayta yuklanadi. ruxsatYoq — foydalanuvchi balansni ko'ra olmaydi (ko'rsatilmaydi).
 */
export function useEskizBalansi(schoolId?: number | null) {
  const [balans, setBalans] = useState<Balans>(undefined);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [ruxsatYoq, setRuxsatYoq] = useState(false);
  // Ketma-ket so'rovlardan faqat oxirgisining javobi yoziladi.
  const navbat = useRef(0);

  const yangila = useCallback(async () => {
    const n = ++navbat.current;
    setYuklanmoqda(true);
    try {
      const r = await fetch('/api/sms/balans', { headers: auth() });
      const d = r.ok ? await r.json().catch(() => null) : null;
      if (n !== navbat.current) return;
      setRuxsatYoq(r.status === 403);
      setBalans(typeof d?.balans === 'number' ? d.balans : null);
    } catch {
      if (n === navbat.current) setBalans(null);
    } finally {
      if (n === navbat.current) setYuklanmoqda(false);
    }
  }, []);

  useEffect(() => {
    setBalans(undefined);
    yangila();
  }, [schoolId, yangila]);

  return { balans, yuklanmoqda, ruxsatYoq, yangila };
}

interface Props {
  balans: Balans;
  yuklanmoqda: boolean;
  onYangila: () => void;
}

const RANG: Record<Daraja | 'nomalum', string> = {
  yaxshi: 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200',
  kam: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400',
  judaKam: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400',
  nomalum: 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-400 dark:text-slate-500',
};
// Rangdan tashqari so'z bilan ham: rangni ajrata olmaydigan odam ham ko'rsin.
const IZOH: Record<Daraja, string> = { yaxshi: '', kam: 'kam', judaKam: "juda kam — to'ldiring" };
const TUSHUNTIRISH = `SMS soni taxminiy: 1 ta SMS o'rtacha ${SMS_ORTACHA_NARX} so'm deb hisoblandi (operatorga qarab 95–350 so'm). Uzun yoki kirillcha matn bir kishiga 2–5 ta SMS bo'lib ketadi.`;

export function EskizBalansi({ balans, yuklanmoqda, onYangila }: Props) {
  const son = typeof balans === 'number';
  const d = son ? daraja(balans) : null;
  return (
    <div
      className={`inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-xl border text-[11px] font-bold tabular-nums ${RANG[d || 'nomalum']}`}
      title={son ? TUSHUNTIRISH : balans === null ? "Eskizdan balansni olib bo'lmadi. Yangilash tugmasini bosing; takrorlansa — Sozlamalardagi Eskiz login va parolini tekshiring." : undefined}
    >
      {/* Tor ekranda qismlar orasidan sinadi, raqamning o'zi esa bo'linmaydi. */}
      <span aria-live="polite" className="flex flex-wrap items-center gap-x-1.5">
        <span className="whitespace-nowrap"><span className="font-semibold opacity-70">Eskiz balansi:</span> {balansMatni(balans)}</span>
        {son && <span className="font-semibold opacity-70 whitespace-nowrap">≈ {pulMatni(taxminiySmsSoni(balans))} ta SMS</span>}
        {d && IZOH[d] && <span className="whitespace-nowrap">{IZOH[d]}</span>}
      </span>
      <button
        type="button"
        onClick={onYangila}
        disabled={yuklanmoqda}
        aria-label="Eskiz balansini yangilash"
        title="Yangilash"
        className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60 cursor-pointer transition-colors"
      >
        <RefreshCw size={12} className={yuklanmoqda ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}
