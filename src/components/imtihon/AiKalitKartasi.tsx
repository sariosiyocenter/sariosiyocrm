import React, { useState } from 'react';
import { Sparkles, ExternalLink, Eye, EyeOff, Trash2, KeyRound, ShieldCheck } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { useImtihonApi } from './useImtihonApi';
import { useAiHolat, aiHolatiniQoy, type AiHolat } from './useAiHolat';
import { Tugma, INPUT, Yorliq } from './ui';

// AI kaliti (Google Gemini) — administrator CRM ning o'zida kiritadi (Vercel
// sozlamalariga kirmasdan). Kalit bepul: aistudio.google.com/apikey. Server
// saqlashdan oldin uni sinab ko'radi; brauzerga faqat oxirgi 4 belgisi qaytadi.
// Joyi: Imtihonlar → Sozlamalar va Savollar banki → Sozlamalar (to'liq karta); AI
// kerak bo'lgan oynalarda (savol yuklash, o'xshash masala) — `ixcham` ko'rinishi.

const KALIT_SAYTI = 'https://aistudio.google.com/apikey';

export default function AiKalitKartasi({ ixcham, onUlandi }: { ixcham?: boolean; onUlandi?: () => void }) {
  const { showNotification } = useCRM();
  const confirm = useConfirm();
  const { soro } = useImtihonApi();
  const holat = useAiHolat();
  const [kalit, setKalit] = useState('');
  const [korsat, setKorsat] = useState(false);
  const [band, setBand] = useState(false);
  const [almashtir, setAlmashtir] = useState(false);

  const saqla = async (yangi: string) => {
    setBand(true);
    try {
      const h = await soro<AiHolat>('PUT', 'ai/kalit', { kalit: yangi });
      aiHolatiniQoy(h);
      setKalit('');
      setAlmashtir(false);
      showNotification(yangi ? 'AI ulandi — kalit sinovdan o\'tdi' : "AI kaliti o'chirildi", 'success');
      if (yangi) onUlandi?.();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const ochir = async () => {
    if (!(await confirm("AI kaliti o'chirilsinmi? Rasmdan o'qish, o'xshash masala va yechim yozish ishlamay qoladi."))) return;
    saqla('');
  };

  if (!holat) return null;
  const kiritish = holat.sozlay && (holat.manba !== 'markaz' || almashtir);

  return (
    <div className={`border border-chiziq rounded-2xl space-y-4 p-4 ${ixcham ? 'bg-ichki/40' : 'bg-sirt shadow-sm'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-brand-fon text-brand border border-brand/20 flex items-center justify-center dark:bg-brand/20">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-matn tracking-wide">AI yordamchi (Google Gemini)</p>
            <p className="text-[11px] font-bold text-matn-xira mt-0.5">Rasmdan savol o'qish, o'xshash masala tuzish, yechim yozish</p>
          </div>
        </div>
        <Yorliq rang={holat.yoqilgan ? 'yaxshi' : 'kulrang'}>{holat.yoqilgan ? 'Ulangan' : 'Ulanmagan'}</Yorliq>
      </div>

      {holat.manba === 'markaz' && !almashtir && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-chiziq bg-sirt px-3 py-2.5">
          <span className="inline-flex items-center gap-2 text-[12.5px] text-matn">
            <KeyRound size={14} className="text-matn-xira" /> Kalit: <span className="raqam tracking-wider">••••••••{holat.kalitOxiri}</span>
          </span>
          {holat.sozlay && (
            <span className="flex gap-1.5">
              <Tugma type="button" kichik turi="oddiy" onClick={() => setAlmashtir(true)}>Almashtirish</Tugma>
              <Tugma type="button" kichik turi="oddiy" ikonka={<Trash2 size={13} />} yuklanmoqda={band} onClick={ochir} aria-label="Kalitni o'chirish" />
            </span>
          )}
        </div>
      )}
      {holat.manba === 'server' && !almashtir && (
        <p className="text-[12px] text-matn-sokin">Serverdagi umumiy kalit ishlayapti.{holat.sozlay ? " O'z kalitingizni kiritsangiz — shu ishlatiladi." : ''}</p>
      )}

      {!holat.sozlay && !holat.yoqilgan && (
        <p className="text-[12.5px] text-matn-sokin">AI hali yoqilmagan. Kalitni administrator kiritadi: Imtihonlar → Sozlamalar.</p>
      )}

      {kiritish && (
        <div className="space-y-3">
          {holat.manba !== 'markaz' && (
            <ol className="space-y-1.5 text-[12.5px] text-matn">
              <li className="flex gap-2"><b className="raqam text-brand">1.</b><span>
                <a href={KALIT_SAYTI} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand underline">aistudio.google.com/apikey <ExternalLink size={11} /></a>
                {' '}ni oching va Google hisobingiz bilan kiring (bepul).</span></li>
              <li className="flex gap-2"><b className="raqam text-brand">2.</b><span>«Create API key» tugmasini bosing, chiqqan kalitni «Copy» bilan nusxalang.</span></li>
              <li className="flex gap-2"><b className="raqam text-brand">3.</b><span>Pastga qo'yib, «Ulash» ni bosing — CRM kalitni sinab ko'radi.</span></li>
            </ol>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type={korsat ? 'text' : 'password'} className={`${INPUT} pr-10`} value={kalit} autoComplete="off" spellCheck={false}
                placeholder="AIza…" aria-label="AI kaliti" onChange={e => setKalit(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (kalit.trim()) saqla(kalit.trim()); } }}
              />
              <button type="button" aria-label={korsat ? 'Kalitni yashirish' : "Kalitni ko'rsatish"} onClick={() => setKorsat(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-matn-xira hover:text-matn cursor-pointer">
                {korsat ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="flex gap-2">
              {almashtir && <Tugma type="button" onClick={() => { setAlmashtir(false); setKalit(''); }}>Bekor</Tugma>}
              <Tugma type="button" turi="asosiy" className="flex-1 sm:flex-none" ikonka={<Sparkles size={14} />} yuklanmoqda={band} disabled={!kalit.trim()} onClick={() => saqla(kalit.trim())}>
                {band ? 'Sinalmoqda…' : 'Ulash'}
              </Tugma>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-[11.5px] text-matn-xira"><ShieldCheck size={12} /> Kalit faqat serverda saqlanadi — hech kimga ko'rinmaydi.</p>
        </div>
      )}
    </div>
  );
}
