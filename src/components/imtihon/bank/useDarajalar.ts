import { useEffect } from 'react';
import { useImtihonApi } from '../useImtihonApi';
import { darajalarniSozla, hammaDarajalar, useQiyinlik, type DarajaBandi } from './qiyinlik';
import type { BelgiGuruhi } from '../../../types';

/**
 * Qiyinlik darajalarining to'liq ro'yxati: asosiy o'rinlar va foydalanuvchi bankda qo'shganlari
 * ("Juda qiyin"…). Egasi, 2026-10-10: "qiyinlikni hammasi chiqmayapti" — savol qo'shish oynalari
 * faqat asosiy uch o'rinni bilardi (ular `bank/daraxt` bilan keladi), foydalanuvchi darajalari esa
 * faqat bank ro'yxatiga (`bank/filtr`) kelardi. Oyna ochilganda shu yerda bir marta so'raladi.
 */
export function useDarajalar(): DarajaBandi[] {
  const { soro } = useImtihonApi();
  useEffect(() => {
    let tirik = true;
    soro<BelgiGuruhi[]>('GET', 'bank/belgilar')
      .then((guruhlar) => { if (tirik) darajalarniSozla(guruhlar.find(g => g.tur === 'qiyinlik')?.tags || []); })
      .catch(() => { /* asosiy darajalar bilan ishlayveradi */ });
    return () => { tirik = false; };
  }, [soro]);
  useQiyinlik();
  return hammaDarajalar();
}
