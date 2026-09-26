import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft, ChevronRight, Loader2, Send, Maximize2, MapPin, X, Search, Phone, AlertTriangle, ChevronDown, Check, Bot, Users,
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { toDateStr, toTimeStr } from '../../../lib/lessons.js';
import { narxHisobla, uyMasofasi, somMatni, tarifMatni } from '../../../lib/transportNarx.js';
import {
    reysKorsatkichi, rejasizlarniJoylash, yangidanTaqsimlash, farqlar, kochir, keyingiNavbat, yangiKalit,
    kalitlarniSaqla, ENG_KOP_NAVBAT,
} from '../../../lib/rejaTahrir.js';
import { parseLatLng, ZAXIRA_MARKAZ } from '../../lib/mapMarkers';
import { displayName } from '../../lib/displayName';
import { jonlimi, qachon } from '../LogisticsMap';
import RejaXarita, { type XBola, type XYol, type BolaHolati } from './RejaXarita';
import type { Car, CarHolati, DayDriver, DayPlan, Korinish, Kun, Qoralama } from './turlar';

/**
 * Logistika → Reja. Uch qadam, bitta ekran (egasi, 2026-09-26: avval
 * "xaritada srazu ko'rinsin, xohlaguncha o'zgartirish mumkin bo'lsin", keyin
 * birinchi variant haqida "vabshe tushunarsiz va qiyin" — shuning uchun
 * hamma ortiqcha narsa olib tashlandi):
 *
 *   1. Bugun kim ketadi — bugun kelgan va transport kerak bolalar ro'yxati,
 *      keraksizi belgidan olinadi.
 *   2. Haydovchilar — kim ishlaydi; "Haydovchilarga bo'lish".
 *   3. Taqsimot — har haydovchining kartasi, xaritada ularning ranglari.
 *      Bolani (xaritada yoki ro'yxatda) bosish → boshqa mashinaga o'tkazish.
 *      "Haydovchilarga yuborish" — faqat o'zgargan haydovchiga xabar boradi.
 *
 * O'zgarishlar yuborilmaguncha brauzerda saqlanib turadi (sahifa yangilansa
 * ham yo'qolmaydi) va PUT /api/logistics/day bilan yoziladi. Haydovchi
 * "Qabul qildim" bosgan mashina o'zgarmaydi — bolalar allaqachon unda.
 */

/** Har reysning o'z rangi (haydovchi tartibi + reys raqami) — boshqa reys qo'shilsa ham o'zgarmaydi. */
const PALITRA = ['#0f766e', '#e11d48', '#2563eb', '#d97706', '#7c3aed', '#16a34a', '#db2777', '#0891b2', '#65a30d', '#9333ea', '#ea580c', '#475569'];
const reysRangi = (haydovchiTartibi: number, navbat: number) => PALITRA[(haydovchiTartibi + (navbat - 1) * 5) % PALITRA.length];
/** "DEMO Alijon Norov" → "Alijon". */
const qisqaIsm = (n: string) => (n || '').replace(/^DEMO\s+/i, '').trim().split(/\s+/)[0] || n;
const KULRANG = '#94a3b8';
const KELGAN = new Set(['Keldi', 'Kechikdi']);
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const KUNLAR = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

const karta = 'bg-sirt rounded-2xl border border-chiziq shadow-sm';
const chip = (faol: boolean) => `flex items-center gap-1.5 px-3 h-9 rounded-xl text-[12.5px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${faol
    ? 'bg-brand border-brand text-white' : 'bg-sirt border-chiziq text-matn-sokin hover:border-brand hover:text-brand'}`;

const kalitOl = (schoolId: number, sana: string, tur: string) => `logistika-reja:${tur}:${schoolId}:${sana}`;
function oqi<T>(k: string): T | null {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
}
function yoz(k: string, v: unknown) {
    try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch { /* shart emas */ }
}

function sanaNomi(sana: string) {
    const d = new Date(sana + 'T12:00:00');
    const farq = Math.round((d.getTime() - new Date(toDateStr() + 'T12:00:00').getTime()) / 86400000);
    const oddiy = `${d.getDate()}-${OYLAR[d.getMonth()]}`;
    if (farq === 0) return `Bugun, ${oddiy}`;
    if (farq === 1) return `Ertaga, ${oddiy}`;
    if (farq === -1) return `Kecha, ${oddiy}`;
    return `${oddiy}, ${KUNLAR[d.getDay()]}`;
}

const mashinaMatni = (t?: { model?: string; name?: string; number?: string } | null) =>
    t ? [t.model || t.name, t.number].filter(Boolean).join(' · ') : '';

