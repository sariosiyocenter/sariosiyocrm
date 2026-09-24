import { useCallback } from 'react';
import { useCRM } from '../../context/CRMContext';

/** Server xatosi: matni foydalanuvchiga ko'rsatiladi, qo'shimcha ma'lumoti (kamchiliklar) bilan. */
export class ApiXato extends Error {
  status: number;
  malumot: any;
  constructor(message: string, status: number, malumot: any) {
    super(message);
    this.status = status;
    this.malumot = malumot;
  }
}

/** Imtihon moduli so'rovlari: token bilan, xato bo'lsa serverning o'z so'zi bilan. */
export function useImtihonApi() {
  const { token, selectedSchoolId, user } = useCRM();
  const filial = selectedSchoolId && selectedSchoolId > 0 ? selectedSchoolId : user?.schoolId;

  const soro = useCallback(async <T = any>(method: string, yol: string, body?: any): Promise<T> => {
    const res = await fetch(`/api/${yol.replace(/^\/?(api\/)?/, '')}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiXato(data?.error || `Xatolik (${res.status})`, res.status, data);
    return data as T;
  }, [token]);

  return { soro, filial };
}
