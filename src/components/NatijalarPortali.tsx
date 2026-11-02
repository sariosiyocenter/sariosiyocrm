import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Trophy, XCircle, Clock } from 'lucide-react';
import { vergul, sanaMatni } from './imtihon/format';

/**
 * Onlayn natija sahifasi (/natijalar/:token) — Addmen «Online result». Imtihonning bitta ochiq
 * havolasi (devordagi QR, Telegram kanal): o'quvchi telefonda ID va telefonning oxirgi 4 raqamini
 * (yoki varaq kodini) kiritadi va shaxsiy natija sahifasiga o'tadi. Sozlamada yoqilsa — eng yaxshilar.
 */

interface Sahifa {
  markaz: { nomi: string; logo: string | null };
  imtihon: { nomi: string; sana: string; maxScore: number };
  elon: boolean;
  jami: number;
  reyting: { orin: number; ism: string; ball: number; foiz: number }[] | null;
}

type Usul = 'id' | 'kod';
const MAYDON = 'w-full rounded-xl border border-chiziq-kuchli bg-sirt px-4 py-3 text-[16px] text-matn placeholder:text-matn-xira focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const MEDAL = ['bg-[#f5c542] text-[#4a3500]', 'bg-[#cfd6de] text-[#2c3640]', 'bg-[#e0a370] text-[#4a2a10]'];

export default function NatijalarPortali() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [d, setD] = useState<Sahifa | null>(null);
  const [xato, setXato] = useState('');
  const [usul, setUsul] = useState<Usul>('id');
  const [id, setId] = useState('');
  const [tel, setTel] = useState('');
  const [kod, setKod] = useState('');
  const [band, setBand] = useState(false);
  const [qidiruvXatosi, setQidiruvXatosi] = useState('');

  useEffect(() => {
    fetch(`/api/public/natijalar/${token}`)
      .then(async r => { const j = await r.json().catch(() => null); if (!r.ok) throw new Error(j?.error || 'Sahifa topilmadi'); return j; })
      .then(setD)
      .catch(e => setXato(e.message));
  }, [token]);

  const qidir = async (e: React.FormEvent) => {
    e.preventDefault();
    setQidiruvXatosi('');
    setBand(true);
    try {
      const r = await fetch(`/api/public/natijalar/${token}/qidir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usul === 'kod' ? { kod } : { id, tel }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || 'Natija topilmadi');
      navigate(j.havola);
    } catch (err: any) {
      setQidiruvXatosi(err.message);
    } finally {
      setBand(false);
    }
  };

  if (xato) {
    return (
      <div className="min-h-screen bg-fon flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-sirt rounded-2xl border border-chiziq p-8 text-center">
          <XCircle size={32} className="mx-auto text-xato mb-3" />
          <p className="text-[14px] font-semibold text-matn">{xato}</p>
        </div>
      </div>
    );
  }
  if (!d) return <div className="min-h-screen bg-fon flex items-center justify-center"><div className="w-9 h-9 border-[3px] border-brand border-t-transparent rounded-full animate-spin" /></div>;

  const tayyor = usul === 'kod' ? kod.trim().length >= 5 : id.trim() && tel.replace(/\D/g, '').length === 4;

  return (
    <div className="min-h-screen bg-fon">
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <header className="text-center space-y-1">
          {d.markaz.logo && <img src={d.markaz.logo} alt="" className="h-12 mx-auto object-contain mb-2" />}
          <p className="text-[12px] text-matn-xira uppercase tracking-wide">{d.markaz.nomi}</p>
          <h1 className="text-[20px] font-bold text-matn leading-tight">{d.imtihon.nomi}</h1>
          <p className="text-[12.5px] text-matn-xira">{sanaMatni(d.imtihon.sana)}{d.elon && d.jami ? ` · ${d.jami} qatnashchi` : ''}</p>
        </header>

        {!d.elon ? (
          <section className="bg-sirt rounded-2xl border border-chiziq p-6 text-center">
            <Clock size={30} className="mx-auto text-brand mb-2" />
            <p className="text-[15px] font-semibold text-matn">Natijalar hali e'lon qilinmagan</p>
            <p className="text-[13px] text-matn-sokin mt-1">E'lon qilingach shu sahifada ko'rinadi — keyinroq qayta oching.</p>
          </section>
        ) : (
          <form onSubmit={qidir} className="bg-sirt rounded-2xl border border-chiziq p-5 space-y-4">
            <div>
              <h2 className="text-[16px] font-bold text-matn">Natijangizni bilish</h2>
              <p className="text-[12.5px] text-matn-sokin mt-0.5">Ma'lumotingiz faqat sizga ochiladi.</p>
            </div>
            <div role="tablist" aria-label="Qidirish usuli" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-ichki">
              {([['id', 'ID va telefon'], ['kod', 'Varaq kodi']] as [Usul, string][]).map(([u, nom]) => (
                <button key={u} type="button" role="tab" aria-selected={usul === u} onClick={() => { setUsul(u); setQidiruvXatosi(''); }}
                  className={`rounded-lg py-2 text-[13px] font-semibold cursor-pointer transition-colors ${usul === u ? 'bg-sirt text-matn shadow-sm' : 'text-matn-sokin'}`}>{nom}</button>
              ))}
            </div>
            {usul === 'id' ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="block text-[12.5px] font-semibold text-matn-sokin mb-1">O'quvchi ID raqami</span>
                  <input className={MAYDON} inputMode="numeric" autoComplete="off" value={id} placeholder="Masalan: 1024" onChange={e => setId(e.target.value.replace(/\D/g, '').slice(0, 9))} />
                </label>
                <label className="block">
                  <span className="block text-[12.5px] font-semibold text-matn-sokin mb-1">Telefonning oxirgi 4 raqami</span>
                  <input className={`${MAYDON} tracking-[0.3em]`} inputMode="numeric" autoComplete="off" value={tel} placeholder="••••" onChange={e => setTel(e.target.value.replace(/\D/g, '').slice(-4))} />
                  <span className="block text-[11.5px] text-matn-xira mt-1">O'quvchining yoki ota-onasining CRM'dagi telefoni.</span>
                </label>
              </div>
            ) : (
              <label className="block">
                <span className="block text-[12.5px] font-semibold text-matn-sokin mb-1">Varaq kodi</span>
                <input className={`${MAYDON} uppercase tracking-[0.2em] font-mono`} autoComplete="off" autoCapitalize="characters" value={kod} placeholder="K7Q2XZ9"
                  onChange={e => setKod(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} />
                <span className="block text-[11.5px] text-matn-xira mt-1">Ruxsatnomada yoki javob varaqasida yozilgan 7 belgili kod.</span>
              </label>
            )}
            {qidiruvXatosi && <p role="alert" className="text-[13px] font-semibold text-xato">{qidiruvXatosi}</p>}
            <button type="submit" disabled={!tayyor || band}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand text-brand-ust py-3 text-[15px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] transition-transform">
              {band ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Search size={17} />}
              Natijani ko'rish
            </button>
          </form>
        )}

        {d.reyting && d.reyting.length > 0 && (
          <section className="bg-sirt rounded-2xl border border-chiziq overflow-hidden">
            <h2 className="flex items-center gap-2 px-5 pt-4 pb-2 text-[15px] font-bold text-matn"><Trophy size={17} className="text-brand" />Eng yaxshi natijalar</h2>
            <ol>
              {d.reyting.map((r, i) => (
                <li key={`${r.orin}-${i}`} className="flex items-center gap-3 px-5 py-2.5 border-t border-chiziq">
                  <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[12.5px] font-bold raqam ${MEDAL[r.orin - 1] || 'bg-ichki text-matn-sokin'}`}>{r.orin}</span>
                  <span className="flex-1 min-w-0 truncate text-[14px] text-matn">{r.ism}</span>
                  <span className="text-right">
                    <b className="block text-[14px] text-matn raqam leading-tight">{vergul(r.ball)}</b>
                    <span className="text-[11.5px] text-matn-xira raqam">{vergul(r.foiz)}%</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
