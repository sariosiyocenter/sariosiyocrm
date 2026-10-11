import React, { useEffect, useRef, useState } from 'react';
import { PenTool, RotateCcw, Undo2, Loader2, AlertTriangle } from 'lucide-react';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, Yorliq, INPUT } from '../ui';
import { rasmChiz, rasmXatoMatni, svgmi, type ChizilganRasm, type RasmSorovi } from '../../../lib/svgRasm';

// Savol rasmi bloki (savolni ko'rib chiqish kartasida): hozirgi rasm, «Vektor qilib chizish»,
// «Qayta chizish» (ixtiyoriy ko'rsatma bilan) va «Asl rasmga qaytish». Egasi (2026-10-10):
// «savollar rasmli bo'ladi yoki o'xshash savol tuzganda — vector qilib rasm tuzsin».
//
// Tanlangan rasm `onChange` bilan hostga beriladi — bu doim saqlashga tayyor havola (Storage):
// host uni savolning `imageUrl` iga yozadi, boshqa hech narsa qilmaydi. Ko'p savolni birdan
// chizdirish uchun — lib/svgRasm.ts dagi `rasmlarniChiz` (shu payt kartaga `band` beriladi).
//
// Chizma faqat <img> bilan ko'rsatiladi (SVG matni sahifaga HTML bo'lib qo'yilmaydi).

export interface VektorRasmProps {
  /** Savol matni (bank HTML i). */
  matn: string;
  /** Guruhli savol yoki o'qish matnining umumiy sharti. */
  shart?: string | null;
  variantlar?: string[] | null;
  /** To'g'ri javob — chizmaga yozilmaydi, nisbatlar to'g'ri chiqishi uchun. */
  javob?: string | null;
  fan?: string | null;
  /** Materialdagi tartib raqami — `aslRasm` butun sahifa bo'lsa, AI kerakli chizmani shu bo'yicha topadi. */
  raqam?: string | null;
  /** AI ko'radigan manba: sahifa surat(lar)i yoki savolning asl rasmi. Berilmasa — hozirgi (rastr) rasm. */
  aslRasm?: string | string[] | null;
  /** O'xshash masalada ASL masalaning rasmi (vektor yoki rastr): uslub shundan, sonlar — bu masaladan. */
  namuna?: string | string[] | null;
  /** Hozir tanlangan rasm (savolning imageUrl i). */
  qiymat: string | null;
  onChange: (qiymat: string | null) => void;
  /** «Asl rasmga qaytish» shu qiymatni qaytaradi (savolning o'z asl rasmi; yo'q bo'lsa — rasmsiz). */
  boshQiymat?: string | null;
  /** Karta ochilganda o'zi bir marta chizadi (hali vektor bo'lmasa). */
  avto?: boolean;
  /** Host to'plam bilan chizayotgan payt: tugmalar o'chadi, «Chizilmoqda» ko'rinadi. */
  band?: boolean;
  /** Host (to'plam) chizgan rasmning kamchiliklari — ChizilganRasm.ogohlar. */
  ogohlar?: string[];
  className?: string;
}

