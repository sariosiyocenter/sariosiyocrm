// Zukko — server bilan aloqa va umumiy turlar (routes/zukko.js).

export type Ton = 'xato' | 'ogoh' | 'yaxshi' | 'brand' | 'sokin' | null | undefined;

export interface Qator {
    tur: string;
    id?: number | null;
    nom: string;
    izoh?: string;
    qiymat?: string | null;
    ton?: Ton;
    havola?: string | null;
    ulush?: number;
    /** Bosilsa yozish maydoniga tushadigan misol (Imkoniyatlar ro'yxati). */
    savol?: string;
}

export interface Maydon {
    nom: string;
    qiymat: string;
    izoh?: string | null;
    ton?: Ton;
    ulush?: number;
    tel?: boolean;
}

export interface Blok {
    tur: 'royxat' | 'karta' | 'korsatkich';
    /** Tepadagi kichik yozuv: standart «manba · baza». */
    belgi?: string;
    sarlavha: string;
    izoh?: string;
    havola?: string;
    havolaMatni?: string;
    maydonlar?: Maydon[];
    grafik?: { x: string; y: number }[];
    bolimlar?: { sarlavha?: string; qatorlar: Qator[]; yana?: number }[];
    eslatma?: string;
    bosh?: string;
}

export type AmalHolati = 'kutmoqda' | 'bajarilmoqda' | 'bajarildi' | 'bekor' | 'xato' | 'qisman';

/** Tasdiqlangach brauzer yuboradigan odatdagi API so'rovi (lib/zukkoAmallar.js). */
export interface Sorov {
    usul: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    yol: string;
    body?: any;
    nom?: string;
}

export interface Amal {
    tur: string;
    sarlavha: string;
    /** eski bo'lsa — «eski → yangi» ko'rinishida. */
    maydonlar: { nom: string; qiymat: string; eski?: string }[];
    royxat?: { sarlavha: string; qatorlar: string[]; yana?: number }[];
    ogohlantirish: string[];
    xavfli?: boolean;
    sorovlar: Sorov[];
    tugma: string;
    natija?: string;
    havola?: string | null;
    yaratildi?: number;
    holat?: AmalHolati;
    xato?: string;
    /** Bajarilgach server javobidan qisqa izoh (SMS ketdi, ogohlantirish...). */
    izoh?: string;
    /** So'rov emas, panel oynasi bilan bajariladigan amal (fayldan savol yuklash). */
    maxsus?: SavolYuklashAmali;
}

export interface SavolYuklashAmali {
    tur: 'savol_yuklash';
    fanId: number;
    fanNomi: string;
    mavzuId: number | null;
    /** Saqlangach faol savollar shu imtihonga qo'shiladi (yangi kartochka). */
    imtihon: { id: number; nom: string } | null;
}

/** Xabarga biriktirilgan fayl — serverga faqat nomi va turi boradi. */
export interface FaylBelgi {
    nom: string;
    tur: string;
}

/** Taklif shuncha vaqtdan keyin tasdiqlanmaydi — ma'lumot eskirgan bo'lishi mumkin. */
export const AMAL_MUDDATI_MS = 15 * 60 * 1000;

export interface Qadam {
    id: string;
    matn: string;
    holat: 'ish' | 'tayyor' | 'xato';
    izoh?: string;
}

export interface Turn {
    id: string;
    rol: 'user' | 'zukko';
    vaqt: number;
    matn?: string;
    /** Foydalanuvchi xabariga biriktirilgan fayllar (nomi, turi). */
    fayllar?: FaylBelgi[];
    qadamlar?: Qadam[];
    bloklar?: Blok[];
    amallar?: Amal[];
    takliflar?: string[];
    xato?: string;
    /** AI siz tezkor buyruq natijasi. */
    tezkor?: boolean;
    /** Javob hali kelmoqda. */
    kutmoqda?: boolean;
    davomiylik?: number;
}

export interface PulsKarta {
    kalit: string;
    nom: string;
    qiymat: string;
    izoh?: string;
    ton?: Ton;
}

export interface Holat {
    ai: { yoqilgan: boolean; sozlay: boolean };
    amallarSoni?: number;
    amalMisollari?: string[];
    /** Test faylini biriktirsa bo'ladi (savol qo'shish ruxsati bor). */
    faylQabul?: boolean;
    puls: PulsKarta[];
    buyruqlar: { kalit: string; nom: string; sahifa: 'oquvchi' | 'kurs' | null }[];
    sahifa: { tur: 'oquvchi' | 'kurs' | 'sahifa'; id?: number; nom?: string; sahifa?: string | null };
    filial: string;
}

