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

export type AmalHolati = 'kutmoqda' | 'bajarilmoqda' | 'bajarildi' | 'bekor' | 'xato';

export interface Amal {
    tur: 'lid_qoshish' | 'lid_holati' | 'izoh';
    sarlavha: string;
    maydonlar: { nom: string; qiymat: string }[];
    ogohlantirish: string[];
    id?: number;
    malumot: Record<string, any>;
    tugma: string;
    holat?: AmalHolati;
    xato?: string;
}

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
    signal?: AbortSignal;
    onHodisa: (h: Hodisa) => void;
}) {
    const res = await fetch('/api/zukko/savol', {
        method: 'POST',
        headers: sarlavhalar(opts.token, true),
        body: JSON.stringify({ savol: opts.savol, tarix: opts.tarix, yol: opts.yol, schoolId: schoolParam(opts.schoolId) }),
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
