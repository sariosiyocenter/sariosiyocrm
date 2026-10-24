import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { pastlat, wavYasa, WAV_CHASTOTA } from '../../../lib/wavKodla.js';

// Ovozli ko'rsatma (egasi, 2026-10-15: "mikrofonni yoqib yo'l-yo'riq berish"): ustoz gapiradi →
// brauzer yozadi → server Gemini bilan matnga o'giradi (POST ai/ovozdan-matn) → matn maydonga
// qo'shiladi. Ustoz uni ko'rib, tuzatib, keyin AI ga yuboradi — ovozning o'zi hech qayerda saqlanmaydi.
//
// Ikki yo'l: Opus yoza oladigan brauzer (Chrome, Edge, Firefox) — MediaRecorder (siqilgan, 2 daqiqa);
// qolgani — MacBook'dagi Safari (u faqat MP4/AAC yozadi va u matnga o'girilmadi, egasi 2026-10-22) —
// Web Audio bilan xom ovoz → WAV (lib/wavKodla.js; hajmi katta, shuning uchun 1 daqiqa).

const OPUS = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];
/** Safari (yangilari WebM ni ham «qo'llayman» deydi) — har doim WAV yo'li: shikoyat aynan undan. */
const safarimi = () => /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(navigator.userAgent);
const opusTuri = (): string | null =>
  (typeof MediaRecorder !== 'undefined' && !safarimi() && OPUS.find(t => MediaRecorder.isTypeSupported?.(t))) || null;
const ovozKonteksti = (): typeof AudioContext | undefined =>
  typeof window === 'undefined' ? undefined : window.AudioContext || (window as any).webkitAudioContext;
const qollaydimi = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && (!!opusTuri() || !!ovozKonteksti());

/** Eng uzun yozuv (soniya) — undan keyin o'zi to'xtaydi. WAV siqilmagan: so'rov hajmiga sig'sin. */
const ENG_UZUN = { opus: 120, wav: 60 };
/** WAV yozuvidagi eng baland nuqta shundan past bo'lsa — mikrofondan ovoz kelmagan (o'chirilgan yoki boshqa qurilma). */
const JIMLIK = 0.004;

function blobdanDataUrl(b: Blob): Promise<string> {
  return new Promise((ok, xato) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => xato(r.error);
    r.readAsDataURL(b);
  });
}

const macmi = () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

/** getUserMedia xatosi → nima qilish kerakligi (MacBook'da tizim ruxsati ham alohida so'raladi). */
function mikrofonXatosi(e: any): string {
  const nom = e?.name;
  if (nom === 'NotAllowedError' || nom === 'SecurityError') {
    if (!macmi()) return 'Mikrofonga ruxsat berilmadi — manzil satridagi qulf belgisini bosib, mikrofonga ruxsat bering';
    // Chrome tizim taqiqlaganini aytadi («Permission denied by system»); Safari ikkalasini bir xil aytadi.
    return /system/i.test(String(e?.message || ''))
      ? "MacBook mikrofonni brauzerga bermayapti: Tizim sozlamalari → Maxfiylik va xavfsizlik → Mikrofon → brauzeringizni yoqing va brauzerni qayta oching"
      : "Mikrofonga ruxsat yo'q. Safari'da: Safari → Sozlamalar → Veb-saytlar → Mikrofon → shu sayt uchun «Ruxsat». Bo'lmasa: Tizim sozlamalari → Maxfiylik va xavfsizlik → Mikrofon → brauzerni yoqing";
  }
  if (nom === 'NotFoundError' || nom === 'OverconstrainedError') return 'Mikrofon topilmadi — ulanganini tekshiring';
  if (nom === 'NotReadableError' || nom === 'AbortError') return "Mikrofon boshqa dasturda band (Zoom, Telegram qo'ng'irog'i…) — o'shani yopib, qayta urinib ko'ring";
  return "Mikrofonni yoqib bo'lmadi";
}

