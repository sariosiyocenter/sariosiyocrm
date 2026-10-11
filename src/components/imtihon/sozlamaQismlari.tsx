import React from 'react';
import { Maydon, Tugma, INPUT } from './ui';
import { SmsHisobi } from '../SmsHisobi';
import type { ExamSettings } from '../../types';

// Imtihon sozlamasining ikki joyda bir xil ko'rinadigan bo'laklari: bitta imtihonning
// o'z sozlamasi (ExamBuilder) va markazning umumiy sozlamasi (ImtihonSozlamalari).

/** Markazning umumiy sozlamasi (lib/imtihonSozlama.js shakli; GET/PUT /api/imtihon-sozlama). */
export interface ImtihonSozlama {
  yangi: {
    duration: number;
    scoring: 'blok' | 'foiz';
    settings: Pick<ExamSettings, 'source' | 'sessions' | 'variantCount' | 'shuffleQuestions' | 'shuffleOptions' | 'variantBubble'
      | 'seatMode' | 'xatoJarima' | 'jarimaNoldan' | 'otish' | 'ranking' | 'topN' | 'orinUsuli' | 'showQuestionsAfter' | 'rasch' | 'notify' | 'admit'>;
  };
}

// Manfiy ball: xato javob uchun savol balining qancha qismi ayiriladi (Addmen "negative marking").
export const JARIMALAR: { v: number; nom: string }[] = [
  { v: 0, nom: "Yo'q" }, { v: 0.25, nom: '¼' }, { v: 1 / 3, nom: '⅓' }, { v: 0.5, nom: '½' }, { v: 1, nom: "To'liq" },
];

export const NATIJA_OZGARUVCHILARI = '{ism} {imtihon} {sana} {ball} {maks} {foiz} {holat} {rasch} {daraja} {bloklar} {orin} {markaz} {havola}';
export const RUXSATNOMA_OZGARUVCHILARI = '{ism} {imtihon} {sana} {vaqt} {filial} {xona} {qator} {orin} {markaz}';

/**
 * Xabar matni: tahrirlash maydoni, to'ldirilgan namuna va (SMS ketadigan kanalda) necha SMS
 * bo'lishi. `standart` — «Standart matn» tugmasi qaytaradigan matn.
 */
export function XabarShabloni({ nom, ozgaruvchilar, qiymat, onChange, standart, namuna, sms, qatorlar = 5 }: {
  nom: string; ozgaruvchilar: string; qiymat: string; onChange: (matn: string) => void;
  standart: string; namuna: string; sms: boolean; qatorlar?: number;
}) {
  return (
    <>
      <Maydon nom={nom} izoh={ozgaruvchilar}>
        <textarea rows={qatorlar} className={INPUT} value={qiymat} onChange={e => onChange(e.target.value)} />
      </Maydon>
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] text-matn-xira">Namuna:</p>
        {qiymat !== standart && <Tugma type="button" kichik turi="oddiy" onClick={() => onChange(standart)}>Standart matn</Tugma>}
      </div>
      <pre className="whitespace-pre-wrap rounded-xl bg-ichki border border-chiziq p-3 text-[12.5px] text-matn font-sans">{namuna}</pre>
      {sms && <SmsHisobi matn={namuna} toldirilgan />}
    </>
  );
}
