import React, { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { Karta, Tugma, Yorliq, INPUT } from '../ui';
import { useAiHolat, AI_SOZLANMAGAN } from '../useAiHolat';

// Addmen ICR: varaqdagi qo'lyozma katakchalari (ism, telefon…) — skanerda kesib saqlangan rasmi,
// AI o'qigan yoki operator yozgan matni. AI natijasi taklif: operator tuzatsa, o'zi ustun turadi.

export interface IcrYozuv { id: string; sarlavha: string; maydon: string; url: string; matn: string | null; ai?: boolean; ishonch?: number | null }
export type Sahifalar = Record<string, { url: string; icr?: IcrYozuv[] }>;

/** Saqlangan rasm (ochiq havola) → data-URL: AI ga yuborish uchun. */
async function dataUrlga(url: string): Promise<string> {
  const b = await (await fetch(url)).blob();
  return new Promise((ok, xato) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => xato(new Error("Rasmni o'qib bo'lmadi"));
    r.readAsDataURL(b);
  });
}

export default function IcrMaydonlari({ natijaId, pages, tahrir, onYangi }: {
  natijaId: number; pages: Sahifalar; tahrir: boolean; onYangi: (p: Sahifalar) => void;
}) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const ai = useAiHolat();
  const [qoralama, setQoralama] = useState<Record<string, string>>({});
  const [band, setBand] = useState<string | null>(null);
  const maydonlar = Object.entries(pages).flatMap(([p, s]) => (s.icr || []).map(m => ({ ...m, page: p, kalit: `${p}:${m.id}` })));
  if (!maydonlar.length) return null;

  const saqla = async (m: (typeof maydonlar)[number]) => {
    setBand(m.kalit);
    try {
      const r = await soro<{ pages: Sahifalar }>('PUT', `exam-results/${natijaId}/icr`, { page: m.page, id: m.id, matn: qoralama[m.kalit] ?? m.matn ?? '' });
      setQoralama(q => { const n = { ...q }; delete n[m.kalit]; return n; });
      onYangi(r.pages);
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
    }
  };

  const aiBilan = async () => {
    setBand('ai');
    try {
      const l = await Promise.all(maydonlar.map(async m => ({ page: m.page, id: m.id, rasm: await dataUrlga(m.url) })));
      const r = await soro<{ pages: Sahifalar; oqildi: number }>('POST', `exam-results/${natijaId}/icr/ai`, { maydonlar: l });
      onYangi(r.pages);
      setQoralama({});
      showNotification(`${r.oqildi} ta maydon o'qildi — tekshirib chiqing`, 'success');
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
    }
  };

  return (
    <Karta sarlavha="Qo'lyozma maydonlari" izoh="Varaqdagi katakchalarga yozilgani — AI o'qiydi yoki o'zingiz yozasiz"
      amallar={tahrir && (
        <Tugma kichik ikonka={<Sparkles size={13} />} yuklanmoqda={band === 'ai'} disabled={!ai?.yoqilgan || !!band} title={ai?.yoqilgan ? undefined : AI_SOZLANMAGAN} onClick={aiBilan}>AI bilan o'qish</Tugma>
      )}>
      <ul className="space-y-3">
        {maydonlar.map(m => {
          const qiymat = qoralama[m.kalit] ?? m.matn ?? '';
          const ozgargan = m.kalit in qoralama && qoralama[m.kalit] !== (m.matn ?? '');
          return (
            <li key={m.kalit} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <b className="text-matn">{m.sarlavha || "Qo'lyozma"}</b>
                {Object.keys(pages).length > 1 && <span className="text-matn-xira">{m.page}-sahifa</span>}
                {m.matn != null && (m.ai ? <Yorliq rang="ogoh">AI o'qidi{m.ishonch != null ? ` · ${Math.round(m.ishonch * 100)}%` : ''}</Yorliq> : <Yorliq rang="yaxshi">Tekshirildi</Yorliq>)}
              </div>
              <img src={m.url} alt={m.sarlavha || "Qo'lyozma maydoni"} className="max-w-full rounded-lg border border-chiziq bg-white" />
              {tahrir ? (
                <div className="flex gap-2">
                  <input className={`${INPUT} py-1.5`} value={qiymat} placeholder="Varaqda yozilgani" aria-label={m.sarlavha || "Qo'lyozma matni"}
                    onChange={e => setQoralama(q => ({ ...q, [m.kalit]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') saqla(m); }} />
                  <Tugma kichik turi={ozgargan || m.ai ? 'asosiy' : 'ikkinchi'} ikonka={<Check size={13} />} yuklanmoqda={band === m.kalit} disabled={!!band} onClick={() => saqla(m)}>
                    {m.ai && !ozgargan ? 'Tasdiqlash' : 'Saqlash'}
                  </Tugma>
                </div>
              ) : (
                <p className="text-[13px] text-matn">{m.matn || <span className="text-matn-xira">o'qilmagan</span>}</p>
              )}
            </li>
          );
        })}
      </ul>
    </Karta>
  );
}