const HOLAT_XARITA: Record<string, BolaHolati> = { 'Olib ketildi': 'olindi', 'Uyiga yetkazildi': 'yetkazildi', 'Kelmadi': 'chiqmadi' };
const HOLAT_NOMI: Record<string, { matn: string; cls: string }> = {
    'Olib ketildi': { matn: 'Olindi', cls: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/50' },
    'Uyiga yetkazildi': { matn: 'Yetkazildi', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50' },
    'Kelmadi': { matn: 'Chiqmadi', cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50' },
};

interface Bola {
    id: number; name: string; phone?: string; address?: string; location?: string | null; photo?: string | null;
    groups?: number[]; needsTransport?: boolean; kod?: number | null; status?: string;
}

export default function RejaTab({ onTarif }: { onTarif?: () => void }) {
    const { students, groups, attendances, settings, showNotification, token, selectedSchoolId, ozgartira, updateStudent } = useCRM();
    const tahrir = ozgartira('logistika.reja');
    const joyTahrir = ozgartira('oquvchilar.royxat');
    const confirm = useConfirm();
    const navigate = useNavigate();
    const schoolId = Number(selectedSchoolId) || 0;

    const [sana, setSana] = useState(toDateStr());
    const bugunmi = sana === toDateStr();
    const markaz = useMemo(() => parseLatLng(settings?.centerLocation) || ZAXIRA_MARKAZ, [settings?.centerLocation]);

    // ===================== Server: kun =====================
    const [kun, setKun] = useState<Kun | null>(null);
    const [yuklanmoqda, setYuklanmoqda] = useState(false);
    const sorov = useRef(0);
    const yukla = useCallback(async (jim = false) => {
        if (!schoolId) return;
        const so = ++sorov.current;
        if (!jim) setYuklanmoqda(true);
        try {
            const r = await fetch(`/api/logistics/day?schoolId=${schoolId}&date=${sana}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Yuklab bo'lmadi");
            const d = await r.json();
            if (so === sorov.current) setKun({ date: d.date || sana, plans: d.plans || [], drivers: d.drivers || [], tarif: d.tarif ?? null });
        } catch (e: any) {
            if (!jim) showNotification(e.message || "Logistika ma'lumoti yuklanmadi", 'error');
        } finally {
            if (so === sorov.current) setYuklanmoqda(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId, sana, token]);
    useEffect(() => { yukla(); }, [yukla]);
    // Bugun: haydovchi joylashuvi va botdagi "Qabul qildim / Yetkazdim" shu yerda ko'rinsin.
    useEffect(() => {
        if (!bugunmi) return;
        const t = setInterval(() => yukla(true), 30000);
        return () => clearInterval(t);
    }, [bugunmi, yukla]);

    const kunTayyor = !!kun && kun.date === sana;
    const rejalar: DayPlan[] = kunTayyor ? kun!.plans : [];
    const haydovchilar: DayDriver[] = kunTayyor ? kun!.drivers : [];
    const tarif = kunTayyor ? kun!.tarif : null;
    const haydovchi = useCallback((id: number) => haydovchilar.find(h => h.id === id), [haydovchilar]);

    const hTartib = useMemo(() => {
        const m = new Map<number, number>();
        haydovchilar.forEach((h, i) => m.set(h.id, i));
        rejalar.forEach(p => { if (p.driver && !m.has(p.driver.id)) m.set(p.driver.id, m.size); });
        return m;
    }, [haydovchilar, rejalar]);

    // ===================== Bazadagi mashinalar =====================
    const planMap = useMemo(() => new Map(rejalar.map(p => [p.id, p])), [rejalar]);
    const asos: Car[] = useMemo(() => rejalar.filter(p => p.driver).map(p => ({
        key: `r${p.id}`, routeId: p.id, driverId: p.driver!.id, navbat: p.navbat || 1, studentIds: p.stops.map(s => s.studentId),
    })), [rejalar]);
    const qulf = useMemo(() => new Set(rejalar.filter(p => p.run?.startedAt).map(p => `r${p.id}`)), [rejalar]);
    const asosImzo = useMemo(() => JSON.stringify(asos.map(c => [c.routeId, c.driverId, [...c.studentIds].sort((a, b) => a - b)])), [asos]);
    const asosOchiq = useMemo(() => asos.filter(c => !qulf.has(c.key)), [asos, qulf]);

    // ===================== Yuborilmagan o'zgarishlar (brauzerda saqlanadi) =====================
    const [qoralama, setQoralama] = useState<Qoralama | null>(null);
    const [korinish, setKorinish] = useState<Korinish>({ chiqarilgan: [], qoshilgan: [], olinmagan: [] });
    const [ziddiyat, setZiddiyat] = useState(false);
    const yuklanganKalit = useRef('');

    // Bir haftadan eski kunlarning yozuvlari brauzerda to'planib qolmasin.
    useEffect(() => {
        try {
            const chegara = toDateStr(new Date(Date.now() - 7 * 86400000));
            for (const k of Object.keys(localStorage)) {
                const m = /^logistika-reja:(?:qoralama|korinish):\d+:(\d{4}-\d{2}-\d{2})$/.exec(k);
                if (m && m[1] < chegara) localStorage.removeItem(k);
            }
        } catch { /* shart emas */ }
    }, []);

    // Sana (yoki filial) almashdi — oldingi kunning o'zgarishlari yangi kunda ko'rinmasin.
    useEffect(() => {
        yuklanganKalit.current = '';
        setQoralama(null);
        setKorinish({ chiqarilgan: [], qoshilgan: [], olinmagan: [] });
    }, [sana, schoolId]);

    useEffect(() => {
        if (!kunTayyor || !schoolId) return;
        const k = `${schoolId}:${sana}`;
        if (yuklanganKalit.current === k) return;
        yuklanganKalit.current = k;
        setZiddiyat(false);
        setKorinish(oqi<Korinish>(kalitOl(schoolId, sana, 'korinish')) || { chiqarilgan: [], qoshilgan: [], olinmagan: [] });
        const q = oqi<Qoralama>(kalitOl(schoolId, sana, 'qoralama'));
        if (q && Array.isArray(q.cars)) {
            setQoralama(q);
            if (q.asosImzo !== asosImzo) setZiddiyat(true);
        } else setQoralama(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kunTayyor, schoolId, sana]);

    useEffect(() => {
        if (!schoolId || yuklanganKalit.current !== `${schoolId}:${sana}`) return;
        yoz(kalitOl(schoolId, sana, 'qoralama'), qoralama);
    }, [qoralama, schoolId, sana]);
    useEffect(() => {
        if (!schoolId || yuklanganKalit.current !== `${schoolId}:${sana}`) return;
        const bosh = !korinish.chiqarilgan.length && !korinish.qoshilgan.length && !korinish.olinmagan.length;
        yoz(kalitOl(schoolId, sana, 'korinish'), bosh ? null : korinish);
    }, [korinish, schoolId, sana]);

    // Boshqa xodim yubordi: o'zgarishimiz yo'q bo'lsa — jimgina yangisiga o'tamiz.
    useEffect(() => {
        if (!qoralama || qoralama.asosImzo === asosImzo) return;
        if (farqlar(asosOchiq, qoralama.cars).soni === 0) setQoralama(null);
        else setZiddiyat(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asosImzo]);

    // Joriy mashinalar: yo'ldagilari doim serverdan, qolgani o'zgarishlar bilan.
    const qulfCars = useMemo(() => asos.filter(c => qulf.has(c.key)), [asos, qulf]);
    const ochiqCars: Car[] = useMemo(() => {
        const yolda = new Set(qulfCars.flatMap(c => c.studentIds));
        const manba = qoralama ? qoralama.cars : asosOchiq;
        return manba
            .filter(c => !(c.routeId && qulf.has(`r${c.routeId}`)))
            .map(c => c.studentIds.some(id => yolda.has(id)) ? { ...c, studentIds: c.studentIds.filter(id => !yolda.has(id)) } : c);
    }, [qoralama, asosOchiq, qulfCars, qulf]);
    const cars: Car[] = useMemo(() => [...qulfCars, ...ochiqCars].sort((a, b) =>
        ((hTartib.get(a.driverId) ?? 99) - (hTartib.get(b.driverId) ?? 99)) || a.navbat - b.navbat), [qulfCars, ochiqCars, hTartib]);
    const farq = useMemo(() => farqlar(asosOchiq, ochiqCars), [asosOchiq, ochiqCars]);

    const carsniSaqla = (yangi: Car[], k: Korinish = korinish) => {
        setQoralama({ cars: yangi, asosImzo: qoralama?.asosImzo ?? asosImzo });
        setKorinish(k);
    };

    // ===================== O'quvchilar =====================
    const bolaMap = useMemo(() => {
        const m = new Map<number, Bola>();
        for (const p of rejalar) for (const st of p.stops) m.set(st.studentId, { id: st.studentId, name: st.name, phone: st.phone, address: st.address, location: st.location, photo: st.photo });
        for (const s of students) m.set(s.id, s as any);
        return m;
    }, [students, rejalar]);
    const joyOl = useCallback((id: number) => bolaMap.get(id)?.location || null, [bolaMap]);
    const kursNomi = useMemo(() => new Map(groups.map(g => [g.id, g.name])), [groups]);
    const ismi = (id: number) => displayName(bolaMap.get(id)?.name || '');

    const kelganlar = useMemo(() => {
        const s = new Set<number>();
        for (const a of attendances || []) if (a.date === sana && KELGAN.has(a.status)) s.add(a.studentId);
        return s;
    }, [attendances, sana]);

    // 1-qadam filtri: bugun kelganlar va transport kerak (standart), kurs.
    const [filtr, setFiltr] = useState(() => ({
        kelgan: true, transport: true, ...(oqi<{ kelgan: boolean; transport: boolean }>('logistika-reja:filtr2') || {}),
        kurslar: [] as number[],
    }));
    useEffect(() => { yoz('logistika-reja:filtr2', { kelgan: filtr.kelgan, transport: filtr.transport }); }, [filtr.kelgan, filtr.transport]);

    const joylashgan = useMemo(() => {
        const m = new Map<number, string>();
        for (const c of cars) for (const id of c.studentIds) m.set(id, c.key);
        return m;
    }, [cars]);

    /** Filtrga mos bolalar (+ qo'lda qo'shilganlar, + mashinadagilar) — 1-qadam ro'yxati. */
    const nomzodlar = useMemo(() => {
        const kursSet = new Set(filtr.kurslar);
        const ids = new Set<number>();
        for (const s of students) {
            if (s.status === 'Arxiv') continue;
            if (filtr.transport && !s.needsTransport) continue;
            if (filtr.kelgan && !kelganlar.has(s.id)) continue;
            if (kursSet.size && !(s.groups || []).some(g => kursSet.has(g))) continue;
            ids.add(s.id);
        }
        for (const id of korinish.qoshilgan) ids.add(id);
        for (const id of joylashgan.keys()) ids.add(id);
        return [...ids].sort((a, b) => (bolaMap.get(a)?.name || '').localeCompare(bolaMap.get(b)?.name || '', 'uz'));
    }, [students, filtr, kelganlar, korinish.qoshilgan, joylashgan, bolaMap]);
    const chiqarilgan = useMemo(() => new Set(korinish.chiqarilgan), [korinish.chiqarilgan]);
    /** Bugun ketadiganlar: nomzodlardan belgisi olinmaganlari. */
    const ketadi = useMemo(() => nomzodlar.filter(id => !chiqarilgan.has(id) || joylashgan.has(id)), [nomzodlar, chiqarilgan, joylashgan]);
    const mashinasiz = useMemo(() => ketadi.filter(id => !joylashgan.has(id)), [ketadi, joylashgan]);

    // ===================== Haydovchilar =====================
    const olinmagan = useMemo(() => new Set(korinish.olinmagan), [korinish.olinmagan]);
    const mashinasiBor = (h: DayDriver) => (h.transport?.capacity || 0) > 0 && h.transport?.status !== 'Arxiv';
    const faolH = haydovchilar.filter(h => mashinasiBor(h) && !olinmagan.has(h.id));
    const jamiOrin = faolH.reduce((s, h) => s + (h.transport?.capacity || 0), 0);
    const sigim = useCallback((driverId: number) => haydovchi(driverId)?.transport?.capacity || 0, [haydovchi]);

    // ===================== Mashinalar ko'rinishi =====================
    const bolaNarxi = useCallback((id: number) => narxHisobla(tarif, uyMasofasi(markaz, joyOl(id))).narx, [tarif, markaz, joyOl]);
    const carlar = useMemo(() => cars.filter(c => c.studentIds.length || !c.routeId || qulf.has(c.key)).map(c => {
        const plan = c.routeId ? planMap.get(c.routeId) || null : null;
        const qulfli = qulf.has(c.key);
        const tartib: number[] = qulfli && plan ? plan.stops.map(s => s.studentId) : reysKorsatkichi(c.studentIds, joyOl, markaz).tartib;
        const narx = (id: number) => {
            const st = plan?.stops.find(s => s.studentId === id);
            return st && st.narx !== undefined ? st.narx : bolaNarxi(id);
        };
        let holat: CarHolati;
        if (plan?.run?.finishedAt) holat = 'yetkazildi';
        else if (qulfli) holat = 'yolda';
        else if (!c.routeId || !planMap.has(c.routeId)) holat = 'yangi';
        else if (farq.ozgargan.includes(c.key)) holat = 'ozgargan';
        else holat = 'yuborilgan';
        const h = haydovchi(c.driverId);
        return {
            ...c, plan, qulfli, tartib, narx, holat,
            rang: reysRangi(hTartib.get(c.driverId) ?? 0, c.navbat), sigim: sigim(c.driverId),
            haydovchiNomi: h?.name || plan?.driver?.name || 'Haydovchi', telegram: h ? h.telegram : !!plan?.driver?.telegram,
            mashina: mashinaMatni(h?.transport || plan?.transport),
        };
    }), [cars, planMap, qulf, joyOl, markaz, farq, bolaNarxi, hTartib, sigim, haydovchi]);
    type CarV = typeof carlar[number];
    const carByKey = useMemo(() => new Map(carlar.map(c => [c.key, c])), [carlar]);
    const reysNomi = (c: CarV) => `${qisqaIsm(c.haydovchiNomi)}${c.navbat > 1 ? ` · ${c.navbat}-reys` : ''}`;
    const rejaBor = carlar.some(c => c.studentIds.length);

    // ===================== Xarita =====================
    const [tanlangan, setTanlangan] = useState<number | null>(null);
    const [fokusKey, setFokusKey] = useState<string | null>(null);
    const [joyRejim, setJoyRejim] = useState<{ id: number; nuqta: [number, number] | null } | null>(null);
    const [moslash, setMoslash] = useState(0);
    const [fokus, setFokus] = useState<{ kalit: string; nuqtalar: [number, number][] } | null>(null);
    const [royxatTanlov, setRoyxatTanlov] = useState<boolean | null>(null);
    const xaritaRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setTanlangan(null); setFokusKey(null); setJoyRejim(null); }, [sana]);
    useEffect(() => { if (fokusKey && !carByKey.has(fokusKey)) setFokusKey(null); }, [fokusKey, carByKey]);

    const xBolalar: XBola[] = useMemo(() => {
        const out: XBola[] = [];
        for (const c of carlar) {
            c.tartib.forEach((id, i) => {
                const b = bolaMap.get(id);
                const pos = parseLatLng(b?.location);
                if (!pos) return;
                out.push({
                    id, name: displayName(b?.name || ''), photo: b?.photo, pos, rang: c.rang, tartib: i + 1,
                    holat: HOLAT_XARITA[c.plan?.holatlar?.[id] || ''] || 'rejada', xira: !!fokusKey && fokusKey !== c.key,
                });
            });
        }
        for (const id of mashinasiz) {
            const b = bolaMap.get(id);
            const pos = parseLatLng(b?.location);
            if (!pos) continue;
            out.push({ id, name: displayName(b?.name || ''), photo: b?.photo, pos, rang: KULRANG, tartib: null, holat: 'rejasiz', xira: !!fokusKey });
        }
        return out;
    }, [carlar, mashinasiz, bolaMap, fokusKey]);

    // Yo'l chizig'i — faqat tanlangan haydovchiniki (hammasiniki chalkash ko'rinardi).
    const xYollar: XYol[] = useMemo(() => {
        const c = fokusKey ? carByKey.get(fokusKey) : null;
        if (!c || !c.studentIds.length) return [];
        return [{ key: c.key, rang: c.rang, uzuq: false, xira: false, nuqtalar: [markaz, ...c.tartib.map(id => parseLatLng(joyOl(id))).filter(Boolean) as [number, number][]] }];
    }, [fokusKey, carByKey, markaz, joyOl]);

    const xHaydovchilar = useMemo(() => haydovchilar.map(h => ({ id: h.id, name: h.name, rang: reysRangi(hTartib.get(h.id) ?? 0, 1), location: h.location })), [haydovchilar, hTartib]);

    const xaritagaOt = () => {
        if (window.innerWidth < 1024) xaritaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const bolaniTanla = (id: number) => {
        setTanlangan(id);
        const pos = parseLatLng(joyOl(id));
        if (pos) setFokus({ kalit: `b${id}-${Date.now()}`, nuqtalar: [pos] });
        xaritagaOt();
    };
    const haydovchiniKorsat = (key: string) => {
        if (fokusKey === key) { setFokusKey(null); return; }
        setFokusKey(key);
        const c = carByKey.get(key);
        const n = (c?.studentIds || []).map(id => parseLatLng(joyOl(id))).filter(Boolean) as [number, number][];
        if (n.length) setFokus({ kalit: `c${key}-${Date.now()}`, nuqtalar: [markaz, ...n] });
        xaritagaOt();
    };

    // ===================== Amallar =====================
    const qulfdami = (id: number) => { const k = joylashgan.get(id); return !!k && qulf.has(k); };

    /** Bolani mashinaga (`qayerga` — mashina kaliti, `h:<id>` — shu haydovchiga yangi reys, null — mashinasiz). */
    const kochirish = (id: number, qayerga: string | null) => {
        if (!tahrir) return;
        if (qulfdami(id)) { showNotification("Bu bola yo'ldagi mashinada — endi o'zgartirib bo'lmaydi", 'info'); return; }
        let manba = ochiqCars;
        let key = qayerga;
        if (qayerga?.startsWith('h:')) {
            const driverId = Number(qayerga.slice(2));
            const navbat = keyingiNavbat(cars, driverId);
            if (navbat > ENG_KOP_NAVBAT) { showNotification(`Bir haydovchiga ${ENG_KOP_NAVBAT} tadan ortiq reys bo'lmaydi`, 'info'); return; }
            const car: Car = { key: yangiKalit(driverId), routeId: null, driverId, navbat, studentIds: [] };
            manba = [...ochiqCars, car];
            key = car.key;
        }
        const yangi = kochir(manba, id, key);
        if (!yangi) return;
        const k = { ...korinish, chiqarilgan: korinish.chiqarilgan.filter(x => x !== id) };
        carsniSaqla(yangi.filter(c => c.studentIds.length || c.routeId), k);
    };
    /** Bugun olib ketilmaydi (1-qadamdagi belgini olish). */
    const chiqarish = (id: number) => {
        if (!tahrir) return;
        if (qulfdami(id)) { showNotification("Bu bola yo'ldagi mashinada — endi o'zgartirib bo'lmaydi", 'info'); return; }
        const k = { ...korinish, chiqarilgan: [...new Set([...korinish.chiqarilgan, id])] };
        if (joylashgan.has(id)) carsniSaqla((kochir(ochiqCars, id, null) || ochiqCars).filter(c => c.studentIds.length || c.routeId), k);
        else setKorinish(k);
        if (tanlangan === id) setTanlangan(null);
    };
    const qaytarish = (id: number) => setKorinish({ ...korinish, chiqarilgan: korinish.chiqarilgan.filter(x => x !== id) });
    const qoshish = (id: number) => {
        setKorinish({ ...korinish, qoshilgan: [...new Set([...korinish.qoshilgan, id])], chiqarilgan: korinish.chiqarilgan.filter(x => x !== id) });
        bolaniTanla(id);
    };
    const haydovchiniAlmashlash = async (h: DayDriver) => {
        if (!tahrir) return;
        if (olinmagan.has(h.id)) { setKorinish({ ...korinish, olinmagan: korinish.olinmagan.filter(x => x !== h.id) }); return; }
        const uniki = ochiqCars.filter(c => c.driverId === h.id && c.studentIds.length);
        const soni = uniki.reduce((s, c) => s + c.studentIds.length, 0);
        if (soni && !await confirm(`${h.name} bugun ishlamaydi — uning mashinasidagi ${soni} ta bola mashinasiz qoladi. Davom etasizmi?`)) return;
        carsniSaqla(ochiqCars.filter(c => c.driverId !== h.id), { ...korinish, olinmagan: [...korinish.olinmagan, h.id] });
    };

    const bolish = async (qaytadan = false) => {
        if (!tahrir) return;
        if (!faolH.length) { showNotification("Ishlaydigan haydovchi yo'q (yoki mashinasining sig'imi kiritilmagan)", 'error'); return; }
        const bor = ochiqCars.some(c => c.studentIds.length);
        if (qaytadan && !await confirm("Hamma bola haydovchilarga qaytadan bo'linadi (qo'lda qilgan o'zgarishlaringiz ham). Davom etasizmi?")) return;
        const args = { markaz, cars, rejasiz: mashinasiz, joyOl, qulf, haydovchilar: faolH.map(h => ({ id: h.id, capacity: h.transport!.capacity })) };
        const r = (qaytadan || !bor) ? yangidanTaqsimlash(args) : rejasizlarniJoylash(args);
        let yangi: Car[] = r.cars.filter((c: Car) => !qulf.has(c.key));
        yangi = kalitlarniSaqla(yangi, ochiqCars).filter(c => c.studentIds.length || c.routeId);
        carsniSaqla(yangi);
        setFokusKey(null);
        setMoslash(m => m + 1);
        if (r.sigmagan.length) showNotification(`${r.sigmagan.length} ta bolaga joy yetmadi — ular «Mashinasiz qoldi» ro'yxatida`, 'info');
    };

    // ===================== Server amallari =====================
    const [band, setBand] = useState('');

    const yuborish = async () => {
        if (!tahrir || !farq.soni) return;
        const ortiq = carlar.filter(c => !c.qulfli && c.sigim > 0 && c.studentIds.length > c.sigim);
        if (ortiq.length && !await confirm(`${ortiq.map(c => `${reysNomi(c)}: ${c.studentIds.length} bola, ${c.sigim} o'rin`).join('; ')}. Baribir yuborasizmi?`)) return;
        setBand('yuborish');
        try {
            const r = await fetch('/api/logistics/day', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    schoolId, date: sana,
                    cars: ochiqCars.filter(c => c.studentIds.length).map(c => ({ routeId: c.routeId, driverId: c.driverId, studentIds: c.studentIds })),
                }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'Reja saqlanmadi');
            setKun(k => k && k.date === sana ? { ...k, plans: d.plans || [] } : k);
            setQoralama(null);
            setZiddiyat(false);
            const y: any[] = d.yuborish || [];
            const yetmadi = y.filter(x => !x.ok);
            showNotification(
                yetmadi.length
                    ? `Saqlandi. ${yetmadi.map(x => haydovchi(x.driverId)?.name).filter(Boolean).join(', ')} — Telegram botga ulanmagan, xabar bormadi`
                    : `Yuborildi — ${y.length} ta haydovchiga xabar ketdi`,
                yetmadi.length ? 'info' : 'success');
        } catch (e: any) {
            showNotification(e.message, 'error');
            yukla(true);
        } finally {
            setBand('');
        }
    };

    const rejaAmali = async (c: CarV, amal: 'accept' | 'deliver') => {
        if (!tahrir || !c.routeId) return;
        const savol = amal === 'accept'
            ? `${c.haydovchiNomi} bolalarni mashinaga oldimi? (Haydovchi o'rniga «Qabul qildim». Shundan keyin bu mashina o'zgartirilmaydi.)`
            : `${c.haydovchiNomi} hammasini uyiga yetkazdimi? (Haydovchi o'rniga «Yetkazdim»)`;
        if (!await confirm(savol)) return;
        setBand(`${amal}-${c.key}`);
        try {
            const r = await fetch(`/api/logistics/plans/${c.routeId}/${amal}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'Xatolik');
            await yukla(true);
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setBand('');
        }
    };

    const bolaHolati = async (c: CarV, id: number, status: string | null) => {
        if (!tahrir || !c.routeId) return;
        setBand(`holat-${id}`);
        try {
            const r = await fetch(`/api/logistics/plans/${c.routeId}/holat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ studentId: id, status }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'Xatolik');
            setKun(k => k && k.date === sana ? { ...k, plans: k.plans.map(p => p.id === d.id ? d : p) } : k);
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setBand('');
        }
    };

    const joyniSaqla = async () => {
        if (!joyRejim?.nuqta) return;
        const [lat, lng] = joyRejim.nuqta;
        setBand('joy');
        try {
            await updateStudent(joyRejim.id, { location: `${lat.toFixed(6)},${lng.toFixed(6)}` } as any);
            setTanlangan(joyRejim.id);
            setJoyRejim(null);
        } finally {
            setBand('');
        }
    };

    useEffect(() => {
        const f = (e: KeyboardEvent) => { if (e.key === 'Escape') { setJoyRejim(null); setTanlangan(null); } };
        window.addEventListener('keydown', f);
        return () => window.removeEventListener('keydown', f);
    }, []);

    const kunSurish = (n: number) => {
        const d = new Date(sana + 'T12:00:00');
        d.setDate(d.getDate() + n);
        setSana(toDateStr(d));
    };

    // ===================== Ko'rinish =====================
    if (!kun && yuklanmoqda) {
        return <div className={`${karta} p-16 flex items-center justify-center gap-2 text-[13px] font-bold text-matn-xira`}><Loader2 size={16} className="animate-spin" /> Yuklanmoqda…</div>;
    }

    const tanlanganBola = tanlangan ? bolaMap.get(tanlangan) : null;
    const tanlanganCar = tanlangan ? carByKey.get(joylashgan.get(tanlangan) || '') || null : null;
    const joyYoqlar = ketadi.filter(id => !parseLatLng(joyOl(id)));
    const bolishMumkin = tahrir && faolH.length > 0 && mashinasiz.length > 0;
    const royxatOchiq = royxatTanlov ?? (!rejaBor && nomzodlar.length <= 40);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_430px] gap-3 lg:h-[calc(100dvh-196px)] lg:min-h-[600px]">
            {/* ======================= XARITA ======================= */}
            <div ref={xaritaRef} className={`${karta} relative overflow-hidden h-[48vh] min-h-[320px] lg:h-full scroll-mt-20`}>
                <RejaXarita
                    className="h-full w-full"
                    markaz={markaz}
                    orgName={settings?.orgName}
                    logo={settings?.logo}
                    bolalar={xBolalar}
                    yollar={xYollar}
                    haydovchilar={xHaydovchilar}
                    tanlangan={tanlangan}
                    rejim={joyRejim ? 'joy' : 'oddiy'}
                    joyNuqta={joyRejim?.nuqta || null}
                    onBola={id => { if (!joyRejim) setTanlangan(t => (t === id ? null : id)); }}
                    onXarita={pos => { if (joyRejim) setJoyRejim({ ...joyRejim, nuqta: pos }); else setTanlangan(null); }}
                    moslashKaliti={`${sana}:${moslash}:${kunTayyor ? 1 : 0}:${students.length ? 1 : 0}`}
                    fokus={fokus}
                >
                    <div className="absolute top-3 left-3 right-3 z-30 flex items-start gap-2 pointer-events-none">
                        {joyRejim ? (
                            <div className="pointer-events-auto mx-auto max-w-full flex flex-wrap items-center gap-2 px-3 py-2 rounded-2xl bg-rose-600 text-white shadow-lg text-[12.5px] font-bold">
                                <MapPin size={15} />
                                <span>{joyRejim.nuqta ? `${ismi(joyRejim.id)} uyi shu yerdami?` : `${ismi(joyRejim.id)} uyini xaritada bosing`}</span>
                                {joyRejim.nuqta && (
                                    <button onClick={joyniSaqla} disabled={band === 'joy'} className="px-3 py-1 rounded-lg bg-white text-rose-700 font-extrabold cursor-pointer disabled:opacity-60">
                                        {band === 'joy' ? <Loader2 size={13} className="animate-spin inline" /> : 'Ha, saqlash'}
                                    </button>
                                )}
                                <button onClick={() => setJoyRejim(null)} className="px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 cursor-pointer">Bekor</button>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1" />
                                <button onClick={() => { setFokusKey(null); setMoslash(m => m + 1); }}
                                    className="pointer-events-auto h-9 px-3 rounded-xl bg-sirt/95 backdrop-blur border border-chiziq shadow-md text-[12px] font-extrabold text-matn-2 hover:text-brand flex items-center gap-1.5 cursor-pointer">
                                    <Maximize2 size={14} /> Hammasi
                                </button>
                            </>
                        )}
                    </div>

                    {/* Kim qaysi rangda — bosilsa o'sha haydovchining bolalari va yo'li */}
                    {!joyRejim && rejaBor && (
                        <div className="absolute bottom-3 left-3 right-14 z-30 pointer-events-none">
                            <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-0.5 w-fit max-w-full">
                                {carlar.filter(c => c.studentIds.length).map(c => {
                                    const faol = fokusKey === c.key;
                                    return (
                                        <button key={c.key} onClick={() => haydovchiniKorsat(c.key)}
                                            className={`shrink-0 h-9 pl-2 pr-3 rounded-xl border shadow-md text-[12px] font-extrabold flex items-center gap-1.5 cursor-pointer ${faol ? 'text-white border-transparent' : 'bg-sirt/95 backdrop-blur border-chiziq text-matn-2'}`}
                                            style={faol ? { background: c.rang } : undefined}>
                                            <span className="w-3 h-3 rounded-full border-2 border-white shrink-0" style={{ background: c.rang }} />
                                            {reysNomi(c)} <span className={faol ? 'text-white/85' : 'text-matn-xira'}>{c.studentIds.length}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {tanlanganBola && !joyRejim && (
                        <div className="hidden lg:block absolute top-16 right-3 z-40 w-[340px] max-h-[calc(100%-140px)] overflow-y-auto">
                            {bolaKarta()}
                        </div>
                    )}
                </RejaXarita>
            </div>

            {/* ======================= PANEL ======================= */}
            <div className={`${karta} flex flex-col lg:h-full lg:overflow-hidden`}>
                {/* Sana */}
                <div className="px-3 py-2.5 border-b border-chiziq-mayin flex items-center gap-1">
                    <button onClick={() => kunSurish(-1)} className="w-10 h-10 rounded-xl hover:bg-ichki flex items-center justify-center text-matn-sokin cursor-pointer" aria-label="Oldingi kun"><ChevronLeft size={19} /></button>
                    <label className="relative flex-1 text-center cursor-pointer">
                        <span className="text-[15px] font-black text-matn">{sanaNomi(sana)}</span>
                        <input type="date" value={sana} onChange={e => e.target.value && setSana(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Sana" />
                    </label>
                    <button onClick={() => kunSurish(1)} className="w-10 h-10 rounded-xl hover:bg-ichki flex items-center justify-center text-matn-sokin cursor-pointer" aria-label="Keyingi kun"><ChevronRight size={19} /></button>
                    {yuklanmoqda && <Loader2 size={15} className="animate-spin text-matn-xira" />}
                </div>

                <div className="flex-1 lg:overflow-y-auto">
                    {ziddiyat && farq.soni > 0 && (
                        <div className="m-3 px-3 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-[12px] font-bold text-amber-800 dark:text-amber-300 flex items-start gap-2">
                            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                            <span className="flex-1">Bu kunning rejasini boshqa xodim o'zgartirgan. Yuborsangiz sizdagi variant yoziladi.</span>
                            <button onClick={() => { setQoralama(null); setZiddiyat(false); }} className="shrink-0 underline cursor-pointer">Unikini olish</button>
                        </div>
                    )}

                    {/* ---------- 1. Kim ketadi ---------- */}
                    <Qadam n={1} sarlavha="Bugun kim ketadi" izoh={`${ketadi.length} ta bola`} bajarildi={rejaBor}
                        xulosa={`${ketadi.length} ta bola${[filtr.kelgan && 'bugun kelgan', filtr.transport && 'transport kerak', filtr.kurslar.length && `${filtr.kurslar.length} ta kurs`].filter(Boolean).map(x => ' · ' + x).join('')}`}>
                        <div className="flex flex-wrap gap-1.5">
                            <button className={chip(filtr.kelgan)} onClick={() => setFiltr(f => ({ ...f, kelgan: !f.kelgan }))}>
                                {filtr.kelgan ? <Check size={13} /> : <span className="w-3.5 h-3.5 rounded border-2 border-current opacity-50" />} Bugun kelganlar
                            </button>
                            <button className={chip(filtr.transport)} onClick={() => setFiltr(f => ({ ...f, transport: !f.transport }))}>
                                {filtr.transport ? <Check size={13} /> : <span className="w-3.5 h-3.5 rounded border-2 border-current opacity-50" />} Transport kerak
                            </button>
                            <KursTanlash groups={groups} tanlangan={filtr.kurslar} onChange={k => setFiltr(f => ({ ...f, kurslar: k }))} />
                        </div>

                        {filtr.kelgan && kelganlar.size === 0 && (
                            <p className="mt-2.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-[12px] font-bold text-amber-800 dark:text-amber-300">
                                Bu kun hali hech kimga «keldi» belgilanmagan (davomat qilinmagan). «Bugun kelganlar» ni o'chirsangiz transport kerak bo'lgan hamma bola chiqadi.
                            </p>
                        )}

                        {nomzodlar.length > 0 && (
                            <>
                                <button onClick={() => setRoyxatTanlov(!royxatOchiq)}
                                    className="mt-2.5 w-full flex items-center justify-between px-3 h-10 rounded-xl bg-ichki border border-chiziq text-[12.5px] font-bold text-matn-2 cursor-pointer">
                                    <span>{ketadi.length} ta bola ketadi{nomzodlar.length > ketadi.length ? ` · ${nomzodlar.length - ketadi.length} tasi olib tashlangan` : ''}</span>
                                    <span className="flex items-center gap-1 text-brand">{royxatOchiq ? 'Yopish' : "Ro'yxat"} <ChevronDown size={15} className={`transition-transform ${royxatOchiq ? 'rotate-180' : ''}`} /></span>
                                </button>
                                {royxatOchiq && (
                                    <div className="mt-1.5 max-h-[340px] overflow-y-auto -mx-1">
                                        {nomzodlar.map(id => {
                                            const bor = !chiqarilgan.has(id) || joylashgan.has(id);
                                            const c = carByKey.get(joylashgan.get(id) || '');
                                            const b = bolaMap.get(id);
                                            return (
                                                <div key={id} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl ${bor ? '' : 'opacity-50'}`}>
                                                    <button disabled={!tahrir || !!c?.qulfli} onClick={() => (bor ? chiqarish(id) : qaytarish(id))}
                                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-default ${bor ? 'bg-brand border-brand text-white' : 'border-chiziq-kuchli'}`}
                                                        aria-label={bor ? 'Olib tashlash' : 'Qaytarish'}>
                                                        {bor && <Check size={14} />}
                                                    </button>
                                                    <button onClick={() => bolaniTanla(id)} className="min-w-0 flex-1 text-left cursor-pointer">
                                                        <span className={`block text-[13px] font-bold truncate ${bor ? 'text-matn' : 'text-matn-xira line-through'}`}>{displayName(b?.name || '')}</span>
                                                        <span className="block text-[11px] font-bold text-matn-xira truncate">
                                                            {!parseLatLng(b?.location) ? <span className="text-amber-600">uyi xaritada yo'q</span> : (b?.address || (b?.groups || []).map(g => kursNomi.get(g)).filter(Boolean).join(', ') || '')}
                                                        </span>
                                                    </button>
                                                    {c && <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.rang }} title={reysNomi(c)} />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                        <BolaQidirish qoshish={qoshish} bor={new Set(ketadi)} />
                        {joyYoqlar.length > 0 && (
                            <p className="mt-2 text-[11.5px] font-bold text-amber-600">
                                {joyYoqlar.length} ta bolaning uyi xaritada belgilanmagan — ismini bosib, «Uyini xaritada belgilash».
                            </p>
                        )}
                    </Qadam>

                    {/* ---------- 2. Haydovchilar ---------- */}
                    <Qadam n={2} sarlavha="Haydovchilar" izoh={`${faolH.length} ta · ${jamiOrin} o'rin`} bajarildi={rejaBor}
                        xulosa={`${faolH.map(h => qisqaIsm(h.name)).join(', ') || "hech kim"} · ${jamiOrin} o'rin`}>
                        {haydovchilar.length === 0 ? (
                            <div className="text-[12.5px] font-bold text-matn-xira space-y-2">
                                <p>Haydovchi yo'q. Xodimlar bo'limida «Haydovchi» lavozimi bilan qo'shing — mashinasi va nechta o'rinligi bilan.</p>
                                <button onClick={() => navigate('/hr')} className="px-3 h-9 rounded-xl border border-chiziq hover:border-brand hover:text-brand cursor-pointer">Xodimlar bo'limiga</button>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {haydovchilar.map(h => {
                                    const bor = mashinasiBor(h);
                                    const ishlaydi = bor && !olinmagan.has(h.id);
                                    return (
                                        <button key={h.id} disabled={!bor || !tahrir} onClick={() => haydovchiniAlmashlash(h)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${ishlaydi ? 'border-brand/60 bg-brand/5' : 'border-chiziq'} ${bor && tahrir ? 'cursor-pointer hover:border-brand' : 'cursor-default'}`}>
                                            <span className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${ishlaydi ? 'bg-brand border-brand text-white' : 'border-chiziq-kuchli'}`}>{ishlaydi && <Check size={14} />}</span>
                                            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: reysRangi(hTartib.get(h.id) ?? 0, 1) }} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13px] font-extrabold text-matn truncate">{displayName(h.name)}</span>
                                                <span className="block text-[11px] font-bold text-matn-xira truncate">
                                                    {bor ? `${mashinaMatni(h.transport)} · ${h.transport!.capacity} o'rin` : <span className="text-amber-600">mashinasining o'rni kiritilmagan (Xodimlar)</span>}
                                                    {!h.telegram && <span className="text-amber-600"> · botga ulanmagan</span>}
                                                    {h.location && jonlimi(h.location) && <span className="text-emerald-600"> · ● xaritada</span>}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {faolH.length > 0 && ketadi.length > 0 && (
                            <p className={`mt-2.5 text-[12px] font-bold ${ketadi.length <= jamiOrin ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {ketadi.length} bola · {jamiOrin} o'rin — {ketadi.length <= jamiOrin ? 'joy yetadi' : "joy yetmaydi, ba'zi haydovchi ikki marta qatnaydi"}
                            </p>
                        )}

                        {tahrir && (
                            <div className="mt-3 space-y-2">
                                {!rejaBor && (
                                    <button onClick={() => bolish(false)} disabled={!bolishMumkin}
                                        className="w-full h-12 rounded-2xl bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-[14px] font-extrabold flex items-center justify-center gap-2 shadow-sm cursor-pointer">
                                        <Users size={17} /> Haydovchilarga bo'lish
                                    </button>
                                )}
                                {rejaBor && ochiqCars.some(c => c.studentIds.length) && (
                                    <button onClick={() => bolish(true)} className="w-full text-center text-[12px] font-bold text-matn-xira hover:text-brand underline cursor-pointer">
                                        Hammasini qaytadan bo'lish
                                    </button>
                                )}
                            </div>
                        )}
                        <button type="button" onClick={onTarif} className={`mt-2 block text-left text-[11.5px] font-bold cursor-pointer hover:underline ${tarif ? 'text-matn-xira' : 'text-amber-600'}`}>
                            {tarif ? `Yo'l haqi: ${tarifMatni(tarif)}` : "Yo'l haqi kiritilmagan — «Yo'l haqi» bo'limi"}
                        </button>
                    </Qadam>

                    {/* ---------- 3. Taqsimot ---------- */}
                    {(rejaBor || carlar.length > 0) && (
                        <Qadam n={3} sarlavha="Taqsimot" izoh="bolani bosing — boshqa mashinaga o'tkazish">
                            <div className="space-y-2.5">
                                {carlar.map(c => mashinaKarta(c))}
                                {mashinasiz.length > 0 && (
                                    <div className="rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-900/60 p-3">
                                        <p className="text-[13px] font-black text-amber-700 dark:text-amber-400">Mashinasiz qoldi — {mashinasiz.length} ta</p>
                                        <p className="text-[11.5px] font-bold text-matn-xira mt-0.5 mb-2">Joy yetmadi yoki keyin qo'shildi. Tizim o'zi joylasin yoki bolani bosib mashinani tanlang.</p>
                                        {tahrir && faolH.length > 0 && (
                                            <button onClick={() => bolish(false)}
                                                className="w-full h-10 mb-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-[13px] font-extrabold flex items-center justify-center gap-2 cursor-pointer">
                                                <Users size={15} /> Bo'sh joyi bor mashinalarga joylash
                                            </button>
                                        )}
                                        <div className="-mx-1 max-h-[260px] overflow-y-auto">
                                            {mashinasiz.map(id => bolaQator(id))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Qadam>
                    )}
                </div>

                {/* Yuborish */}
                {tahrir && (farq.soni > 0 || rejaBor) && (
                    <div className="p-3 border-t border-chiziq-mayin bg-sirt max-lg:sticky max-lg:bottom-0 max-lg:z-[80] max-lg:shadow-[0_-8px_24px_rgba(15,23,42,.12)]">
                        {farq.soni > 0 ? (
                            <>
                                <button onClick={yuborish} disabled={!!band}
                                    className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[14px] font-extrabold flex items-center justify-center gap-2 shadow-sm cursor-pointer">
                                    {band === 'yuborish' ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                                    Haydovchilarga yuborish
                                </button>
                                <p className="mt-1.5 text-center text-[11px] font-bold text-matn-xira">
                                    {farq.soni} ta o'zgarish · xabar faqat o'zgargan haydovchiga boradi
                                </p>
                            </>
                        ) : (
                            <p className="text-center text-[12.5px] font-extrabold text-emerald-600">✓ Hammasi haydovchilarga yuborilgan</p>
                        )}
                    </div>
                )}
            </div>

            {/* Tanlangan bola — telefonda pastdan */}
            {tanlanganBola && !joyRejim && (
                <div className="lg:hidden fixed inset-x-0 bottom-0 z-[95] max-h-[75vh] overflow-y-auto p-2">
                    {bolaKarta()}
                </div>
            )}
        </div>
    );

    // ===================== Ichki render funksiyalar =====================

    function bolaQator(id: number, car?: CarV) {
        const b = bolaMap.get(id);
        if (!b) return null;
        const tartib = car ? car.tartib.indexOf(id) + 1 : 0;
        const h = car?.plan?.holatlar?.[id];
        const narx = car ? car.narx(id) : null;
        return (
            <button key={id} onClick={() => bolaniTanla(id)}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left cursor-pointer transition-colors ${tanlangan === id ? 'bg-brand/10' : 'hover:bg-ichki'}`}>
                {car
                    ? <span className="w-6 h-6 rounded-full text-[11px] font-black text-white flex items-center justify-center shrink-0" style={{ background: car.rang }}>{tartib}</span>
                    : <span className="w-6 h-6 rounded-full border-2 border-dashed border-slate-400 shrink-0" />}
                <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-matn truncate">{displayName(b.name)}</span>
                    <span className="block text-[11px] font-bold text-matn-xira truncate">
                        {!parseLatLng(b.location) ? <span className="text-amber-600">uyi xaritada yo'q</span> : (b.address || (b.groups || []).map(g => kursNomi.get(g)).filter(Boolean).join(', ') || '')}
                    </span>
                </span>
                {h ? <span className={`px-2 py-0.5 rounded-md border text-[10.5px] font-black shrink-0 ${HOLAT_NOMI[h]?.cls || ''}`}>{HOLAT_NOMI[h]?.matn || h}</span>
                    : narx !== null && narx !== undefined ? <span className="text-[11.5px] font-bold text-matn-sokin shrink-0">{somMatni(narx)}</span> : null}
            </button>
        );
    }

    function mashinaKarta(c: CarV) {
        const toldi = c.sigim ? c.studentIds.length / c.sigim : 0;
        const holatlar: Record<CarHolati, { matn: string; cls: string }> = {
            yetkazildi: { matn: `✓ Yetkazildi${c.plan?.run?.finishedAt ? ' ' + toTimeStr(c.plan.run.finishedAt) : ''}`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50' },
            yolda: { matn: `Yo'lda${c.plan?.run?.startedAt ? ' · ' + toTimeStr(c.plan.run.startedAt) : ''}`, cls: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/50' },
            yangi: { matn: 'Yuborilmagan', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50' },
            ozgargan: { matn: "O'zgardi · yuborilmagan", cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50' },
            bosh: { matn: "Bo'sh", cls: 'bg-ichki text-matn-sokin border-chiziq' },
            yuborilgan: c.telegram
                ? { matn: '✓ Yuborilgan', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50' }
                : { matn: 'Botga ulanmagan', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50' },
        };
        const hc = holatlar[c.holat];
        const fokusda = fokusKey === c.key;
        return (
            <div key={c.key} className={`rounded-2xl border overflow-hidden ${fokusda ? 'shadow-md' : ''}`} style={{ borderColor: fokusda ? c.rang : undefined }}>
                <div className="flex">
                    <div className="w-1.5 shrink-0" style={{ background: c.rang }} />
                    <div className="flex-1 min-w-0">
                        <button onClick={() => haydovchiniKorsat(c.key)} className="w-full px-3 pt-2.5 pb-2 text-left cursor-pointer" title="Xaritada ko'rsatish">
                            <span className="flex items-start gap-2">
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[14px] font-black text-matn truncate">{displayName(c.haydovchiNomi)}{c.navbat > 1 && <span className="text-matn-xira"> · {c.navbat}-reys</span>}</span>
                                    <span className="block text-[11px] font-bold text-matn-xira truncate">{c.mashina || 'mashina kiritilmagan'}</span>
                                </span>
                                <span className={`px-2 py-0.5 rounded-md border text-[10.5px] font-black shrink-0 whitespace-nowrap ${hc.cls}`}>{hc.matn}</span>
                            </span>
                            <span className="mt-2 flex items-center gap-2">
                                <span className="flex-1 h-2 rounded-full bg-ichki overflow-hidden">
                                    <span className="block h-full rounded-full" style={{ width: `${Math.min(100, toldi * 100)}%`, background: toldi > 1 ? '#e11d48' : c.rang }} />
                                </span>
                                <span className={`text-[12px] font-black shrink-0 ${toldi > 1 ? 'text-rose-600' : 'text-matn-2'}`}>{c.studentIds.length} / {c.sigim || '?'} o'rin</span>
                            </span>
                        </button>
                        <div className="px-1 pb-1.5">
                            {c.tartib.map(id => bolaQator(id, c))}
                        </div>
                        {tahrir && c.plan && !c.plan.run?.finishedAt && (c.holat === 'yuborilgan' || c.holat === 'yolda') && (
                            <div className="px-3 pb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-bold text-matn-xira">
                                <span>Haydovchi o'rniga:</span>
                                {!c.plan.run?.startedAt && (
                                    <button onClick={() => rejaAmali(c, 'accept')} disabled={!!band} className="text-brand hover:underline cursor-pointer disabled:opacity-50">
                                        {band === `accept-${c.key}` ? <Loader2 size={12} className="animate-spin inline" /> : 'Qabul qildim'}
                                    </button>
                                )}
                                {c.plan.run?.startedAt && (
                                    <button onClick={() => rejaAmali(c, 'deliver')} disabled={!!band} className="text-emerald-600 hover:underline cursor-pointer disabled:opacity-50">
                                        {band === `deliver-${c.key}` ? <Loader2 size={12} className="animate-spin inline" /> : 'Yetkazdim'}
                                    </button>
                                )}
                                {!c.telegram && <span className="text-amber-600 flex items-center gap-1"><Bot size={12} /> botga ulanmagan</span>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    function bolaKarta() {
        const b = tanlanganBola!;
        const id = b.id;
        const c = tanlanganCar;
        const pos = parseLatLng(b.location);
        const km = pos ? uyMasofasi(markaz, b.location) : null;
        const narx = c ? c.narx(id) : bolaNarxi(id);
        const h = c?.plan?.holatlar?.[id];
        const kurslar = (b.groups || []).map(g => kursNomi.get(g)).filter(Boolean);
        const ketmaydi = chiqarilgan.has(id) && !c;
        // Qaysi mashinalarga qo'yish mumkin: yo'lga chiqmaganlari + hali mashinasi yo'q ishlaydigan haydovchilar.
        const ochiqlar = carlar.filter(x => !x.qulfli);
        const yangiH = faolH.filter(hh => !ochiqlar.some(x => x.driverId === hh.id) && keyingiNavbat(cars, hh.id) <= ENG_KOP_NAVBAT);
        return (
            <div className={`${karta} shadow-xl p-3.5 space-y-3`}>
                <div className="flex items-start gap-3">
                    {b.photo
                        ? <img src={b.photo} alt="" className="w-12 h-12 rounded-full object-cover border-2 shrink-0" style={{ borderColor: c?.rang || KULRANG }} />
                        : <span className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-[14px] font-black shrink-0" style={{ borderColor: c?.rang || KULRANG, color: c?.rang || '#64748b' }}>{displayName(b.name).split(' ').map(w => w[0]).slice(0, 2).join('')}</span>}
                    <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-black text-matn leading-tight">{displayName(b.name)}</p>
                        <p className="text-[12px] font-bold text-matn-xira mt-0.5">
                            {kurslar.length ? kurslar.join(', ') : 'kurssiz'}
                            {kelganlar.has(id) && <span className="text-emerald-600"> · bugun keldi</span>}
                        </p>
                        <p className="text-[12px] font-bold text-matn-sokin mt-0.5">
                            {[b.address, km !== null ? `markazdan ${km} km` : null].filter(Boolean).join(' · ')}
                            {narx !== null && narx !== undefined && <> · <b className="text-matn-2">{somMatni(narx)} so'm</b></>}
                        </p>
                        {b.phone && (
                            <a href={`tel:${b.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 mt-1 text-[12px] font-extrabold text-brand hover:underline">
                                <Phone size={12} /> {b.phone}
                            </a>
                        )}
                    </div>
                    <button onClick={() => setTanlangan(null)} className="w-9 h-9 rounded-lg hover:bg-ichki flex items-center justify-center text-matn-xira shrink-0 cursor-pointer" aria-label="Yopish"><X size={17} /></button>
                </div>

                {c?.qulfli ? (
                    <div className="space-y-2">
                        <p className="text-[12px] font-extrabold text-matn-sokin">
                            <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: c.rang }} />
                            {reysNomi(c)} mashinasida — {c.holat === 'yetkazildi' ? 'yetkazildi' : "yo'lda"}
                        </p>
                        {tahrir && (
                            <div className="grid grid-cols-3 gap-1.5">
                                {(['Olib ketildi', 'Uyiga yetkazildi', 'Kelmadi'] as const).map(s => (
                                    <button key={s} disabled={!!band} onClick={() => bolaHolati(c, id, h === s ? null : s)}
                                        className={`h-10 rounded-xl border text-[12px] font-extrabold cursor-pointer disabled:opacity-50 ${h === s ? HOLAT_NOMI[s].cls : 'border-chiziq text-matn-sokin hover:border-brand hover:text-brand'}`}>
                                        {band === `holat-${id}` ? <Loader2 size={12} className="animate-spin inline" /> : HOLAT_NOMI[s].matn}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : tahrir ? (
                    <div className="space-y-2">
                        {ketmaydi ? (
                            <button onClick={() => qaytarish(id)} className="w-full h-10 rounded-xl bg-brand text-white text-[12.5px] font-extrabold cursor-pointer">Bugun ketadi — ro'yxatga qaytarish</button>
                        ) : ochiqlar.length + yangiH.length === 0 ? (
                            <p className="text-[12px] font-bold text-matn-xira">Avval 2-qadamda «Haydovchilarga bo'lish» ni bosing.</p>
                        ) : (
                            <>
                                <p className="text-[12px] font-extrabold text-matn-sokin">{c ? 'Boshqa mashinaga o\'tkazish:' : 'Qaysi mashinada ketadi:'}</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {ochiqlar.map(x => {
                                        const bu = c?.key === x.key;
                                        const toliq = x.sigim > 0 && x.studentIds.length >= x.sigim && !bu;
                                        return (
                                            <button key={x.key} onClick={() => !bu && kochirish(id, x.key)}
                                                className={`min-h-[44px] px-2.5 py-1.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer ${bu ? 'text-white border-transparent' : 'border-chiziq hover:border-brand'}`}
                                                style={bu ? { background: x.rang } : undefined}>
                                                <span className="w-3.5 h-3.5 rounded-full border-2 border-white shrink-0" style={{ background: x.rang }} />
                                                <span className="min-w-0 flex-1">
                                                    <span className={`block text-[12.5px] font-extrabold truncate ${bu ? '' : 'text-matn'}`}>{reysNomi(x)}</span>
                                                    <span className={`block text-[11px] font-bold ${bu ? 'text-white/85' : toliq ? 'text-rose-600' : 'text-matn-xira'}`}>{bu ? 'hozir shu yerda' : `${x.studentIds.length}/${x.sigim || '?'}${toliq ? ' · to\'la' : ''}`}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {yangiH.map(hh => (
                                        <button key={`h${hh.id}`} onClick={() => kochirish(id, `h:${hh.id}`)}
                                            className="min-h-[44px] px-2.5 py-1.5 rounded-xl border border-chiziq text-left flex items-center gap-2 hover:border-brand cursor-pointer">
                                            <span className="w-3.5 h-3.5 rounded-full border-2 border-white shrink-0" style={{ background: reysRangi(hTartib.get(hh.id) ?? 0, keyingiNavbat(cars, hh.id)) }} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[12.5px] font-extrabold text-matn truncate">{qisqaIsm(hh.name)}</span>
                                                <span className="block text-[11px] font-bold text-matn-xira">bo'sh · {hh.transport?.capacity} o'rin</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => chiqarish(id)} className="w-full h-10 rounded-xl border border-chiziq text-[12.5px] font-extrabold text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer">
                                    Bugun olib ketilmaydi
                                </button>
                            </>
                        )}
                        {joyTahrir && (
                            <button onClick={() => { setJoyRejim({ id, nuqta: null }); xaritagaOt(); }}
                                className={`w-full h-10 rounded-xl border text-[12.5px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${pos ? 'border-chiziq text-matn-sokin hover:border-brand hover:text-brand' : 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-300'}`}>
                                <MapPin size={14} /> {pos ? "Uyining joyini tuzatish" : 'Uyini xaritada belgilash'}
                            </button>
                        )}
                    </div>
                ) : (
                    <p className="text-[12px] font-bold text-matn-xira">{c ? `${reysNomi(c)} mashinasida` : 'Mashinasiz'}</p>
                )}
            </div>
        );
    }
}

/**
 * Raqamli qadam. `bajarildi` — reja tuzilgan: qadam bitta qatorga yig'iladi
 * (xulosa + "O'zgartirish"), taqsimot darhol ko'rinsin.
 */
function Qadam({ n, sarlavha, izoh, bajarildi = false, xulosa, children }: {
    n: number; sarlavha: string; izoh?: string; bajarildi?: boolean; xulosa?: React.ReactNode; children: React.ReactNode;
}) {
    const [ochiq, setOchiq] = useState(false);
    const korinadi = !bajarildi || ochiq;
    return (
        <div className="p-3.5 border-b border-chiziq-mayin last:border-b-0">
            <div className={`flex items-center gap-2.5 ${korinadi ? 'mb-2.5' : ''}`}>
                <span className={`w-7 h-7 rounded-full text-white text-[13px] font-black flex items-center justify-center shrink-0 ${bajarildi ? 'bg-emerald-600' : 'bg-brand'}`}>
                    {bajarildi ? <Check size={15} /> : n}
                </span>
                <span className="min-w-0">
                    <span className="block text-[15px] font-black text-matn leading-tight">{sarlavha}</span>
                    {bajarildi && !ochiq && xulosa && <span className="block text-[12px] font-bold text-matn-sokin truncate">{xulosa}</span>}
                </span>
                {bajarildi
                    ? <button onClick={() => setOchiq(o => !o)} className="ml-auto shrink-0 px-2.5 h-8 rounded-lg text-[12px] font-extrabold text-brand hover:bg-ichki cursor-pointer">{ochiq ? 'Yopish' : "O'zgartirish"}</button>
                    : izoh && <span className="ml-auto text-[11.5px] font-bold text-matn-xira text-right">{izoh}</span>}
            </div>
            {korinadi && children}
        </div>
    );
}

/** Ro'yxatda yo'q bolani qo'shish: ism, telefon yoki 5 xonali ID. */
function BolaQidirish({ qoshish, bor }: { qoshish: (id: number) => void; bor: Set<number> }) {
    const { students } = useCRM();
    const [q, setQ] = useState('');
    const topildi = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (s.length < 2) return [];
        return students
            .filter(x => x.status !== 'Arxiv' && ((x.name || '').toLowerCase().includes(s) || (x.phone || '').includes(s) || (!!x.kod && String(x.kod).startsWith(s))))
            .slice(0, 8);
    }, [q, students]);
    return (
        <div className="relative mt-2.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" size={14} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Yana bola qo'shish (ism yoki telefon)…"
                className="w-full pl-9 pr-3 h-10 bg-ichki border border-chiziq rounded-xl text-[12.5px] font-bold text-matn outline-none focus:border-brand" />
            {topildi.length > 0 && (
                <div className="absolute z-[70] left-0 right-0 mt-1 bg-sirt border border-chiziq rounded-xl shadow-xl overflow-hidden divide-y divide-chiziq-mayin">
                    {topildi.map(s => {
                        const royxatda = bor.has(s.id);
                        return (
                            <button key={s.id} disabled={royxatda} onClick={() => { qoshish(s.id); setQ(''); }}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-ichki disabled:opacity-50 cursor-pointer disabled:cursor-default">
                                <span className="min-w-0">
                                    <span className="block text-[13px] font-bold text-matn truncate">{displayName(s.name)}</span>
                                    <span className="block text-[11px] font-bold text-matn-xira truncate">{s.phone}{!parseLatLng(s.location) && " · uyi xaritada yo'q"}</span>
                                </span>
                                <span className="text-[11.5px] font-extrabold text-brand shrink-0">{royxatda ? "ro'yxatda" : "+ qo'shish"}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/** Kurs filtri (bir nechtasini tanlash). */
function KursTanlash({ groups, tanlangan: t, onChange }: { groups: { id: number; name: string; studentIds?: number[] }[]; tanlangan: number[]; onChange: (k: number[]) => void }) {
    const [ochiq, setOchiq] = useState(false);
    const [q, setQ] = useState('');
    return (
        <div className="relative">
            <button onClick={() => setOchiq(v => !v)} className={chip(t.length > 0)}>
                Kurs{t.length ? `: ${t.length} ta` : ''} <ChevronDown size={13} />
            </button>
            {ochiq && (
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setOchiq(false)} />
                    <div className="absolute z-[70] mt-1 left-0 w-72 max-w-[80vw] bg-sirt border border-chiziq rounded-xl shadow-xl p-2">
                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-matn-xira" size={12} />
                            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Kurs qidirish..."
                                className="w-full pl-7 pr-2 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12px] text-matn outline-none focus:border-brand" />
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {groups.filter(g => (g.name || '').toLowerCase().includes(q.toLowerCase())).map(g => {
                                const bor = t.includes(g.id);
                                return (
                                    <button key={g.id} onClick={() => onChange(bor ? t.filter(x => x !== g.id) : [...t, g.id])}
                                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-ichki text-left cursor-pointer">
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${bor ? 'bg-brand border-brand text-white' : 'border-chiziq'}`}>{bor && <Check size={10} />}</span>
                                            <span className="text-[12px] font-bold text-matn truncate">{g.name}</span>
                                        </span>
                                        <span className="text-[10px] text-matn-xira shrink-0">{g.studentIds?.length || 0}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {t.length > 0 && (
                            <button onClick={() => onChange([])} className="w-full mt-2 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer">Tozalash</button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