export default function VektorRasm({ matn, shart, variantlar, javob, fan, raqam, aslRasm, namuna, qiymat, onChange, boshQiymat = null, avto, band, ogohlar: hostOgohlari, className = '' }: VektorRasmProps) {
  const { soro } = useImtihonApi();
  const [chizilmoqda, setChizilmoqda] = useState(false);
  const [xato, setXato] = useState<{ matn: string; yumshoq: boolean } | null>(null);
  const [korsatma, setKorsatma] = useState('');
  const [natija, setNatija] = useState<ChizilganRasm | null>(null);
  const tirik = useRef(true);
  const avtoBoshlandi = useRef(false);

  const ish = chizilmoqda || !!band;
  const vektor = svgmi(qiymat);
  // Shu kartada chizilgan rasm hali tanlangan bo'lsa — uning ma'lumoti (kamchiliklar, PNG zaxirasi).
  const ozimizniki = natija && natija.url === qiymat ? natija : null;
  const aiChizgan = vektor || !!ozimizniki;
  const korinadiganOgohlar = ozimizniki ? ozimizniki.ogohlar : aiChizgan ? hostOgohlari || [] : [];
  const rastr = (v?: string | null) => (v && !svgmi(v) ? v : null);

  const chiz = async () => {
    if (ish) return;
    const sorov: RasmSorovi = {
      matn, shart, variantlar, javob, fan, raqam, namuna,
      aslRasm: aslRasm ?? rastr(qiymat) ?? rastr(boshQiymat),
      avvalgiSvg: vektor ? qiymat : null,
      korsatma: korsatma.trim() || null,
    };
    setChizilmoqda(true);
    setXato(null);
    try {
      const rasm = await rasmChiz(soro, sorov);
      if (!tirik.current) return;
      setNatija(rasm);
      setKorsatma('');
      onChange(rasm.url);
    } catch (e: any) {
      if (tirik.current) setXato({ matn: rasmXatoMatni(e), yumshoq: e?.malumot?.sabab === 'kerak-emas' });
    } finally {
      if (tirik.current) setChizilmoqda(false);
    }
  };

  useEffect(() => {
    tirik.current = true;
    if (avto && !avtoBoshlandi.current && !svgmi(qiymat)) {
      avtoBoshlandi.current = true;
      void chiz();
    }
    return () => { tirik.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Solishtirish uchun: vektor yonida savolning o'z asl rasmi (sahifa surati emas).
  const aslKichik = aiChizgan && rastr(boshQiymat) && boshQiymat !== qiymat ? boshQiymat : null;

  return (
    <div className={`rounded-xl border border-chiziq bg-ichki p-2.5 space-y-2 ${className}`} aria-busy={ish}>
      {(qiymat || ish) && (
        <div className="flex flex-wrap items-stretch gap-2">
          {aslKichik && (
            <figure className="shrink-0 w-24 rounded-lg bg-white border border-chiziq p-1 flex flex-col items-center justify-center gap-1">
              <img src={aslKichik} alt="Asl rasm" className="max-h-24 max-w-full object-contain" />
              <figcaption className="text-[10.5px] font-semibold text-neutral-500">Asl rasm</figcaption>
            </figure>
          )}
          {/* Oq qog'oz: rasm qorong'i mavzuda ham kitobchadagidek ko'rinadi. min-w-48: tor ekranda chizma
              asl rasm yonida siqilib qolmaydi — pastki qatorga tushadi. */}
          <div className="relative flex-1 min-w-48 min-h-24 rounded-lg bg-white border border-chiziq p-2 flex items-center justify-center">
            {qiymat && <img src={qiymat} alt="Savol rasmi" className={`max-h-56 max-w-full object-contain transition-opacity ${ish ? 'opacity-30' : ''}`} />}
            {qiymat && !ish && <Yorliq rang={aiChizgan ? 'yaxshi' : 'kulrang'} className="absolute top-1.5 right-1.5">{vektor ? 'Vektor' : aiChizgan ? 'AI chizmasi' : 'Asl rasm'}</Yorliq>}
            {ish && (
              <div className="absolute inset-0 flex items-center justify-center" role="status">
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-[12.5px] font-semibold text-neutral-700">
                  <Loader2 size={15} className="animate-spin" /> Chizilmoqda… odatda 10–40 soniya
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {korinadiganOgohlar.length > 0 && !ish && (
        <p className="flex items-start gap-1.5 text-[11.5px] text-ogoh"><AlertTriangle size={13} className="shrink-0 mt-px" /><span>Chizmani ko'zdan kechiring: {korinadiganOgohlar.join('; ')}.</span></p>
      )}
      {xato && !ish && (
        <p role="alert" className={`flex items-start gap-1.5 text-[12px] ${xato.yumshoq ? 'text-matn-sokin' : 'text-xato'}`}>
          <AlertTriangle size={13} className="shrink-0 mt-px" /><span>{xato.matn}</span>
        </p>
      )}

      {aiChizgan ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${INPUT} py-1.5 text-[12.5px] flex-1 min-w-44`} value={korsatma} disabled={ish} maxLength={300}
            placeholder="Nimani o'zgartirish kerak?" aria-label="Qayta chizish uchun ko'rsatma (ixtiyoriy)"
            onChange={e => setKorsatma(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void chiz(); } }}
          />
          <Tugma kichik type="button" ikonka={<RotateCcw size={13} />} disabled={ish} onClick={() => void chiz()}>Qayta chizish</Tugma>
          <Tugma kichik type="button" turi="oddiy" ikonka={<Undo2 size={13} />} disabled={ish} onClick={() => { setXato(null); onChange(boshQiymat); }}>
            {boshQiymat ? 'Asl rasmga qaytish' : 'Chizmani olib tashlash'}
          </Tugma>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Tugma kichik type="button" ikonka={<PenTool size={13} />} disabled={ish} onClick={() => void chiz()}>{xato && !xato.yumshoq ? 'Qayta urinish' : 'Vektor qilib chizish'}</Tugma>
          {!ish && !xato && <span className="text-[11.5px] text-matn-xira">{aslRasm || qiymat ? 'AI rasmni chopga mos toza chizma qilib qayta chizadi' : "AI masala matni bo'yicha chopga mos chizma chizadi"}</span>}
        </div>
      )}
    </div>
  );
}
