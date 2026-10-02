import React from 'react';
import { smsMatni, smsSoni, gsmEmasBelgilar, ESKI_QIMMAT_HARF } from '../../lib/tolovXabari.js';
import { fillTemplate } from '../../lib/xabarMatni.js';

/**
 * Matn necha SMS bo'lib ketishi — shablon, yangi xabar, avtomatik qoida va
 * imtihon xabarlari ostida bir xil ko'rinishda.
 *
 * Egasi (2026-10-02): kampaniya matnidagi bitta "ı" har bir xabarni 5 SMS
 * qildi, ekranda esa buni sezmadi — "ogohlantirish qo'yish kerakda shablon
 * qo'shayotganda nechta sms bo'lishini".
 */

// {ism}, {qarz}… o'rniga uzunroq namunaviy qiymatlar: hisob kam chiqib qolmasin.
const NAMUNA = {
  name: 'Abdurahmonov Muhammadali', balance: -1500000, lastPaymentAmount: 1500000, customPaymentAmount: 1500000,
  customExamName: 'Oylik imtihon', customExamScore: 85, customExamPercentage: 85, customDailyScore: 5, oylikImtihon: 'Oylik imtihon: 85 ball',
};
const NAMUNA_KURS = [{ name: 'Matematika-1', courseName: 'Matematika', teacherName: 'Karimov Anvar' }];

export type SmsHisob = ReturnType<typeof smsHisobla>;

/**
 * toldirilgan=true — matn allaqachon namunaviy qiymatlar bilan to'ldirilgan
 * (masalan imtihon xabari namunasi), aks holda o'zgaruvchilar shu yerda to'ldiriladi.
 */
export function smsHisobla(matn: string, orgName?: string, toldirilgan = false) {
  const ozgaruvchili = !toldirilgan && /\{[a-z_]+\}/i.test(matn);
  const toliq = toldirilgan ? matn
    : fillTemplate(matn, NAMUNA, NAMUNA_KURS, { orgName: orgName || 'SARIOSIYO' }).replace(/\{[a-z_]+\}/gi, 'x'.repeat(12));
  const t = smsMatni(toliq);
  const s = smsSoni(t);
  const belgilar = gsmEmasBelgilar(t);
  return {
    ...s,
    qimmat: s.kodlash === 'UCS-2',
    belgilar,
    // Shu belgilar lotinga almashtirilsa nechta bo'lardi.
    gsmdaSoni: smsSoni(t.replace(/[^\n -~]/g, 'a')).soni,
    ozgaruvchili,
    // ı ş ç ğ — yuborishda o'zi lotinga almashtiriladi (smsMatni).
    turkcha: [...new Set([...matn].filter(c => ESKI_QIMMAT_HARF.test(c) && /\p{L}/u.test(c)))],
  };
}

export function SmsHisobi({ matn, orgName, toldirilgan, className = '' }: { matn: string; orgName?: string; toldirilgan?: boolean; className?: string }) {
  if (!matn.trim()) return null;
  const h = smsHisobla(matn, orgName, toldirilgan);
  const namunaIzoh = (h.ozgaruvchili ? " {ism} kabi o'zgaruvchilar o'rniga namunaviy qiymat qo'yib hisoblandi." : '')
    + (h.turkcha.length ? ` Turkcha ${h.turkcha.join(' ')} SMS da lotinga (i, sh, ch, g') almashtiriladi.` : '');

  if (h.qimmat) {
    return (
      <div role="alert" className={`p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-[11px] font-bold text-rose-600 dark:text-rose-400 leading-relaxed ${className}`}>
        <div className="text-xs font-black">Har bir kishiga {h.soni} ta SMS ketadi</div>
        Matnda lotin bo'lmagan belgi bor: <span className="font-mono">{h.belgilar.slice(0, 8).join(' ')}</span>.
        {' '}Shu sabab 1 ta SMS 160 emas, 70 belgi{h.gsmdaSoni < h.soni ? ` — bularsiz ${h.gsmdaSoni} ta SMS bo'lardi` : ''}.{namunaIzoh}
      </div>
    );
  }
  if (h.soni > 1) {
    return (
      <div className={`p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[11px] font-bold text-amber-700 dark:text-amber-400 leading-relaxed tabular-nums ${className}`}>
        <div className="text-xs font-black">Har bir kishiga {h.soni} ta SMS ketadi</div>
        {h.belgi} belgi; 1 ta SMS — 160 belgigacha. 1 ta bo'lishi uchun {h.belgi - 160} belgi qisqartiring.{namunaIzoh}
      </div>
    );
  }
  return (
    <div className={`text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums ${className}`}>
      Har bir kishiga 1 ta SMS · {h.belgi}/160 belgi{h.ozgaruvchili ? ' (namunaviy ism bilan)' : ''}
    </div>
  );
}
