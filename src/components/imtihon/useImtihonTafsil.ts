import { useCallback, useEffect, useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import type { ImtihonTafsil } from '../ExamDetail';

/**
 * Bitta imtihonning to'liq ma'lumoti (variantlar, kurslar, sanoqlar) —
 * imtihon sahifasi ham, modul sahifasidagi O'rinlashtirish / Chop etish /
 * Skaner / Natijalar tablari ham shu bilan ishlaydi.
 */
export function useImtihonTafsil(id: number | null) {
  const { imtihonniYangila } = useCRM();
  const { soro } = useImtihonApi();
  const [exam, setExam] = useState<ImtihonTafsil | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  const yangila = useCallback(async () => {
    if (!id) return null;
    try {
      const e = await soro<ImtihonTafsil>('GET', `exams/${id}`);
      setExam(e);
      setXato(null);
      imtihonniYangila(e);
      return e;
    } catch (err: any) {
      setXato(err.message);
      return null;
    }
  }, [id, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setExam(null);
    setXato(null);
    yangila();
  }, [yangila]);

  return { exam, xato, yangila };
}
