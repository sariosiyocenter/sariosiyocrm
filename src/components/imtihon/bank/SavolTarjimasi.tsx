import React, { useEffect, useState } from 'react';
import { Languages, Loader2, Save } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { useAiHolat, AI_SOZLANMAGAN } from '../useAiHolat';
import { Tanlov, Tugma, Yorliq } from '../ui';
import { formulaliHtml, oddiyMatn, SAVOL_MATNI } from '../../../lib/matn';
import { HARFLAR } from '../../../../lib/imtihon.js';
import { boshTarjimaTili, tarjimaQilinmaydimi, tarjimaTillari, tilNomi } from '../../../../lib/tarjimaKop.js';
import { xatoMatni } from './aiUmumiy';
import type { Question } from '../../../types';

// Savol oynasidagi «Tarjima» bo'limi (egasi, 2026-10-15: "savollarni tarjima qilish imkoniyati ham
// qo'shgin"): til tanlanadi, AI tarjimasi oldindan ko'rinadi (POST ai/tarjima-matn — hech narsa
// saqlanmaydi) va «Qoralama sifatida saqlash» (POST ai/tarjima) tarjimani yangi QORALAMA savol qilib
// bankka yozadi (asl savolga bog'langan, kalit o'sha). Guruhli savol (MS-33-35, MS-36-45) tarjima
// qilinmaydi — server ham rad etadi. Savolning «ikkinchi til» maydonidagi tarjimasi bo'lsa — ko'rsatiladi.

interface Korinish { til: string; text: string; options: string[] }

const HTML_SINFI = `${SAVOL_MATNI} text-[13px] text-matn`;

export default function SavolTarjimasi({ q, tahrir, onSaqlandi }: {
  q: Question; tahrir: boolean;
  /** Tarjima qoralama savol bo'lib saqlandi (ro'yxat yangilansin). */
  onSaqlandi?: (id: number) => void;
}) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const ai = useAiHolat();
  const ozTili = q.language || 'uz';
  const tillar = tarjimaTillari(ozTili);
  const guruhli = tarjimaQilinmaydimi(q.type);
  const [til, setTil] = useState<string>(boshTarjimaTili(ozTili));
  const [korinish, setKorinish] = useState<Korinish | null>(null);
  const [band, setBand] = useState<'korish' | 'saqla' | null>(null);
  // Shu oynada qoralama bo'lib saqlangan tarjimalar (til → yangi savol id).
  const [saqlangan, setSaqlangan] = useState<Record<string, number>>({});

  // Til almashsa — eski ko'rinish boshqa tilniki bo'lib qoladi: olib tashlanadi.
  useEffect(() => { setKorinish(k => (k && k.til !== til ? null : k)); }, [til]);

  const mavjud = q.tarjima && (oddiyMatn(q.tarjima.text || '').trim() || q.tarjima.options?.some(o => oddiyMatn(o).trim())) ? q.tarjima : null;
  if (!tahrir && !mavjud) return null;

  const aiYoq = !!ai && !ai.yoqilgan;
  const sabab = guruhli ? "Guruhli savol (MS-33-35, MS-36-45) hozircha tarjima qilinmaydi — har bo'lagi umumiy shartga bog'liq" : aiYoq ? AI_SOZLANMAGAN : null;

  const korish = async () => {
    if (band) return;
    setBand('korish');
    try {
      const r = await soro<Korinish>('POST', `questions/${q.id}/ai/tarjima-matn`, { til });
      setKorinish({ til: r.til || til, text: r.text || '', options: r.options || [] });
    } catch (e: unknown) {
      showNotification(xatoMatni(e), 'error');
    } finally {
      setBand(null);
    }
  };

  const saqla = async () => {
    if (band) return;
    setBand('saqla');
    try {
      const r = await soro<{ id: number; language: string }>('POST', `questions/${q.id}/ai/tarjima`, { til });
      setSaqlangan(s => ({ ...s, [til]: r.id }));
      showNotification(`${tilNomi(til)} tarjima #${r.id} qoralama savol bo'lib saqlandi — bankda ko'rib chiqib, faol qilasiz`, 'success');
      onSaqlandi?.(r.id);
    } catch (e: unknown) {
      showNotification(xatoMatni(e), 'error');
    } finally {
      setBand(null);
    }
  };

  return (
    <section aria-label="Tarjima" className="rounded-xl border border-chiziq p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Languages size={15} className="text-matn-xira shrink-0" />
        <h4 className="text-[13px] font-bold text-matn">Tarjima</h4>
        <Yorliq>asl til: {tilNomi(ozTili).toLowerCase()}</Yorliq>
      </div>

      {mavjud && (
        <div className="rounded-lg border border-chiziq bg-ichki p-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-matn-xira">Savolda saqlangan tarjima — {tilNomi(mavjud.til).toLowerCase()}</p>
          <div className={HTML_SINFI} dangerouslySetInnerHTML={{ __html: formulaliHtml(mavjud.text) }} />
          {mavjud.options?.some(o => o && o.trim()) && (
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[12.5px] text-matn">
              {mavjud.options.map((o, i) => o && o.trim() ? <li key={i} className="flex gap-1.5"><b className="text-matn-xira">{HARFLAR[i]})</b><span dangerouslySetInnerHTML={{ __html: formulaliHtml(o) }} /></li> : null)}
            </ol>
          )}
        </div>
      )}

      {tahrir && (sabab && guruhli ? <p className="text-[12px] text-matn-xira">{sabab}</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Tanlov kichik qiymat={til} onChange={setTil} variantlar={tillar.map(t => ({ v: t.v, nom: t.nom }))} />
            <Tugma kichik ikonka={band === 'korish' ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />} disabled={!!band || !!sabab} title={sabab || undefined} onClick={korish}>
              Tarjimasini ko'rish
            </Tugma>
          </div>
          {sabab && <p className="text-[12px] text-ogoh">{sabab}</p>}
          {korinish && (
            <div className="rounded-lg border border-brand/40 bg-sirt p-3 space-y-2">
              <p className="text-[11px] font-semibold text-matn-xira">AI tarjimasi — {tilNomi(korinish.til).toLowerCase()} (hali saqlanmagan)</p>
              <div className={HTML_SINFI} dangerouslySetInnerHTML={{ __html: formulaliHtml(korinish.text) }} />
              {korinish.options.length > 0 && (
                <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {korinish.options.map((o, i) => (
                    <li key={i} className={`flex gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] text-matn ${HARFLAR[i] === String(q.correctAnswer || '').toUpperCase() ? 'border-yaxshi/40 bg-yaxshi-fon' : 'border-chiziq bg-ichki'}`}>
                      <b>{HARFLAR[i]})</b><span dangerouslySetInnerHTML={{ __html: formulaliHtml(o) }} />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Tugma kichik turi="asosiy" ikonka={<Save size={13} />} yuklanmoqda={band === 'saqla'} disabled={!!band || !!sabab || !!saqlangan[til]} title={sabab || undefined} onClick={saqla}>
              Qoralama sifatida saqlash
            </Tugma>
            {saqlangan[til]
              ? <span className="text-[12px] text-yaxshi font-semibold">Saqlandi: #{saqlangan[til]} (qoralama)</span>
              : <span className="text-[11.5px] text-matn-xira">Saqlashda tarjima qayta bajariladi; yangi savol qoralama bo'lib tushadi, asl savolga tegilmaydi.</span>}
          </div>
        </>
      ))}
    </section>
  );
}
