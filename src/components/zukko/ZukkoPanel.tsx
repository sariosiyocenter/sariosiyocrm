import { CSSProperties, KeyboardEvent as RKeyboardEvent, PointerEvent as RPointerEvent, Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, BookOpen, CalendarClock, DoorOpen, KeyRound, Mic, MicOff, PenLine, Square, Target, TrendingUp, User, UserX, Wallet, X, Zap, BarChart3, Receipt, Sparkles, ChevronRight, Paperclip, FileText, FileSpreadsheet, Image as RasmBelgi, FileUp, Loader2 } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import ZukkoBelgi from './ZukkoBelgi';
import ZukkoXabar from './ZukkoXabar';
import { tonRangi } from './ZukkoBlok';
import { AMAL_MUDDATI_MS, Amal, AmalXato, FaylBelgi, Hodisa, Holat, SavolYuklashAmali, Turn, ZukkoXato, amalTayyorla, amalniYubor, buyruqBajar, dalilMatni, faylTuri, holatniOl, natijaIzohi, savolYubor } from './zukkoApi';
import type { SaqlashNatijasi } from '../imtihon/bank/SavolYuklash';

// Savol yuklash oynasi (bank kodi bilan) — faqat kartochka tasdiqlanganda yuklanadi.
const ZukkoSavolYuklash = lazy(() => import('./ZukkoSavolYuklash'));

/**
 * Zukko — o'ng tomondan chiqadigan AI yordamchi.
 *
 * Egasi (2026-09-29): "Denta7 dagi AI ni ko'r, lekin o'ziga xos va ko'proq
 * funksiyali qil — o'ng tomondan chiqsinmi yoki chatmi". Uch qatlam:
 *   1. Puls va tezkor tugmalar — AI siz, bazadan, bir bosishda (kvota sarflanmaydi).
 *   2. Erkin savol — Gemini CRM vositalari orqali javob beradi; har raqamning
 *      manbasi kartochka bo'lib yonida chiqadi.
 *   3. Amallar — lid qo'shish, lid holati, o'quvchiga izoh: faqat tasdiqlangach,
 *      odatdagi API orqali (ruxsat va jurnal o'sha-o'sha).
 * Katta ekranda (xl) panel sahifani siqib yonida turadi, kichikda — ustida.
 */

const KENGLIK_KALIT = 'zukko_kenglik';
const suhbatKaliti = (userId?: number) => `zukko_suhbat_${userId ?? 0}`;
const MAKS_TURN = 24;
const MAKS_FAYL = 10;
// Fayl biriktirib, matn yozmay yuborilsa.
const FAYL_SAVOLI = "Shu fayldagi savollarni bankka qo'sh";

const BUYRUQ_BELGI: Record<string, typeof Zap> = {
    darslar: CalendarClock, kelmaganlar: UserX, qarzdorlar: Wallet, 'bugungi-tushum': TrendingUp, tushum: TrendingUp,
    lidlar: Target, xonalar: DoorOpen, xarajatlar: Receipt, korsatkichlar: BarChart3, oquvchi: User, kurs: BookOpen, 'kurs-qarzi': Wallet,
    imkoniyatlar: Sparkles,
};

