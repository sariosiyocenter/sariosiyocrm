import React, { useRef, useState } from 'react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import VektorRasm from './VektorRasm';
import { rasmniQoy, chizmaMatni, ichkiRasm } from './rasmNavbati';
import { svgmi } from '../../../lib/svgRasm';
import type { Question } from '../../../types';

// Bankdagi (saqlangan) savolning chizmasi: AI vektor qilib chizadi, qayta chizadi yoki olib tashlaydi —
// natija shu zahoti savolga saqlanadi. Egasi (2026-10-17): «hozir bor savolga qo'shadigan joy yo'q, AI
// qo'shish kerak, kompyuterdan yuklash emas». Savol qo'shish oynalaridagi chizma bilan bir xil:
// chizma qo'yilsa «[rasm]» belgisi (yoki Word'dan kelgan yagona ichki rasm) matndan olinadi, olib
// tashlansa matn asliga qaytadi (rasmNavbati.rasmniQoy).

export default function SavolChizmasi({ q, avto, onSaqlandi }: {
  q: Question;
  /** Oyna «Rasm chizish (AI)» dan ochilgan: chizma hali vektor bo'lmasa — o'zi boshlaydi. */
  avto?: boolean;
  onSaqlandi: (o: Pick<Question, 'text' | 'imageUrl' | 'xato'>) => void;
}) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  // Oyna ochilgandagi holat: «Asl rasmga qaytish» shu rasmni, olib tashlash — shu matnni qaytaradi.
  const bosh = useRef({ rasm: q.imageUrl && !svgmi(q.imageUrl) ? q.imageUrl : null, ichki: !q.imageUrl && !!ichkiRasm(q.text) });
  const [aslMatn, setAslMatn] = useState<string | undefined>(undefined);
  const { rasm: boshRasm, ichki } = bosh.current;
  const holat = { text: q.text, imageUrl: q.imageUrl, aslMatn };

  const qoy = async (url: string | null) => {
    // Asl rasmga qaytish — chizma olib tashlangandek (matn asliga), faqat rasm o'rnida asl rasm qoladi.
    const yangi = url !== null && url === boshRasm ? { ...rasmniQoy(holat, null, { ichki }), imageUrl: boshRasm } : rasmniQoy(holat, url, { ichki });
    setSaqlanmoqda(true);
    try {
      const r = await soro<Question>('PUT', `questions/${q.id}`, { text: yangi.text, imageUrl: yangi.imageUrl ?? null });
      setAslMatn(yangi.aslMatn);
      onSaqlandi({ text: r.text, imageUrl: r.imageUrl, xato: r.xato });
      showNotification(url ? 'Chizma saqlandi' : 'Chizma olib tashlandi', 'success');
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  return (
    <VektorRasm
      matn={chizmaMatni(holat, ichki)} variantlar={q.type === 'yopiq' ? q.options : null} javob={q.correctAnswer}
      shart={q.passage?.text} fan={q.subject} aslRasm={ichki ? ichkiRasm(q.text) : undefined}
      qiymat={q.imageUrl ?? null} boshQiymat={boshRasm} avto={avto} band={saqlanmoqda} onChange={url => void qoy(url)}
    />
  );
}
