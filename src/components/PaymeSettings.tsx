import React, { useEffect, useState } from 'react';
import { CreditCard, Copy, Check, RefreshCw, Save, ShieldCheck, ExternalLink } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';

// Sozlamalar → Payme. Kalitlar serverdan hech qachon qaytmaydi: maydon bo'sh
// turadi, "o'rnatilgan" belgisi ko'rinadi; bo'sh yuborilsa server eskisini
// saqlab qoladi. Webhook manzili shu yerdan Payme kabinetiga ko'chiriladi.

const inp = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[11px] font-extrabold text-matn-xira mb-2";
const card = "p-5 bg-ichki/30 border border-chiziq rounded-2xl space-y-4";

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });
const money = (n: number) => Number(n || 0).toLocaleString('ru-RU');

const STATE_LABEL: Record<number, { text: string; cls: string }> = {
    1:  { text: 'Kutilmoqda',   cls: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40' },
    2:  { text: "To'landi",     cls: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40' },
    [-1]: { text: 'Bekor',      cls: 'bg-gray-100 text-matn-xira border-gray-200 dark:bg-gray-900 dark:border-gray-800' },
    [-2]: { text: 'Qaytarildi', cls: 'bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40' },
};

function Toggle({ value, onChange, label, hint }: { value: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
    return (
        <button type="button" onClick={() => onChange(!value)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-left cursor-pointer">
            <span>
                <span className="block text-xs font-bold text-matn">{label}</span>
                <span className="block text-[10px] font-bold text-matn-xira mt-0.5">{hint}</span>
            </span>
            <span className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${value ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-700'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-5' : 'left-1'}`} />
            </span>
        </button>
    );
}

type Tx = {
    id: number; paymeId: string; amount: number; state: number; performTime: number; createTime: number;
    studentName: string; groupName: string; source: string; test: boolean; fiscalUrl?: string | null;
};

export default function PaymeSettings() {
    const { settings, updateSettings, selectedSchoolId, user, showNotification } = useCRM();
    const confirm = useConfirm();
    const schoolId = (!selectedSchoolId || selectedSchoolId === 0) ? user?.schoolId : selectedSchoolId;

    const [form, setForm] = useState({
        paymeMerchantId: settings.paymeMerchantId || '',
        paymeKey: '',
        paymeTestKey: '',
        paymeMode: settings.paymeMode || 'off',
        paymeAllowRefund: settings.paymeAllowRefund ?? true,
        paymeIpCheck: settings.paymeIpCheck ?? true,
        paymeMxik: settings.paymeMxik || '',
        paymePackageCode: settings.paymePackageCode || '',
        paymeVatPercent: settings.paymeVatPercent ?? 0,
    });
    const [endpointToken, setEndpointToken] = useState(settings.paymeEndpointToken || '');
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [txs, setTxs] = useState<Tx[]>([]);

    useEffect(() => {
        setForm(f => ({
            ...f,
            paymeMerchantId: settings.paymeMerchantId || '',
            paymeMode: settings.paymeMode || 'off',
            paymeAllowRefund: settings.paymeAllowRefund ?? true,
            paymeIpCheck: settings.paymeIpCheck ?? true,
            paymeMxik: settings.paymeMxik || '',
            paymePackageCode: settings.paymePackageCode || '',
            paymeVatPercent: settings.paymeVatPercent ?? 0,
            // Saqlangach maydonlar tozalanadi — kalit brauzerda turmasin.
            paymeKey: '', paymeTestKey: '',
        }));
        setEndpointToken(settings.paymeEndpointToken || '');
    }, [settings]);

    useEffect(() => {
        if (!schoolId) return;
        fetch(`/api/payme/transactions?schoolId=${schoolId}&limit=30`, { headers: auth() })
            .then(r => r.ok ? r.json() : [])
            .then(setTxs)
            .catch(() => setTxs([]));
    }, [schoolId, settings.paymeMode]);

    const endpointUrl = endpointToken ? `${window.location.origin}/api/payme/${endpointToken}` : '';
    const mode = settings.paymeMode || 'off';
    const badge = mode === 'live'
        ? { text: 'Jonli', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40' }
        : mode === 'test'
            ? { text: 'Test rejim', cls: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40' }
            : { text: "O'chiq", cls: 'bg-gray-100 text-matn-xira border-gray-200 dark:bg-gray-900 dark:border-gray-800' };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateSettings({ ...settings, ...form, paymeVatPercent: Number(form.paymeVatPercent) || 0 });
            showNotification('Payme sozlamalari saqlandi', 'success');
        } catch (err: any) {
            showNotification(err.message || 'Saqlashda xatolik', 'error');
        } finally {
            setSaving(false);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(endpointUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { showNotification("Nusxalab bo'lmadi", 'error'); }
    };

    const rotate = async () => {
        const ok = await confirm({
            title: 'Webhook manzilini almashtirish',
            message: "Eski manzil darhol ishlamay qoladi. Yangi manzilni Payme kabinetiga kiritmaguningizcha to'lovlar kelmaydi. Davom etilsinmi?",
            confirmLabel: 'Almashtirish', danger: true,
        });
        if (!ok) return;
        try {
            const r = await fetch('/api/payme/rotate-endpoint', { method: 'POST', headers: auth(), body: JSON.stringify({ schoolId }) });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Xatolik');
            setEndpointToken(j.paymeEndpointToken);
            showNotification('Yangi manzil yaratildi — Payme kabinetida yangilang', 'success');
        } catch (err: any) {
            showNotification(err.message, 'error');
        }
    };

    return (
        <form onSubmit={save} className="space-y-8">
            <div>
                <h2 className="text-xs font-black text-matn">Payme</h2>
                <p className="text-[11px] font-bold text-matn-xira mt-0.5">Ota-onalar Payme orqali to'laydi — pul avtomatik o'quvchining hisobiga tushadi</p>
            </div>

            {settings.settingsEncryption === false && (
                <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    Serverda <span className="font-mono">SETTINGS_KEY</span> o'rnatilmagan — Payme kalitlari shifrlanmasdan saqlanmaydi, saqlash rad etiladi.
                    Vercel → Settings → Environment Variables ga uzun tasodifiy <span className="font-mono">SETTINGS_KEY</span> qo'shib, qayta deploy qiling.
                </div>
            )}

            {/* Holat va manzil */}
            <div className={card}>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40 flex items-center justify-center">
                            <CreditCard size={16} />
                        </div>
                        <div>
                            <p className="text-xs font-black text-matn tracking-wide">Payme Business</p>
                            <p className="text-[11px] font-bold text-matn-xira mt-0.5">Merchant API — karta ma'lumotlari CRM ga kelmaydi</p>
                        </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border shrink-0 ${badge.cls}`}>{badge.text}</span>
                </div>

                <div>
                    <label className={lbl}>Webhook (Endpoint URL) — Payme kabinetiga kiritiladi</label>
                    {endpointUrl ? (
                        <div className="flex gap-2">
                            <input type="text" readOnly className={inp + ' font-mono text-[11px]'} value={endpointUrl} onFocus={e => e.target.select()} />
                            <button type="button" onClick={copy} title="Nusxalash"
                                className="px-3 rounded-2xl bg-ichki border border-chiziq text-matn hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                            <button type="button" onClick={rotate} title="Manzilni almashtirish"
                                className="px-3 rounded-2xl bg-ichki border border-chiziq text-matn hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    ) : (
                        <p className="text-[11px] font-bold text-matn-xira">Merchant ID ni kiritib saqlagach manzil yaratiladi.</p>
                    )}
                    <p className="text-[10px] font-bold text-matn-xira mt-2 ml-1">
                        Hisob maydoni (account field) nomi: <span className="font-mono text-matn">order_id</span>. Manzil tasodifiy va maxfiy — hech kimga yubormang.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={lbl}>Merchant ID</label>
                        <input type="text" placeholder="5e730e8e0b852a417aa49ceb" className={inp} value={form.paymeMerchantId}
                            onChange={e => setForm(f => ({ ...f, paymeMerchantId: e.target.value }))} autoComplete="off" />
                    </div>
                    <div>
                        <label className={lbl}>Rejim</label>
                        <select className={inp} value={form.paymeMode} onChange={e => setForm(f => ({ ...f, paymeMode: e.target.value as any }))}>
                            <option value="off">O'chiq</option>
                            <option value="test">Test (sandbox)</option>
                            <option value="live">Jonli</option>
                        </select>
                    </div>
                    <div>
                        <label className={lbl}>Jonli kalit (KEY) {settings.paymeKeySet && <span className="text-emerald-500">· o'rnatilgan</span>}</label>
                        <input type="password" placeholder={settings.paymeKeySet ? "•••••••• (o'zgartirish uchun yangisini yozing)" : 'Payme kabinetidan'} className={inp}
                            value={form.paymeKey} onChange={e => setForm(f => ({ ...f, paymeKey: e.target.value }))} autoComplete="new-password" />
                    </div>
                    <div>
                        <label className={lbl}>Test kalit {settings.paymeTestKeySet && <span className="text-emerald-500">· o'rnatilgan</span>}</label>
                        <input type="password" placeholder={settings.paymeTestKeySet ? "•••••••• (o'zgartirish uchun yangisini yozing)" : 'Sandbox uchun'} className={inp}
                            value={form.paymeTestKey} onChange={e => setForm(f => ({ ...f, paymeTestKey: e.target.value }))} autoComplete="new-password" />
                    </div>
                </div>
                <p className="text-[10px] font-bold text-matn-xira ml-1">
                    Kalitlar shifrlangan holda saqlanadi va bu sahifaga qaytib chiqmaydi. Test rejimda faqat test kaliti, jonlida faqat jonli kalit qabul qilinadi.
                </p>
            </div>

            {/* Xavfsizlik */}
            <div className={card}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 flex items-center justify-center">
                        <ShieldCheck size={16} />
                    </div>
                    <div>
                        <p className="text-xs font-black text-matn tracking-wide">Xavfsizlik va qoidalar</p>
                        <p className="text-[11px] font-bold text-matn-xira mt-0.5">Har bir so'rov jurnalga yoziladi; summa buyurtma bilan tiyinigacha solishtiriladi</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Toggle value={form.paymeIpCheck} onChange={v => setForm(f => ({ ...f, paymeIpCheck: v }))}
                        label="Faqat Payme IP manzillari" hint="Jonli rejimda 185.234.113.1–15 dan boshqa so'rovlar rad etiladi" />
                    <Toggle value={form.paymeAllowRefund} onChange={v => setForm(f => ({ ...f, paymeAllowRefund: v }))}
                        label="Qaytarishga ruxsat" hint="Payme o'tgan to'lovni bekor qilsa balansdan ayiriladi; o'chiq bo'lsa rad etiladi (-31007). Test rejimda doim ruxsat — sandbox shuni tekshiradi" />
                </div>
            </div>

            {/* Fiskal */}
            <div className={card}>
                <div>
                    <p className="text-xs font-black text-matn tracking-wide">Fiskal chek (ixtiyoriy)</p>
                    <p className="text-[11px] font-bold text-matn-xira mt-0.5">Payme fiskalizatsiya talab qilsa — xizmatning IKPU (MXIK) kodi va package code. Ikkalasi ham kiritilsagina chekka qo'shiladi (Payme'da ikkalasi majburiy).</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className={lbl}>IKPU / MXIK kodi</label>
                        <input type="text" placeholder="10899002001000000" className={inp} value={form.paymeMxik} onChange={e => setForm(f => ({ ...f, paymeMxik: e.target.value }))} />
                    </div>
                    <div>
                        <label className={lbl}>Package code</label>
                        <input type="text" className={inp} value={form.paymePackageCode} onChange={e => setForm(f => ({ ...f, paymePackageCode: e.target.value }))} />
                    </div>
                    <div>
                        <label className={lbl}>QQS, %</label>
                        <input type="number" min={0} max={100} className={inp} value={form.paymeVatPercent} onChange={e => setForm(f => ({ ...f, paymeVatPercent: Number(e.target.value) }))} />
                    </div>
                </div>
            </div>

            {/* Yo'riqnoma */}
            <div className="p-5 border border-dashed border-chiziq rounded-2xl text-[11px] font-bold text-matn-xira space-y-1.5">
                <p className="text-xs font-black text-matn">Ulash tartibi</p>
                <p>1. <a href="https://merchant.paycom.uz" target="_blank" rel="noopener noreferrer" className="text-brand underline inline-flex items-center gap-1">Payme Business kabineti <ExternalLink size={10} /></a> da kassa yarating; Endpoint URL ga yuqoridagi webhook manzilini, hisob maydoniga <span className="font-mono text-matn">order_id</span> ni kiriting.</p>
                <p>2. Merchant ID, jonli va test kalitlarini shu yerga kiriting, rejimni "Test" qilib saqlang.</p>
                <p>3. <a href="https://test.paycom.uz" target="_blank" rel="noopener noreferrer" className="text-brand underline inline-flex items-center gap-1">Sandbox <ExternalLink size={10} /></a> da webhook manzili va test kaliti bilan avtomatik testlarni o'tkazing (buyurtma ID sini o'quvchi kartochkasidan "Payme havola" orqali oling).</p>
                <p>4. Testlar o'tgach rejimni "Jonli" qiling — botda "Payme orqali to'lash" tugmasi paydo bo'ladi.</p>
            </div>

            <div className="flex justify-end pt-4 border-t border-dashed border-chiziq/50">
                <button type="submit" disabled={saving}
                    className="px-6 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold flex items-center gap-2 shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                    <Save size={14} />{saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
            </div>

            {/* Oxirgi tranzaksiyalar */}
            <div className={card}>
                <div>
                    <p className="text-xs font-black text-matn tracking-wide">Oxirgi Payme tranzaksiyalari</p>
                    <p className="text-[11px] font-bold text-matn-xira mt-0.5">Payme yuborgan har bir to'lovning holati</p>
                </div>
                {txs.length === 0 ? (
                    <p className="text-[11px] font-bold text-matn-xira">Hali tranzaksiya yo'q.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px] font-bold">
                            <thead>
                                <tr className="text-left text-matn-xira">
                                    <th className="py-2 pr-3">Vaqt</th>
                                    <th className="py-2 pr-3">O'quvchi</th>
                                    <th className="py-2 pr-3">Guruh</th>
                                    <th className="py-2 pr-3 text-right">Summa</th>
                                    <th className="py-2 pr-3">Holat</th>
                                    <th className="py-2">Payme ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {txs.map(t => {
                                    const s = STATE_LABEL[t.state] || { text: String(t.state), cls: '' };
                                    return (
                                        <tr key={t.id} className="border-t border-chiziq/60 text-matn">
                                            <td className="py-2 pr-3 whitespace-nowrap">{new Date(t.performTime || t.createTime).toLocaleString('ru-RU')}</td>
                                            <td className="py-2 pr-3">{t.studentName}{t.test && <span className="ml-1 text-[9px] text-amber-500">TEST</span>}</td>
                                            <td className="py-2 pr-3">{t.groupName}</td>
                                            <td className="py-2 pr-3 text-right whitespace-nowrap">{money(t.amount)}</td>
                                            <td className="py-2 pr-3"><span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${s.cls}`}>{s.text}</span></td>
                                            <td className="py-2 font-mono text-[10px] text-matn-xira whitespace-nowrap">
                                                {t.paymeId.slice(0, 10)}…
                                                {t.fiscalUrl && (
                                                    <a href={t.fiscalUrl} target="_blank" rel="noopener noreferrer" title="Fiskal chek" className="ml-2 text-brand underline font-sans">chek</a>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </form>
    );
}
