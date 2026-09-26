import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft, ChevronRight, Loader2, Zap, Send, Undo2, Maximize2, MapPin, X, Search, Plus, Paintbrush,
    UserCheck, CheckCircle2, RotateCcw, Phone, AlertTriangle, ChevronDown, Check, EyeOff, Bot, Trash2, Users, Filter, Clock, MoreHorizontal,
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { toDateStr, toTimeStr, isLessonDay } from '../../../lib/lessons.js';
import { darsTugashi, tolqinlarniBirlashtirish } from '../../../lib/jadval.js';
import { narxHisobla, uyMasofasi, somMatni, tarifMatni, rejaSummasi } from '../../../lib/transportNarx.js';
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
 * Logistika → Reja (egasi, 2026-09-26: "interaktivroq qilish kerak, srazu
 * xaritada ko'rinsin, xohlaguncha o'zgartirish mumkin bo'lsin").
 *
 * Bitta ish joyi: chapda xarita — kunning hamma bolasi o'z mashinasining
 * rangida, bekat raqami va yo'l chizig'i bilan; rejasizlari kulrang. O'ngda
 * mashinalar (har haydovchining har reysi) — to'lishi, yo'li, vaqti, yo'l
 * haqi. O'zgartirish usullari:
 *   - bolani bosish (xaritada yoki ro'yxatda) → qaysi mashinaga;
 *   - "Bo'yash": mashinani tanlab, xaritada bolalarni ketma-ket bosish;
 *   - "Taqsimlash": rejasizlarni tizim o'zi eng yaqin mashinaga joylaydi
 *     (reja hali bo'lmasa — hammasini mashinalarga bo'ladi);
 *   - uyi belgilanmagan bolaning uyini shu xaritada belgilash.
 * Hamma o'zgarish avval qoralama (brauzerda saqlanadi, "Orqaga" bilan
 * qaytariladi); "Haydovchilarga yuborish" faqat o'zgargan mashinalarni
 * yozadi va o'sha haydovchilarga xabar beradi (PUT /api/logistics/day).
 * Yo'lga chiqqan ("Qabul qildim") mashina qulflanadi.
 */

/**
 * Har reysning o'z rangi: xaritada bir haydovchining 1- va 2-reysi ham
 * ajralib tursin. Rang haydovchi tartibi va navbatdan — reys qo'shilsa yoki
 * olinsa boshqalarning rangi o'zgarmaydi.
 */
const PALITRA = ['#0f766e', '#e11d48', '#2563eb', '#d97706', '#7c3aed', '#16a34a', '#db2777', '#0891b2', '#65a30d', '#9333ea', '#ea580c', '#475569'];
const reysRangi = (haydovchiTartibi: number, navbat: number) => PALITRA[(haydovchiTartibi + (navbat - 1) * 5) % PALITRA.length];
/** "DEMO Alijon Norov" → "Alijon" — tugma va xarita yorlig'i uchun. */
const qisqaIsm = (n: string) => (n || '').replace(/^DEMO\s+/i, '').trim().split(/\s+/)[0] || n;
const KULRANG = '#94a3b8';
const KELGAN = new Set(['Keldi', 'Kechikdi']);
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const KUNLAR = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

const karta = 'bg-sirt rounded-2xl border border-chiziq shadow-sm';
const chip = (faol: boolean) => `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${faol
    ? 'bg-brand border-brand text-white' : 'bg-sirt border-chiziq text-matn-sokin hover:border-brand hover:text-brand'}`;

const kalitOl = (schoolId: number, sana: string, tur: string) => `logistika-reja:${tur}:${schoolId}:${sana}`;
function oqi<T>(k: string): T | null {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
}
function yoz(k: string, v: unknown) {
    try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch { /* ko'rinish uchun — shart emas */ }
}

function sanaNomi(sana: string) {
    const d = new Date(sana + 'T12:00:00');
    const bugun = toDateStr();
    const farq = Math.round((d.getTime() - new Date(bugun + 'T12:00:00').getTime()) / 86400000);
    const oddiy = `${d.getDate()}-${OYLAR[d.getMonth()]}`;
    if (farq === 0) return { katta: 'Bugun', kichik: oddiy };
    if (farq === 1) return { katta: 'Ertaga', kichik: oddiy };
    if (farq === -1) return { katta: 'Kecha', kichik: oddiy };
    return { katta: oddiy, kichik: KUNLAR[d.getDay()] };
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
    groups?: number[]; needsTransport?: boolean; kod?: number | null;
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

    /** Haydovchining tartibi (rang uchun): filial ro'yxatidagi o'rni, keyin rejadagi boshqalar. */
    const hTartib = useMemo(() => {
        const m = new Map<number, number>();
        haydovchilar.forEach((h, i) => m.set(h.id, i));
        rejalar.forEach(p => { if (p.driver && !m.has(p.driver.id)) m.set(p.driver.id, m.size); });
        return m;
    }, [haydovchilar, rejalar]);
    const rangi = useMemo(() => new Map([...hTartib].map(([id, i]) => [id, reysRangi(i, 1)])), [hTartib]);
    const haydovchi = useCallback((id: number) => haydovchilar.find(h => h.id === id), [haydovchilar]);

    // ===================== Bazadagi mashinalar =====================
    const planMap = useMemo(() => new Map(rejalar.map(p => [p.id, p])), [rejalar]);
    const asos: Car[] = useMemo(() => rejalar.filter(p => p.driver).map(p => ({
        key: `r${p.id}`, routeId: p.id, driverId: p.driver!.id, navbat: p.navbat || 1, studentIds: p.stops.map(s => s.studentId),
    })), [rejalar]);
    const qulf = useMemo(() => new Set(rejalar.filter(p => p.run?.startedAt).map(p => `r${p.id}`)), [rejalar]);
    const asosImzo = useMemo(() => JSON.stringify(asos.map(c => [c.routeId, c.driverId, [...c.studentIds].sort((a, b) => a - b)])), [asos]);
    const asosOchiq = useMemo(() => asos.filter(c => !qulf.has(c.key)), [asos, qulf]);

    // ===================== Qoralama va ko'rinish =====================
    const [qoralama, setQoralama] = useState<Qoralama | null>(null);
    const [korinish, setKorinish] = useState<Korinish>({ chiqarilgan: [], qoshilgan: [], olinmagan: [] });
    const [tarix, setTarix] = useState<{ q: Qoralama | null; k: Korinish }[]>([]);
    const [ziddiyat, setZiddiyat] = useState(false);
    const yuklanganKalit = useRef('');

    // Bir haftadan eski kunlarning qoralamalari brauzerda to'planib qolmasin.
    useEffect(() => {
        try {
            const chegara = toDateStr(new Date(Date.now() - 7 * 86400000));
            for (const k of Object.keys(localStorage)) {
                const m = /^logistika-reja:(?:qoralama|korinish):\d+:(\d{4}-\d{2}-\d{2})$/.exec(k);
                if (m && m[1] < chegara) localStorage.removeItem(k);
            }
        } catch { /* shart emas */ }
    }, []);

    // Sana (yoki filial) almashdi: oldingi kunning qoralamasi yangi kunda bir
    // lahza ham ko'rinmasin — yangisi server javobi kelgach o'qiladi.
    useEffect(() => {
        yuklanganKalit.current = '';
        setQoralama(null);
        setKorinish({ chiqarilgan: [], qoshilgan: [], olinmagan: [] });
        setTarix([]);
    }, [sana, schoolId]);

    // O'sha kunning qoralamasi (server javobi kelgach, bir marta).
    useEffect(() => {
        if (!kunTayyor || !schoolId) return;
        const k = `${schoolId}:${sana}`;
        if (yuklanganKalit.current === k) return;
        yuklanganKalit.current = k;
        setTarix([]);
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

    // Server boshqa joyda o'zgardi (boshqa xodim yubordi): qoralama o'zgarmagan
    // bo'lsa — jimgina yangisiga o'tamiz, aks holda ogohlantiramiz.
    useEffect(() => {
        if (!qoralama || qoralama.asosImzo === asosImzo) return;
        if (farqlar(asosOchiq, qoralama.cars).soni === 0) setQoralama(null);
        else setZiddiyat(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asosImzo]);

    // Joriy mashinalar: qulflanganlari doim serverdan, qolgani qoralamadan.
    const qulfCars = useMemo(() => asos.filter(c => qulf.has(c.key)), [asos, qulf]);
    const ochiqCars: Car[] = useMemo(() => {
        const yolda = new Set(qulfCars.flatMap(c => c.studentIds));
        const manba = qoralama ? qoralama.cars : asosOchiq;
        return manba
            .filter(c => !(c.routeId && qulf.has(`r${c.routeId}`)))
            .map(c => c.studentIds.some(id => yolda.has(id)) ? { ...c, studentIds: c.studentIds.filter(id => !yolda.has(id)) } : c);
    }, [qoralama, asosOchiq, qulfCars, qulf]);
    const tartibH = useMemo(() => new Map(haydovchilar.map((h, i) => [h.id, i])), [haydovchilar]);
    const cars: Car[] = useMemo(() => [...qulfCars, ...ochiqCars].sort((a, b) =>
        ((tartibH.get(a.driverId) ?? 99) - (tartibH.get(b.driverId) ?? 99)) || a.navbat - b.navbat), [qulfCars, ochiqCars, tartibH]);
    const farq = useMemo(() => farqlar(asosOchiq, ochiqCars), [asosOchiq, ochiqCars]);

    const saqla = (q: Qoralama | null, k: Korinish = korinish) => {
        setTarix(t => [...t.slice(-39), { q: qoralama, k: korinish }]);
        setQoralama(q);
        setKorinish(k);
    };
    const carsniSaqla = (yangi: Car[], k: Korinish = korinish) => saqla({ cars: yangi, asosImzo: qoralama?.asosImzo ?? asosImzo }, k);
    const orqaga = () => {
        const t = [...tarix];
        const oldingi = t.pop();
        if (!oldingi) return;
        setTarix(t);
        setQoralama(oldingi.q);
        setKorinish(oldingi.k);
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

    const kelganlar = useMemo(() => {
        const s = new Set<number>();
        for (const a of attendances || []) if (a.date === sana && KELGAN.has(a.status)) s.add(a.studentId);
        return s;
    }, [attendances, sana]);

    // Dars tugashi (to'lqinlar): bugun darsi bor kurslar tugash vaqti bo'yicha.
    const tolqinlar = useMemo(() => {
        const vaqtlar = new Map<string, number[]>();
        for (const g of groups) {
            if (!isLessonDay(g.days, sana)) continue;
            const o = darsTugashi(g.schedule);
            if (!o) continue;
            if (!vaqtlar.has(o)) vaqtlar.set(o, []);
            vaqtlar.get(o)!.push(g.id);
        }
        return tolqinlarniBirlashtirish([...vaqtlar.keys()]).map((t: any) => ({
            vaqt: t.vaqt as string,
            guruhlar: (t.ichidagilar as string[]).flatMap(v => vaqtlar.get(v) || []),
        }));
    }, [groups, sana]);

    const [filtr, setFiltr] = useState(() => ({
        transport: true, kelgan: false, ...(oqi<{ transport: boolean; kelgan: boolean }>('logistika-reja:filtr') || {}),
        tolqinlar: [] as string[], kurslar: [] as number[],
    }));
    useEffect(() => { yoz('logistika-reja:filtr', { transport: filtr.transport, kelgan: filtr.kelgan }); }, [filtr.transport, filtr.kelgan]);
    useEffect(() => { setFiltr(f => ({ ...f, tolqinlar: [] })); }, [sana]);

    const hovuz = useMemo(() => {
        const tolqinGuruh = new Set(tolqinlar.filter(t => filtr.tolqinlar.includes(t.vaqt)).flatMap(t => t.guruhlar));
        const kursSet = new Set(filtr.kurslar);
        const ids = new Set<number>();
        for (const s of students) {
            if (s.status === 'Arxiv') continue;
            if (filtr.transport && !s.needsTransport) continue;
            if (filtr.kelgan && !kelganlar.has(s.id)) continue;
            if (filtr.tolqinlar.length && !(s.groups || []).some(g => tolqinGuruh.has(g))) continue;
            if (kursSet.size && !(s.groups || []).some(g => kursSet.has(g))) continue;
            ids.add(s.id);
        }
        for (const id of korinish.qoshilgan) ids.add(id);
        for (const id of korinish.chiqarilgan) ids.delete(id);
        return ids;
    }, [students, filtr, kelganlar, tolqinlar, korinish]);

    const joylashgan = useMemo(() => {
        const m = new Map<number, string>();
        for (const c of cars) for (const id of c.studentIds) m.set(id, c.key);
        return m;
    }, [cars]);
    const rejasiz = useMemo(() => [...hovuz].filter(id => !joylashgan.has(id))
        .sort((a, b) => (bolaMap.get(a)?.name || '').localeCompare(bolaMap.get(b)?.name || '', 'uz')), [hovuz, joylashgan, bolaMap]);

    // ===================== Haydovchilar =====================
    const olinmagan = useMemo(() => new Set(korinish.olinmagan), [korinish.olinmagan]);
    const mashinasiBor = (h: DayDriver) => (h.transport?.capacity || 0) > 0 && h.transport?.status !== 'Arxiv';
    const faolH = haydovchilar.filter(h => mashinasiBor(h) && !olinmagan.has(h.id));
    const sigim = useCallback((driverId: number) => haydovchi(driverId)?.transport?.capacity || 0, [haydovchi]);

    // ===================== Mashinalar ko'rinishi =====================
    const bolaNarxi = useCallback((id: number) => narxHisobla(tarif, uyMasofasi(markaz, joyOl(id))), [tarif, markaz, joyOl]);
    const carlar = useMemo(() => cars.map(c => {
        const plan = c.routeId ? planMap.get(c.routeId) || null : null;
        const qulfli = qulf.has(c.key);
        const k = reysKorsatkichi(c.studentIds, joyOl, markaz);
        // Yo'lga chiqqan reysning tartibi — serverdagi (haydovchi botda shuni ko'rgan).
        const tartib: number[] = qulfli && plan ? plan.stops.map(s => s.studentId) : k.tartib;
        const narx = (id: number) => {
            const st = plan?.stops.find(s => s.studentId === id);
            return st && (qulfli || !farq.ozgargan.includes(c.key)) ? st.narx ?? null : bolaNarxi(id).narx;
        };
        const pul = rejaSummasi(c.studentIds.map(narx));
        let holat: CarHolati;
        if (plan?.run?.finishedAt) holat = 'yetkazildi';
        else if (qulfli) holat = 'yolda';
        else if (!c.routeId || !planMap.has(c.routeId)) holat = 'yangi';
        else if (!c.studentIds.length) holat = 'bosh';
        else if (farq.ozgargan.includes(c.key)) holat = 'ozgargan';
        else holat = 'yuborilgan';
        const h = haydovchi(c.driverId);
        return {
            ...c, plan, qulfli, tartib, km: k.km, daqiqa: k.daqiqa, pul, narx, holat,
            rang: reysRangi(hTartib.get(c.driverId) ?? 0, c.navbat), sigim: sigim(c.driverId),
            haydovchiNomi: h?.name || plan?.driver?.name || 'Haydovchi', telegram: h ? h.telegram : !!plan?.driver?.telegram,
            mashina: mashinaMatni(h?.transport || plan?.transport),
        };
    }), [cars, planMap, qulf, joyOl, markaz, farq, bolaNarxi, hTartib, sigim, haydovchi]);
    type CarV = typeof carlar[number];
    const carByKey = useMemo(() => new Map(carlar.map(c => [c.key, c])), [carlar]);

    const jamiRejada = carlar.reduce((s, c) => s + c.studentIds.length, 0);
    const rejaBor = carlar.some(c => c.studentIds.length);
    const jamiPul = rejaSummasi(carlar.flatMap(c => c.studentIds.map(id => c.narx(id))));

    // ===================== Xarita holati =====================
    const [tanlangan, setTanlangan] = useState<number | null>(null);
    const [fokusKey, setFokusKey] = useState<string | null>(null);
    const [chotka, setChotka] = useState<string | null>(null);
    const [joyRejim, setJoyRejim] = useState<{ id: number; nuqta: [number, number] | null } | null>(null);
    const [moslash, setMoslash] = useState(0);
    const [fokus, setFokus] = useState<{ kalit: string; nuqtalar: [number, number][] } | null>(null);
    const [yopiq, setYopiq] = useState<Set<string>>(new Set());
    const xaritaRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setTanlangan(null); setFokusKey(null); setChotka(null); setJoyRejim(null); }, [sana]);
    // Tanlangan mashina yo'qolsa (yuborildi, o'chirildi) — tanlov ham.
    useEffect(() => { if (fokusKey && !carByKey.has(fokusKey)) setFokusKey(null); }, [fokusKey, carByKey]);
    useEffect(() => {
        if (chotka && chotka !== 'rejasiz' && chotka !== 'chiqar' && (!carByKey.has(chotka) || carByKey.get(chotka)!.qulfli)) setChotka(null);
    }, [chotka, carByKey]);

    const holatiga = (c: CarV, id: number): BolaHolati => HOLAT_XARITA[c.plan?.holatlar?.[id] || ''] || 'rejada';

    const xBolalar: XBola[] = useMemo(() => {
        const out: XBola[] = [];
        const xira = (key: string | null) => !!fokusKey && !chotka && key !== fokusKey;
        for (const c of carlar) {
            c.tartib.forEach((id, i) => {
                const b = bolaMap.get(id);
                const pos = parseLatLng(b?.location);
                if (!pos) return;
                out.push({ id, name: displayName(b?.name || ''), photo: b?.photo, pos, rang: c.rang, tartib: i + 1, holat: holatiga(c, id), xira: xira(c.key) });
            });
        }
        for (const id of rejasiz) {
            const b = bolaMap.get(id);
            const pos = parseLatLng(b?.location);
            if (!pos) continue;
            out.push({ id, name: displayName(b?.name || ''), photo: b?.photo, pos, rang: KULRANG, tartib: null, holat: 'rejasiz', xira: xira(null) });
        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [carlar, rejasiz, bolaMap, fokusKey, chotka]);

    const xYollar: XYol[] = useMemo(() => carlar.filter(c => c.studentIds.length).map(c => ({
        key: c.key, rang: c.rang,
        nuqtalar: [markaz, ...c.tartib.map(id => parseLatLng(joyOl(id))).filter(Boolean) as [number, number][]],
        uzuq: c.holat === 'yangi' || c.holat === 'ozgargan',
        xira: !!fokusKey && !chotka && fokusKey !== c.key,
    })), [carlar, markaz, joyOl, fokusKey, chotka]);

    const xHaydovchilar = useMemo(() => haydovchilar.map(h => ({ id: h.id, name: h.name, rang: rangi.get(h.id) || KULRANG, location: h.location })), [haydovchilar, rangi]);

    const xaritagaOt = () => {
        // Telefonda panel xaritaning ostida — tanlangach xarita ko'rinsin.
        if (window.innerWidth < 1024) xaritaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const bolagaFokus = (id: number) => {
        const pos = parseLatLng(joyOl(id));
        if (pos) setFokus({ kalit: `b${id}-${Date.now()}`, nuqtalar: [pos] });
    };
    const mashinagaFokus = (key: string) => {
        if (fokusKey === key) { setFokusKey(null); return; }
        setFokusKey(key);
        const c = carByKey.get(key);
        const n = (c?.studentIds || []).map(id => parseLatLng(joyOl(id))).filter(Boolean) as [number, number][];
        if (n.length) setFokus({ kalit: `c${key}-${Date.now()}`, nuqtalar: [markaz, ...n] });
    };

    // ===================== Amallar =====================
    const qulfdami = (id: number) => { const k = joylashgan.get(id); return !!k && qulf.has(k); };

    /** Bolani mashinaga (yoki `null` — rejasizga). */
    const kochirish = (id: number, qayerga: string | null) => {
        if (!tahrir) return;
        if (qulfdami(id)) { showNotification("Bu bola yo'ldagi mashinada — endi ko'chirib bo'lmaydi", 'info'); return; }
        if (qayerga && qulf.has(qayerga)) { showNotification("Bu mashina yo'lga chiqqan — unga bola qo'shib bo'lmaydi", 'info'); return; }
        const yangi = kochir(ochiqCars, id, qayerga);
        if (!yangi) return;
        // Filtrga kirmaydigan bola rejasizga tushsa ham ko'rinib tursin.
        const k = !qayerga && !hovuz.has(id) ? { ...korinish, qoshilgan: [...korinish.qoshilgan, id] } : korinish;
        carsniSaqla(yangi, k);
    };
    const chiqarish = (id: number) => {
        if (!tahrir || qulfdami(id)) return;
        const yangi = joylashgan.has(id) ? kochir(ochiqCars, id, null) || ochiqCars : ochiqCars;
        const k = { ...korinish, chiqarilgan: [...new Set([...korinish.chiqarilgan, id])], qoshilgan: korinish.qoshilgan.filter(x => x !== id) };
        if (joylashgan.has(id)) carsniSaqla(yangi, k); else saqla(qoralama, k);
        if (tanlangan === id) setTanlangan(null);
    };
    const qaytarish = (id: number) => saqla(qoralama, { ...korinish, chiqarilgan: korinish.chiqarilgan.filter(x => x !== id) });
    const qoshish = (id: number) => {
        saqla(qoralama, { ...korinish, qoshilgan: [...new Set([...korinish.qoshilgan, id])], chiqarilgan: korinish.chiqarilgan.filter(x => x !== id) });
        setTanlangan(id);
        bolagaFokus(id);
    };
    const yangiReys = (driverId: number) => {
        if (!tahrir) return null;
        const navbat = keyingiNavbat(cars, driverId);
        if (navbat > ENG_KOP_NAVBAT) { showNotification(`Bir haydovchiga ${ENG_KOP_NAVBAT} tadan ortiq reys bo'lmaydi`, 'info'); return null; }
        const car: Car = { key: yangiKalit(driverId), routeId: null, driverId, navbat, studentIds: [] };
        carsniSaqla([...ochiqCars, car]);
        return car.key;
    };
    /** Haydovchiga yangi reys ochib, bolani darhol unga qo'yish (bitta o'zgarish). */
    const yangiReysgaQoy = (id: number, driverId: number) => {
        if (!tahrir) return;
        if (qulfdami(id)) { showNotification("Bu bola yo'ldagi mashinada — endi ko'chirib bo'lmaydi", 'info'); return; }
        const navbat = keyingiNavbat(cars, driverId);
        if (navbat > ENG_KOP_NAVBAT) { showNotification(`Bir haydovchiga ${ENG_KOP_NAVBAT} tadan ortiq reys bo'lmaydi`, 'info'); return; }
        const car: Car = { key: yangiKalit(driverId), routeId: null, driverId, navbat, studentIds: [] };
        const yangi = kochir([...ochiqCars, car], id, car.key);
        if (yangi) carsniSaqla(yangi);
    };
    const reysniOlibTashlash = (key: string) => {
        const c = ochiqCars.find(x => x.key === key);
        if (!c) return;
        const qoshilgan = [...korinish.qoshilgan, ...c.studentIds.filter(id => !hovuz.has(id))];
        carsniSaqla(ochiqCars.filter(x => x.key !== key), { ...korinish, qoshilgan });
        if (chotka === key) setChotka(null);
    };
    const haydovchiniAlmashtir = (key: string, driverId: number) => {
        const c = ochiqCars.find(x => x.key === key);
        if (!c || c.driverId === driverId) return;
        const navbat = keyingiNavbat(cars.filter(x => x.key !== key), driverId);
        if (navbat > ENG_KOP_NAVBAT) { showNotification(`Bu haydovchida ${ENG_KOP_NAVBAT} ta reys bor`, 'info'); return; }
        carsniSaqla(ochiqCars.map(x => x.key === key ? { ...x, driverId, navbat } : x));
    };
    const haydovchiniAlmashlash = async (h: DayDriver) => {
        if (olinmagan.has(h.id)) { saqla(qoralama, { ...korinish, olinmagan: korinish.olinmagan.filter(x => x !== h.id) }); return; }
        const uniki = ochiqCars.filter(c => c.driverId === h.id && c.studentIds.length);
        const soni = uniki.reduce((s, c) => s + c.studentIds.length, 0);
        if (soni && !await confirm(`${h.name} bugun ishlamaydi: uning ${uniki.length} reysidagi ${soni} ta bola rejasiz qoladi. Davom etasizmi?`)) return;
        const qoshilgan = [...korinish.qoshilgan, ...uniki.flatMap(c => c.studentIds).filter(id => !hovuz.has(id))];
        const k = { ...korinish, olinmagan: [...korinish.olinmagan, h.id], qoshilgan };
        carsniSaqla(ochiqCars.filter(c => c.driverId !== h.id), k);
    };

    const taqsimla = async (qaytadan = false) => {
        if (!tahrir) return;
        if (!faolH.length) { showNotification("Bugun ishlaydigan haydovchi yo'q (yoki mashinasining sig'imi kiritilmagan)", 'error'); return; }
        const bor = ochiqCars.some(c => c.studentIds.length);
        if (!qaytadan && !rejasiz.length) { showNotification("Rejasiz bola yo'q — hammasi mashinalarda", 'info'); return; }
        if (qaytadan && bor && !await confirm("Yo'lga chiqmagan hamma mashina qaytadan taqsimlanadi (qo'lda qilgan o'zgarishlaringiz ham). Davom etasizmi?")) return;
        const args = {
            markaz, cars, rejasiz, joyOl, qulf,
            haydovchilar: faolH.map(h => ({ id: h.id, capacity: h.transport!.capacity })),
        };
        const oldin = new Set(joylashgan.keys());
        const r = (qaytadan || !bor) ? yangidanTaqsimlash(args) : rejasizlarniJoylash(args);
        let yangi: Car[] = r.cars.filter((c: Car) => !qulf.has(c.key));
        yangi = kalitlarniSaqla(yangi, ochiqCars);
        // Bo'sh qolgan yangi reyslar kerak emas.
        yangi = yangi.filter(c => c.studentIds.length || c.routeId);
        carsniSaqla(yangi);
        const joylandi = yangi.flatMap(c => c.studentIds).filter(id => !oldin.has(id)).length;
        showNotification(
            (qaytadan || !bor ? `Taqsimlandi: ${yangi.filter(c => c.studentIds.length).length} ta reys` : `${joylandi} ta bola joylandi`) +
            (r.sigmagan.length ? `, ${r.sigmagan.length} tasiga joy yetmadi` : ''),
            r.sigmagan.length ? 'info' : 'success');
    };

    const tashlash = async () => {
        if (!await confirm("Yuborilmagan o'zgarishlar bekor qilinadi — reja serverdagi holatiga qaytadi. Davom etasizmi?")) return;
        saqla(null);
        setZiddiyat(false);
    };

    // ===================== Server amallari =====================
    const [band, setBand] = useState('');

    const yuborish = async () => {
        if (!tahrir || !farq.soni) return;
        const ortiq = carlar.filter(c => !c.qulfli && c.studentIds.length > c.sigim && c.sigim > 0);
        if (ortiq.length && !await confirm(`${ortiq.map(c => `${c.haydovchiNomi} (${c.studentIds.length}/${c.sigim})`).join(', ')} — sig'imidan ortiq. Baribir yuborasizmi?`)) return;
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
            setTarix([]);
            setQoralama(null);
            setZiddiyat(false);
            const y: any[] = d.yuborish || [];
            const soni = (t: string) => y.filter(x => x.tur === t).length;
            const qism = [soni('yangi') && `${soni('yangi')} yangi`, soni('ozgardi') && `${soni('ozgardi')} o'zgardi`, soni('bekor') && `${soni('bekor')} bekor qilindi`].filter(Boolean).join(', ');
            const yetmadi = y.filter(x => !x.ok);
            const nomi = (x: any) => haydovchi(x.driverId)?.name || '';
            showNotification(
                `Saqlandi (${qism}). Haydovchilarga xabar ketdi: ${y.filter(x => x.ok).length}` +
                (yetmadi.length ? `. Yetmadi: ${yetmadi.map(x => `${nomi(x)} — ${x.sabab}`).join('; ')}` : '') +
                (d.otaOnaXabarlari && d.otaOnagaYuborildi ? `. Ota-onalarga: ${d.otaOnagaYuborildi}` : ''),
                yetmadi.length ? 'info' : 'success');
        } catch (e: any) {
            showNotification(e.message, 'error');
            yukla(true);
        } finally {
            setBand('');
        }
    };

    const rejaAmali = async (c: CarV, amal: 'accept' | 'deliver' | 'send') => {
        if (!tahrir || !c.routeId) return;
        const savol = {
            accept: `${c.haydovchiNomi}: bolalar mashinaga olindimi? («Qabul qildim» — haydovchi o'rniga). Shundan keyin bu mashina o'zgartirilmaydi.`,
            deliver: `${c.haydovchiNomi}: hammasi uyiga yetkazildimi? («Yetkazdim» — haydovchi o'rniga)`,
            send: '',
        }[amal];
        if (savol && !await confirm(savol)) return;
        setBand(`${amal}-${c.key}`);
        try {
            const r = await fetch(`/api/logistics/plans/${c.routeId}/${amal}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'Xatolik');
            showNotification({ accept: 'Qabul qilindi — mashina yo\'lda', deliver: 'Yetkazildi deb belgilandi', send: 'Reja haydovchiga qayta yuborildi' }[amal], 'success');
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
        } catch (e: any) {
            showNotification(e?.message || 'Joy saqlanmadi', 'error');
        } finally {
            setBand('');
        }
    };

    // ===================== Xarita hodisalari =====================
    const bolaBosildi = (id: number) => {
        if (joyRejim) return;
        if (chotka) {
            if (!tahrir) return;
            if (chotka === 'chiqar') chiqarish(id);
            else kochirish(id, chotka === 'rejasiz' ? null : chotka);
            return;
        }
        setTanlangan(t => (t === id ? null : id));
    };
    const xaritaBosildi = (pos: [number, number]) => {
        if (joyRejim) { setJoyRejim({ ...joyRejim, nuqta: pos }); return; }
        if (!chotka) setTanlangan(null);
    };

    // Ctrl+Z — orqaga.
    useEffect(() => {
        const f = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement)?.closest?.('input,textarea,select')) {
                e.preventDefault();
                orqaga();
            }
            if (e.key === 'Escape') { setChotka(null); setJoyRejim(null); setTanlangan(null); }
        };
        window.addEventListener('keydown', f);
        return () => window.removeEventListener('keydown', f);
    });

    const kunSurish = (n: number) => {
        const d = new Date(sana + 'T12:00:00');
        d.setDate(d.getDate() + n);
        setSana(toDateStr(d));
    };

    // ===================== Ko'rinish =====================
    const sanaY = sanaNomi(sana);
    const tanlanganBola = tanlangan ? bolaMap.get(tanlangan) : null;
    const tanlanganCar = tanlangan ? carByKey.get(joylashgan.get(tanlangan) || '') || null : null;
    const nuqtasizlar = [...hovuz].filter(id => !parseLatLng(joyOl(id)));
    const chotkaNomi = chotka === 'rejasiz' ? 'Rejasiz' : chotka === 'chiqar' ? "Bugun ketmaydi" : chotka ? (() => { const c = carByKey.get(chotka); return c ? `${c.haydovchiNomi}${c.navbat > 1 ? ` · ${c.navbat}-reys` : ''}` : ''; })() : '';

    if (!kun && yuklanmoqda) {
        return <div className={`${karta} p-16 flex items-center justify-center gap-2 text-[12px] font-bold text-matn-xira`}><Loader2 size={16} className="animate-spin" /> Yuklanmoqda…</div>;
    }

    return (
        <div className="space-y-3">
            {/* ===== Buyruq paneli: sana, ko'rsatkichlar, orqaga, yuborish ===== */}
            <div className={`${karta} px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2`}>
                <div className="flex items-center gap-1">
                    <button onClick={() => kunSurish(-1)} className="w-9 h-9 rounded-xl hover:bg-ichki flex items-center justify-center text-matn-sokin cursor-pointer" aria-label="Oldingi kun"><ChevronLeft size={18} /></button>
                    <label className="relative flex flex-col items-center px-2 min-w-[108px] cursor-pointer">
                        <span className="text-[14px] font-black text-matn leading-tight">{sanaY.katta}</span>
                        <span className="text-[10.5px] font-bold text-matn-xira leading-tight">{sanaY.kichik}</span>
                        <input type="date" value={sana} onChange={e => e.target.value && setSana(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Sana" />
                    </label>
                    <button onClick={() => kunSurish(1)} className="w-9 h-9 rounded-xl hover:bg-ichki flex items-center justify-center text-matn-sokin cursor-pointer" aria-label="Keyingi kun"><ChevronRight size={18} /></button>
                    {!bugunmi && (
                        <button onClick={() => setSana(toDateStr())} className="ml-1 px-2.5 py-1.5 rounded-lg border border-chiziq text-[11px] font-extrabold text-matn-sokin hover:border-brand hover:text-brand cursor-pointer">Bugun</button>
                    )}
                </div>

                <div className="flex items-center gap-4 text-[11px] font-bold text-matn-xira order-3 sm:order-none w-full sm:w-auto overflow-x-auto">
                    <span className="whitespace-nowrap">Rejada <b className="text-[15px] text-matn num">{jamiRejada}</b></span>
                    <span className="whitespace-nowrap">Rejasiz <b className={`text-[15px] num ${rejasiz.length ? 'text-amber-600' : 'text-matn'}`}>{rejasiz.length}</b></span>
                    <span className="whitespace-nowrap">Reys <b className="text-[15px] text-matn num">{carlar.filter(c => c.studentIds.length).length}</b></span>
                    <span className="whitespace-nowrap">Yo'l haqi <b className="text-[15px] text-matn num">{somMatni(jamiPul.jami)}</b>{jamiPul.aniqlanmagan > 0 && <span className="text-amber-600"> +{jamiPul.aniqlanmagan} narxsiz</span>}</span>
                    {yuklanmoqda && <Loader2 size={14} className="animate-spin" />}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <button onClick={orqaga} disabled={!tarix.length} title="Orqaga (Ctrl+Z)"
                        className="h-9 px-3 rounded-xl border border-chiziq text-[12px] font-extrabold text-matn-sokin hover:border-brand hover:text-brand disabled:opacity-35 disabled:hover:border-chiziq disabled:hover:text-matn-sokin flex items-center gap-1.5 cursor-pointer">
                        <Undo2 size={15} /> <span className="hidden sm:inline">Orqaga</span>
                    </button>
                    {tahrir && (
                        <button onClick={yuborish} disabled={!farq.soni || !!band}
                            className="hidden lg:flex h-9 px-4 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-[12px] font-extrabold items-center gap-2 shadow-sm cursor-pointer">
                            {band === 'yuborish' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                            {farq.soni ? `Haydovchilarga yuborish · ${farq.soni}` : carlar.some(c => c.plan) ? 'Hammasi yuborilgan' : 'Haydovchilarga yuborish'}
                        </button>
                    )}
                </div>
            </div>

            {ziddiyat && farq.soni > 0 && (
                <div className="px-4 py-2.5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 flex flex-wrap items-center gap-3 text-[12px] font-bold text-amber-800 dark:text-amber-300">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span className="flex-1 min-w-[200px]">Bu kunning rejasi boshqa joyda o'zgartirilgan. Yuborsangiz — sizning variantingiz yoziladi.</span>
                    <button onClick={tashlash} className="px-3 py-1.5 rounded-lg bg-white/70 dark:bg-black/20 border border-amber-300 dark:border-amber-800 hover:bg-white cursor-pointer">Mening qoralamamni tashlash</button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_410px] gap-3 lg:h-[calc(100dvh-236px)] lg:min-h-[600px]">
                {/* ===== XARITA ===== */}
                <div ref={xaritaRef} className={`${karta} relative overflow-hidden h-[60vh] min-h-[380px] lg:h-full scroll-mt-20`}>
                    <RejaXarita
                        className="h-full w-full"
                        markaz={markaz}
                        orgName={settings?.orgName}
                        logo={settings?.logo}
                        bolalar={xBolalar}
                        yollar={xYollar}
                        haydovchilar={xHaydovchilar}
                        tanlangan={tanlangan}
                        rejim={joyRejim ? 'joy' : chotka ? 'boyash' : 'oddiy'}
                        joyNuqta={joyRejim?.nuqta || null}
                        onBola={bolaBosildi}
                        onXarita={xaritaBosildi}
                        moslashKaliti={`${sana}:${moslash}:${kunTayyor ? 1 : 0}:${students.length ? 1 : 0}`}
                        fokus={fokus}
                    >
                        {/* Yuqorida: rejim banneri yoki yordam */}
                        <div className="absolute top-3 left-3 right-3 z-30 flex items-start gap-2 pointer-events-none">
                            {joyRejim ? (
                                <div className="pointer-events-auto mx-auto max-w-full flex flex-wrap items-center gap-2 px-3 py-2 rounded-2xl bg-rose-600 text-white shadow-lg text-[12px] font-bold">
                                    <MapPin size={15} />
                                    {joyRejim.nuqta
                                        ? <span>«{displayName(bolaMap.get(joyRejim.id)?.name || '')}» uyi shu yerdami?</span>
                                        : <span>«{displayName(bolaMap.get(joyRejim.id)?.name || '')}» uyini xaritada bosing</span>}
                                    {joyRejim.nuqta && (
                                        <button onClick={joyniSaqla} disabled={band === 'joy'} className="px-3 py-1 rounded-lg bg-white text-rose-700 font-extrabold cursor-pointer disabled:opacity-60">
                                            {band === 'joy' ? <Loader2 size={13} className="animate-spin inline" /> : 'Saqlash'}
                                        </button>
                                    )}
                                    <button onClick={() => setJoyRejim(null)} className="px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 cursor-pointer">Bekor</button>
                                </div>
                            ) : chotka ? (
                                <div className="pointer-events-auto mx-auto max-w-full flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-2xl text-white shadow-lg text-[12px] font-bold"
                                    style={{ background: chotka === 'rejasiz' ? '#64748b' : chotka === 'chiqar' ? '#be123c' : carByKey.get(chotka)?.rang }}>
                                    <Paintbrush size={14} className="shrink-0" />
                                    <span className="truncate"><b>{chotkaNomi}</b> — bolalarni xaritada bosing</span>
                                    <button onClick={() => setChotka(null)} className="shrink-0 px-3 py-1 rounded-xl bg-white/25 hover:bg-white/35 font-extrabold cursor-pointer">Tayyor</button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1" />
                                    <button onClick={() => { setFokusKey(null); setMoslash(m => m + 1); }} title="Hamma bolalarni ko'rsatish"
                                        className="pointer-events-auto h-9 px-3 rounded-xl bg-sirt/95 backdrop-blur border border-chiziq shadow-md text-[11.5px] font-extrabold text-matn-2 hover:text-brand flex items-center gap-1.5 cursor-pointer">
                                        <Maximize2 size={14} /> Hammasi
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Pastda: mashinalar (legend) va bo'yash */}
                        {!joyRejim && carlar.length + rejasiz.length > 0 && (
                            <div className="absolute bottom-3 left-3 right-14 z-30 pointer-events-none">
                                <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full w-fit">
                                    {tahrir && !chotka && (
                                        <button onClick={() => setChotka(carlar.find(c => !c.qulfli)?.key || 'rejasiz')}
                                            className="shrink-0 h-9 px-3 rounded-xl bg-matn text-sirt shadow-md text-[11.5px] font-extrabold flex items-center gap-1.5 cursor-pointer">
                                            <Paintbrush size={14} /> Bo'yash
                                        </button>
                                    )}
                                    {carlar.map(c => {
                                        const faol = chotka ? chotka === c.key : fokusKey === c.key;
                                        return (
                                            <button key={c.key} disabled={!!chotka && c.qulfli}
                                                onClick={() => (chotka ? setChotka(c.key) : mashinagaFokus(c.key))}
                                                className={`shrink-0 h-9 pl-2 pr-3 rounded-xl border shadow-md text-[11.5px] font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${faol ? 'text-white border-transparent' : 'bg-sirt/95 backdrop-blur border-chiziq text-matn-2'}`}
                                                style={faol ? { background: c.rang } : undefined}>
                                                <span className="w-3 h-3 rounded-full border-2 border-white shrink-0" style={{ background: c.rang }} />
                                                {qisqaIsm(c.haydovchiNomi)}{c.navbat > 1 ? ` ${c.navbat}` : ''}
                                                <span className={`num ${faol ? 'text-white/85' : c.studentIds.length > c.sigim && c.sigim ? 'text-rose-600' : 'text-matn-xira'}`}>{c.studentIds.length}/{c.sigim || '?'}</span>
                                            </button>
                                        );
                                    })}
                                    {(chotka || rejasiz.length > 0) && (
                                        <button onClick={() => (chotka ? setChotka('rejasiz') : setFokusKey(null))}
                                            className={`shrink-0 h-9 px-3 rounded-xl border shadow-md text-[11.5px] font-extrabold flex items-center gap-1.5 cursor-pointer ${chotka === 'rejasiz' ? 'bg-slate-500 text-white border-transparent' : 'bg-sirt/95 backdrop-blur border-chiziq text-matn-2'}`}>
                                            <span className="w-3 h-3 rounded-full border-2 border-dashed border-slate-400 shrink-0" /> Rejasiz <span className="num opacity-75">{rejasiz.length}</span>
                                        </button>
                                    )}
                                    {chotka && (
                                        <button onClick={() => setChotka('chiqar')}
                                            className={`shrink-0 h-9 px-3 rounded-xl border shadow-md text-[11.5px] font-extrabold flex items-center gap-1.5 cursor-pointer ${chotka === 'chiqar' ? 'bg-rose-700 text-white border-transparent' : 'bg-sirt/95 backdrop-blur border-chiziq text-rose-600'}`}>
                                            <EyeOff size={13} /> Bugun ketmaydi
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tanlangan bola — kompyuterda xarita ichida */}
                        {tanlanganBola && !joyRejim && !chotka && (
                            <div className="hidden lg:block absolute top-16 right-3 z-40 w-[340px] max-h-[calc(100%-140px)] overflow-y-auto">
                                {bolaKarta()}
                            </div>
                        )}
                    </RejaXarita>
                </div>

                {/* ===== PANEL ===== */}
                <div className={`${karta} flex flex-col lg:h-full lg:overflow-hidden`}>
                    <div className="flex-1 lg:overflow-y-auto divide-y divide-chiziq-mayin">
                        {/* --- Asosiy amal: taqsimlash --- */}
                        <div className="p-3.5">
                        {tahrir && (
                            <div className="flex gap-2">
                                <button onClick={() => taqsimla(false)} disabled={!faolH.length || (!rejasiz.length && ochiqCars.some(c => c.studentIds.length))}
                                    className="flex-1 h-11 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-[12.5px] font-extrabold flex items-center justify-center gap-2 shadow-sm cursor-pointer">
                                    <Zap size={16} />
                                    {ochiqCars.some(c => c.studentIds.length) ? `Rejasizlarni joylash (${rejasiz.length})` : `Avtomatik taqsimlash (${rejasiz.length})`}
                                </button>
                                <Menyu items={[
                                    { label: "Qaytadan taqsimlash (hammasini)", icon: <RotateCcw size={13} />, onClick: () => taqsimla(true), hidden: !ochiqCars.some(c => c.studentIds.length) },
                                    { label: "Qoralamani tashlash", icon: <Trash2 size={13} />, onClick: tashlash, hidden: !qoralama, xavfli: true },
                                ]} />
                            </div>
                        )}
                        <p className="mt-2 text-[10.5px] font-bold text-matn-xira leading-relaxed">
                            {rejaBor
                                ? "O'zgartirish: bolani bosing yoki «Bo'yash» bilan bir nechtasini birdan ko'chiring. Haydovchi faqat «Yuborish» dan keyin oladi."
                                : "Bolalar mashina sig'imi va uylar joylashuviga qarab bo'linadi, keyin xohlaganingizcha o'zgartirasiz."}
                        </p>
                        </div>

                        {/* --- Kimlar ketadi (reja bo'lsa yig'iq) --- */}
                        <Bolim key={rejaBor ? 'f1' : 'f0'} ochiq={!rejaBor} sarlavha="Kimlar ketadi" ikon={<Filter size={14} />} izoh={`${hovuz.size} ta bola`}>
                            <div className="flex flex-wrap gap-1.5">
                                <button className={chip(filtr.transport)} onClick={() => setFiltr(f => ({ ...f, transport: !f.transport }))}>
                                    {filtr.transport ? <Check size={12} /> : <span className="w-3 h-3 rounded border border-current opacity-60" />} Transport kerak
                                </button>
                                <button className={chip(filtr.kelgan)} onClick={() => setFiltr(f => ({ ...f, kelgan: !f.kelgan }))}>
                                    {filtr.kelgan ? <Check size={12} /> : <span className="w-3 h-3 rounded border border-current opacity-60" />} Bugun kelgan <span className="opacity-70 num">{kelganlar.size}</span>
                                </button>
                                <KursTanlash groups={groups} tanlangan={filtr.kurslar} onChange={k => setFiltr(f => ({ ...f, kurslar: k }))} />
                            </div>
                            {tolqinlar.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                    <span className="text-[10.5px] font-extrabold text-matn-xira flex items-center gap-1"><Clock size={11} /> Dars tugashi:</span>
                                    {tolqinlar.map(t => {
                                        const faol = filtr.tolqinlar.includes(t.vaqt);
                                        return (
                                            <button key={t.vaqt} className={chip(faol)}
                                                onClick={() => setFiltr(f => ({ ...f, tolqinlar: faol ? f.tolqinlar.filter(x => x !== t.vaqt) : [...f.tolqinlar, t.vaqt] }))}>
                                                <span className="num">{t.vaqt}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <BolaQidirish qoshish={qoshish} hovuz={hovuz} joylashgan={joylashgan} />
                            {nuqtasizlar.length > 0 && (
                                <p className="mt-2 text-[10.5px] font-bold text-amber-600 flex items-start gap-1.5">
                                    <MapPin size={12} className="shrink-0 mt-0.5" />
                                    {nuqtasizlar.length} ta bolaning uyi xaritada yo'q — ro'yxatda "joyi yo'q" deb turibdi; bosib, xaritada belgilang.
                                </p>
                            )}
                        </Bolim>

                        {/* --- Haydovchilar va taqsimlash --- */}
                        <Bolim key={rejaBor ? 'h1' : 'h0'} ochiq={!rejaBor} sarlavha="Haydovchilar" ikon={<Users size={14} />} izoh={`${faolH.length} ta ishlaydi · ${faolH.reduce((s, h) => s + (h.transport?.capacity || 0), 0)} o'rin`}>
                            {haydovchilar.length === 0 ? (
                                <div className="text-[11.5px] font-bold text-matn-xira space-y-2">
                                    <p>Haydovchi yo'q. Xodimlar bo'limida "Haydovchi" lavozimi bilan qo'shing — mashina rusumi, raqami va sig'imi bilan.</p>
                                    <button onClick={() => navigate('/hr')} className="px-3 py-1.5 rounded-lg border border-chiziq hover:border-brand hover:text-brand cursor-pointer">Xodimlar bo'limiga</button>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {haydovchilar.map(h => {
                                        const bor = mashinasiBor(h);
                                        const ishlaydi = bor && !olinmagan.has(h.id);
                                        const loc = h.location;
                                        return (
                                            <div key={h.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${ishlaydi ? 'border-chiziq' : 'border-dashed border-chiziq opacity-60'}`}>
                                                <button disabled={!bor || !tahrir} onClick={() => haydovchiniAlmashlash(h)}
                                                    title={ishlaydi ? 'Bugun ishlamaydi deb belgilash' : 'Bugun ishlaydi'}
                                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed ${ishlaydi ? 'bg-brand border-brand text-white' : 'border-chiziq-kuchli'}`}>
                                                    {ishlaydi && <Check size={12} />}
                                                </button>
                                                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: rangi.get(h.id) }} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[12.5px] font-extrabold text-matn truncate">{h.name}</p>
                                                    <p className="text-[10.5px] font-bold text-matn-xira truncate">
                                                        {bor ? `${mashinaMatni(h.transport)}${h.transport?.capacity ? ` · ${h.transport.capacity} o'rin` : ''}` : <span className="text-amber-600">mashina sig'imi kiritilmagan (Xodimlar)</span>}
                                                        {!h.telegram && <span className="text-amber-600"> · botga ulanmagan</span>}
                                                        {loc && <span className={jonlimi(loc) ? 'text-emerald-600' : ''}> · {jonlimi(loc) ? '● jonli' : qachon(loc.updatedAt)}</span>}
                                                    </p>
                                                </div>
                                                {tahrir && ishlaydi && (
                                                    <button onClick={() => { const k = yangiReys(h.id); if (k) { setChotka(k); xaritagaOt(); } }}
                                                        title="Yangi reys ochib, xaritada bolalarni bo'yash"
                                                        className="shrink-0 h-7 px-2 rounded-lg border border-chiziq text-[10.5px] font-extrabold text-matn-sokin hover:border-brand hover:text-brand flex items-center gap-1 cursor-pointer">
                                                        <Plus size={12} /> reys
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <button type="button" onClick={onTarif}
                                className={`mt-2 text-left text-[10.5px] font-bold cursor-pointer hover:underline ${tarif ? 'text-matn-sokin' : 'text-amber-600'}`}>
                                {tarif ? `💰 Yo'l haqi (hammaga): ${tarifMatni(tarif)}` : "💰 Yo'l haqi kiritilmagan — «Yo'l haqi» bo'limi"}
                            </button>
                        </Bolim>

                        {/* --- Mashinalar --- */}
                        {carlar.length > 0 && (
                            <div className="p-3 space-y-2.5">
                                {carlar.map(c => mashinaKarta(c))}
                            </div>
                        )}

                        {/* --- Rejasiz --- */}
                        <Bolim sarlavha="Rejasiz" ikon={<span className="w-3 h-3 rounded-full border-2 border-dashed border-slate-400" />} izoh={`${rejasiz.length} ta`} ochiq={rejasiz.length > 0 && rejasiz.length <= 40}>
                            {rejasiz.length === 0 ? (
                                <p className="text-[11.5px] font-bold text-matn-xira">{hovuz.size ? 'Hamma bola mashinalarda.' : "Filtrga mos bola yo'q."}</p>
                            ) : (
                                <div className="-mx-1 max-h-[360px] overflow-y-auto">
                                    {rejasiz.map(id => (
                                        bolaQator(id)
                                    ))}
                                </div>
                            )}
                        </Bolim>

                        {/* --- Bugun ketmaydi --- */}
                        {korinish.chiqarilgan.length > 0 && (
                            <Bolim sarlavha="Bugun ketmaydi" ikon={<EyeOff size={14} />} izoh={`${korinish.chiqarilgan.length} ta`} ochiq={false}>
                                <div className="space-y-1">
                                    {korinish.chiqarilgan.map(id => (
                                        <div key={id} className="flex items-center justify-between gap-2 py-1">
                                            <span className="text-[12px] font-bold text-matn-sokin truncate">{displayName(bolaMap.get(id)?.name || '')}</span>
                                            <button onClick={() => qaytarish(id)} className="shrink-0 px-2 py-1 rounded-lg text-[10.5px] font-extrabold text-brand hover:bg-ichki flex items-center gap-1 cursor-pointer">
                                                <RotateCcw size={11} /> Qaytarish
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </Bolim>
                        )}
                    </div>

                    {/* Telefonda pastki "Yuborish" paneli */}
                    {tahrir && farq.soni > 0 && (
                        <div className="lg:hidden fixed bottom-0 inset-x-0 z-[90] p-3 bg-sirt/95 backdrop-blur border-t border-chiziq shadow-[0_-8px_24px_rgba(15,23,42,.12)]">
                            <button onClick={yuborish} disabled={!!band}
                                className="w-full h-12 rounded-2xl bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-[13px] font-extrabold flex items-center justify-center gap-2 shadow-sm cursor-pointer">
                                {band === 'yuborish' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                Haydovchilarga yuborish · {farq.soni} o'zgarish
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tanlangan bola — telefonda pastdan chiqadigan varaq */}
            {tanlanganBola && !joyRejim && !chotka && (
                <div className="lg:hidden fixed inset-x-0 bottom-0 z-[95] max-h-[70vh] overflow-y-auto p-2">
                    {bolaKarta()}
                </div>
            )}
            {tahrir && farq.soni > 0 && <div className="lg:hidden h-20" />}
        </div>
    );

    // ===================== Ichki komponentlar =====================
    // (Yuqoridagi holat va amallardan foydalanadi — alohida props zanjiri kerak emas.)

    function bolaQator(id: number, car?: CarV) {
        const b = bolaMap.get(id);
        if (!b) return null;
        const tartib = car ? car.tartib.indexOf(id) + 1 : 0;
        const narx = car ? car.narx(id) : bolaNarxi(id).narx;
        const joyYoq = !parseLatLng(b.location);
        const h = car?.plan?.holatlar?.[id];
        const tanlandi = tanlangan === id;
        return (
            <div key={id} className={`group flex items-center gap-2 px-2 py-1.5 rounded-xl cursor-pointer transition-colors ${tanlandi ? 'bg-brand/10' : 'hover:bg-ichki'}`}
                onClick={() => { setTanlangan(id); bolagaFokus(id); xaritagaOt(); }}>
                {car ? (
                    <span className="w-5 h-5 rounded-full text-[10px] font-black text-white flex items-center justify-center shrink-0 num" style={{ background: car.rang }}>{tartib}</span>
                ) : (
                    <span className="w-5 h-5 rounded-full border-2 border-dashed border-slate-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-matn truncate">
                        {displayName(b.name)}
                        {kelganlar.has(id) && <span className="ml-1.5 text-[9.5px] font-black text-emerald-600">keldi</span>}
                    </p>
                    <p className="text-[10px] font-bold text-matn-xira truncate">
                        {joyYoq ? <span className="text-amber-600">📍 joyi yo'q</span> : (b.address || (b.groups || []).map(g => kursNomi.get(g)).filter(Boolean).join(', ') || '—')}
                    </p>
                </div>
                {h ? (
                    <span className={`px-1.5 py-0.5 rounded-md border text-[9.5px] font-black shrink-0 ${HOLAT_NOMI[h]?.cls || ''}`}>{HOLAT_NOMI[h]?.matn || h}</span>
                ) : (
                    <span className={`text-[10.5px] font-black shrink-0 num ${narx === null || narx === undefined ? 'text-amber-600' : 'text-matn-sokin'}`}>
                        {narx === null || narx === undefined ? '' : somMatni(narx)}
                    </span>
                )}
                {tahrir && !car?.qulfli && (
                    car ? (
                        <button onClick={e => { e.stopPropagation(); kochirish(id, null); }} title="Mashinadan chiqarish (rejasizga)"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-matn-xira hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0 cursor-pointer">
                            <X size={14} />
                        </button>
                    ) : (
                        <select value="" onClick={e => e.stopPropagation()} onChange={e => { const v = e.target.value; if (v === '__yangi') return; if (v === '__chiqar') chiqarish(id); else if (v) kochirish(id, v); }}
                            title="Mashinaga qo'yish"
                            className="w-[92px] shrink-0 px-1.5 py-1 bg-ichki border border-chiziq rounded-lg text-[10.5px] font-bold text-matn outline-none cursor-pointer">
                            <option value="">Qo'yish…</option>
                            {carlar.filter(x => !x.qulfli).map(x => (
                                <option key={x.key} value={x.key}>{qisqaIsm(x.haydovchiNomi)}{x.navbat > 1 ? ` ${x.navbat}-reys` : ''} ({x.studentIds.length}/{x.sigim})</option>
                            ))}
                            <option value="__chiqar">Bugun ketmaydi</option>
                        </select>
                    )
                )}
            </div>
        );
    }

    function mashinaKarta(c: CarV) {
        const ochiq = !yopiq.has(c.key);
        const toldi = c.sigim ? c.studentIds.length / c.sigim : 0;
        const fokusda = fokusKey === c.key;
        const holatChip: Record<CarHolati, { matn: string; cls: string }> = {
            yetkazildi: { matn: `✓ Yetkazildi${c.plan?.run?.finishedAt ? ' ' + toTimeStr(c.plan.run.finishedAt) : ''}`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50' },
            yolda: { matn: `Yo'lda${c.plan?.run?.startedAt ? ' · ' + toTimeStr(c.plan.run.startedAt) + ' dan' : ''}`, cls: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/50' },
            yangi: { matn: c.studentIds.length ? 'Yangi · yuborilmagan' : "Bo'sh", cls: c.studentIds.length ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50' : 'bg-ichki text-matn-sokin border-chiziq' },
            ozgargan: { matn: "O'zgargan · yuborilmagan", cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50' },
            bosh: { matn: "Bo'sh — yuborilsa bekor bo'ladi", cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50' },
            yuborilgan: c.telegram
                ? { matn: '✓ Yuborilgan', cls: 'bg-ichki text-matn-sokin border-chiziq' }
                : { matn: 'Botga ulanmagan', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50' },
        };
        const hc = holatChip[c.holat];
        const saqlangan = !!c.plan && (c.holat === 'yuborilgan' || c.holat === 'yolda' || c.holat === 'yetkazildi');
        return (
            <div key={c.key} className={`rounded-2xl border overflow-hidden transition-shadow ${fokusda ? 'shadow-md' : ''}`}
                style={{ borderColor: fokusda || chotka === c.key ? c.rang : undefined }}>
                <div className="flex">
                    <div className="w-1.5 shrink-0" style={{ background: c.rang }} />
                    <div className="flex-1 min-w-0">
                        <div className="px-3 pt-2.5 pb-2 flex items-start gap-2">
                            <button onClick={() => { mashinagaFokus(c.key); xaritagaOt(); }} className="min-w-0 flex-1 text-left cursor-pointer" title="Xaritada ko'rsatish">
                                <p className="text-[13px] font-black text-matn truncate">
                                    {c.haydovchiNomi}{c.navbat > 1 && <span className="text-matn-xira font-extrabold"> · {c.navbat}-reys</span>}
                                </p>
                                <p className="text-[10.5px] font-bold text-matn-xira truncate">{c.mashina || 'mashina kiritilmagan'}</p>
                            </button>
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black shrink-0 whitespace-nowrap ${hc.cls}`}>{hc.matn}</span>
                        </div>
                        <div className="px-3 pb-2">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-ichki overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, toldi * 100)}%`, background: toldi > 1 ? '#e11d48' : toldi >= 0.9 ? '#d97706' : c.rang }} />
                                </div>
                                <span className={`text-[11px] font-black num shrink-0 ${toldi > 1 ? 'text-rose-600' : 'text-matn-2'}`}>{c.studentIds.length}/{c.sigim || '?'}</span>
                            </div>
                            <p className="mt-1 text-[10.5px] font-bold text-matn-xira num">
                                {c.studentIds.length ? <>≈ {c.km} km · {c.daqiqa} daq</> : 'bolalar yo\'q'}
                                {c.pul.jami > 0 && <> · <span className="text-matn-2">{somMatni(c.pul.jami)} so'm</span></>}
                                {c.pul.aniqlanmagan > 0 && <span className="text-amber-600"> · {c.pul.aniqlanmagan} narxsiz</span>}
                            </p>
                        </div>

                        {/* Amallar */}
                        {tahrir && (
                            <div className="px-3 pb-2 flex flex-wrap items-center gap-1.5">
                                {!c.qulfli && (
                                    <button onClick={() => { setChotka(chotka === c.key ? null : c.key); xaritagaOt(); }}
                                        className={`h-7 px-2.5 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1 cursor-pointer border ${chotka === c.key ? 'text-white border-transparent' : 'border-chiziq text-matn-sokin hover:text-brand hover:border-brand'}`}
                                        style={chotka === c.key ? { background: c.rang } : undefined}>
                                        <Paintbrush size={12} /> Bo'yash
                                    </button>
                                )}
                                {saqlangan && !c.plan!.run?.startedAt && (
                                    <button onClick={() => rejaAmali(c, 'accept')} disabled={!!band}
                                        className="h-7 px-2.5 rounded-lg border border-chiziq text-[10.5px] font-extrabold text-matn-sokin hover:text-brand hover:border-brand disabled:opacity-50 flex items-center gap-1 cursor-pointer">
                                        {band === `accept-${c.key}` ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />} Qabul qildim
                                    </button>
                                )}
                                {saqlangan && !c.plan!.run?.finishedAt && c.plan!.run?.startedAt && (
                                    <button onClick={() => rejaAmali(c, 'deliver')} disabled={!!band}
                                        className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-extrabold disabled:opacity-50 flex items-center gap-1 cursor-pointer">
                                        {band === `deliver-${c.key}` ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Yetkazdim
                                    </button>
                                )}
                                {saqlangan && !c.plan!.run?.finishedAt && c.telegram && (
                                    <button onClick={() => rejaAmali(c, 'send')} disabled={!!band}
                                        className="h-7 px-2.5 rounded-lg border border-chiziq text-[10.5px] font-extrabold text-matn-sokin hover:text-brand hover:border-brand disabled:opacity-50 flex items-center gap-1 cursor-pointer">
                                        {band === `send-${c.key}` ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Qayta yuborish
                                    </button>
                                )}
                                {!c.qulfli && (
                                    <Menyu kichik items={[
                                        ...faolH.filter(h => h.id !== c.driverId).map(h => ({ label: `Haydovchi: ${h.name}`, icon: <span className="w-2.5 h-2.5 rounded-full" style={{ background: rangi.get(h.id) }} />, onClick: () => haydovchiniAlmashtir(c.key, h.id) })),
                                        { label: 'Reysni olib tashlash', icon: <Trash2 size={13} />, onClick: () => reysniOlibTashlash(c.key), xavfli: true },
                                    ]} />
                                )}
                                {!c.telegram && !c.qulfli && <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1"><Bot size={11} /> botga ulanmagan — xabar bormaydi</span>}
                                <button onClick={() => setYopiq(y => { const n = new Set(y); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })} className="ml-auto w-7 h-7 rounded-lg hover:bg-ichki flex items-center justify-center text-matn-xira cursor-pointer" aria-label="Ro'yxat">
                                    <ChevronDown size={15} className={`transition-transform ${ochiq ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                        )}

                        {ochiq && (
                            <div className="px-1 pb-2">
                                {c.tartib.length === 0 ? (
                                    <p className="px-2 py-2 text-[11px] font-bold text-matn-xira">
                                        {chotka === c.key ? "Xaritada bolalarni bosing — shu mashinaga tushadi." : "Bo'sh. «Bo'yash» ni bosib, xaritada bolalarni tanlang."}
                                    </p>
                                ) : c.tartib.map(id => bolaQator(id, c))}
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
        const narx = c ? c.narx(id) : bolaNarxi(id).narx;
        const h = c?.plan?.holatlar?.[id];
        const kurslar = (b.groups || []).map(g => kursNomi.get(g)).filter(Boolean);
        return (
            <div className={`${karta} shadow-xl p-3.5 space-y-3`}>
                <div className="flex items-start gap-3">
                    {b.photo
                        ? <img src={b.photo} alt="" className="w-12 h-12 rounded-full object-cover border-2 shrink-0" style={{ borderColor: c?.rang || KULRANG }} />
                        : <span className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-[14px] font-black shrink-0" style={{ borderColor: c?.rang || KULRANG, color: c?.rang || '#64748b' }}>{displayName(b.name).split(' ').map(w => w[0]).slice(0, 2).join('')}</span>}
                    <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-black text-matn leading-tight">{displayName(b.name)}</p>
                        <p className="text-[11px] font-bold text-matn-xira mt-0.5">
                            {kurslar.length ? kurslar.join(', ') : 'kurssiz'}
                            {kelganlar.has(id) && <span className="text-emerald-600"> · bugun keldi</span>}
                        </p>
                        <p className="text-[11px] font-bold text-matn-sokin mt-0.5">
                            {[b.address, km !== null ? `markazdan ${km} km` : null].filter(Boolean).join(' · ')}
                            {narx !== null && narx !== undefined && <> · <b className="text-matn-2">{somMatni(narx)} so'm</b></>}
                        </p>
                        {b.phone && (
                            <a href={`tel:${b.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 mt-1 text-[11px] font-extrabold text-brand hover:underline">
                                <Phone size={11} /> {b.phone}
                            </a>
                        )}
                    </div>
                    <button onClick={() => setTanlangan(null)} className="w-8 h-8 rounded-lg hover:bg-ichki flex items-center justify-center text-matn-xira shrink-0 cursor-pointer" aria-label="Yopish"><X size={16} /></button>
                </div>

                {!pos && (
                    <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                        Uyi xaritada belgilanmagan — yo'l va narx hisoblanmaydi.
                    </div>
                )}

                {c?.qulfli ? (
                    <div className="space-y-2">
                        <p className="text-[11px] font-extrabold text-matn-xira">
                            <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: c.rang }} />
                            {c.haydovchiNomi}{c.navbat > 1 ? ` · ${c.navbat}-reys` : ''} — {c.holat === 'yetkazildi' ? 'yetkazildi' : "yo'lda"}
                        </p>
                        {tahrir && (
                            <div className="grid grid-cols-3 gap-1.5">
                                {(['Olib ketildi', 'Uyiga yetkazildi', 'Kelmadi'] as const).map(s => (
                                    <button key={s} disabled={!!band} onClick={() => bolaHolati(c, id, h === s ? null : s)}
                                        className={`h-9 rounded-xl border text-[11px] font-extrabold cursor-pointer disabled:opacity-50 ${h === s ? HOLAT_NOMI[s].cls : 'border-chiziq text-matn-sokin hover:border-brand hover:text-brand'}`}>
                                        {band === `holat-${id}` ? <Loader2 size={12} className="animate-spin inline" /> : HOLAT_NOMI[s].matn}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : tahrir ? (
                    <div className="space-y-2">
                        <p className="text-[10.5px] font-extrabold text-matn-xira">Qaysi mashinada ketadi:</p>
                        <div className="grid grid-cols-2 gap-1.5">
                            {carlar.filter(x => !x.qulfli).map(x => {
                                const bu = c?.key === x.key;
                                const toliq = x.sigim > 0 && x.studentIds.length >= x.sigim && !bu;
                                return (
                                    <button key={x.key} onClick={() => kochirish(id, x.key)}
                                        className={`min-h-[40px] px-2.5 py-1.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer ${bu ? 'text-white border-transparent' : 'border-chiziq hover:border-brand'}`}
                                        style={bu ? { background: x.rang } : undefined}>
                                        <span className="w-3 h-3 rounded-full border-2 border-white shrink-0" style={{ background: x.rang }} />
                                        <span className="min-w-0 flex-1">
                                            <span className={`block text-[11.5px] font-extrabold truncate ${bu ? '' : 'text-matn'}`}>{qisqaIsm(x.haydovchiNomi)}{x.navbat > 1 ? ` · ${x.navbat}-reys` : ''}</span>
                                            <span className={`block text-[10px] font-bold num ${bu ? 'text-white/80' : toliq ? 'text-rose-600' : 'text-matn-xira'}`}>{x.studentIds.length}/{x.sigim || '?'}{toliq ? ' · to\'la' : ''}</span>
                                        </span>
                                        {bu && <Check size={14} className="shrink-0" />}
                                    </button>
                                );
                            })}
                            {faolH.map(hh => {
                                const n = keyingiNavbat(cars, hh.id);
                                if (n > ENG_KOP_NAVBAT) return null;
                                const birinchi = !cars.some(x => x.driverId === hh.id);
                                return (
                                    <button key={`y${hh.id}`} onClick={() => yangiReysgaQoy(id, hh.id)}
                                        className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-dashed border-chiziq-kuchli text-left flex items-center gap-2 hover:border-brand cursor-pointer">
                                        <Plus size={13} className="shrink-0 text-matn-xira" />
                                        <span className="min-w-0">
                                            <span className="block text-[11.5px] font-extrabold text-matn truncate">{qisqaIsm(hh.name)}</span>
                                            <span className="block text-[10px] font-bold text-matn-xira">{birinchi ? 'yangi reys' : `${n}-reys`}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {c && (
                                <button onClick={() => kochirish(id, null)} className="h-8 px-3 rounded-xl border border-chiziq text-[11px] font-extrabold text-matn-sokin hover:border-brand hover:text-brand flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-slate-400" /> Rejasizga
                                </button>
                            )}
                            <button onClick={() => chiqarish(id)} className="h-8 px-3 rounded-xl border border-chiziq text-[11px] font-extrabold text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-1.5 cursor-pointer">
                                <EyeOff size={12} /> Bugun ketmaydi
                            </button>
                            {joyTahrir && (
                                <button onClick={() => { setJoyRejim({ id, nuqta: null }); xaritagaOt(); }}
                                    className={`h-8 px-3 rounded-xl border text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer ${pos ? 'border-chiziq text-matn-sokin hover:border-brand hover:text-brand' : 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-300'}`}>
                                    <MapPin size={12} /> {pos ? "Uy joyini o'zgartirish" : 'Uyini xaritada belgilash'}
                                </button>
                            )}
                        </div>
                        {c && c.routeId && h && (
                            <p className="text-[10.5px] font-bold text-matn-xira">Belgi: {HOLAT_NOMI[h]?.matn || h}</p>
                        )}
                    </div>
                ) : (
                    <p className="text-[11px] font-bold text-matn-xira">{c ? `${c.haydovchiNomi} mashinasida` : 'Rejasiz'}</p>
                )}
            </div>
        );
    }

}

/**
 * Filtrga kirmagan bolani qo'lda qo'shish (masalan bugun transport so'ragan).
 * Ism, telefon yoki 5 xonali ID bo'yicha.
 */
function BolaQidirish({ qoshish, hovuz, joylashgan }: { qoshish: (id: number) => void; hovuz: Set<number>; joylashgan: Map<number, string> }) {
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" size={13} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Boshqa bolani qo'shish: ism, telefon yoki ID…"
                className="w-full pl-8 pr-3 h-9 bg-ichki border border-chiziq rounded-xl text-[12px] font-bold text-matn outline-none focus:border-brand" />
            {topildi.length > 0 && (
                <div className="absolute z-[70] left-0 right-0 mt-1 bg-sirt border border-chiziq rounded-xl shadow-xl overflow-hidden divide-y divide-chiziq-mayin">
                    {topildi.map(s => {
                        const bor = hovuz.has(s.id) || joylashgan.has(s.id);
                        return (
                            <button key={s.id} disabled={bor} onClick={() => { qoshish(s.id); setQ(''); }}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-ichki disabled:opacity-50 cursor-pointer disabled:cursor-default">
                                <span className="min-w-0">
                                    <span className="block text-[12px] font-bold text-matn truncate">{displayName(s.name)}</span>
                                    <span className="block text-[10px] font-bold text-matn-xira truncate">{s.phone}{!parseLatLng(s.location) && ' · joyi yo\'q'}</span>
                                </span>
                                <span className="text-[10.5px] font-extrabold text-brand shrink-0">{bor ? "ro'yxatda" : "+ qo'shish"}</span>
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
                Kurs{t.length ? `: ${t.length} ta` : ''} <ChevronDown size={12} />
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
                                        <span className="text-[10px] text-matn-xira num shrink-0">{g.studentIds?.length || 0}</span>
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

/** Panelning yig'iladigan bo'limi. */
function Bolim({ sarlavha, ikon, izoh, ochiq: boshi = true, children }: { sarlavha: string; ikon: React.ReactNode; izoh?: string; ochiq?: boolean; children: React.ReactNode }) {
    const [ochiq, setOchiq] = useState(boshi);
    return (
        <div className="p-3.5">
            <button onClick={() => setOchiq(o => !o)} className="w-full flex items-center justify-between gap-2 cursor-pointer">
                <span className="flex items-center gap-2 text-[12.5px] font-black text-matn">
                    <span className="text-brand flex items-center">{ikon}</span> {sarlavha}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-matn-xira">
                    {izoh} <ChevronDown size={14} className={`transition-transform ${ochiq ? 'rotate-180' : ''}`} />
                </span>
            </button>
            {ochiq && <div className="mt-2.5">{children}</div>}
        </div>
    );
}

/** Qo'shimcha amallar menyusi (⋯). */
function Menyu({ items, kichik = false }: { items: { label: string; icon?: React.ReactNode; onClick: () => void; hidden?: boolean; xavfli?: boolean }[]; kichik?: boolean }) {
    const [ochiq, setOchiq] = useState(false);
    const korinadi = items.filter(i => !i.hidden);
    if (!korinadi.length) return null;
    return (
        <div className="relative">
            <button onClick={() => setOchiq(o => !o)} aria-label="Boshqa amallar"
                className={`${kichik ? 'h-7 w-7 rounded-lg' : 'h-11 w-11 rounded-xl'} border border-chiziq flex items-center justify-center text-matn-sokin hover:border-brand hover:text-brand cursor-pointer`}>
                <MoreHorizontal size={kichik ? 14 : 18} />
            </button>
            {ochiq && (
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setOchiq(false)} />
                    <div className="absolute right-0 z-[70] mt-1 min-w-[220px] bg-sirt border border-chiziq rounded-xl shadow-xl p-1">
                        {korinadi.map(i => (
                            <button key={i.label} onClick={() => { setOchiq(false); i.onClick(); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[12px] font-bold cursor-pointer ${i.xavfli ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20' : 'text-matn hover:bg-ichki'}`}>
                                {i.icon} {i.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