export class ZukkoXato extends Error {
    constructor(message: string, public status = 0, public aiYoq = false) { super(message); }
}

const sarlavhalar = (token: string | null, json = false): Record<string, string> => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const schoolParam = (schoolId: number | null | undefined) => (schoolId === null || schoolId === undefined ? '' : String(schoolId));

async function xatoniOl(res: Response): Promise<ZukkoXato> {
    const b = await res.json().catch(() => null);
    const matn = b?.error || (res.status === 401 ? 'Sessiya tugagan — qaytadan kiring' : `Server xatosi (${res.status})`);
    return new ZukkoXato(matn, res.status, !!b?.aiYoq);
}

export async function holatniOl(token: string | null, schoolId: number | null | undefined, yol: string, signal?: AbortSignal): Promise<Holat> {
    const q = new URLSearchParams({ schoolId: schoolParam(schoolId), yol });
    const res = await fetch(`/api/zukko/holat?${q}`, { headers: sarlavhalar(token), signal });
    if (!res.ok) throw await xatoniOl(res);
    return res.json();
}

export async function buyruqBajar(token: string | null, schoolId: number | null | undefined, buyruq: string, param?: { id?: number }): Promise<{ blok: Blok; xulosa: string }> {
    const res = await fetch('/api/zukko/buyruq', {
        method: 'POST',
        headers: sarlavhalar(token, true),
        body: JSON.stringify({ buyruq, param, schoolId: schoolParam(schoolId) }),
    });
    if (!res.ok) throw await xatoniOl(res);
    return res.json();
}

export type Hodisa =
    | { t: 'qadam'; id: string; matn?: string; holat: Qadam['holat']; izoh?: string }
    | { t: 'blok'; blok: Blok }
    | { t: 'amal'; amal: Amal }
    | { t: 'matn'; matn: string }
    | { t: 'takliflar'; takliflar: string[] }
    | { t: 'xato'; matn: string; status?: number }
    | { t: 'tugadi' };

/**
 * Savol yuboradi va javob oqimini hodisalarga bo'ladi. Server oqimni bo'lib
 * yuboradi; oraliq (Vercel) bufer qilsa ham hammasi oxirida keladi — natija bir xil.
 */
export async function savolYubor(opts: {
    token: string | null;
    schoolId: number | null | undefined;
    savol: string;
    tarix: { rol: 'user' | 'model'; matn: string; dalil?: string }[];
    yol: string;
    fayllar?: FaylBelgi[];
    signal?: AbortSignal;
    onHodisa: (h: Hodisa) => void;
}) {
    const res = await fetch('/api/zukko/savol', {
        method: 'POST',
        headers: sarlavhalar(opts.token, true),
        body: JSON.stringify({ savol: opts.savol, tarix: opts.tarix, yol: opts.yol, fayllar: opts.fayllar?.length ? opts.fayllar : undefined, schoolId: schoolParam(opts.schoolId) }),
        signal: opts.signal,
    });
    if (!res.ok || !res.body) throw await xatoniOl(res);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let bufer = '';
    const qismlar = (matn: string) => {
        for (const qator of matn.split('\n')) {
            if (!qator.startsWith('data: ')) continue;
            let h: Hodisa;
            // Faqat JSON o'qish himoyalanadi — hodisani qayta ishlashdagi xato yashirinmasin.
            try { h = JSON.parse(qator.slice(6)); } catch { continue; }
            opts.onHodisa(h);
        }
    };
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        bufer += dec.decode(value, { stream: true });
        let i;
        while ((i = bufer.indexOf('\n\n')) >= 0) {
            qismlar(bufer.slice(0, i));
            bufer = bufer.slice(i + 2);
        }
    }
    bufer += dec.decode();
    if (bufer.trim()) qismlar(bufer);
}

/** Keyingi savolda AI "uni", "ularni" nimaligini bilsin: ekranda ko'rsatilgan yozuvlar. */
export function dalilMatni(t: Turn): string {
    const turi: Record<string, string> = { oquvchi: "o'quvchi", kurs: 'kurs', lid: 'lid' };
    const out: string[] = [];
    for (const b of t.bloklar || []) {
        for (const bo of b.bolimlar || []) {
            for (const q of bo.qatorlar) {
                if (q.id && turi[q.tur] && out.length < 12) out.push(`${turi[q.tur]}#${q.id} ${q.nom}`);
            }
        }
    }
    return out.join('; ');
}

