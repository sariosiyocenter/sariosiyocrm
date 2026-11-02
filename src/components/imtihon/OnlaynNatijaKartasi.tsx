import React, { useEffect, useState } from 'react';
import { Copy, ExternalLink, Printer } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { chopEt, esc } from '../../lib/chopEtish';
import { SozlamaKartasi } from './sozlamaQismlari';
import { Almashtirgich, Tugma, INPUT } from './ui';
import { sanaMatni } from './format';
import type { ImtihonTafsil } from './turlar';

// Addmen «Online result»: imtihonning bitta ochiq havolasi. O'quvchi telefonda ID va telefon
// oxirgi 4 raqamini (yoki varaq kodini) kiritib natijasini ko'radi. Havola va QR — devorga,
// Telegram kanalga; «E'lon varag'i» — A4 da chop etiladigan QR li varaq.

const KALITLAR = ['onlaynNatija'] as const;

async function qrRasm(matn: string, olcham: number): Promise<string> {
  const lib = await import('qrcode');
  const QRCode = (lib as any).default || lib;
  return QRCode.toDataURL(matn, { width: olcham, margin: 1 });
}

const ELON_CSS = `
@page { size: A4; margin: 16mm; }
body { font: 12pt/1.4 Arial, Helvetica, sans-serif; color: #000; text-align: center; margin: 0; }
.markaz { font-size: 12pt; letter-spacing: 1pt; text-transform: uppercase; color: #333; margin-top: 6mm; }
h1 { font-size: 26pt; margin: 4mm 0 2mm; }
.sana { font-size: 13pt; color: #333; }
.qr { width: 105mm; height: 105mm; margin: 12mm auto 6mm; display: block; }
.chaqiriq { font-size: 20pt; font-weight: 700; margin: 0 0 6mm; }
ol { text-align: left; display: inline-block; font-size: 13pt; margin: 0 auto; padding-left: 7mm; }
li { margin: 1.5mm 0; }
.havola { margin-top: 8mm; font: 11pt 'Courier New', monospace; word-break: break-all; color: #333; }
`;

export default function OnlaynNatijaKartasi({ exam, yangila, tahrir }: { exam: ImtihonTafsil; yangila: () => Promise<unknown>; tahrir: boolean }) {
  const { settings, showNotification } = useCRM();
  const havola = exam.natijalarHavolasi ? `${window.location.origin}${exam.natijalarHavolasi}` : '';
  const yoqilgan = !!exam.settings.onlaynNatija?.yoqilgan;
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (!yoqilgan || !havola) { setQr(''); return; }
    let bekor = false;
    qrRasm(havola, 240).then(u => { if (!bekor) setQr(u); }).catch(() => setQr(''));
    return () => { bekor = true; };
  }, [yoqilgan, havola]);

  const nusxa = async () => {
    try {
      await navigator.clipboard.writeText(havola);
      showNotification('Havola nusxalandi', 'success');
    } catch {
      showNotification("Nusxalab bo'lmadi — havolani belgilab, o'zingiz nusxalang", 'error');
    }
  };

  const elonVaragi = async () => {
    try {
      const rasm = await qrRasm(havola, 900);
      await chopEt({
        sarlavha: `${exam.name} — onlayn natija`,
        css: ELON_CSS,
        body: `<div class="markaz">${esc(settings?.orgName || '')}</div>
          <h1>${esc(exam.name)}</h1><div class="sana">${esc(sanaMatni(exam.date))}</div>
          <img class="qr" src="${rasm}" alt="">
          <p class="chaqiriq">Natijangizni telefoningizda ko'ring</p>
          <ol><li>Telefon kamerasi bilan QR kodni skanerlang.</li><li>O'quvchi ID raqamini va telefonning oxirgi 4 raqamini kiriting.</li><li>«Natijani ko'rish» tugmasini bosing.</li></ol>
          <div class="havola">${esc(havola)}</div>`,
      });
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  return (
    <SozlamaKartasi exam={exam} yangila={yangila} kalitlar={KALITLAR} tahrir={tahrir} sarlavha="Onlayn natija sahifasi"
      izoh="Bitta havola hammaga: o'quvchi telefonda o'z natijasini topadi">
      {(q, qoy, ozgardi) => {
        const on = q.onlaynNatija ?? { yoqilgan: false, reyting: false };
        return (
          <div className="space-y-3">
            <Almashtirgich yoqilgan={on.yoqilgan} onChange={v => qoy({ onlaynNatija: { ...on, yoqilgan: v } })} nom="Sahifa ochiq"
              izoh="O'quvchi ID va telefonning oxirgi 4 raqamini yoki varaq kodini kiritadi — faqat o'z natijasi ochiladi" />
            <Almashtirgich yoqilgan={on.reyting && exam.settings.ranking !== 'yoq'} disabled={!on.yoqilgan || exam.settings.ranking === 'yoq'}
              onChange={v => qoy({ onlaynNatija: { ...on, reyting: v } })} nom="Eng yaxshilar ro'yxati"
              izoh={exam.settings.ranking === 'yoq' ? "Reyting «Ko'rsatilmaydi» — yuqorida yoqing" : `Birinchi ${Math.min(50, exam.settings.topN || 10)} ta, ism qisqartiriladi («Aliyev V.»)`} />
            {yoqilgan && havola && !ozgardi && (
              <div className="pt-3 border-t border-chiziq space-y-3">
                <div className="flex gap-2">
                  <input readOnly className={`${INPUT} py-1.5 text-[12.5px] font-mono`} value={havola} aria-label="Sahifa havolasi" onFocus={e => e.target.select()} />
                  <Tugma kichik ikonka={<Copy size={13} />} onClick={nusxa}>Nusxa</Tugma>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {qr && <img src={qr} alt="Sahifa QR kodi" className="w-28 h-28 rounded-lg border border-chiziq bg-white p-1" />}
                  <div className="flex flex-col gap-2">
                    <a href={havola} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline"><ExternalLink size={13} />Sahifani ochish</a>
                    <Tugma kichik ikonka={<Printer size={13} />} onClick={elonVaragi}>E'lon varag'i (QR, A4)</Tugma>
                  </div>
                </div>
                <p className="text-[11.5px] text-matn-xira">
                  {exam.publishedAt ? "Natijalar e'lon qilingan — sahifa ishlayapti." : "E'lon qilinmaguncha sahifada «hali e'lon qilinmagan» chiqadi."} Varaq kodi bilan qidirish uchun ruxsatnomaga {'{varaq_kodi}'} ni qo'shing.
                </p>
              </div>
            )}
          </div>
        );
      }}
    </SozlamaKartasi>
  );
}
