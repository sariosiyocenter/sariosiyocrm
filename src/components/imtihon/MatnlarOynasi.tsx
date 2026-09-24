import React, { useCallback, useEffect, useState } from 'react';
import { X, Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { useImtihonApi } from './useImtihonApi';
import { Tugma, Maydon, INPUT, BoshHolat, Yuklanmoqda } from './ui';
import RichTextEditor from '../RichTextEditor';
import { formulaliHtml, oddiyMatn, SAVOL_MATNI } from '../../lib/matn';
import type { Passage } from '../../types';

// Matnlar: bir nechta savolga umumiy matn yoki rasm ("Matnni o'qing va 1–4
// savollarga javob bering"). Variant yasalganda shu matnning savollari birga
// turadi va kitobchada matn ular oldidan bir marta chiqadi.

export default function MatnlarOynasi({ onYop, tanlash }: { onYop: () => void; tanlash?: (p: Passage) => void }) {
  const { showNotification, ozgartira, selectedSchoolId, user } = useCRM();
  const tahrir = ozgartira('imtihonlar.savollar');
  const ochirish = ozgartira('imtihonlar.ochirish');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const [royxat, setRoyxat] = useState<Passage[] | null>(null);
  const [forma, setForma] = useState<Partial<Passage> | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  const yukla = useCallback(() => soro<Passage[]>('GET', 'passages').then(setRoyxat).catch(e => showNotification(e.message, 'error')), [soro, showNotification]);
  useEffect(() => { yukla(); }, [yukla]);

  const saqla = async () => {
    if (!forma) return;
    if (!forma.subject?.trim()) return showNotification('Fanni kiriting', 'error');
    if (!oddiyMatn(forma.text || '') && !forma.imageUrl) return showNotification('Matn yoki rasm kerak', 'error');
    setSaqlanmoqda(true);
    try {
      const schoolId = selectedSchoolId && selectedSchoolId > 0 ? selectedSchoolId : user?.schoolId;
      const body = { title: forma.title || null, subject: forma.subject, text: forma.text || '', imageUrl: forma.imageUrl || null, schoolId };
      if (forma.id) await soro('PUT', `passages/${forma.id}`, body);
      else await soro('POST', 'passages', body);
      setForma(null);
      yukla();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  const ochir = async (p: Passage) => {
    if (!(await confirm(`"${p.title || 'Matn'}" o'chirilsinmi? Unga bog'langan savollar qoladi, faqat matnsiz.`))) return;
    try {
      await soro('DELETE', `passages/${p.id}`);
      yukla();
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  const rasmTanla = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => setForma(f => ({ ...f, imageUrl: String(ev.target?.result || '') }));
    r.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-start sm:items-center justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onYop} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-2xl border border-chiziq max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-chiziq">
          <div>
            <h3 className="text-[14px] font-bold text-matn">Matnlar</h3>
            <p className="text-[12px] text-matn-xira">Bir nechta savolga umumiy matn yoki rasm</p>
          </div>
          <div className="flex items-center gap-2">
            {tahrir && !forma && <Tugma kichik turi="asosiy" ikonka={<Plus size={14} />} onClick={() => setForma({ subject: '', text: '' })}>Yangi matn</Tugma>}
            <button aria-label="Yopish" onClick={onYop} className="p-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto space-y-3">
          {forma ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Maydon nom="Fan"><input className={INPUT} value={forma.subject || ''} onChange={e => setForma({ ...forma, subject: e.target.value })} /></Maydon>
                <Maydon nom="Sarlavha (ixtiyoriy)"><input className={INPUT} value={forma.title || ''} onChange={e => setForma({ ...forma, title: e.target.value })} placeholder="Masalan: Amir Temur haqida matn" /></Maydon>
              </div>
              <Maydon nom="Matn" izoh="Formula: $x^2$ ko'rinishida yoziladi">
                <RichTextEditor key={forma.id ?? 'yangi'} content={forma.text || ''} onChange={text => setForma(f => ({ ...f, text }))} />
              </Maydon>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 rounded-xl border border-chiziq bg-sirt hover:bg-ichki px-2.5 py-1.5 text-[12px] font-semibold text-matn cursor-pointer">
                  Rasm qo'shish <input type="file" accept="image/*" className="hidden" onChange={rasmTanla} />
                </label>
                {forma.imageUrl && <><img src={forma.imageUrl} alt="" className="h-14 rounded-lg border border-chiziq" /><Tugma kichik turi="oddiy" onClick={() => setForma({ ...forma, imageUrl: null })}>Olib tashlash</Tugma></>}
              </div>
              <div className="flex justify-end gap-2">
                <Tugma onClick={() => setForma(null)}>Bekor qilish</Tugma>
                <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} onClick={saqla}>Saqlash</Tugma>
              </div>
            </div>
          ) : royxat === null ? <Yuklanmoqda /> : !royxat.length ? (
            <BoshHolat ikonka={<FileText size={20} />} sarlavha="Hali matn yo'q" izoh="Matn qo'shing, keyin savol tahririda shu matnni tanlang." />
          ) : (
            <ul className="space-y-2">
              {royxat.map(p => (
                <li key={p.id} className="rounded-xl border border-chiziq p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-matn">{p.title || `Matn #${p.id}`} <span className="font-normal text-matn-xira">· {p.subject} · {p._count?.questions || 0} ta savol</span></p>
                      <div className={`${SAVOL_MATNI} text-[12.5px] text-matn-sokin line-clamp-3 mt-1`} dangerouslySetInnerHTML={{ __html: formulaliHtml(p.text) }} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {tanlash && <Tugma kichik turi="asosiy" onClick={() => { tanlash(p); onYop(); }}>Tanlash</Tugma>}
                      {tahrir && <button aria-label="Tahrirlash" onClick={() => setForma(p)} className="p-2 rounded-lg text-matn-sokin hover:text-brand hover:bg-ichki cursor-pointer"><Pencil size={14} /></button>}
                      {ochirish && <button aria-label="O'chirish" onClick={() => ochir(p)} className="p-2 rounded-lg text-matn-sokin hover:text-xato hover:bg-xato-fon cursor-pointer"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
