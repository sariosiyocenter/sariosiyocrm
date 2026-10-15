import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';

// Ovozli ko'rsatma (egasi, 2026-10-15: "mikrofonni yoqib yo'l-yo'riq berish"): ustoz gapiradi →
// brauzer yozadi → server Gemini bilan matnga o'giradi (POST ai/ovozdan-matn) → matn maydonga
// qo'shiladi. Ustoz uni ko'rib, tuzatib, keyin AI ga yuboradi — ovozning o'zi hech qayerda saqlanmaydi.

/** Eng uzun yozuv (soniya) — undan keyin o'zi to'xtaydi. */
const ENG_UZUN = 120;
// Brauzerlar yozadigan formatlar: Chrome/Edge — webm, Firefox — ogg, Safari — mp4.
const TURLAR = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];

const qollaydimi = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

function blobdanDataUrl(b: Blob): Promise<string> {
  return new Promise((ok, xato) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => xato(r.error);
    r.readAsDataURL(b);
  });
}

export default function MikrofonTugma({ onMatn, disabled }: { onMatn: (matn: string) => void; disabled?: boolean }) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [holat, setHolat] = useState<'tayyor' | 'yozmoqda' | 'oqimoqda'>('tayyor');
  const [soniya, setSoniya] = useState(0);
  const yozuvchi = useRef<MediaRecorder | null>(null);
  const oqim = useRef<MediaStream | null>(null);
  const ochiq = useRef(true);

  const mikrofonniYop = () => { oqim.current?.getTracks().forEach(t => t.stop()); oqim.current = null; };
  useEffect(() => () => { ochiq.current = false; yozuvchi.current?.state === 'recording' && yozuvchi.current.stop(); mikrofonniYop(); }, []);

  // Yozish davomida soniya sanaladi; chegaraga yetsa o'zi to'xtaydi.
  useEffect(() => {
    if (holat !== 'yozmoqda') return;
    const t = window.setInterval(() => setSoniya(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [holat]);
  useEffect(() => { if (holat === 'yozmoqda' && soniya >= ENG_UZUN) yozuvchi.current?.stop(); }, [holat, soniya]);

  if (!qollaydimi()) return null;

  const matngaOgir = async (bolaklar: Blob[], tur: string) => {
    setHolat('oqimoqda');
    try {
      const audio = await blobdanDataUrl(new Blob(bolaklar, { type: tur }));
      const r = await soro<{ matn: string }>('POST', 'ai/ovozdan-matn', { audio });
      if (!ochiq.current) return;
      if (r.matn) onMatn(r.matn);
      else showNotification("Nutq eshitilmadi — mikrofonga yaqinroq gapirib, qayta urinib ko'ring", 'error');
    } catch (e: any) {
      if (ochiq.current) showNotification(e?.message || "Ovozni matnga o'girib bo'lmadi", 'error');
    } finally {
      if (ochiq.current) setHolat('tayyor');
    }
  };

  const boshla = async () => {
    try {
      oqim.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e: any) {
      showNotification(e?.name === 'NotAllowedError'
        ? "Mikrofonga ruxsat berilmadi — manzil satridagi qulf belgisini bosib, mikrofonga ruxsat bering"
        : 'Mikrofon topilmadi yoki band', 'error');
      return;
    }
    const tur = TURLAR.find(t => MediaRecorder.isTypeSupported(t)) || '';
    const r = new MediaRecorder(oqim.current, { ...(tur ? { mimeType: tur } : {}), audioBitsPerSecond: 32000 });
    const bolaklar: Blob[] = [];
    r.ondataavailable = (e) => { if (e.data.size) bolaklar.push(e.data); };
    r.onstop = () => {
      mikrofonniYop();
      if (ochiq.current && bolaklar.length) matngaOgir(bolaklar, (r.mimeType || tur || 'audio/webm').split(';')[0]);
      else if (ochiq.current) setHolat('tayyor');
    };
    yozuvchi.current = r;
    setSoniya(0);
    r.start(1000);
    setHolat('yozmoqda');
  };

  if (holat === 'yozmoqda') {
    return (
      <button type="button" onClick={() => yozuvchi.current?.stop()} aria-label="Yozishni to'xtatish va matnga o'girish"
        className="inline-flex items-center gap-2 rounded-xl border border-xato-chiziq bg-xato-fon px-3 py-2 text-[12.5px] font-semibold text-xato cursor-pointer">
        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-xato opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-xato" /></span>
        <span className="raqam">{Math.floor(soniya / 60)}:{String(soniya % 60).padStart(2, '0')}</span>
        <Square size={12} fill="currentColor" />To'xtatish
      </button>
    );
  }
  return (
    <button type="button" onClick={boshla} disabled={disabled || holat === 'oqimoqda'} title="Mikrofonni yoqib, ko'rsatmani ovoz bilan ayting — matnga o'giriladi"
      className="inline-flex items-center gap-1.5 rounded-xl border border-chiziq bg-sirt px-3 py-2 text-[12.5px] font-semibold text-matn-sokin hover:border-brand hover:text-brand cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
      {holat === 'oqimoqda' ? <><Loader2 size={14} className="animate-spin" />Matnga o'girilmoqda…</> : <><Mic size={14} />Ovoz bilan aytish</>}
    </button>
  );
}