/** Blokni oddiy matnga — Telegramga nusxalash uchun. */
export function blokMatni(b: Blok): string {
    const q: string[] = [`${b.sarlavha}${b.izoh ? ` (${b.izoh})` : ''}`];
    if (b.maydonlar?.length) q.push(b.maydonlar.map(m => `${m.nom}: ${m.qiymat}`).join(' · '));
    for (const bo of b.bolimlar || []) {
        if (bo.sarlavha) q.push('', bo.sarlavha);
        bo.qatorlar.forEach((r, i) => q.push(`${i + 1}. ${r.nom}${r.qiymat ? ` — ${r.qiymat}` : ''}${r.izoh ? ` (${r.izoh})` : ''}`));
        if (bo.yana) q.push(`… yana ${bo.yana} ta`);
    }
    return q.join('\n');
}

/** AI siz amal kartochkasi (masalan, savollar saqlangach — imtihonga qo'shish taklifi). */
export async function amalTayyorla(token: string | null, schoolId: number | null | undefined, nom: string, args: Record<string, unknown>): Promise<Amal> {
    const res = await fetch('/api/zukko/amal', {
        method: 'POST',
        headers: sarlavhalar(token, true),
        body: JSON.stringify({ nom, args, schoolId: schoolParam(schoolId) }),
    });
    if (!res.ok) throw await xatoniOl(res);
    return (await res.json()).amal;
}

/** Fayl turi — xabar ostidagi belgi va serverga yuboriladigan izoh uchun. */
export function faylTuri(f: File): string {
    if (/\.xlsx?$/i.test(f.name)) return 'Excel';
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'PDF';
    if (f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name)) return 'rasm';
    return '';
}

export class AmalXato extends Error {
    constructor(message: string, public bajarildi: number, public javoblar: any[]) { super(message); }
}

/**
 * Tasdiqlangan amal: so'rovlar ketma-ket, odatdagi API ga — xuddi xodim o'zi
 * tugmani bosgandek (ruxsat, jurnal, xabarlar o'sha yo'llarniki). X-Zukko —
 * jurnalda "Zukko orqali" belgisi uchun.
 */
export async function amalniYubor(token: string | null, sorovlar: Sorov[]): Promise<any[]> {
    const javoblar: any[] = [];
    for (let i = 0; i < sorovlar.length; i++) {
        const s = sorovlar[i];
        const res = await fetch(s.yol, {
            method: s.usul,
            headers: { ...(s.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), 'X-Zukko': '1' },
            body: s.body !== undefined ? JSON.stringify(s.body) : undefined,
        });
        const j = await res.json().catch(() => null);
        if (!res.ok) throw new AmalXato(`${s.nom ? `${s.nom}: ` : ''}${j?.error || `xato (${res.status})`}`, i, javoblar);
        javoblar.push(j);
    }
    return javoblar;
}

const somF = (n: number) => Math.round(n).toLocaleString('ru-RU');

/** Server javobidan xodimga kerakli qisqa izoh. */
export function natijaIzohi(javoblar: any[]): string | undefined {
    const q: string[] = [];
    for (const j of javoblar) {
        if (!j || typeof j !== 'object') continue;
        if (j.warning) q.push(String(j.warning));
        if (Array.isArray(j.takror) && j.takror.length) q.push(`Diqqat — takror chek: ${j.takror[0]}`);
        if (j.activated) q.push("O'quvchi Faol bo'ldi");
        if (typeof j.charge === 'number' && j.charge > 0) q.push(`Birinchi oy hisobi: ${somF(j.charge)} so'm`);
        if (typeof j.sentCount === 'number') q.push(`${j.sentCount} ta yuborildi${j.failedCount ? `, ${j.failedCount} tasi yetmadi` : ''}`);
        else if (typeof j.yuborildi === 'number') q.push(`${j.yuborildi} ta xabar ketdi${j.xato ? `, ${j.xato} tasi xato` : ''}${j.shablonsiz ? `, ${j.shablonsiz} tasiga shablon yo'q` : ''}${j.aloqasiz ? `, ${j.aloqasiz} tasida aloqa yo'q` : ''}`);
        else if (typeof j.yaratildi === 'number') q.push(`${j.yaratildi} ta eslatma navbatga qo'yildi${j.takror ? `, ${j.takror} tasi yaqinda olgan` : ''}`);
        if (j.telegram && typeof j.telegram === 'object' && typeof j.telegram.yuborildi === 'number') q.push(j.telegram.yuborildi ? 'Administratorga Telegramda yuborildi' : `Administratorga Telegram ketmadi${j.telegram.sabab ? `: ${j.telegram.sabab}` : ''}`);
    }
    return q.join(' · ') || undefined;
}