// AI yoqilmaganda erkin matnni tezkor buyruqqa yo'naltirish (kalit so'z bo'yicha).
const MAHALLIY: [RegExp, string][] = [
    [/qarz|долг/i, 'qarzdorlar'],
    [/kelma|yo'?q ?lama|davomat|пропуск|посещ/i, 'kelmaganlar'],
    [/xarajat|расход/i, 'xarajatlar'],
    [/bugun.*(tushum|pul|to'?lov)|сегодня.*(оплат|выручк)/i, 'bugungi-tushum'],
    [/tushum|pul|to'?lov|выручк|оплат/i, 'tushum'],
    [/dars|урок|занят/i, 'darslar'],
    [/lid|лид|заявк/i, 'lidlar'],
    [/xona|кабинет|аудитор/i, 'xonalar'],
    [/ko'?rsatkich|statistika|nechta|статист/i, 'korsatkichlar'],
];

const yangiId = () => Math.random().toString(36).slice(2, 10);

function salom(ism?: string) {
    const h = new Date().getHours();
    const vaqt = h >= 5 && h < 11 ? 'Xayrli tong' : h >= 11 && h < 17 ? 'Xayrli kun' : h >= 17 && h < 23 ? 'Xayrli kech' : 'Xayrli tun';
    // Bosh sahifadagi kabi birinchi so'z; bosh harflarda saqlangan bo'lsa — oddiy yozuvda.
    const birinchi = (ism || '').trim().split(/\s+/)[0] || '';
    const chiroyli = birinchi && birinchi === birinchi.toUpperCase() ? birinchi[0] + birinchi.slice(1).toLowerCase() : birinchi;
    return chiroyli ? `${vaqt}, ${chiroyli}` : vaqt;
}

const HAFTA = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const bugunMatni = () => { const d = new Date(); return `${HAFTA[d.getDay()]}, ${d.getDate()}-${OYLAR[d.getMonth()]}`; };

/** Savol yuklash oynasi (kodi va bank daraxti) yuklanguncha. */
function OynaKutish() {
    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40" role="status">
            <div className="flex items-center gap-2 rounded-xl bg-sirt px-4 py-3 text-[13px] text-matn shadow-xl">
                <Loader2 size={16} className="animate-spin text-brand" /> Savollar banki ochilmoqda…
            </div>
        </div>
    );
}

function saqlanganSuhbat(userId?: number): Turn[] {
    try {
        const raw = localStorage.getItem(suhbatKaliti(userId));
        const turns: Turn[] = raw ? JSON.parse(raw) : [];
        // Yarim qolgan javob (sahifa yangilangan) — uzilgan deb belgilanadi; ochiq
        // qolgan savol yuklash oynasi yopilgan — kartochka yana tasdiqlashni kutadi.
        return Array.isArray(turns) ? turns.map(t => {
            const u = t.kutmoqda ? { ...t, kutmoqda: false, xato: t.xato || 'Javob uzildi' } : t;
            if (!u.amallar?.some(a => a.maxsus && a.holat === 'bajarilmoqda')) return u;
            return { ...u, amallar: u.amallar.map(a => (a.maxsus && a.holat === 'bajarilmoqda' ? { ...a, holat: 'kutmoqda' as const } : a)) };
        }) : [];
    } catch { return []; }
}

export default function ZukkoPanel({ ochiq, yop }: { ochiq: boolean; yop: () => void }) {
    const { user, token, selectedSchoolId, showNotification, retryLoad } = useCRM();
    const navigate = useNavigate();
    const location = useLocation();

    const [turns, setTurns] = useState<Turn[]>(() => saqlanganSuhbat(user?.id));
    const [matn, setMatn] = useState('');
    const [holat, setHolat] = useState<Holat | null>(null);
    const [holatXato, setHolatXato] = useState<string | null>(null);
    const [band, setBand] = useState(false);
    const [menyuIndeks, setMenyuIndeks] = useState(0);
    const [tinglaydi, setTinglaydi] = useState(false);
    const [kenglik, setKenglik] = useState(() => {
        try { return Math.min(620, Math.max(340, Number(localStorage.getItem(KENGLIK_KALIT)) || 400)); } catch { return 400; }
    });

    const abortRef = useRef<AbortController | null>(null);
    const oqimRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const nutqRef = useRef<any>(null);
    const pastdami = useRef(true);

    // Biriktirilgan fayllar. Serverga (AI ga) faqat nomi boradi; fayl o'zi xotirada,
    // xabar id si bo'yicha — savol yuklash oynasi o'qiydi. Sahifa yangilansa qayta tanlanadi.
    const [biriktirma, setBiriktirma] = useState<File[]>([]);
    const [sudralmoqda, setSudralmoqda] = useState(false);
    const [yuklash, setYuklash] = useState<{ turnId: string; indeks: number; maxsus: SavolYuklashAmali; fayllar: File[] } | null>(null);
    const faylRef = useRef<HTMLInputElement>(null);
    const fayllarRef = useRef(new Map<string, File[]>());
    const saqlandiRef = useRef(false);

    // Suhbat saqlanadi (xodim bo'yicha) — sahifa yangilansa ham yo'qolmaydi.
    useEffect(() => {
        try { localStorage.setItem(suhbatKaliti(user?.id), JSON.stringify(turns.slice(-MAKS_TURN))); } catch { /* joy tugagan */ }
    }, [turns, user?.id]);

    // Panel holati: puls, buyruqlar, sahifa konteksti. Sahifa yoki filial o'zgarsa yangilanadi.
    const yol = location.pathname;
    useEffect(() => {
        if (!ochiq || !token) return;
        const ac = new AbortController();
        const t = setTimeout(() => {
            holatniOl(token, selectedSchoolId, yol, ac.signal)
                .then(h => { setHolat(h); setHolatXato(null); })
                .catch(e => { if (e?.name !== 'AbortError') setHolatXato(e?.message || 'Yuklab bo\'lmadi'); });
        }, 150);
        return () => { clearTimeout(t); ac.abort(); };
    }, [ochiq, token, selectedSchoolId, yol]);

    // Ochilganda yozish maydoniga (sichqonchali qurilmada — telefonda klaviatura o'zi ochilib ketmasin).
    useEffect(() => {
        if (ochiq && window.matchMedia?.('(pointer: fine)').matches) setTimeout(() => inputRef.current?.focus(), 60);
    }, [ochiq]);

    // Yangi xabar kelganda pastga — agar xodim o'zi tepaga chiqib o'qimayotgan bo'lsa.
    // Layout effekt: DOM o'zgargan zahoti, brauzerning scroll hodisasidan oldin —
    // oddiy useEffect kechikib qolar va o'sgan kontent "xodim tepaga chiqdi" deb
    // o'qilib, suhbat pastga tushmay qolardi.
    useLayoutEffect(() => {
        const el = oqimRef.current;
        if (el && pastdami.current) el.scrollTop = el.scrollHeight;
    }, [turns]);

    useEffect(() => () => { abortRef.current?.abort(); nutqRef.current?.abort?.(); }, []);

    const turnniYangila = useCallback((id: string, f: (t: Turn) => Turn) => {
        setTurns(ts => ts.map(t => (t.id === id ? f(t) : t)));
    }, []);

    const havolaniOch = useCallback((y: string) => {
        navigate(y);
        // Kichik ekranda panel sahifani yopib turadi — o'tgach yopiladi.
        if (window.innerWidth < 1280) yop();
    }, [navigate, yop]);

    const buyruqlar = holat?.buyruqlar || [];
    const sahifa = holat?.sahifa;
    const sahifaBuyruqlari = buyruqlar.filter(b => b.sahifa && b.sahifa === sahifa?.tur);
    const umumiyBuyruqlar = buyruqlar.filter(b => !b.sahifa);

    // --- Tezkor buyruq (AI siz) ---------------------------------------------
    const buyruqniIshga = useCallback(async (kalit: string, nom: string, param?: { id?: number }) => {
        if (band) return;
        const zid = yangiId();
        pastdami.current = true;
        setTurns(ts => [...ts, { id: yangiId(), rol: 'user', matn: nom, vaqt: Date.now() }, { id: zid, rol: 'zukko', vaqt: Date.now(), tezkor: true, kutmoqda: true }]);
        const t0 = Date.now();
        try {
            const r = await buyruqBajar(token, selectedSchoolId, kalit, param);
            turnniYangila(zid, t => ({ ...t, kutmoqda: false, matn: r.xulosa, bloklar: [r.blok], davomiylik: Date.now() - t0 }));
        } catch (e: any) {
            turnniYangila(zid, t => ({ ...t, kutmoqda: false, xato: e?.message || 'Xato', davomiylik: Date.now() - t0 }));
        }
    }, [band, token, selectedSchoolId, turnniYangila]);

    // --- Erkin savol (AI) -----------------------------------------------------
    const hodisa = useCallback((zid: string, h: Hodisa) => {
        turnniYangila(zid, t => {
            switch (h.t) {
                case 'qadam': {
                    const qadamlar = [...(t.qadamlar || [])];
                    const i = qadamlar.findIndex(q => q.id === h.id);
                    if (i >= 0) qadamlar[i] = { ...qadamlar[i], holat: h.holat, izoh: h.izoh ?? qadamlar[i].izoh, matn: h.matn || qadamlar[i].matn };
                    else qadamlar.push({ id: h.id, matn: h.matn || '…', holat: h.holat, izoh: h.izoh });
                    return { ...t, qadamlar };
                }
                case 'blok': return { ...t, bloklar: [...(t.bloklar || []), h.blok] };
                case 'amal': return { ...t, amallar: [...(t.amallar || []), { ...h.amal, holat: 'kutmoqda' }] };
                case 'matn': return { ...t, matn: h.matn };
                case 'takliflar': return { ...t, takliflar: h.takliflar };
                case 'xato': return { ...t, xato: h.matn };
                case 'tugadi': return { ...t, kutmoqda: false };
                default: return t;
            }
        });
    }, [turnniYangila]);

    const yubor = useCallback(async (kirish?: string) => {
        const fayllar = biriktirma;
        const savol = (kirish ?? matn).trim() || (fayllar.length ? FAYL_SAVOLI : '');
        if (!savol || band) return;
        setMatn('');

        // AI yoqilmagan: kalit so'z bo'yicha tezkor buyruq, bo'lmasa — tushuntirish.
        if (holat && !holat.ai.yoqilgan) {
            const topildi = MAHALLIY.find(([re]) => re.test(savol));
            const b = topildi && buyruqlar.find(x => x.kalit === topildi[1]);
            if (b) return buyruqniIshga(b.kalit, savol);
            setTurns(ts => [...ts,
                { id: yangiId(), rol: 'user', matn: savol, vaqt: Date.now() },
                { id: yangiId(), rol: 'zukko', vaqt: Date.now(), tezkor: true, xato: "Erkin savollar uchun AI kaliti kerak. Hozircha tezkor tugmalardan foydalaning." }]);
            return;
        }

        const tarix = turns
            .filter(t => !t.kutmoqda && (t.matn || t.bloklar?.length))
            .slice(-10)
            .map(t => (t.rol === 'user'
                // Oldingi xabardagi fayl — keyingi javobda ("Matematikaga") AI uni bilsin.
                ? { rol: 'user' as const, matn: `${t.matn || ''}${t.fayllar?.length ? `\n[Biriktirilgan fayllar: ${t.fayllar.map(f => f.nom).join(', ')}]` : ''}` }
                : { rol: 'model' as const, matn: t.matn || (t.bloklar || []).map(b => b.sarlavha).join(', '), dalil: dalilMatni(t) || undefined }));

        const belgilar: FaylBelgi[] = fayllar.map(f => ({ nom: f.name, tur: faylTuri(f) }));
        const uid = yangiId();
        if (fayllar.length) {
            fayllarRef.current.set(uid, fayllar);
            setBiriktirma([]);
        }
        const zid = yangiId();
        pastdami.current = true;
        setTurns(ts => [...ts,
            { id: uid, rol: 'user', matn: savol, vaqt: Date.now(), ...(belgilar.length ? { fayllar: belgilar } : {}) },
            { id: zid, rol: 'zukko', vaqt: Date.now(), kutmoqda: true, qadamlar: [], bloklar: [], amallar: [] }]);
        setBand(true);
        const ac = new AbortController();
        abortRef.current = ac;
        const t0 = Date.now();
        try {
            await savolYubor({ token, schoolId: selectedSchoolId, savol, tarix, yol, fayllar: belgilar, signal: ac.signal, onHodisa: h => hodisa(zid, h) });
        } catch (e: any) {
            if (e?.name === 'AbortError') {
                turnniYangila(zid, t => ({ ...t, xato: t.matn ? undefined : "To'xtatildi" }));
            } else {
                if (e instanceof ZukkoXato && e.aiYoq) setHolat(h => (h ? { ...h, ai: { ...h.ai, yoqilgan: false } } : h));
                turnniYangila(zid, t => ({ ...t, xato: e?.message || 'Aloqa uzildi' }));
            }
        } finally {
            turnniYangila(zid, t => ({
                ...t,
                kutmoqda: false,
                davomiylik: Date.now() - t0,
                qadamlar: (t.qadamlar || []).map(q => (q.holat === 'ish' ? { ...q, holat: 'xato', izoh: 'uzildi' } : q)),
                xato: t.xato || (!t.matn && !t.bloklar?.length && !t.amallar?.length ? "Javob kelmadi — qayta urinib ko'ring" : undefined),
            }));
            abortRef.current = null;
            setBand(false);
        }
    }, [matn, biriktirma, band, holat, buyruqlar, buyruqniIshga, turns, token, selectedSchoolId, yol, hodisa, turnniYangila]);

    const toxtat = () => abortRef.current?.abort();

    // --- Amal tasdiqlash: kartochkadagi so'rovlar odatdagi API ga ---------------
    // Server (lib/zukkoAmallar.js) aynan UI yuboradigan so'rovni tayyorlagan;
    // ruxsat, jurnal ("Zukko orqali") va xabarlar o'sha yo'llarniki.
    const amalniQoy = useCallback((turnId: string, indeks: number, o: Partial<Amal>) => {
        turnniYangila(turnId, t => ({ ...t, amallar: (t.amallar || []).map((a, i) => (i === indeks ? { ...a, ...o } : a)) }));
    }, [turnniYangila]);

    const amalniBajar = useCallback(async (turnId: string, indeks: number, tasdiq: boolean) => {
        const turn = turns.find(t => t.id === turnId);
        const amal = turn?.amallar?.[indeks];
        if (!amal || amal.holat === 'bajarilmoqda' || amal.holat === 'bajarildi') return;
        const qoy = (o: Partial<Amal>) => amalniQoy(turnId, indeks, o);
        if (!tasdiq) return qoy({ holat: 'bekor' });
        if (amal.yaratildi && Date.now() - amal.yaratildi > AMAL_MUDDATI_MS) return qoy({ holat: 'xato', xato: "Taklif eskirdi — qaytadan so'rang" });
        // Fayldan savollar: so'rov emas — bankdagi «Savol qo'shish» oynasi ochiladi
        // (fayllar shu suhbatdagi eng yaqin xabardan), saqlashni xodim o'zi bosadi.
        if (amal.maxsus?.tur === 'savol_yuklash') {
            let fayllar: File[] = [];
            for (let i = turns.findIndex(t => t.id === turnId); i >= 0; i--) {
                const t = turns[i];
                if (t.rol !== 'user' || !t.fayllar?.length) continue;
                fayllar = fayllarRef.current.get(t.id) || [];
                if (!fayllar.length) showNotification("Fayl sahifa yangilanganda xotiradan o'chdi — oynada qayta tanlang", 'info');
                break;
            }
            saqlandiRef.current = false;
            qoy({ holat: 'bajarilmoqda', xato: undefined });
            setYuklash({ turnId, indeks, maxsus: amal.maxsus, fayllar });
            return;
        }
        if (!amal.sorovlar?.length) return qoy({ holat: 'xato', xato: "Bu kartochka eski — amalni qaytadan so'rang" });
        qoy({ holat: 'bajarilmoqda', xato: undefined });
        try {
            const javoblar = await amalniYubor(token, amal.sorovlar);
            qoy({ holat: 'bajarildi', izoh: natijaIzohi(javoblar) });
            showNotification(amal.natija || 'Bajarildi', 'success');
            // Ro'yxatlar (o'quvchilar, to'lovlar, lidlar...) fonda yangilanadi — ilova yopilmaydi.
            retryLoad().catch(() => {});
        } catch (e: any) {
            if (e instanceof AmalXato && e.bajarildi > 0) {
                qoy({ holat: 'qisman', xato: e.message, izoh: natijaIzohi(e.javoblar) });
                retryLoad().catch(() => {});
            } else {
                qoy({ holat: 'xato', xato: e?.message || "Bajarib bo'lmadi" });
            }
        }
    }, [turns, amalniQoy, token, showNotification, retryLoad]);

    // Savol yuklash oynasi saqladi: kartochka bajarildi; imtihon aytilgan bo'lsa —
    // faol savollarni unga qo'shish kartochkasi (yana xodim tasdiqlaydi).
    const yuklashSaqlandi = async (n: SaqlashNatijasi) => {
        if (!yuklash) return;
        saqlandiRef.current = true;
        const { turnId, indeks, maxsus } = yuklash;
        const qoralama = n.soni - n.faolIds.length;
        const izoh = `${n.soni} ta savol bankka qo'shildi${qoralama > 0 ? ` · ${n.faolIds.length} tasi faol, ${qoralama} tasi qoralama` : ''}`;
        amalniQoy(turnId, indeks, { holat: 'bajarildi', izoh });
        if (!maxsus.imtihon) return;
        if (!n.faolIds.length) {
            amalniQoy(turnId, indeks, { izoh: `${izoh}. Imtihonga faqat faol savol qo'shiladi — bankda tekshirib, faol qiling` });
            return;
        }
        try {
            const keyingi = await amalTayyorla(token, selectedSchoolId, 'imtihonga_savol_qoshish', { imtihon: String(maxsus.imtihon.id), savolIdlar: n.faolIds });
            pastdami.current = true;
            turnniYangila(turnId, t => ({ ...t, amallar: [...(t.amallar || []), { ...keyingi, holat: 'kutmoqda' }] }));
        } catch (e: any) {
            amalniQoy(turnId, indeks, { izoh: `${izoh}. «${maxsus.imtihon.nom}» ga qo'shib bo'lmadi: ${e?.message || 'xato'}` });
        }
    };

    const yuklashYopildi = (xato?: string) => {
        if (!yuklash) return;
        if (!saqlandiRef.current) amalniQoy(yuklash.turnId, yuklash.indeks, xato ? { holat: 'xato', xato } : { holat: 'kutmoqda' });
        setYuklash(null);
    };

    // --- Fayl biriktirish -----------------------------------------------------
    const faylQabul = !!holat?.ai.yoqilgan && !!holat?.faylQabul;
    const faylQosh = (royxat: File[]) => {
        if (!faylQabul || !royxat.length) return;
        const yaroqli = royxat.filter(f => faylTuri(f));
        const eski = royxat.find(f => /\.doc$/i.test(f.name));
        if (eski) showNotification(`${eski.name}: eski Word formati (.doc) o'qilmaydi — Word'da «Fayl → Saqlash» orqali .docx yoki PDF qilib saqlang`, 'error');
        else if (yaroqli.length < royxat.length) showNotification('Faqat PDF, Word (.docx), rasm yoki Excel fayl biriktiriladi', 'error');
        const yangi = [...biriktirma, ...yaroqli.filter(f => !biriktirma.some(x => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified))];
        if (yangi.length > MAKS_FAYL) showNotification(`Bir xabarga ${MAKS_FAYL} tagacha fayl`, 'error');
        setBiriktirma(yangi.slice(0, MAKS_FAYL));
        if (window.matchMedia?.('(pointer: fine)').matches) setTimeout(() => inputRef.current?.focus(), 0);
    };

    // --- Ovoz bilan yozish (brauzer qo'llasa) ---------------------------------
    const NutqAniqlash = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
    const ovoz = () => {
        if (tinglaydi) { nutqRef.current?.stop?.(); return; }
        if (!NutqAniqlash) return;
        const r = new NutqAniqlash();
        r.lang = /[а-яё]/i.test(matn) ? 'ru-RU' : 'uz-UZ';
        r.interimResults = true;
        r.continuous = false;
        const boshi = matn ? `${matn.trim()} ` : '';
        r.onresult = (e: any) => {
            const s = Array.from(e.results).map((x: any) => x[0]?.transcript || '').join('');
            setMatn(boshi + s);
        };
        r.onerror = () => setTinglaydi(false);
        r.onend = () => setTinglaydi(false);
        nutqRef.current = r;
        setTinglaydi(true);
        try { r.start(); } catch { setTinglaydi(false); }
    };

    // --- "/" buyruqlar menyusi ------------------------------------------------
    const menyu = useMemo(() => {
        if (!matn.startsWith('/')) return [];
        const q = matn.slice(1).toLowerCase().trim();
        const hammasi = [...sahifaBuyruqlari, ...umumiyBuyruqlar];
        return hammasi.filter(b => !q || b.nom.toLowerCase().includes(q) || b.kalit.includes(q)).slice(0, 8);
    }, [matn, sahifaBuyruqlari, umumiyBuyruqlar]);
    useEffect(() => setMenyuIndeks(0), [menyu.length]);

    const menyudanTanla = (b: { kalit: string; nom: string; sahifa: string | null }) => {
        setMatn('');
        buyruqniIshga(b.kalit, b.sahifa && sahifa?.nom ? `${b.nom}: ${sahifa.nom}` : b.nom, b.sahifa ? { id: sahifa?.id } : undefined);
    };

    const klavish = (e: RKeyboardEvent<HTMLTextAreaElement>) => {
        if (menyu.length) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setMenyuIndeks(i => (i + 1) % menyu.length); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setMenyuIndeks(i => (i - 1 + menyu.length) % menyu.length); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); menyudanTanla(menyu[menyuIndeks]); return; }
            if (e.key === 'Escape') { e.preventDefault(); setMatn(''); return; }
        }
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); yubor(); }
        if (e.key === 'Escape' && !matn) yop();
    };

    // Yozish maydoni balandligi matnga qarab (5 qatorgacha).
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
    }, [matn, ochiq]);

    /** Misolni yozish maydoniga (xodim ismlarni o'zinikiga almashtiradi). */
    const yozishgaQoy = (m: string) => {
        setMatn(m);
        setTimeout(() => {
            const el = inputRef.current;
            if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        }, 0);
    };

    const taklifniOl = (s: string) => {
        // "Izohiga yozib qo'y: " kabi takliflarni xodim o'zi davom ettiradi.
        if (s.endsWith(': ')) { setMatn(s); inputRef.current?.focus(); return; }
        yubor(s);
    };

    // --- Kenglikni sudrab o'zgartirish (katta ekranda) ------------------------
    const sudra = (e: RPointerEvent) => {
        e.preventDefault();
        const harakat = (ev: PointerEvent) => setKenglik(Math.min(620, Math.max(340, window.innerWidth - ev.clientX)));
        const tugat = () => {
            window.removeEventListener('pointermove', harakat);
            window.removeEventListener('pointerup', tugat);
            document.body.style.cursor = '';
            setKenglik(k => { try { localStorage.setItem(KENGLIK_KALIT, String(k)); } catch { /* */ } return k; });
        };
        document.body.style.cursor = 'col-resize';
        window.addEventListener('pointermove', harakat);
        window.addEventListener('pointerup', tugat);
    };

    const tozala = () => {
        abortRef.current?.abort();
        setTurns([]);
        setMatn('');
    };

    // Savol yuklash oynasi panel yopilsa ham turadi (AI ishi yo'qolmasin): ikkala holatda
    // ham fragmentning ikkinchi bolasi — React uni qayta yaratmaydi.
    const oyna = yuklash ? (
        <Suspense fallback={<OynaKutish />}>
            <ZukkoSavolYuklash fanId={yuklash.maxsus.fanId} mavzuId={yuklash.maxsus.mavzuId} fayllar={yuklash.fayllar}
                kutish={<OynaKutish />} onYop={yuklashYopildi} onSaqlandi={yuklashSaqlandi} />
        </Suspense>
    ) : null;

    if (!ochiq) return <>{null}{oyna}</>;

    const aiYoq = holat ? !holat.ai.yoqilgan : false;
    const has = (k: string) => buyruqlar.some(b => b.kalit === k);
    const namunalar = [
        sahifa?.tur === 'oquvchi' && "Bu o'quvchining qarzi va davomati qanday?",
        sahifa?.tur === 'kurs' && 'Bu kursda kim qarzdor va kim ko\'p dars qoldiryapti?',
        has('tushum') && "Bu oy tushum o'tgan oyga nisbatan qanday?",
        has('qarzdorlar') && "Eng katta 5 ta qarzdor kim, oxirgi marta qachon to'lagan?",
        has('kelmaganlar') && "Shu hafta eng ko'p dars qoldirganlar kim?",
        has('xonalar') && "Ertaga 15:00 da qaysi xona bo'sh?",
    ].filter(Boolean).slice(0, 3) as string[];
    // Buyruq namunalari — server xodimning ruxsati bo'yicha beradi; bosilsa yozish maydoniga tushadi.
    const buyruqNamunalari = (holat?.amalMisollari || []).slice(0, 3);
    const tezkorlar = umumiyBuyruqlar.filter(b => b.kalit !== 'imkoniyatlar');

    return (
        <>
            <>
                {/* Kichik ekranda panel sahifa ustida: orqa fon bosilsa yopiladi. */}
                <div className="fixed inset-0 z-[290] bg-slate-900/30 xl:hidden" onClick={yop} aria-hidden="true" />
                <aside
                    aria-label="Zukko — AI yordamchi"
                    className="fixed z-[300] inset-0 sm:left-auto sm:w-[420px] sm:border-l xl:sticky xl:inset-auto xl:top-0 xl:h-screen xl:z-40 xl:w-[var(--zk-w)] xl:shrink-0 border-chiziq bg-sirt flex flex-col shadow-2xl xl:shadow-none"
                    style={{ '--zk-w': `${kenglik}px` } as CSSProperties}
                    // Test faylini panelga tashlash (kompyuterda).
                    onDragOver={e => { if (faylQabul && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setSudralmoqda(true); } }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSudralmoqda(false); }}
                    onDrop={e => { if (!faylQabul) return; e.preventDefault(); setSudralmoqda(false); faylQosh(Array.from(e.dataTransfer.files || [])); }}
                >
                    <div onPointerDown={sudra} className="hidden xl:block absolute left-0 top-0 h-full w-2 -translate-x-1/2 cursor-col-resize z-10 group" title="Kenglikni o'zgartirish">
                        <div className="mx-auto h-full w-[2px] bg-transparent group-hover:bg-brand/40 transition-colors" />
                    </div>

                    {sudralmoqda && (
                        <div className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand bg-sirt text-center px-6">
                            <FileUp size={28} className="text-brand" />
                            <div className="text-[14px] font-semibold text-matn">Faylni tashlang</div>
                            <div className="text-[12px] text-matn-sokin">PDF, Word, rasm yoki Excel — savollarini ajratib, bankka yoki imtihonga qo'shaman</div>
                        </div>
                    )}

                    {/* Sarlavha */}
                    <div className="zk-nur shrink-0 border-b border-chiziq">
                        <div className="h-[54px] flex items-center gap-2.5 px-3.5">
                            <ZukkoBelgi size={30} fikrlaydi={band} />
                            <div className="min-w-0 flex-1 leading-tight">
                                <div className="text-[14.5px] font-semibold text-matn tracking-tight">Zukko</div>
                                <div className="text-[11px] text-matn-sokin truncate">
                                    {aiYoq ? 'Tezkor rejim · AI yoqilmagan' : 'AI yordamchi'}{holat?.filial ? ` · ${holat.filial}` : ''}
                                </div>
                            </div>
                            {turns.length > 0 && (
                                <button onClick={tozala} title="Yangi suhbat" aria-label="Yangi suhbat"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-matn-sokin hover:text-matn hover:bg-ichki transition-colors">
                                    <PenLine size={16} />
                                </button>
                            )}
                            <button onClick={yop} title="Yopish (Ctrl + /)" aria-label="Yopish"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-matn-sokin hover:text-matn hover:bg-ichki transition-colors">
                                <X size={17} />
                            </button>
                        </div>
                    </div>

                    {/* Suhbat oqimi */}
                    <div
                        ref={oqimRef}
                        onScroll={e => { const el = e.currentTarget; pastdami.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}
                        className="flex-1 min-h-0 overflow-y-auto [overflow-anchor:none] px-3.5 py-4 space-y-4"
                    >
                        {turns.length === 0 ? (
                            <div className="space-y-5 zk-kirish">
                                <div>
                                    <div className="text-[19px] font-semibold text-matn tracking-tight">{salom(user?.name)}</div>
                                    <div className="text-[12.5px] text-matn-sokin mt-0.5">Bugun {bugunMatni()}. Nimani bilmoqchisiz?</div>
                                </div>

                                {holatXato && <div className="rounded-xl border border-xato-chiziq bg-xato-fon px-3 py-2 text-[12px] text-xato">{holatXato}</div>}

                                {/* Puls: bugungi holat, AI siz */}
                                <div className="grid grid-cols-2 gap-2">
                                    {(holat?.puls || Array.from({ length: 4 }, () => null)).map((p, i) => p ? (
                                        <button key={p.kalit} onClick={() => buyruqniIshga(p.kalit, buyruqlar.find(b => b.kalit === p.kalit)?.nom || p.nom)}
                                            className="group text-left rounded-xl border border-chiziq bg-sirt px-3 py-2.5 hover:border-brand/40 hover:bg-brand/[0.03] transition-colors min-w-0">
                                            <div className="text-[11px] text-matn-sokin truncate">{p.nom}</div>
                                            <div className={`raqam text-[21px] font-semibold leading-tight mt-0.5 truncate ${tonRangi(p.ton)}`}>{p.qiymat}</div>
                                            {p.izoh && <div className="text-[10.5px] text-matn-xira mt-0.5 truncate">{p.izoh}</div>}
                                        </button>
                                    ) : (
                                        <div key={i} className="h-[76px] rounded-xl border border-chiziq bg-ichki/60 animate-pulse" />
                                    ))}
                                </div>

                                {/* Sahifa konteksti */}
                                {sahifa && (sahifa.tur === 'oquvchi' || sahifa.tur === 'kurs') && sahifaBuyruqlari.length > 0 && (
                                    <div className="rounded-xl border border-brand/25 bg-brand/[0.04] px-3 py-2.5">
                                        <div className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-brand">shu sahifa</div>
                                        <div className="text-[13px] font-semibold text-matn truncate mt-0.5">{sahifa.nom}</div>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {sahifaBuyruqlari.map(b => (
                                                <button key={b.kalit} onClick={() => menyudanTanla(b)}
                                                    className="rounded-full bg-sirt border border-chiziq px-2.5 py-1 text-[11.5px] text-matn-2 hover:border-brand/40 hover:text-brand transition-colors">
                                                    {b.nom}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {tezkorlar.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-matn-sokin mb-2"><Zap size={12} /> Tezkor · AI siz</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {tezkorlar.map(b => {
                                                const Belgi = BUYRUQ_BELGI[b.kalit] || Zap;
                                                return (
                                                    <button key={b.kalit} onClick={() => buyruqniIshga(b.kalit, b.nom)}
                                                        className="inline-flex items-center gap-1.5 rounded-full border border-chiziq bg-sirt px-2.5 py-1.5 text-[12px] text-matn-2 hover:border-brand/40 hover:text-brand transition-colors">
                                                        <Belgi size={13} /> {b.nom}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {aiYoq ? (
                                    <div className="rounded-xl border border-chiziq bg-ichki px-3 py-3">
                                        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-matn"><KeyRound size={14} className="text-ogoh" /> Erkin savollar o'chiq</div>
                                        <p className="text-[12px] text-matn-sokin mt-1 leading-relaxed">
                                            «Bu oy tushum qanday?» kabi savollarga javob uchun Gemini AI kaliti kerak. Tezkor tugmalar esa hozir ham ishlaydi.
                                        </p>
                                        {holat?.ai.sozlay ? (
                                            <button onClick={() => havolaniOch('/exams?tab=sozlama')} className="mt-2 text-[12px] font-medium text-brand hover:underline">
                                                Imtihonlar → Sozlamalar →
                                            </button>
                                        ) : <p className="text-[11.5px] text-matn-xira mt-1">Kalitni administrator kiritadi.</p>}
                                    </div>
                                ) : (
                                    <>
                                        {!!holat?.amallarSoni && (
                                            <button onClick={() => buyruqniIshga('imkoniyatlar', 'Nimalar qila olaman?')}
                                                className="w-full flex items-center gap-3 rounded-xl border border-brand/25 bg-brand/[0.05] px-3 py-2.5 text-left hover:bg-brand/[0.09] transition-colors">
                                                <span className="w-8 h-8 rounded-lg bg-brand/12 text-brand flex items-center justify-center shrink-0"><Sparkles size={16} /></span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-[13px] font-semibold text-matn">Buyuring — bajaraman</span>
                                                    <span className="block text-[11.5px] text-matn-sokin">{holat.amallarSoni} xil amal: to'lov, yo'qlama, o'quvchi, kurs, xabar… Har birini siz tasdiqlaysiz</span>
                                                </span>
                                                <ChevronRight size={16} className="text-matn-xira shrink-0" />
                                            </button>
                                        )}
                                        {faylQabul && (
                                            <button onClick={() => faylRef.current?.click()}
                                                className="w-full flex items-center gap-3 rounded-xl border border-dashed border-chiziq-kuchli px-3 py-2.5 text-left hover:border-brand/50 hover:bg-brand/[0.03] transition-colors">
                                                <span className="w-8 h-8 rounded-lg bg-ichki text-matn-sokin flex items-center justify-center shrink-0"><Paperclip size={16} /></span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-[13px] font-semibold text-matn">Test fayli</span>
                                                    <span className="block text-[11.5px] text-matn-sokin">PDF, Word, rasm yoki Excel — savollarini ajratib, bankka yoki imtihonga qo'shaman</span>
                                                </span>
                                            </button>
                                        )}
                                        {buyruqNamunalari.length > 0 && (
                                            <div>
                                                <div className="text-[11px] font-semibold text-matn-sokin mb-1.5">Masalan, buyuring</div>
                                                <div className="space-y-1">
                                                    {buyruqNamunalari.map(n => (
                                                        <button key={n} onClick={() => yozishgaQoy(n)} title="Yozish maydoniga qo'yish"
                                                            className="w-full text-left rounded-lg px-2.5 py-2 text-[12.5px] text-matn-2 hover:bg-ichki hover:text-matn transition-colors flex items-start gap-2">
                                                            <PenLine size={13} className="text-brand mt-[3px] shrink-0" /><span>{n}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {namunalar.length > 0 && (
                                            <div>
                                                <div className="text-[11px] font-semibold text-matn-sokin mb-1.5">Yoki so'rang</div>
                                                <div className="space-y-1">
                                                    {namunalar.map(n => (
                                                        <button key={n} onClick={() => yubor(n)}
                                                            className="w-full text-left rounded-lg px-2.5 py-2 text-[12.5px] text-matn-2 hover:bg-ichki hover:text-matn transition-colors flex items-start gap-2">
                                                            <span className="text-brand mt-[1px]">›</span><span>{n}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : (
                            turns.map(t => (
                                <ZukkoXabar key={t.id} turn={t} onHavola={havolaniOch} onTaklif={taklifniOl} onYoz={yozishgaQoy}
                                    onAmal={(i, tasdiq) => amalniBajar(t.id, i, tasdiq)} />
                            ))
                        )}
                    </div>

                    {/* Yozish maydoni */}
                    <div className="shrink-0 border-t border-chiziq px-3 pt-2.5 pb-3 bg-sirt relative">
                        {menyu.length > 0 && (
                            <div className="absolute left-3 right-3 bottom-full mb-2 rounded-xl border border-chiziq bg-sirt shadow-xl overflow-hidden zk-kirish" role="listbox">
                                <div className="px-3 pt-2 pb-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-matn-xira">tezkor buyruqlar · AI siz</div>
                                {menyu.map((b, i) => {
                                    const Belgi = BUYRUQ_BELGI[b.kalit] || Zap;
                                    return (
                                        <button key={b.kalit} role="option" aria-selected={i === menyuIndeks}
                                            onMouseEnter={() => setMenyuIndeks(i)} onClick={() => menyudanTanla(b)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12.5px] ${i === menyuIndeks ? 'bg-brand/[0.07] text-brand' : 'text-matn-2'}`}>
                                            <Belgi size={14} className="shrink-0" />
                                            <span className="flex-1 truncate">{b.nom}{b.sahifa && sahifa?.nom ? <span className="text-matn-xira"> · {sahifa.nom}</span> : null}</span>
                                            <span className="font-mono text-[10px] text-matn-xira">/{b.kalit}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {turns.length > 0 && sahifa && (sahifa.tur === 'oquvchi' || sahifa.tur === 'kurs') && (
                            <div className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand/[0.07] px-2.5 py-1 text-[11px] text-brand">
                                {sahifa.tur === 'oquvchi' ? <User size={12} /> : <BookOpen size={12} />}
                                <span className="truncate">«bu {sahifa.tur === 'oquvchi' ? "o'quvchi" : 'kurs'}» — {sahifa.nom}</span>
                            </div>
                        )}

                        {biriktirma.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                                {biriktirma.map((f, i) => {
                                    const tur = faylTuri(f);
                                    const Belgi = tur === 'Excel' ? FileSpreadsheet : tur === 'rasm' ? RasmBelgi : FileText;
                                    return (
                                        <span key={`${f.name}-${f.size}-${i}`} title={f.name}
                                            className="inline-flex max-w-[230px] items-center gap-1.5 rounded-lg border border-chiziq bg-ichki py-1 pl-2 pr-1 text-[11.5px] text-matn-2">
                                            <Belgi size={13} className={`shrink-0 ${tur === 'Excel' ? 'text-yaxshi' : 'text-brand'}`} />
                                            <span className="truncate">{f.name}</span>
                                            <button onClick={() => setBiriktirma(l => l.filter((_, j) => j !== i))} aria-label={`${f.name} — olib tashlash`}
                                                className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-matn-xira hover:text-xato hover:bg-sirt">
                                                <X size={12} />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        <div className={`flex items-end gap-1.5 rounded-2xl border bg-ichki px-2 py-1.5 transition-colors ${band ? 'border-brand/40' : 'border-chiziq focus-within:border-brand/50'}`}>
                            {faylQabul && (
                                <button onClick={() => faylRef.current?.click()} title="Fayl biriktirish — PDF, Word, rasm yoki Excel" aria-label="Fayl biriktirish"
                                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-matn-sokin hover:text-brand hover:bg-sirt transition-colors">
                                    <Paperclip size={16} />
                                </button>
                            )}
                            <textarea
                                ref={inputRef}
                                value={matn}
                                onChange={e => setMatn(e.target.value)}
                                onKeyDown={klavish}
                                // Nusxalangan rasm (Ctrl+V) — biriktiriladi.
                                onPaste={e => {
                                    const rasmlar = Array.from(e.clipboardData?.files || []);
                                    if (faylQabul && rasmlar.length) { e.preventDefault(); faylQosh(rasmlar); }
                                }}
                                rows={1}
                                placeholder={aiYoq ? 'Masalan: qarzdorlar, bugungi darslar' : 'Savol yoki buyruq yozing…'}
                                aria-label="Zukkoga savol"
                                className="flex-1 min-w-0 resize-none bg-transparent px-1.5 py-1.5 text-[13.5px] leading-[1.45] text-matn placeholder:text-matn-xira max-h-[132px]"
                                // index.css dagi umumiy fokus ramkasi qatlamsiz — Tailwind klassi uni bosolmaydi.
                                // Fokusni tashqi quti (focus-within) ko'rsatadi.
                                style={{ outline: 'none' }}
                            />
                            {NutqAniqlash && !band && (
                                <button onClick={ovoz} title={tinglaydi ? "To'xtatish" : 'Ovoz bilan yozish'} aria-label="Ovoz bilan yozish"
                                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${tinglaydi ? 'bg-xato text-white animate-pulse' : 'text-matn-sokin hover:text-brand hover:bg-sirt'}`}>
                                    {tinglaydi ? <MicOff size={16} /> : <Mic size={16} />}
                                </button>
                            )}
                            {band ? (
                                <button onClick={toxtat} title="To'xtatish" aria-label="To'xtatish"
                                    className="w-8 h-8 rounded-xl bg-matn text-sirt flex items-center justify-center shrink-0 hover:opacity-85">
                                    <Square size={12} fill="currentColor" />
                                </button>
                            ) : (
                                <button onClick={() => yubor()} disabled={!matn.trim() && !biriktirma.length} title="Yuborish (Enter)" aria-label="Yuborish"
                                    className="w-8 h-8 rounded-xl bg-brand text-brand-ust flex items-center justify-center shrink-0 disabled:opacity-35 hover:opacity-90 transition-opacity">
                                    <ArrowUp size={16} strokeWidth={2.4} />
                                </button>
                            )}
                        </div>
                        <div className="mt-1.5 px-1 flex items-center justify-between gap-2 text-[10.5px] text-matn-xira">
                            <span className="truncate">/ — tezkor buyruqlar · telefonlar AI ga berilmaydi</span>
                            <span className="hidden sm:inline font-mono shrink-0">Ctrl+/</span>
                        </div>
                        <input ref={faylRef} type="file" multiple accept="image/*,application/pdf,.pdf,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.xlsx,.xls" className="hidden"
                            onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; faylQosh(f); }} />
                    </div>
                </aside>
            </>
            {oyna}
        </>
    );
}