export default function MikrofonTugma({ onMatn, disabled }: { onMatn: (matn: string) => void; disabled?: boolean }) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [holat, setHolat] = useState<'tayyor' | 'yozmoqda' | 'oqimoqda'>('tayyor');
  const [soniya, setSoniya] = useState(0);
  const [chegara, setChegara] = useState(ENG_UZUN.opus);
  /** Yozishni to'xtatadi va yozuvni matnga yuboradi (yozish yo'liga qarab). */
  const toxtat = useRef<(() => void) | null>(null);
  const oqim = useRef<MediaStream | null>(null);
  const ochiq = useRef(true);
  const boshlanmoqda = useRef(false);

  const mikrofonniYop = () => { oqim.current?.getTracks().forEach(t => t.stop()); oqim.current = null; };
  useEffect(() => () => { ochiq.current = false; toxtat.current?.(); mikrofonniYop(); }, []);

  // Yozish davomida soniya sanaladi; chegaraga yetsa o'zi to'xtaydi.
  useEffect(() => {
    if (holat !== 'yozmoqda') return;
    const t = window.setInterval(() => setSoniya(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [holat]);
  useEffect(() => { if (holat === 'yozmoqda' && soniya >= chegara) toxtat.current?.(); }, [holat, soniya, chegara]);

  if (!qollaydimi()) return null;

  const matngaOgir = async (ovoz: Blob) => {
    setHolat('oqimoqda');
    try {
      const audio = await blobdanDataUrl(ovoz);
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

  const opusBilanYoz = (strim: MediaStream, tur: string) => {
    const r = new MediaRecorder(strim, { mimeType: tur, audioBitsPerSecond: 32000 });
    const bolaklar: Blob[] = [];
    r.ondataavailable = (e) => { if (e.data.size) bolaklar.push(e.data); };
    r.onstop = () => {
      mikrofonniYop();
      if (ochiq.current && bolaklar.length) void matngaOgir(new Blob(bolaklar, { type: (r.mimeType || tur).split(';')[0] }));
      else if (ochiq.current) setHolat('tayyor');
    };
    toxtat.current = () => { toxtat.current = null; if (r.state === 'recording') r.stop(); };
    r.start();
  };

  const wavBilanYoz = (strim: MediaStream, kontekst: AudioContext) => {
    void kontekst.resume();
    const manba = kontekst.createMediaStreamSource(strim);
    // ScriptProcessor eskirgan, lekin Safari'ning hamma versiyasida bor (AudioWorklet alohida fayl so'raydi).
    const ishlov = kontekst.createScriptProcessor(4096, 1, 1);
    const bolaklar: Float32Array[] = [];
    ishlov.onaudioprocess = (e) => bolaklar.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    manba.connect(ishlov);
    // Safari chiqishga ulanmagan ishlovchini chaqirmaydi; chiqishi bo'sh — eshitilmaydi.
    ishlov.connect(kontekst.destination);
    toxtat.current = () => {
      toxtat.current = null;
      ishlov.disconnect();
      manba.disconnect();
      const chastota = kontekst.sampleRate;
      void kontekst.close();
      mikrofonniYop();
      if (!ochiq.current) return;
      const namunalar = pastlat(bolaklar, chastota);
      let eng = 0;
      for (let i = 0; i < namunalar.length; i++) eng = Math.max(eng, Math.abs(namunalar[i]));
      if (eng < JIMLIK) {
        setHolat('tayyor');
        showNotification(macmi()
          ? "Mikrofondan ovoz kelmadi — Tizim sozlamalari → Ovoz → Kirish bo'limida to'g'ri mikrofon tanlanganini va ovoz darajasini tekshiring"
          : "Mikrofondan ovoz kelmadi — mikrofon o'chirilmaganini tekshiring", 'error');
        return;
      }
      // 16 kHz dan past kontekst (kamdan-kam) — namunalar o'z chastotasida qoladi, sarlavha ham shunday.
      void matngaOgir(new Blob([wavYasa(namunalar, Math.min(chastota, WAV_CHASTOTA))], { type: 'audio/wav' }));
    };
  };

  const boshla = async () => {
    // Ruxsat oynasi turganda qayta bosilsa — ikkinchi mikrofon oqimi ochilib, yoniq qolib ketardi.
    if (boshlanmoqda.current) return;
    boshlanmoqda.current = true;
    const tur = opusTuri();
    // Safari ovoz kontekstini faqat bosish paytida ishga tushiradi — ruxsat so'rovidan OLDIN yaratiladi.
    const Kontekst = ovozKonteksti();
    const kontekst = !tur && Kontekst ? new Kontekst() : null;
    try {
      oqim.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e: any) {
      void kontekst?.close();
      if (ochiq.current) showNotification(mikrofonXatosi(e), 'error');
      return;
    } finally {
      boshlanmoqda.current = false;
    }
    // Ruxsat kutilayotganda oyna yopildi — mikrofon yoniq qolmasin.
    if (!ochiq.current) { mikrofonniYop(); void kontekst?.close(); return; }
    try {
      if (tur) opusBilanYoz(oqim.current, tur);
      else wavBilanYoz(oqim.current, kontekst!);
    } catch {
      void kontekst?.close();
      mikrofonniYop();
      showNotification("Bu brauzer ovoz yoza olmadi — Chrome'da urinib ko'ring", 'error');
      return;
    }
    setChegara(tur ? ENG_UZUN.opus : ENG_UZUN.wav);
    setSoniya(0);
    setHolat('yozmoqda');
  };

  if (holat === 'yozmoqda') {
    return (
      <button type="button" onClick={() => toxtat.current?.()} aria-label="Yozishni to'xtatish va matnga o'girish"
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
