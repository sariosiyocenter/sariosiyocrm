import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { davrOraligi, davrNomi, type Davr } from '../lib/davr';
import LeadsReport from './reports/LeadsReport';
import StudentsGeneralReport from './reports/StudentsGeneralReport';
import LeftStudentsReport from './reports/LeftStudentsReport';
import GraduatesReport from './reports/GraduatesReport';
import StaffAttendanceReport from './reports/StaffAttendanceReport';
import StudentBonusReport from './reports/StudentBonusReport';

/**
 * Hisobotlar — alohida sahifa (ilgari Bosh sahifaning pastida edi).
 *
 * Pul hisobotlari (Statistika, To'lovlar hisoboti, O'quvchilar to'lovi) bu
 * yerda yo'q: ular Moliya → Hisobotlar bilan takror edi va noto'g'ri
 * hisoblardi (ROI, oylik hisobni tushum deb qo'shish). Qolganlari — lidlar,
 * o'quvchilar, ketganlar, bitiruvchilar, xodimlar davomati, ballar.
 */
const DAVRLAR: { tur: Exclude<Davr, 'custom'>; nom: string }[] = [
    { tur: 'this_week', nom: 'Hafta' },
    { tur: 'this_month', nom: 'Shu oy' },
    { tur: 'last_30', nom: '30 kun' },
    { tur: 'this_year', nom: 'Shu yil' },
    { tur: 'all', nom: 'Barchasi' },
];

export default function Hisobotlar() {
    const { kora } = useCRM();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [davr, setDavr] = useState<Exclude<Davr, 'custom'>>('this_month');
    const { start, end } = davrOraligi(davr);

    const TURLAR = [
        { id: 'lidlar', nom: 'Lidlar', ok: true },
        { id: 'oquvchilar', nom: "O'quvchilar", ok: true },
        { id: 'ketganlar', nom: 'Ketganlar', ok: true },
        { id: 'bitiruvchilar', nom: 'Bitiruvchilar', ok: true },
        { id: 'xodimlar', nom: 'Xodimlar davomati', ok: kora('xodimlar.davomat') },
        { id: 'ballar', nom: 'Ballar', ok: kora('oquvchilar.ballar') },
    ].filter(t => t.ok);
    const tanlangan = TURLAR.find(t => t.id === params.get('tur'))?.id || TURLAR[0]?.id;

    const hisobot = () => {
        switch (tanlangan) {
            case 'oquvchilar': return <StudentsGeneralReport startDate={start} endDate={end} />;
            case 'ketganlar': return <LeftStudentsReport startDate={start} endDate={end} />;
            case 'bitiruvchilar': return <GraduatesReport startDate={start} endDate={end} />;
            case 'xodimlar': return <StaffAttendanceReport startDate={start} endDate={end} />;
            case 'ballar': return <StudentBonusReport startDate={start} endDate={end} />;
            default: return <LeadsReport startDate={start} endDate={end} />;
        }
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-[12px] text-matn-sokin hover:text-brand cursor-pointer mb-2">
                        <ArrowLeft size={14} /> Bosh sahifa
                    </button>
                    <h1 className="text-[26px] font-bold text-matn tracking-tight leading-tight">Hisobotlar</h1>
                    <p className="text-[13px] text-matn-sokin mt-1">{davrNomi(davr, start, end)} · pul hisobotlari — Moliya bo'limida</p>
                </div>
                <div className="flex items-center gap-1 bg-ichki p-1 rounded-xl border border-chiziq max-w-full overflow-x-auto no-scrollbar">
                    {DAVRLAR.map(d => (
                        <button key={d.tur} onClick={() => setDavr(d.tur)}
                            className={`px-3 py-1.5 rounded-lg text-[12px] whitespace-nowrap transition-colors cursor-pointer ${davr === d.tur ? 'bg-brand text-brand-ust font-semibold' : 'text-matn-sokin hover:text-matn'}`}>
                            {d.nom}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {TURLAR.map(t => (
                    <button key={t.id} onClick={() => setParams({ tur: t.id }, { replace: true })}
                        className={`px-3.5 py-2 rounded-lg text-[13px] whitespace-nowrap border transition-colors cursor-pointer ${tanlangan === t.id ? 'bg-brand text-brand-ust border-brand font-semibold' : 'bg-sirt border-chiziq text-matn-sokin hover:text-matn'}`}>
                        {t.nom}
                    </button>
                ))}
            </div>

            <div className="bg-sirt rounded-2xl border border-chiziq p-5 overflow-hidden">
                {hisobot()}
            </div>
        </div>
    );
}
