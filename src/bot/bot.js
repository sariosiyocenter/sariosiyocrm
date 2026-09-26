import { Telegraf, Markup } from 'telegraf';
import prisma from '../../lib/prisma.js';
import { isLessonDay, toDateStr, toTimeStr } from '../../lib/lessons.js';
import {
    bugungiReyslar, marshrutHolati, holatniYozish, holatniOchirish, reysVaqti, holatlar as yonalishHolatlari, markazNuqtasi,
    rejaniQabulQilish, rejaniYetkazish, joylashuvniYozish, REJA_INCLUDE, rejaPuli,
} from '../../services/logistics.js';
import { somMatni } from '../../lib/transportNarx.js';
import { markazNomi } from '../../lib/markazBrendi.js';
import { rolRuxsati, yetadimi, toliqRuxsatli } from '../../lib/ruxsatlar.js';
import { tashkilotSozlamasi } from '../../middleware/auth.js';
import { javobniYozish } from '../../services/kunlikReja.js';
import { parseLatLng, distanceKm } from '../../lib/tartib.js';
import { studentLedger } from '../../services/ledger.js';
import { natijaTokeni } from '../../routes/imtihon.js';
import { davomatXabariniYuborish } from '../../services/davomatXabari.js';
import { sozlamaniTozala, sanaMatni, vergul } from '../../lib/imtihon.js';
import {
    createOrder as paymeCreateOrder, loadSettings as paymeLoadSettings, isConfigured as paymeIsConfigured,
    MIN_AMOUNT as PAYME_MIN, MAX_AMOUNT as PAYME_MAX, payIdFor as paymePayIdFor,
} from '../../services/payme.js';
import { registerKlikTasdiq } from './klikTasdiq.js';
import { registerQarzJavob } from './qarzJavob.js';

const somFmt = (n) => Number(n || 0).toLocaleString('ru-RU');

// "Boshqa summa" so'rovi ForceReply bilan yuboriladi, xabar oxirida belgi
// turadi ("· B"; eski xabarlarda "· G12"). Javob shu belgi orqali taniladi —
// serverda holat saqlanmaydi (Vercelda har so'rov boshqa konteynerga tushadi).
// Bir nechta farzandli ota-onada belgi farzand raqami bilan: "· B123".
const PAYME_PROMPT_RE = /·\s(?:G\d+|B(\d*))\s*$/;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'fake_token_for_init');

// In-memory state tracking
const adminStates = {};
const botCache = new Map(); // token -> botInstance

// User roles and menus
// Ruxsatnoma bilan ham yuboriladi (routes/imtihon.js) — eski menyuli foydalanuvchiga yangi tugmalar chiqsin.
export const getStudentMenu = () => Markup.keyboard([
    ['📅 Dars Jadvali', '💳 To\'lovlar'],
    ['✅ Davomat', '📊 Baholar'],
    // 🆔 — 5 xonali o'quvchi ID si (Payme'da to'lash uchun), src/bot/klikTasdiq.js.
    ['📝 Imtihonlar', '🆔 ID raqam'],
    ['✍️ Shikoyat va takliflar', '👤 Profil'],
    ['🚪 Chiqish']
]).resize();

const getTeacherMenu = () => Markup.keyboard([
    ['🎒 Davomat qilish', '📅 Mening Jadvalim'],
    ['💰 Oylik va Bonuslar', '👤 Profil'],
    ['🚪 Chiqish']
]).resize();

// Botdagi xodim menyusi ham lavozim ruxsatiga bo'ysunadi (Sozlamalar → Ruxsatlar).
// Ilgari haydovchidan boshqa har qanday xodim — resepshn, texnik xodim ham —
// bugungi tushumni ko'rardi va barcha ota-onalarga ommaviy xabar yubora olardi.
const getAdminMenu = (ruxsat) => {
    const q1 = [yetadimi(ruxsat, 'lidlar.royxat', 1) && '📢 Yangi Lidlar', yetadimi(ruxsat, 'bosh.korsatkich', 1) && '📊 Kunlik Hisobot'].filter(Boolean);
    const q2 = [yetadimi(ruxsat, 'xabarlar.yuborish', 2) && '📧 Ommaviy xabar', '⚙️ Sozlamalar'].filter(Boolean);
    return Markup.keyboard([q1, q2, ['🚪 Chiqish']].filter(q => q.length)).resize();
};

/** Xodimning (User) amaldagi ruxsati — CRM dagi bilan bir xil. */
async function xodimRuxsati(u) {
    if (!u) return null;
    if (toliqRuxsatli(u.role)) return rolRuxsati(null, u.role);
    const s = u.schoolId ? await prisma.school.findUnique({ where: { id: u.schoolId }, select: { organizationId: true } }) : null;
    return rolRuxsati(await tashkilotSozlamasi(s?.organizationId), u.role);
}

// "📍 Joylashuvni yuborish" — bir martalik joylashuv. Doimiy ko'rinishi uchun
// haydovchi jonli joylashuv ulashadi (📎 → Joylashuv), bot uni ham qabul qiladi.
const getDriverMenu = () => Markup.keyboard([
    ['🚌 Bugungi reyslar'],
    [Markup.button.locationRequest('📍 Joylashuvni yuborish'), '🚍 Mening Transportim'],
    ['👤 Profil', '🚪 Chiqish']
]).resize();

/** HTML rejimidagi xabar uchun: ism yoki manzilda "<" yoki "&" bo'lsa xabar yuborilmay qolardi. */
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Reja xabaridagi belgi: bola hozir qaysi holatda. */
const holatBelgisi = (belgi) =>
    !belgi ? '⬜' : belgi === 'Kelmadi' ? '❌' : belgi === 'Olib ketildi' ? '🚐' : '✅';

/**
 * Haydovchining reja xabari: kimlar, qayerga, va ikki tugma.
 *
 * Egasining oqimi (2026-09-19): haydovchi bolalarni mashinaga olgach
 * "Qabul qildim" ni bosadi, hammasini uyiga yetkazgach "Yetkazdim" ni.
 * Ro'yxatdagi bola tugmasi — istisno uchun: chiqmagan bolani ❌ qilish yoki
 * birini oldinroq ✅ yetkazildi deb belgilash.
 */
const reysKorinishi = (route, holat, sana) => {
    const run = holat.run;
    const b = holat.holatlar;
    const yetkazildi = route.stops.filter(st => b[st.studentId] === 'Uyiga yetkazildi').length;
    const kelmadi = route.stops.filter(st => b[st.studentId] === 'Kelmadi').length;
    const mashina = route.transport
        ? [route.transport.model || route.transport.name, route.transport.number].filter(Boolean).join(' · ')
        : '';

    let matn = `🚌 <b>${escHtml(route.name)}</b> · ${sana}\n`;
    if (mashina) matn += `🚍 ${escHtml(mashina)}\n`;
    matn += `👥 ${route.stops.length} ta o'quvchi`;
    if (yetkazildi) matn += ` · ✅ ${yetkazildi}`;
    if (kelmadi) matn += ` · ❌ ${kelmadi}`;
    matn += '\n';
    // Yo'l haqi reja tuzilganda hisoblangan: haydovchi oldindan qancha olishini biladi.
    const pul = rejaPuli(route.stops, b);
    if (pul.jami > 0 || pul.aniqlanmagan < route.stops.length) {
        matn += `💰 Hammasini olib borsangiz: <b>${somMatni(pul.jami)} so'm</b> (naqd, o'quvchidan)`;
        if (pul.aniqlanmagan) matn += ` (${pul.aniqlanmagan} tasining narxi aniqlanmagan)`;
        matn += '\n';
        if (run?.startedAt && pul.olingan !== pul.jami) matn += `💵 Olib ketilganlar uchun: <b>${somMatni(pul.olingan)} so'm</b>\n`;
    }
    // Vaqt O'zbekiston bo'yicha: server UTC da ishlaydi.
    if (run?.startedAt) matn += `🚐 Qabul qilindi: ${toTimeStr(run.startedAt)}\n`;
    if (run?.finishedAt) matn += `🏁 Yetkazildi: ${toTimeStr(run.finishedAt)}\n`;
    matn += '\n';

    // Telegram xabari 4096 belgidan oshmasin: ro'yxat uzun bo'lsa oxirgilarining
    // manzili qisqaradi (ismi va tugmasi baribir bor).
    let qisqa = false;
    route.stops.forEach((st, idx) => {
        const s2 = st.student;
        let qator = `${holatBelgisi(b[st.studentId])} <b>${idx + 1}. ${escHtml(s2.name)}</b>`;
        if (st.narx !== null && st.narx !== undefined) qator += ` · 💰 ${somMatni(st.narx)}`;
        if (s2.phone) qator += ` · 📞 ${escHtml(s2.phone)}`;
        if (st.masofaKm !== null && st.masofaKm !== undefined) qator += ` · ${st.masofaKm} km`;
        qator += '\n';
        if (!qisqa && matn.length < 3300) {
            if (s2.address) qator += `   🏠 ${escHtml(s2.address)}\n`;
            if (s2.location) qator += `   🗺 https://www.google.com/maps?q=${encodeURIComponent(s2.location)}\n`;
        } else {
            qisqa = true;
        }
        matn += qator;
    });
    if (route.stops.length === 0) matn += "Bu rejada o'quvchi yo'q.\n";

    if (!run?.startedAt) {
        matn += `\nBolalarni mashinaga olgach <b>«Qabul qildim»</b> ni bosing. Chiqmagan bolani ro'yxatdan bosib ❌ qiling.`;
    } else if (!run?.finishedAt) {
        matn += `\nHammasini uyiga yetkazgach <b>«Yetkazdim»</b> ni bosing.`;
    }
    if (matn.length > 4000) matn = matn.slice(0, 3990) + '…';

    const tugmalar = route.stops.map((st, idx) => {
        // Ism qisqartiriladi: tugma matni telefon ekraniga sig'sin.
        const ism = st.student.name.length > 22 ? st.student.name.slice(0, 21) + '…' : st.student.name;
        return [Markup.button.callback(`${holatBelgisi(b[st.studentId])} ${idx + 1}. ${ism}`, `reys_h_${route.id}_${st.studentId}`)];
    });
    if (!run?.startedAt) {
        tugmalar.unshift([Markup.button.callback('✅ Qabul qildim — bolalar mashinada', `reys_bosh_${route.id}`)]);
    } else if (!run?.finishedAt) {
        tugmalar.unshift([Markup.button.callback('🏁 Yetkazdim — hammasi uyida', `reys_tugat_${route.id}`)]);
    }
    tugmalar.push([Markup.button.callback('🔄 Yangilash', `reys_yangi_${route.id}`)]);

    return { matn, tugmalar };
};

/** Jonli joylashuvni qanday yoqish — "Qabul qildim" dan keyin yuboriladi. */
const JOYLASHUV_YORDAM =
    "📍 Markaz sizni xaritada ko'rib tursin: pastdagi 📎 (skrepka) → «Joylashuv» → " +
    "«Jonli joylashuvni ulashish» ni tanlang (8 soat yoki «to'xtatmaguncha»). " +
    "Bir martalik joylashuv uchun pastdagi «📍 Joylashuvni yuborish» tugmasi.";

/**
 * Rejani haydovchiga Telegram orqali yuboradi (reja tuzilganda avtomatik).
 * @returns {Promise<{ok:boolean, sabab?:string}>}
 */
export async function rejaniHaydovchigaYuborish({ schoolId, routeId, sarlavha = '' }) {
    const route = await prisma.route.findFirst({ where: { id: routeId, schoolId }, include: REJA_INCLUDE });
    if (!route) return { ok: false, sabab: 'Reja topilmadi' };
    if (!route.driver?.telegramId) return { ok: false, sabab: 'Haydovchi botga ulanmagan' };
    const botInstance = await getTelegramBot(schoolId);
    if (!botInstance) return { ok: false, sabab: 'Telegram bot sozlanmagan' };

    const sana = route.date || toDateStr();
    const holat = await marshrutHolati({ routeId: route.id, date: sana });
    const { matn, tugmalar } = reysKorinishi(route, holat, sana);
    try {
        await botInstance.telegram.sendMessage(route.driver.telegramId, (sarlavha ? sarlavha + '\n\n' : '') + matn, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            ...Markup.inlineKeyboard(tugmalar),
        });
        return { ok: true };
    } catch (e) {
        return { ok: false, sabab: 'Telegram xabarni qabul qilmadi: ' + e.message };
    }
}

/** Reja bekor qilinganini haydovchiga aytadi (yuborilmasa jim). */
export async function rejaBekorXabari({ schoolId, telegramId, nomi }) {
    if (!telegramId) return;
    const botInstance = await getTelegramBot(schoolId);
    if (!botInstance) return;
    await botInstance.telegram.sendMessage(telegramId, `❌ «${nomi}» rejasi bekor qilindi.`).catch(() => {});
}

const getGuestMenu = () => Markup.keyboard([
    ['ℹ️ Markaz haqida', '📍 Geolokatsiya'],
    ['📝 Sinov darsiga yozilish', '📞 Kontaktlar']
]).resize();

/**
 * Markaz sozlamalari (nom, logotip, manzil, telefon) — bir necha marta so'ralgani
 * uchun qisqa muddatga eslab qolinadi.
 */
const settingsCache = new Map(); // schoolId -> { value, at }
const SETTINGS_TTL_MS = 5 * 60 * 1000;

const getSchoolSettings = async (schoolId) => {
    if (!schoolId) return null;
    const cached = settingsCache.get(schoolId);
    if (cached && Date.now() - cached.at < SETTINGS_TTL_MS) return cached.value;
    try {
        let value = await prisma.setting.findUnique({ where: { schoolId: Number(schoolId) } });
        // Yangi filialning o'z sozlamalari bo'lmasligi mumkin (Langar filialida
        // Setting qatori umuman yo'q edi): markaz nomi, logotip va manzil
        // tashkilotning sozlangan filialidan olinadi, aks holda bot nomsiz
        // "CRM botiga xush kelibsiz" deb salomlashardi.
        if (!value) {
            const ids = await orgSchoolIds(schoolId);
            for (const id of ids) {
                if (id === Number(schoolId)) continue;
                const other = await prisma.setting.findUnique({ where: { schoolId: id } });
                if (other) { value = other; break; }
            }
        }
        // Markaz nomi filialdan qat'iy nazar bitta (lib/markazBrendi.js).
        if (value) value = { ...value, orgName: await markazNomi(schoolId) };
        settingsCache.set(schoolId, { value, at: Date.now() });
        return value;
    } catch (e) {
        console.error('Sozlamalarni o' + String.fromCharCode(39) + 'qib bo' + String.fromCharCode(39) + 'lmadi:', e.message);
        return null;
    }
};

/**
 * Markaz logotipini rasm sifatida yuboradi; logotip yo'q bo'lsa oddiy matn.
 * Telegram data URL ni qabul qilmaydi, shuning uchun base64 bufferga aylantiriladi.
 */
const replyWithLogo = async (ctx, schoolId, caption, extra = {}) => {
    const settings = await getSchoolSettings(schoolId);
    const logo = settings && settings.logo;
    if (!logo) return ctx.reply(caption, extra);

    try {
        const options = Object.assign({ caption }, extra);
        if (logo.startsWith('data:')) {
            const base64 = logo.slice(logo.indexOf(',') + 1);
            return await ctx.replyWithPhoto({ source: Buffer.from(base64, 'base64') }, options);
        }
        return await ctx.replyWithPhoto(logo, options);
    } catch (e) {
        // Rasm yuborilmasa xabarning o'zi baribir yetib borsin.
        console.error('Logotipni yuborib bo' + String.fromCharCode(39) + 'lmadi:', e.message);
        return ctx.reply(caption, extra);
    }
};

// ---------------------------------------------------------------------------
// Bitta bot — butun o'quv markazi (2026-09-22).
//
// Muammo: bot filiallarda ishlamasdi. Markazda bitta Telegram boti bor va
// uning webhook'i bitta filialga (Sariosiyo, id 1) bog'langan; Telegram esa
// bitta botga bitta webhook manzilidan ortig'iga ruxsat bermaydi. Shuning
// uchun Langar filialidagi o'quvchi, ota-ona, ustoz va haydovchi botdan
// umuman foydalana olmasdi: har bir so'rov `schoolId: 1` bilan qidirilardi
// va ular topilmasdi ("Bu raqam tizimda topilmadi").
//
// Endi bot tashkilotning barcha filiallarida qidiradi va kim yozganiga
// qarab o'sha odamning filialida ishlaydi — yozuvlar (davomat, to'lov
// buyurtmasi) ham o'sha filialga tushadi.
// ---------------------------------------------------------------------------

const orgCache = new Map();   // schoolId -> { ids, at }
const ORG_TTL_MS = 10 * 60 * 1000;

/** Shu filial va uning tashkilotdagi barcha "aka-uka" filiallari. O'zi birinchi. */
export const orgSchoolIds = async (schoolId) => {
    const own = Number(schoolId);
    if (!own) return [];
    const hit = orgCache.get(own);
    if (hit && Date.now() - hit.at < ORG_TTL_MS) return hit.ids;
    let ids = [own];
    try {
        const row = await prisma.school.findUnique({ where: { id: own }, select: { organizationId: true } });
        if (row?.organizationId) {
            const rows = await prisma.school.findMany({
                where: { organizationId: row.organizationId },
                select: { id: true },
            });
            ids = [own, ...rows.map(r => r.id).filter(id => id !== own)];
        }
    } catch (e) {
        console.error('[bot] filiallar ro' + String.fromCharCode(39) + 'yxati:', e.message);
    }
    orgCache.set(own, { ids, at: Date.now() });
    return ids;
};

/**
 * Filiallar bo'ylab birinchi mos yozuv. Tartib muhim: bot o'z filialidan
 * boshlaydi, shuning uchun bir xil telefon ikki filialda bo'lsa o'z filiali
 * ustun turadi.
 */
export const findAcross = async (model, where, ids) => {
    for (const id of ids) {
        const row = await prisma[model].findFirst({ where: { ...where, schoolId: id } });
        if (row) return row;
    }
    return null;
};

/** "BOBORAJABOV QILICHBEK" → "Boborajabov Qilichbek", ortiqcha bo'shliqlar olinadi. */
const ismKor = (name) => {
    const n = String(name || '').replace(/\s+/g, ' ').trim();
    if (n !== n.toUpperCase()) return n;
    return n.toLowerCase().replace(/(^|[\s-])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
};

/** Telefonning oxirgi 9 raqami (ro'yxatdan o'tishdagi kabi); qisqa bo'lsa — ''. */
const oxirgi9 = (v) => {
    const d = String(v || '').replace(/\D/g, '');
    return d.length >= 9 ? d.slice(-9) : '';
};

/**
 * Shu Telegram hisobiga tegishli HAMMA bolalar (egasi, 2026-09-26: "2 ta
 * yoki ko'proq farzandi bo'lsa telegramda hammasi chiqsin — bittasining
 * otasi ekansiz emas, farzandlaringiz deb").
 *
 * Ilgari ro'yxatdan o'tishda raqam bo'yicha BIRINCHI topilgan bola bog'lanardi
 * va bot faqat uni ko'rsatardi. Endi: bog'langan bolalar, hamda o'sha raqam
 * ota/ona (yoki o'quvchi) raqami bo'lib turgan boshqa bolalar — aka-uka keyin
 * qo'shilgan bo'lsa ham. Otasi/onasi raqami mos kelgan va hali hech kimga
 * bog'lanmagan bola shu hisobga bog'lanadi, shunda davomat va to'lov xabarlari
 * ham unga yetib boradi.
 *
 * @returns {null | { type: 'student'|'parent_father'|'parent_mother', data, farzandlar }}
 *          data — birinchi farzand (eski kod uchun), farzandlar — alifbo tartibida.
 */
const oilaniTop = async (tidStr, ids) => {
    const boglangan = await prisma.student.findMany({
        where: { schoolId: { in: ids }, OR: [{ telegramId: tidStr }, { fatherTelegramId: tidStr }, { motherTelegramId: tidStr }] },
    });
    if (!boglangan.length) return null;
    const type = boglangan.some(s => s.fatherTelegramId === tidStr) ? 'parent_father'
        : boglangan.some(s => s.motherTelegramId === tidStr) ? 'parent_mother' : 'student';

    const raqamlar = new Set();
    for (const s of boglangan) {
        if (s.telegramId === tidStr) raqamlar.add(oxirgi9(s.phone));
        if (s.fatherTelegramId === tidStr) raqamlar.add(oxirgi9(s.fatherPhone));
        if (s.motherTelegramId === tidStr) raqamlar.add(oxirgi9(s.motherPhone));
    }
    raqamlar.delete('');

    let farzandlar = [...boglangan];
    if (raqamlar.size) {
        const OR = [];
        for (const r of raqamlar) OR.push({ phone: { contains: r } }, { fatherPhone: { contains: r } }, { motherPhone: { contains: r } });
        const qarindoshlar = await prisma.student.findMany({
            where: { schoolId: { in: ids }, id: { notIn: boglangan.map(s => s.id) }, OR },
        });
        for (const s of qarindoshlar) {
            const ota = raqamlar.has(oxirgi9(s.fatherPhone));
            const ona = raqamlar.has(oxirgi9(s.motherPhone));
            if (!ota && !ona && !raqamlar.has(oxirgi9(s.phone))) continue; // raqam o'rtasida mos kelgan
            const data = {};
            if (ota && !s.fatherTelegramId) data.fatherTelegramId = tidStr;
            else if (ona && !s.motherTelegramId) data.motherTelegramId = tidStr;
            if (data.fatherTelegramId || data.motherTelegramId) {
                await prisma.student.update({ where: { id: s.id }, data }).catch(() => {});
                Object.assign(s, data);
            }
            farzandlar.push(s);
        }
    }
    // Arxivdagi bola ro'yxatni to'ldirmasin — faqat hammasi arxivda bo'lsa ko'rinadi.
    const faol = farzandlar.filter(s => s.status !== 'Arxiv');
    if (faol.length) farzandlar = faol;
    farzandlar.sort((a, b) => ismKor(a.name).localeCompare(ismKor(b.name), 'uz'));
    return { type, data: farzandlar[0], farzandlar };
};

/** O'quvchi yoki ota-ona hisobimi (o'quvchi menyusi). */
const oilami = (user) => !!user && (user.type === 'student' || user.type.startsWith('parent_'));

/** "1. Ali\n2. Vali" */
const farzandlarRoyxati = (farzandlar) => farzandlar.map((s, i) => `${i + 1}. ${ismKor(s.name)}`).join('\n');

/** Salom va ro'yxatdan o'tish matni: bitta bola — ismi, bir nechta — hammasi. */
const oilaMatni = (user, boshi) => {
    const f = user.farzandlar || [user.data];
    if (f.length > 1) return `${boshi}\n\n👨‍👩‍👧‍👦 Farzandlaringiz:\n${farzandlarRoyxati(f)}\n\nMenyudagi har bir bo'limda hammasi ko'rsatiladi.`;
    const s = f[0];
    if (user.type === 'parent_father') return `${boshi}\n\nFarzandingiz: ${ismKor(s.name)}${s.fatherName ? `\nOtasi: ${s.fatherName}` : ''}`;
    if (user.type === 'parent_mother') return `${boshi}\n\nFarzandingiz: ${ismKor(s.name)}${s.motherName ? `\nOnasi: ${s.motherName}` : ''}`;
    return `${boshi}\n\nO'quvchi: ${ismKor(s.name)}`;
};

// Helper to find user by telegramId — tashkilotning hamma filialida
const findUser = async (tid, schoolId) => {
    const tidStr = String(tid);
    const ids = await orgSchoolIds(schoolId);
    if (!ids.length) return null;

    // O'quvchi yoki ota-ona — bog'langan hamma bolalari bilan.
    const oila = await oilaniTop(tidStr, ids);
    if (oila) return oila;

    const teacher = await findAcross('teacher', { telegramId: tidStr }, ids);
    if (teacher) return { type: 'teacher', data: teacher };

    // Xodimning ikkinchi raqami ham o'z Telegram hisobi bilan (telegramId2).
    const user = await findAcross('user', { OR: [{ telegramId: tidStr }, { telegramId2: tidStr }] }, ids);
    // Arxivdagi xodim botda ham xodim emas.
    if (user && user.status !== 'Arxiv') {
        if (user.role === 'DRIVER') return { type: 'driver', data: user };
        return { type: 'admin', data: user };
    }

    return null;
};

// Setup handlers for a specific bot instance and schoolId
export const setupBotHandlers = (botInstance, botSchoolId) => {
    /**
     * Shu yangilanish qaysi filialda bajarilishi kerak: yozgan odam qaysi
     * filialda bo'lsa — o'sha. Topilmasa (hali ro'yxatdan o'tmagan mehmon)
     * botning o'z filiali. Bitta yangilanish uchun bir marta hisoblanadi.
     */
    const filial = async (ctx) => {
        if (!ctx.state) ctx.state = {};
        if (ctx.state.filialId === undefined) {
            let id = botSchoolId;
            try {
                const u = ctx.from ? await findUser(ctx.from.id, botSchoolId) : null;
                if (u?.data?.schoolId) id = u.data.schoolId;
            } catch (e) {
                console.error('[bot] filialni aniqlab bo' + String.fromCharCode(39) + 'lmadi:', e.message);
            }
            ctx.state.filialId = id;
        }
        return ctx.state.filialId;
    };

    botInstance.catch((err, ctx) => {
        console.error(`Telegram Bot xatosi (${ctx.updateType}) [School: ${botSchoolId}]:`, err);
    });

    // Klik to'lovini administrator Telegram'da tasdiqlaydi / rad etadi va
    // ota-ona "🆔 ID raqam" bilan farzandining ID sini so'raydi.
    registerKlikTasdiq(botInstance, { findUser, filial });

    // Qarz eslatmasidagi "✅ To'laganman": ota-ona izoh yoki chek rasmini
    // yuboradi, xodim CRM da tekshiradi (src/bot/qarzJavob.js).
    registerQarzJavob(botInstance, { findUser, filial });

    botInstance.start(async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (user) {
            let menu;
            let greeting = `Xush kelibsiz, ${user.data.name}!`;

            if (oilami(user)) {
                menu = getStudentMenu();
                greeting = user.type === 'student' && user.farzandlar.length === 1
                    ? `Xush kelibsiz, ${ismKor(user.data.name)}!`
                    : oilaMatni(user, 'Xush kelibsiz!');
            } else if (user.type === 'teacher') {
                menu = getTeacherMenu();
            } else if (user.type === 'admin') {
                menu = getAdminMenu(await xodimRuxsati(user.data));
            } else if (user.type === 'driver') {
                menu = getDriverMenu();
            }

            return replyWithLogo(ctx, schoolId, greeting, menu);
        }

        const settings = await getSchoolSettings(schoolId);
        const NL = String.fromCharCode(10);
        const welcome = ((settings && settings.orgName) || 'CRM') +
            ' botiga xush kelibsiz!' + NL + NL +
            'Tizimdan foydalanish uchun telefon raqamingizni yuboring:';

        return replyWithLogo(ctx, schoolId, welcome, Markup.keyboard([
            [Markup.button.contactRequest('📱 Telefon raqamni yuborish')]
        ]).resize());
    });

    const logoutHandler = async (ctx) => {
        const schoolId = await filial(ctx);
        const tidStr = String(ctx.from.id);
        const scWhere = schoolId ? { schoolId } : {};

        await Promise.all([
            prisma.student.updateMany({ where: { telegramId: tidStr, ...scWhere }, data: { telegramId: null } }),
            prisma.student.updateMany({ where: { fatherTelegramId: tidStr, ...scWhere }, data: { fatherTelegramId: null } }),
            prisma.student.updateMany({ where: { motherTelegramId: tidStr, ...scWhere }, data: { motherTelegramId: null } }),
            prisma.teacher.updateMany({ where: { telegramId: tidStr, ...scWhere }, data: { telegramId: null } }),
            prisma.user.updateMany({ where: { telegramId: tidStr, ...scWhere }, data: { telegramId: null } }),
            prisma.user.updateMany({ where: { telegramId2: tidStr, ...scWhere }, data: { telegramId2: null } })
        ]);
        ctx.reply("Hisobingiz botdan uzildi. Endi qaytadan ro'yxatdan o'tishingiz mumkin ( /start bosib).", Markup.keyboard([
            [Markup.button.contactRequest('📱 Telefon raqamni yuborish')]
        ]).resize());
    };

    botInstance.command('logout', logoutHandler);
    botInstance.hears('🚪 Chiqish', logoutHandler);

    botInstance.on('contact', async (ctx) => {
        const schoolId = await filial(ctx);
        // Faqat o'z raqami: begona kontaktni yuborib, boshqaning farzandiga
        // (to'lovlari, davomati) ulanib olish mumkin edi.
        if (ctx.message.contact.user_id && ctx.message.contact.user_id !== ctx.from.id) {
            return ctx.reply("Iltimos, pastdagi «📱 Telefon raqamni yuborish» tugmasi bilan o'z raqamingizni yuboring.", Markup.keyboard([
                [Markup.button.contactRequest('📱 Telefon raqamni yuborish')]
            ]).resize());
        }
        const phone = ctx.message.contact.phone_number.replace('+', '').trim();
        const tid = String(ctx.from.id);
        const phoneSuffix = phone.slice(-9);

        // telegramId maydonlari unique. Shu Telegram hisobi ilgari boshqa
        // yozuvga bog'langan bo'lsa (masalan avval o'qituvchi, endi ota),
        // yangi bog'lanish baza cheklovi tufayli jimgina uzilib qolardi va
        // CRM da ulanish ko'rinmasdi. Avval eski bog'lanishni bo'shatamiz.
        await Promise.all([
            prisma.student.updateMany({ where: { telegramId: tid }, data: { telegramId: null } }),
            prisma.student.updateMany({ where: { fatherTelegramId: tid }, data: { fatherTelegramId: null } }),
            prisma.student.updateMany({ where: { motherTelegramId: tid }, data: { motherTelegramId: null } }),
            prisma.teacher.updateMany({ where: { telegramId: tid }, data: { telegramId: null } }),
            prisma.user.updateMany({ where: { telegramId: tid }, data: { telegramId: null } }),
            prisma.user.updateMany({ where: { telegramId2: tid }, data: { telegramId2: null } })
        ]);

        // Ro'yxatdan o'tishda odam hali hech qaysi yozuvga bog'lanmagan —
        // shuning uchun raqam tashkilotning hamma filialida qidiriladi.
        const ids = await orgSchoolIds(schoolId);

        // O'quvchi, ota yoki ona — shu raqamdagi HAMMA bolalar. Ilgari faqat
        // birinchi topilgani bog'lanardi: aka-ukaning ikkinchisi botda ham,
        // xabarlarda ham yo'q edi. Ota (ona) raqami mos kelgan har bir bola
        // shu hisobga bog'lanadi; o'quvchining o'z raqami (telegramId noyob) —
        // faqat ota/ona sifatida topilmaganda, birinchisiga.
        // Raqamlar turlicha yozilgan ("+998 90 123-45-67") — bazadagi "contains"
        // ularni topmasdi, shuning uchun oxirgi 9 raqam JS da solishtiriladi.
        const mos = (await prisma.student.findMany({
            where: { schoolId: { in: ids } },
            select: { id: true, schoolId: true, phone: true, fatherPhone: true, motherPhone: true },
            orderBy: { id: 'asc' },
        }))
            .filter(s => [s.phone, s.fatherPhone, s.motherPhone].some(v => oxirgi9(v) === phoneSuffix))
            .sort((a, b) => ids.indexOf(a.schoolId) - ids.indexOf(b.schoolId));
        const otasi = mos.filter(s => oxirgi9(s.fatherPhone) === phoneSuffix);
        const onasi = mos.filter(s => oxirgi9(s.motherPhone) === phoneSuffix && !otasi.includes(s));
        const ozi = mos.filter(s => oxirgi9(s.phone) === phoneSuffix);
        if (otasi.length || onasi.length || ozi.length) {
            for (const s of otasi) await prisma.student.update({ where: { id: s.id }, data: { fatherTelegramId: tid } });
            for (const s of onasi) await prisma.student.update({ where: { id: s.id }, data: { motherTelegramId: tid } });
            if (!otasi.length && !onasi.length) await prisma.student.update({ where: { id: ozi[0].id }, data: { telegramId: tid } });
            const oila = await oilaniTop(tid, ids);
            if (oila) {
                const boshi = oila.type === 'parent_father' ? "Siz ota sifatida ro'yxatdan o'tdingiz."
                    : oila.type === 'parent_mother' ? "Siz ona sifatida ro'yxatdan o'tdingiz."
                    : oila.farzandlar.length > 1 ? "Siz ota-ona sifatida ro'yxatdan o'tdingiz." : "Siz o'quvchi sifatida ro'yxatdan o'tdingiz.";
                return ctx.reply(oilaMatni(oila, boshi), getStudentMenu());
            }
        }

        // Try to find as teacher
        let teacher = await findAcross('teacher', { phone: { contains: phoneSuffix } }, ids);
        if (teacher) {
            await prisma.teacher.update({ where: { id: teacher.id }, data: { telegramId: tid } });
            return ctx.reply(`Siz o'qituvchi sifatida ro'yxatdan o'tdingiz: ${teacher.name}`, getTeacherMenu());
        }

        // Try to find in users (Admin/Manager/Receptionist)
        // Ikkinchi raqam (phone2) bo'yicha ham: u telegramId2 ga bog'lanadi —
        // bitta xodimga ikki Telegram (masalan administratorning ikki telefoni).
        let user = await findAcross('user', { OR: [{ phone: { contains: phoneSuffix } }, { phone2: { contains: phoneSuffix } }] }, ids);
        if (user) {
            const ikkinchi = !String(user.phone || '').replace(/\D/g, '').includes(phoneSuffix);
            await prisma.user.update({ where: { id: user.id }, data: ikkinchi ? { telegramId2: tid } : { telegramId: tid } });
            const menu = user.role === 'DRIVER' ? getDriverMenu() : getAdminMenu(await xodimRuxsati(user));
            return ctx.reply(`Siz xodim sifatida ro'yxatdan o'tdingiz: ${user.name}`, menu);
        }

        ctx.reply("Kechirasiz, ushbu raqam tizimda topilmadi. Ma'lumot olish uchun mehmon menyusidan foydalaning.", getGuestMenu());
    });

    // Student Handlers
    //
    // O'quvchi menyusi ota-onaga ham xizmat qiladi. Bir nechta farzandi bo'lsa
    // har bo'limda hammasi — har biri o'z ismi ostida (user.farzandlar).

    /** Farzand sarlavhasi — bir nechta bo'lsa ismi, bitta bo'lsa hech narsa. */
    const farzandSarlavhasi = (user, s) => (user.farzandlar.length > 1 ? `👤 <b>${escHtml(ismKor(s.name))}</b>\n` : '');

    /** Telegram 4096 belgidan uzun xabarni qabul qilmaydi. */
    const qisqart = (matn) => (matn.length > 4000 ? matn.slice(0, 3990) + '…' : matn);

    botInstance.hears('📅 Dars Jadvali', async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!oilami(user)) return;

        const bolalar = await prisma.student.findMany({
            where: { id: { in: user.farzandlar.map(f => f.id) } },
            include: { groups: { include: { teacher: true, course: true, roomRel: true } } }
        });
        const tartib = user.farzandlar.map(f => bolalar.find(b => b.id === f.id)).filter(Boolean);
        if (tartib.every(s => s.groups.length === 0)) {
            return ctx.reply(user.farzandlar.length > 1 ? "Farzandlaringiz hali hech qaysi kursga yozilmagan." : "Hali hech qaysi kursga yozilmagansiz.");
        }

        let msg = user.farzandlar.length > 1 ? "📅 <b>Farzandlaringizning dars jadvali</b>\n\n" : "📅 <b>Dars jadvali</b>\n\n";
        for (const s of tartib) {
            msg += farzandSarlavhasi(user, s);
            if (s.groups.length === 0) { msg += "Hozircha kursga yozilmagan\n\n"; continue; }
            s.groups.forEach(g => {
                msg += `🔹 ${escHtml(g.name)}${g.course?.name && g.course.name !== g.name ? ` (${escHtml(g.course.name)})` : ''}\n`;
                msg += `🕒 ${escHtml(g.schedule || '')} | ${escHtml(g.days || '')}\n`;
                if (g.teacher?.name) msg += `👨‍🏫 Ustoz: ${escHtml(g.teacher.name)}\n`;
                msg += `🚪 Xona: ${escHtml(g.roomRel?.name || "Noma'lum")}\n\n`;
            });
        }
        ctx.reply(qisqart(msg), { parse_mode: 'HTML' });
    });

    botInstance.hears('💳 To\'lovlar', async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!oilami(user)) return;

        const bolalar = await prisma.student.findMany({
            where: { id: { in: user.farzandlar.map(f => f.id) } },
            include: { payments: { take: 5, orderBy: { id: 'desc' } } }
        });
        const tartib = user.farzandlar.map(f => bolalar.find(b => b.id === f.id)).filter(Boolean);
        const kop = tartib.length > 1;

        let msg = '';
        const tugmalar = [];
        for (const student of tartib) {
            msg += farzandSarlavhasi(user, student);
            msg += `💰 ${kop ? 'Balans' : 'Joriy balansingiz'}: ${student.balance.toLocaleString()} UZS\n`;
            msg += "💳 Oxirgi to'lovlar:\n";
            if (student.payments.length === 0) {
                msg += "Hech qanday to'lov topilmadi.\n";
            } else {
                student.payments.forEach(p => {
                    msg += `▫️ ${p.date}: ${p.amount.toLocaleString()} (${escHtml(p.type)})\n`;
                });
            }

            // Payme jonli rejimda ulangan bo'lsa — shu yerdan to'lash mumkin.
            // Kesh emas, to'g'ridan-to'g'ri: admin rejimni o'zgartirsa darhol ko'rinsin.
            // Payme filialniki — farzand qaysi filialda o'qisa, o'shaniki.
            const paymeSettings = await paymeLoadSettings(student.schoolId || schoolId);
            if (paymeIsConfigured(paymeSettings) && paymeSettings.paymeMode === 'live') {
                // Payme ilovasidan to'lash uchun faqat o'quvchi ID si kerak: pul
                // balansga tushadi, kurs so'ralmaydi va ko'rsatilmaydi (2026-09-23).
                // Payme ID — 5 xonali o'quvchi ID si (services/oquvchiKod.js), telefon emas.
                msg += `\u{1F194} Payme ilovasida o'quvchi ID: <b>${(await paymePayIdFor(student.id)) || '—'}</b>\n`;
                tugmalar.push([Markup.button.callback(
                    kop ? `💳 ${ismKor(student.name).slice(0, 28)} — Payme` : "💳 Payme orqali to'lash",
                    kop ? `payme_k_${student.id}` : 'payme_start'
                )]);
            }
            msg += '\n';
        }
        ctx.reply(qisqart(msg.trim()), { parse_mode: 'HTML', ...(tugmalar.length ? Markup.inlineKeyboard(tugmalar) : {}) });
    });

    // --- Payme: summa → havola -----------------------------------------------
    // 2026-09-23 dan pul faqat balansga tushadi: ota-ona kurs tanlamaydi.
    // Eski xabarlardagi kursli tugmalar (payme_c_/payme_a_/payme_o_) ham
    // ishlayveradi — kurs raqami e'tiborsiz qoldiriladi.
    //
    // Bir nechta farzand: tugmalarda farzand raqami bor (payme_k_<id>,
    // payme_sb_<id>_<summa>, payme_sob_<id>); faqat o'z farzandi qabul qilinadi.
    // Raqamsiz eski tugmalar birinchi farzandga (ilgarigidek).

    const paymeStudent = async (ctx, studentId) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!oilami(user)) return null;
        if (studentId) return user.farzandlar.find(f => f.id === studentId) || null;
        return user.data;
    };

    /** Farzand tanlash — bir nechta bo'lsa. */
    const paymeFarzandTanlash = async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!oilami(user)) return false;
        if (user.farzandlar.length < 2) return false;
        await ctx.reply("Qaysi farzandingiz uchun to'laysiz?", Markup.inlineKeyboard(
            user.farzandlar.map(s => [Markup.button.callback(`💳 ${ismKor(s.name).slice(0, 40)}`, `payme_k_${s.id}`)])
        ));
        return true;
    };

    const paymeSendLink = async (ctx, student, amount) => {
        const schoolId = student.schoolId || await filial(ctx);
        const r = await paymeCreateOrder({
            schoolId, studentId: student.id, groupId: null, amount,
            source: 'bot', chatId: ctx.chat.id,
            returnBase: (process.env.APP_URL || '').replace(/\/+$/, ''),
        });
        if (r.error) return ctx.reply(`❌ ${r.error}`);
        return ctx.reply(
            `💳 To'lov: ${somFmt(amount)} so'm\n\nTugmani bosib Payme sahifasida to'lang. Havola 7 kun amal qiladi; to'lov o'tgach shu yerga xabar keladi.`,
            Markup.inlineKeyboard([[Markup.button.url("💳 Payme orqali to'lash", r.url)]])
        );
    };

    /** kop — ota-onaning bir nechta farzandi bor: qaysi biri ekani yoziladi. */
    const paymeBalanceMenu = async (ctx, student, kop = false) => {
        const ledger = await studentLedger(student.id);
        const kurslar = ledger.courses.filter(c => c.isMember);
        if (!kurslar.length) {
            return ctx.reply(kop
                ? `${ismKor(student.name)} hozir hech qaysi kursda emas — to'lov uchun markazga murojaat qiling.`
                : "Siz hozir hech qaysi kursda emassiz — to'lov uchun markazga murojaat qiling.");
        }
        const debt = Math.max(0, Math.round(ledger.debt || 0));
        const oylik = kurslar.reduce((a, c) => a + (c.monthlyPrice || 0), 0);
        const rows = [];
        if (debt >= PAYME_MIN && debt <= PAYME_MAX) rows.push([Markup.button.callback(`Qarzni yopish — ${somFmt(debt)} so'm`, `payme_sb_${student.id}_${debt}`)]);
        if (oylik >= PAYME_MIN && oylik <= PAYME_MAX && oylik !== debt) rows.push([Markup.button.callback(`Oylik to'lov — ${somFmt(oylik)} so'm`, `payme_sb_${student.id}_${oylik}`)]);
        rows.push([Markup.button.callback('✏️ Boshqa summa', `payme_sob_${student.id}`)]);
        let info = kop ? `👤 ${ismKor(student.name)}\n` : '';
        info += `💰 Qarz: ${somFmt(debt)} so'm\n`;
        if (ledger.wallet > 0) info += `Balansda: ${somFmt(ledger.wallet)} so'm\n`;
        info += `Oylik: ${somFmt(oylik)} so'm\n`;
        return ctx.reply(info + "\nPul balansga tushadi. Summani tanlang:", Markup.inlineKeyboard(rows));
    };

    // Javob belgisi "· B" (bitta farzand) yoki "· B<id>" (qaysi farzand).
    const paymeAskAmount = (ctx, studentId) => ctx.reply(
        `✏️ Summani so'mda yozing (masalan: 500000)\n· B${studentId || ''}`,
        { reply_markup: { force_reply: true, input_field_placeholder: '500000', selective: true } }
    );

    /** Farzandning filialida Payme jonli ulanganmi. */
    const paymeJonli = async (student) => {
        const s = await paymeLoadSettings(student.schoolId);
        return paymeIsConfigured(s) && s.paymeMode === 'live';
    };

    botInstance.action('payme_start', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        // Eski xabardagi tugma: bir nechta farzand bo'lsa — avval tanlash.
        if (await paymeFarzandTanlash(ctx)) return;
        const student = await paymeStudent(ctx);
        if (!student) return;
        if (!(await paymeJonli(student))) return ctx.reply("Payme orqali to'lov hozircha ulanmagan.");
        return paymeBalanceMenu(ctx, student);
    });

    botInstance.action(/^payme_k_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const student = await paymeStudent(ctx, parseInt(ctx.match[1]));
        if (!student) return ctx.reply("Bu o'quvchi sizning farzandlaringiz ro'yxatida yo'q.");
        if (!(await paymeJonli(student))) return ctx.reply("Payme orqali to'lov hozircha ulanmagan.");
        return paymeBalanceMenu(ctx, student, true);
    });

    botInstance.action(/^payme_sb_(\d+)_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const student = await paymeStudent(ctx, parseInt(ctx.match[1]));
        if (!student) return;
        return paymeSendLink(ctx, student, parseInt(ctx.match[2]));
    });

    botInstance.action(/^payme_sob_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const student = await paymeStudent(ctx, parseInt(ctx.match[1]));
        if (!student) return;
        return paymeAskAmount(ctx, student.id);
    });

    botInstance.action(/^payme_c_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const student = await paymeStudent(ctx);
        if (!student) return;
        return paymeBalanceMenu(ctx, student);
    });

    // Summa tugma ichidan keladi; createOrder uni chegaralarga tekshiradi.
    botInstance.action(/^payme_b_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const student = await paymeStudent(ctx);
        if (!student) return;
        return paymeSendLink(ctx, student, parseInt(ctx.match[1]));
    });

    botInstance.action(/^payme_a_(\d+)_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const student = await paymeStudent(ctx);
        if (!student) return;
        return paymeSendLink(ctx, student, parseInt(ctx.match[2]));
    });

    botInstance.action(/^payme_o(?:b|_\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const student = await paymeStudent(ctx);
        if (!student) return;
        return paymeAskAmount(ctx);
    });

    // Holat nomi odam tilida: bazadagi "Kelmapdi" / "ErtaKetdi" ota-onaga ko'rinmasin.
    const DAVOMAT_BELGI = { Keldi: '✅', Kelmapdi: '❌', Kelmadi: '❌', Sababli: '⚠️', Kechikdi: '⏰', ErtaKetdi: '🏃', "Dars bo'lmadi": '🚫' };
    const DAVOMAT_NOMI = { Keldi: 'keldi', Kelmapdi: 'kelmadi', Kelmadi: 'kelmadi', Sababli: 'sababli', Kechikdi: 'kechikdi', ErtaKetdi: 'erta ketdi', "Dars bo'lmadi": "dars bo'lmadi" };
    const sanaQisqa = (d) => String(d || '').split('-').reverse().join('.');

    botInstance.hears('✅ Davomat', async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!oilami(user)) return;

        // Farzand boshqa filialda o'qishi mumkin — faqat o'quvchi bo'yicha.
        const kop = user.farzandlar.length > 1;
        let msg = kop ? "📊 <b>Farzandlaringizning oxirgi davomati</b>\n\n" : "📊 <b>Oxirgi davomat holati</b>\n\n";
        let bor = false;
        for (const s of user.farzandlar) {
            const attendances = await prisma.attendance.findMany({
                where: { studentId: s.id },
                take: kop ? 7 : 10,
                orderBy: [{ date: 'desc' }, { id: 'desc' }],
                include: { group: { select: { name: true } } }
            });
            msg += farzandSarlavhasi(user, s);
            if (!attendances.length) { msg += "Davomat ma'lumotlari yo'q\n\n"; continue; }
            bor = true;
            attendances.forEach(a => {
                msg += `${DAVOMAT_BELGI[a.status] || '▫️'} ${sanaQisqa(a.date)} · ${escHtml(a.group?.name || '')} — ${DAVOMAT_NOMI[a.status] || escHtml(a.status)}\n`;
            });
            msg += '\n';
        }
        if (!bor) return ctx.reply("Davomat ma'lumotlari topilmadi.");
        ctx.reply(qisqart(msg.trim()), { parse_mode: 'HTML' });
    });

    botInstance.hears('📊 Baholar', async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!oilami(user)) return;

        const kop = user.farzandlar.length > 1;
        let msg = kop ? "📊 <b>Farzandlaringizning oxirgi baholari</b>\n\n" : "📊 <b>Oxirgi baholaringiz</b>\n\n";
        let bor = false;
        for (const s of user.farzandlar) {
            const scores = await prisma.score.findMany({
                where: { studentId: s.id },
                take: 10,
                orderBy: { id: 'desc' }
            });
            msg += farzandSarlavhasi(user, s);
            if (!scores.length) { msg += "Hozircha baho yo'q\n\n"; continue; }
            bor = true;
            scores.forEach(sc => { msg += `▫️ ${sanaQisqa(sc.date)}: ${sc.value} ball\n`; });
            msg += '\n';
        }
        if (!bor) return ctx.reply("Hozircha baholar mavjud emas.");
        ctx.reply(qisqart(msg.trim()), { parse_mode: 'HTML' });
    });

    // Imtihonlar: yaqin imtihon — sana, vaqt, xona va o'rin (ruxsatnoma bilan
    // bir xil); e'lon qilingan natijalar — ball, o'rin va natija sahifasi Mini
    // App bo'lib ochiladigan tugma. Faqat e'lon qilingan natija ko'rinadi.
    // Bir nechta farzand — har biriga alohida xabar (o'z tugmalari bilan).
    const imtihonlarniKorsat = async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!oilami(user)) return;
        let yuborildi = 0;
        for (const f of user.farzandlar) {
            if (await farzandImtihonlari(ctx, f, user.farzandlar.length > 1)) yuborildi++;
        }
        if (!yuborildi) return ctx.reply("📝 Hozircha imtihon yo'q.");
    };

    /** Bitta o'quvchining imtihonlari. Hech narsa bo'lmasa — false. */
    const farzandImtihonlari = async (ctx, farzand, kop) => {
        const studentId = farzand.id;
        const [orinlar, natijalar] = await Promise.all([
            prisma.examSeat.findMany({
                where: { studentId, exam: { date: { gte: toDateStr() }, publishedAt: null } },
                include: { exam: { select: { name: true, date: true, settings: true } } },
                orderBy: { exam: { date: 'asc' } },
                take: 3,
            }),
            prisma.examResult.findMany({
                where: { studentId, exam: { publishedAt: { not: null } } },
                include: { exam: { select: { id: true, name: true, date: true, maxScore: true, settings: true } } },
                orderBy: { scannedAt: 'desc' },
                take: 5,
            }),
        ]);
        if (!orinlar.length && !natijalar.length) return false;

        const roomIds = [...new Set(orinlar.map(o => o.roomId).filter(Boolean))];
        const rooms = roomIds.length ? await prisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, name: true, schoolId: true } }) : [];
        const schools = rooms.length ? await prisma.school.findMany({ where: { id: { in: [...new Set(rooms.map(r => r.schoolId))] } }, select: { id: true, name: true } }) : [];
        const soni = natijalar.length ? await prisma.examResult.groupBy({ by: ['examId'], where: { examId: { in: natijalar.map(r => r.examId) } }, _count: { _all: true } }) : [];
        const jami = new Map(soni.map(x => [x.examId, x._count._all]));

        let matn = kop ? `📝 <b>Imtihonlar — ${escHtml(ismKor(farzand.name))}</b>\n` : '📝 <b>Imtihonlar</b>\n';
        if (orinlar.length) {
            matn += '\n<b>Yaqin imtihon</b>\n';
            for (const o of orinlar) {
                const s = sozlamaniTozala(o.exam.settings);
                const smena = s.sessions.find(x => x.id === o.session);
                const room = rooms.find(r => r.id === o.roomId);
                matn += `🗓 <b>${escHtml(o.exam.name)}</b> — ${sanaMatni(o.exam.date)}\n`;
                if (smena?.time) matn += `⏰ Soat ${smena.time}${s.sessions.length > 1 ? ` (${escHtml(smena.name)})` : ''}\n`;
                matn += room
                    ? `🚪 ${escHtml([schools.find(x => x.id === room.schoolId)?.name, room.name].filter(Boolean).join(', '))}, ${o.row + 1}-qator, ${o.col + 1}-o'rin\n`
                    : "🚪 O'rin hali belgilanmagan\n";
            }
        }
        if (natijalar.length) {
            matn += '\n<b>Natijalar</b>\n';
            for (const r of natijalar) {
                const s = sozlamaniTozala(r.exam.settings);
                let orin = '';
                if (r.rank && (s.ranking === 'hammasi' || (s.ranking === 'top' && r.rank <= s.topN))) {
                    orin = s.ranking === 'hammasi' ? ` · 🏆 ${r.rank}/${jami.get(r.examId) || '?'}` : ` · 🏆 ${r.rank}-o'rin`;
                }
                const rasch = r.raschScore != null ? `, Rasch ${vergul(r.raschScore)}${r.grade ? ` (${escHtml(r.grade)})` : ''}` : '';
                matn += `▫️ <b>${escHtml(r.exam.name)}</b> (${sanaMatni(r.exam.date)}): ${vergul(r.score)} / ${vergul(r.exam.maxScore)} ball, ${vergul(r.percentage)}%${rasch}${orin}\n`;
            }
        }
        // Natija sahifasi — kirishsiz, imzolangan havola. Telegram Mini App faqat https bilan ochiladi.
        const asos = (process.env.PUBLIC_URL || process.env.APP_URL || '').replace(/\/+$/, '');
        const tugmalar = asos ? natijalar.map(r => {
            const url = `${asos}/natija/${natijaTokeni(r.id)}`;
            const text = `📊 ${r.exam.name}`.slice(0, 60);
            return [asos.startsWith('https://') ? { text, web_app: { url } } : { text, url }];
        }) : [];
        await ctx.reply(matn, { parse_mode: 'HTML', ...(tugmalar.length ? { reply_markup: { inline_keyboard: tugmalar } } : {}) });
        return true;
    };
    botInstance.hears('📝 Imtihonlar', imtihonlarniKorsat);
    botInstance.command('imtihon', imtihonlarniKorsat);

    botInstance.hears('✍️ Shikoyat va takliflar', async (ctx) => {
        ctx.reply("Sizning fikringiz biz uchun muhim! ✍️\n\nShikoyat yoki taklifingiz bo'lsa, shu yerga yozib qoldiring. Adminlarimiz uni albatta ko'rib chiqishadi.");
    });

    botInstance.hears('👤 Profil', async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user) return;

        let roleLabel = 'O\'quvchi';
        if (user.type === 'parent_father') roleLabel = 'Ota';
        else if (user.type === 'parent_mother') roleLabel = 'Ona';
        else if (user.type === 'teacher') roleLabel = 'O\'qituvchi';
        else if (user.type === 'driver') roleLabel = 'Haydovchi';
        else if (user.type === 'admin') roleLabel = 'Xodim';

        let msg = `👤 Mening Profilim:\n\n`;
        if (oilami(user) && (user.type !== 'student' || user.farzandlar.length > 1)) {
            // Ota-ona: o'z ismi va raqami, keyin hamma farzandlari.
            const s = user.data;
            const ota = user.type === 'parent_father';
            const ism = ota ? s.fatherName : user.type === 'parent_mother' ? s.motherName : '';
            if (ism) msg += `NAME: ${ism}\n`;
            msg += `📞 TEL: ${(ota ? s.fatherPhone : user.type === 'parent_mother' ? s.motherPhone : s.phone) || s.phone}\n`;
            msg += `🎭 ROL: ${ota ? 'Ota' : user.type === 'parent_mother' ? 'Ona' : 'Ota-ona'}\n\n`;
            msg += `${user.farzandlar.length > 1 ? '👨‍👩‍👧‍👦 Farzandlaringiz' : '👤 Farzandingiz'}:\n${farzandlarRoyxati(user.farzandlar)}\n`;
            return ctx.reply(msg);
        }
        msg += `🆔 ID: ${user.data.id}\n`;
        msg += `NAME: ${user.data.name}\n`;
        if (user.type === 'parent_father') {
            msg += `📞 TEL: ${user.data.fatherPhone || user.data.phone}\n`;
            msg += `👨‍👦 O'quvchi: ${user.data.name}\n`;
        } else if (user.type === 'parent_mother') {
            msg += `📞 TEL: ${user.data.motherPhone || user.data.phone}\n`;
            msg += `👩‍👦 O'quvchi: ${user.data.name}\n`;
        } else {
            msg += `📞 TEL: ${user.data.phone}\n`;
        }
        msg += `🎭 ROL: ${roleLabel}\n`;

        ctx.reply(msg);
    });

    // ===== Ustozning davomati =====
    //
    // Ilgari ro'yxat bazadan qanday kelsa shunday — tartibsiz, bitta ustunda
    // 100 tagacha tugma bo'lib chiqardi ("kasha"), Telegram esa 100 dan ortiq
    // tugmani umuman qabul qilmaydi. Belgilar server xotirasida (attStates)
    // turardi: Vercelda keyingi bosish boshqa konteynerga tushsa "Sessiya
    // eskirgan" chiqardi. Endi:
    //  - o'quvchilar alifbo tartibida, raqamlangan, 20 tadan sahifada;
    //  - har bosish darhol bazaga yoziladi, xotirada hech narsa saqlanmaydi;
    //  - «Saqlash» belgilanmaganlarni "Keldi" deb yozadi va xabar yuboradi.
    const ATT_SAHIFA = 20;
    const KELMADI = ['Kelmapdi', 'Kelmadi'];
    const ATT_BELGI = { Keldi: '✅', Kelmapdi: '❌', Kelmadi: '❌', Sababli: '⚠️', Kechikdi: '⏰', ErtaKetdi: '🏃', "Dars bo'lmadi": '🚫' };
    const ATT_NOMI = { Keldi: 'Keldi', Kelmapdi: 'Kelmadi', Kelmadi: 'Kelmadi', Sababli: 'Sababli', Kechikdi: 'Kechikdi', ErtaKetdi: 'Erta ketdi', "Dars bo'lmadi": "Dars bo'lmadi" };

    // "BOBORAJABOV QILICHBEK" → "Boborajabov Qilichbek", ortiqcha bo'shliqlar olinadi.
    const ismKorinishi = (name) => {
        const n = String(name || '').replace(/\s+/g, ' ').trim();
        if (n !== n.toUpperCase()) return n;
        return n.toLowerCase().replace(/(^|[\s-])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
    };
    const sanaKorinishi = (d) => d.split('-').reverse().join('.');

    /** Ustozga biriktirilgan kurs va uning o'quvchilari (alifbo tartibida). Begona kurs — null. */
    const ustozKursi = async (ctx, groupId) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'teacher') return null;
        const group = await prisma.group.findFirst({
            where: { id: groupId, teacherId: user.data.id },
            include: {
                students: {
                    where: { status: { not: 'Arxiv' } },
                    select: { id: true, name: true, telegramId: true, fatherTelegramId: true, motherTelegramId: true },
                },
            },
        });
        if (!group) return null;
        group.students = group.students
            .map(s => ({ ...s, ism: ismKorinishi(s.name) }))
            .sort((a, b) => a.ism.localeCompare(b.ism, 'uz'));
        return group;
    };

    const bugungiBelgilar = async (groupId, sana) => {
        const rows = await prisma.attendance.findMany({
            where: { groupId, date: sana },
            select: { studentId: true, status: true },
        });
        return new Map(rows.map(r => [r.studentId, r.status]));
    };

    /** Kelmaganlar ro'yxati: "3. Ism, 17. Ism". Juda uzun bo'lsa qisqaradi. */
    const kelmaganlarMatni = (students, holat) => {
        const qator = [];
        students.forEach((s, i) => { if (KELMADI.includes(holat.get(s.id))) qator.push(`${i + 1}. ${escHtml(s.ism)}`); });
        let matn = qator.join(', ');
        if (matn.length > 2500) matn = matn.slice(0, 2500) + '…';
        return matn;
    };

    const sanoqMatni = (students, holat) => {
        const sanoq = {};
        students.forEach(s => {
            const h = holat.get(s.id) || 'Keldi';
            const k = KELMADI.includes(h) ? 'Kelmapdi' : h;
            sanoq[k] = (sanoq[k] || 0) + 1;
        });
        return Object.entries(sanoq)
            .sort(([a], [b]) => (a === 'Keldi' ? -1 : b === 'Keldi' ? 1 : a === 'Kelmapdi' ? -1 : b === 'Kelmapdi' ? 1 : 0))
            .map(([k, n]) => `${ATT_BELGI[k] || '▫️'} ${ATT_NOMI[k] || k}: ${n}`)
            .join('  ·  ');
    };

    const davomatniChiz = async (ctx, group, sahifa) => {
        const sana = toDateStr();
        const holat = await bugungiBelgilar(group.id, sana);
        const students = group.students;
        const jamiSahifa = Math.max(1, Math.ceil(students.length / ATT_SAHIFA));
        const p = Math.min(Math.max(0, sahifa || 0), jamiSahifa - 1);

        let matn = `📋 <b>${escHtml(group.name)}</b> — davomat\n`;
        matn += `📅 ${sanaKorinishi(sana)}  ·  ${students.length} ta o'quvchi\n`;
        matn += sanoqMatni(students, holat) + '\n';
        const kelmaganlar = kelmaganlarMatni(students, holat);
        if (kelmaganlar) matn += `\n❌ <b>Kelmaganlar:</b> ${kelmaganlar}\n`;
        matn += `\nKelmagan o'quvchini bosing (❌ bo'ladi), qayta bossangiz ✅ ga qaytadi. Oxirida «💾 Saqlash».`;
        if (jamiSahifa > 1) matn += `\nRo'yxat ${jamiSahifa} sahifada — pastdagi ◀️ ▶️ bilan o'ting.`;

        const tugmalar = students.slice(p * ATT_SAHIFA, (p + 1) * ATT_SAHIFA).map((s, i) => {
            const n = p * ATT_SAHIFA + i + 1;
            const ism = s.ism.length > 28 ? s.ism.slice(0, 27) + '…' : s.ism;
            const belgi = ATT_BELGI[holat.get(s.id)] || '✅';
            return [Markup.button.callback(`${belgi} ${n}. ${ism}`, `ta_t_${group.id}_${s.id}_${p}`)];
        });
        if (jamiSahifa > 1) {
            const nav = [];
            if (p > 0) nav.push(Markup.button.callback('◀️ Oldingi', `ta_p_${group.id}_${p - 1}`));
            nav.push(Markup.button.callback(`${p + 1} / ${jamiSahifa}`, `ta_p_${group.id}_${p}`));
            if (p < jamiSahifa - 1) nav.push(Markup.button.callback('Keyingi ▶️', `ta_p_${group.id}_${p + 1}`));
            tugmalar.push(nav);
        }
        tugmalar.push([Markup.button.callback('💾 Saqlash', `ta_s_${group.id}`)]);

        const extra = { parse_mode: 'HTML', ...Markup.inlineKeyboard(tugmalar) };
        if (ctx.callbackQuery) {
            // Hech narsa o'zgarmagan bo'lsa Telegram "message is not modified" qaytaradi.
            await ctx.editMessageText(matn, extra).catch(e => {
                if (!String(e.message).includes('not modified')) throw e;
            });
        } else {
            await ctx.reply(matn, extra);
        }
    };

    botInstance.hears('🎒 Davomat qilish', async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'teacher') return;

        const groups = await prisma.group.findMany({
            where: { teacherId: user.data.id },
            select: { id: true, name: true, _count: { select: { students: { where: { status: { not: 'Arxiv' } } } } } },
            orderBy: { name: 'asc' },
        });

        if (groups.length === 0) return ctx.reply("Sizga biriktirilgan kurslar topilmadi.");

        const buttons = groups.map(g => [Markup.button.callback(`📚 ${g.name}  ·  ${g._count.students} ta`, `mark_att_${g.id}`)]);
        ctx.reply("Qaysi kurs uchun davomat qilasiz?", Markup.inlineKeyboard(buttons));
    });

    botInstance.hears('📅 Mening Jadvalim', async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'teacher') return;

        const groups = await prisma.group.findMany({
            where: { teacherId: user.data.id, schoolId },
            include: { course: true, roomRel: true }
        });

        if (groups.length === 0) return ctx.reply("Sizga hozircha hech qanday guruh biriktirilmagan.");

        let msg = "📅 Sizning dars jadvalingiz:\n\n";
        groups.forEach(g => {
            msg += `👥 ${g.name} (${g.course.name})\n`;
            msg += `🕒 ${g.schedule} | ${g.days}\n`;
            msg += `🚪 Xona: ${g.roomRel?.name || 'Noma\'lum'}\n\n`;
        });

        ctx.reply(msg);
    });

    botInstance.hears('💰 Oylik va Bonuslar', async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'teacher') return;

        const teacher = user.data;
        const NL = String.fromCharCode(10);
        const lines = ['💰 Ish haqi'];

        // Haqiqatan berilgan oyliklar. Ilgari bu yerda faqat shartnoma
        // ma'lumoti (stavka) ko'rsatilardi va to'lansa ham, to'lanmasa ham
        // xabar bir xil bo'lardi — shuning uchun "telegramda aks etmayapti".
        // SalaryPayment User ga bog'langan, Teacher ga emas: ikkalasi ism
        // bo'yicha topiladi (server.js dagi KPI hisobi ham shunday qiladi).
        let paid = [];
        let staff = null;
        try {
            // Xodim yozuvi Teacher.userId orqali topiladi. Ilgari u ism bo'yicha
            // qidirilardi: ism biroz boshqacha yozilgan bo'lsa bot "berilgan
            // oylik yozuvi yo'q" der, CRM da esa oylik berilgan bo'lardi.
            staff = teacher.userId
                ? await prisma.user.findUnique({ where: { id: teacher.userId } })
                : await prisma.user.findFirst({ where: { name: teacher.name, schoolId: teacher.schoolId } });
            if (staff) {
                paid = await prisma.salaryPayment.findMany({
                    where: { userId: staff.id },
                    orderBy: { month: 'desc' },
                    take: 6
                });
            }
        } catch (e) {
            console.error('Oylik tarixini olishda xato:', e.message);
        }

        if (paid.length > 0) {
            lines.push('');
            lines.push('✅ Berilgan oyliklar:');
            paid.forEach(p => {
                let row = '▫️ ' + p.month + ': ' + p.amount.toLocaleString() + ' UZS';
                if (p.bonuses) row += ' (+' + p.bonuses.toLocaleString() + ' bonus)';
                if (p.fines) row += ' (−' + p.fines.toLocaleString() + ' jarima)';
                lines.push(row);
            });
        } else {
            lines.push('');
            lines.push('Hozircha berilgan oylik yozuvi yo\'q.');
        }

        lines.push('');
        lines.push('📋 Shartnoma bo\'yicha:');
        // Shartnoma ma'lumoti CRM ning o'zi hisoblaydigan joydan olinadi:
        // xodim kartasidagi asosiy maosh va KPI foizi, hamda guruhga alohida
        // belgilangan haq. Ilgari bu yerda Teacher jadvalidagi eski maydonlar
        // ko'rsatilar va CRM dagidan boshqa raqam chiqardi.
        lines.push('\u{1F4B5} Asosiy oylik: ' + (staff?.salary || 0).toLocaleString() + ' UZS');

        const guruhlar = await prisma.group.findMany({
            where: { teacherId: teacher.id },
            select: { name: true, payType: true, payValue: true }
        });
        const umumiyFoiz = staff?.kpiPercent || 0;

        if (guruhlar.length > 0 && (guruhlar.some(g => g.payType) || umumiyFoiz > 0)) {
            lines.push('\u{1F465} Guruhlar uchun:');
            guruhlar.forEach(g => {
                if (g.payType === 'Belgilangan') {
                    lines.push('  \u25AB\uFE0F ' + g.name + ': ' + Math.round(g.payValue || 0).toLocaleString() + ' UZS/oy');
                } else if (g.payType === 'Foiz') {
                    lines.push('  \u25AB\uFE0F ' + g.name + ': ' + (g.payValue || 0) + '%');
                } else if (umumiyFoiz > 0) {
                    lines.push('  \u25AB\uFE0F ' + g.name + ': ' + umumiyFoiz + '% (umumiy ulush)');
                }
            });
        } else if (umumiyFoiz > 0) {
            lines.push('\u{1F4C8} Guruhlardan ulush: ' + umumiyFoiz + '%');
        }

        ctx.reply(lines.join(NL));
    });

    // Kurs tanlandi — ro'yxatning birinchi sahifasi.
    botInstance.action(/^mark_att_(\d+)$/, async (ctx) => {
        const group = await ustozKursi(ctx, parseInt(ctx.match[1]));
        if (!group) return ctx.answerCbQuery("Bu kurs sizga biriktirilmagan.");
        if (group.students.length === 0) {
            await ctx.answerCbQuery();
            return ctx.reply("Bu kursda o'quvchilar yo'q.");
        }
        await ctx.answerCbQuery();
        await davomatniChiz(ctx, group, 0);
    });

    // Sahifa almashtirish (o'rtadagi "2 / 5" tugmasi — yangilash).
    botInstance.action(/^ta_p_(\d+)_(\d+)$/, async (ctx) => {
        const group = await ustozKursi(ctx, parseInt(ctx.match[1]));
        if (!group) return ctx.answerCbQuery("Bu kurs sizga biriktirilmagan.");
        await ctx.answerCbQuery();
        await davomatniChiz(ctx, group, parseInt(ctx.match[2]));
    });

    // O'quvchini bosish: ✅ → ❌ → ✅. Darhol bazaga yoziladi.
    botInstance.action(/^ta_t_(\d+)_(\d+)_(\d+)$/, async (ctx) => {
        const group = await ustozKursi(ctx, parseInt(ctx.match[1]));
        if (!group) return ctx.answerCbQuery("Bu kurs sizga biriktirilmagan.");
        const studentId = parseInt(ctx.match[2]);
        if (!group.students.some(s => s.id === studentId)) return ctx.answerCbQuery("O'quvchi bu kursda emas.");

        const sana = toDateStr();
        const rows = await prisma.attendance.findMany({
            where: { studentId, groupId: group.id, date: sana },
            select: { id: true, status: true },
        });
        const keyingi = KELMADI.includes(rows[0]?.status) ? 'Keldi' : 'Kelmapdi';
        if (rows.length) {
            await prisma.attendance.updateMany({ where: { id: { in: rows.map(r => r.id) } }, data: { status: keyingi } });
        } else {
            await prisma.attendance.create({
                data: { studentId, groupId: group.id, date: sana, status: keyingi, schoolId: group.schoolId },
            });
        }
        await ctx.answerCbQuery(keyingi === 'Keldi' ? '✅ Keldi' : '❌ Kelmadi');
        await davomatniChiz(ctx, group, parseInt(ctx.match[3]));
    });

    // Saqlash: belgilanmaganlar "Keldi", so'ng ota-onaga davomat xabari — CRM
    // kurs sahifasidagi "Xabar yuborish" bilan bir xil: har holatga Xabarlar →
    // Shablonlar dagi tanlangan shablon (services/davomatXabari.js). Shablon
    // tanlanmagan holatga (odatda "Keldi") xabar ketmaydi.
    botInstance.action(/^ta_s_(\d+)$/, async (ctx) => {
        const group = await ustozKursi(ctx, parseInt(ctx.match[1]));
        if (!group) return ctx.answerCbQuery("Bu kurs sizga biriktirilmagan.");
        await ctx.answerCbQuery('Saqlanmoqda...');

        const sana = toDateStr();
        try {
            const holat = await bugungiBelgilar(group.id, sana);
            const yangi = group.students.filter(s => !holat.has(s.id));
            if (yangi.length) {
                await prisma.attendance.createMany({
                    data: yangi.map(s => ({ studentId: s.id, groupId: group.id, date: sana, status: 'Keldi', schoolId: group.schoolId })),
                });
                yangi.forEach(s => holat.set(s.id, 'Keldi'));
            }

            let xabar = null;
            try {
                xabar = await davomatXabariniYuborish({ groupId: group.id, date: sana, studentIds: group.students.map(s => s.id) });
            } catch (e) {
                console.error('Davomat xabari (bot):', e.message);
            }

            let matn = `✅ <b>${escHtml(group.name)}</b> — davomat saqlandi\n`;
            matn += `📅 ${sanaKorinishi(sana)}  ·  ${group.students.length} ta o'quvchi\n`;
            matn += sanoqMatni(group.students, holat) + '\n';
            const kelmaganlar = kelmaganlarMatni(group.students, holat);
            if (kelmaganlar) matn += `\n❌ <b>Kelmaganlar:</b> ${kelmaganlar}\n`;
            if (xabar && !xabar.error) {
                const yetmadi = (xabar.xato || 0) + (xabar.aloqasiz || 0);
                matn += `\n📨 Ota-onalarga xabar: ${xabar.yuborildi} ta yuborildi${yetmadi ? `, ${yetmadi} tasiga yetib bormadi` : ''}`;
            } else {
                matn += `\n📨 Ota-onalarga xabar yuborilmadi`;
            }
            await ctx.editMessageText(matn, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([[Markup.button.callback('✏️ Tuzatish', `ta_p_${group.id}_0`)]]),
            });
        } catch (err) {
            console.error('Save attendance error:', err);
            ctx.reply("Davomatni saqlashda xatolik yuz berdi. Qaytadan urinib ko'ring.");
        }
    });

    // Yangilanishdan oldin yuborilgan eski ro'yxatlardagi tugmalar.
    const eskiRoyxat = (ctx) => ctx.answerCbQuery("Ro'yxat yangilandi — «🎒 Davomat qilish» ni qayta bosing.", { show_alert: true });
    botInstance.action(/^toggle_att_(\d+)$/, eskiRoyxat);
    botInstance.action('save_attendance', eskiRoyxat);

    // ===== Haydovchining joylashuvi =====
    //
    // Haydovchi CRM ga kirmaydi, shuning uchun joylashuv faqat botdan keladi:
    // "📍 Joylashuvni yuborish" (bir martalik) yoki 📎 → jonli joylashuv.
    // Jonli joylashuvni Telegram o'zi yangilab turadi — har yangilanish
    // edited_message bo'lib keladi va jim yoziladi.
    botInstance.on('location', async (ctx, next) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'driver') return next();
        const loc = ctx.message.location;
        await joylashuvniYozish({
            driverId: user.data.id, schoolId,
            lat: loc.latitude, lng: loc.longitude,
            livePeriod: loc.live_period || null, sentAt: ctx.message.date,
        });
        if (loc.live_period) {
            return ctx.reply("✅ Jonli joylashuv ulandi — markaz sizni xaritada ko'rib turadi. Ishingiz tugagach ulashishni to'xtatishingiz mumkin.");
        }
        return ctx.reply("✅ Joylashuvingiz saqlandi.\n\n" + JOYLASHUV_YORDAM);
    });

    botInstance.on('edited_message', async (ctx, next) => {
        const schoolId = await filial(ctx);
        const msg = ctx.editedMessage;
        if (!msg?.location) return next();
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'driver') return;
        await joylashuvniYozish({
            driverId: user.data.id, schoolId,
            lat: msg.location.latitude, lng: msg.location.longitude,
            livePeriod: msg.location.live_period || null, sentAt: msg.date,
        });
    });

    // Eski klaviaturadagi tugma: endi bugungi rejalarning o'zi ko'rsatiladi.
    botInstance.hears('📍 O\'quvchilar lokatsiyasi', (ctx) => bugungiRejalar(ctx));

    // ===== Haydovchining bugungi rejalari =====
    //
    // Butun holat bazada: tugma bosilganda yozuv yoziladi va xabar qayta
    // chiziladi. Xotirada hech narsa saqlanmaydi, shuning uchun bot qayta
    // ishga tushsa ham eski xabardagi tugmalar ishlayveradi.

    /** Haydovchi va uning shu rejaga haqqi bormi. */
    const haydovchiMarshruti = async (ctx, routeId) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'driver') return null;
        const route = await prisma.route.findFirst({
            where: {
                id: routeId,
                schoolId,
                OR: [{ driverId: user.data.id }, { transport: { driverId: user.data.id } }],
            },
            include: REJA_INCLUDE,
        });
        if (!route) return null;
        return { user, route };
    };

    /** Reja sanasi: kunlik reja o'z kuniga tegishli, eski marshrut — bugun. */
    const rejaSanasi = (route) => route.date || toDateStr();

    /** Xabarni joyida qayta chizadi. */
    const reysniQaytaChizish = async (ctx, route, sana) => {
        const holat = await marshrutHolati({ routeId: route.id, date: sana });
        const { matn, tugmalar } = reysKorinishi(route, holat, sana);
        try {
            await ctx.editMessageText(matn, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...Markup.inlineKeyboard(tugmalar),
            });
        } catch (e) {
            // "message is not modified" — foydalanuvchi bir xil tugmani bossa.
            if (!String(e.message || '').includes('not modified')) throw e;
        }
    };

    const bugungiRejalar = async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'driver') return;

        const sana = toDateStr();
        const reyslar = await bugungiReyslar({ schoolId, date: sana, driverId: user.data.id });

        if (reyslar.length === 0) {
            return ctx.reply(`🗓 ${sana}\n\nBugun sizga hali reja tuzilmagan. Reja tuzilishi bilan shu yerga keladi.`);
        }

        for (const route of reyslar) {
            const holat = await marshrutHolati({ routeId: route.id, date: sana });
            const { matn, tugmalar } = reysKorinishi(route, holat, sana);
            await ctx.reply(matn, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...Markup.inlineKeyboard(tugmalar),
            });
        }
    };
    botInstance.hears('🚌 Bugungi reyslar', (ctx) => bugungiRejalar(ctx));

    // Bola tugmasi — istisnolar uchun. Qabul qilinmaguncha: ⬜ ↔ ❌ (chiqmadi).
    // Qabul qilingach: 🚐 olindi → ✅ yetkazildi → ❌ kelmadi → 🚐.
    botInstance.action(/^reys_h_(\d+)_(\d+)$/, async (ctx) => {
        const schoolId = await filial(ctx);
        const routeId = parseInt(ctx.match[1]);
        const studentId = parseInt(ctx.match[2]);
        const topilgan = await haydovchiMarshruti(ctx, routeId);
        if (!topilgan) return ctx.answerCbQuery('Bu reja sizga biriktirilmagan');
        const { user, route } = topilgan;

        const sana = rejaSanasi(route);
        const holat = await marshrutHolati({ routeId, date: sana });
        const hozirgi = holat.holatlar[studentId];
        const boshlangan = !!holat.run?.startedAt;
        const yoz = (status) => holatniYozish({
            route, studentId, status, date: sana, schoolId,
            markedById: user.data.id, transportId: route.transportId,
        });

        if (!boshlangan) {
            if (hozirgi === 'Kelmadi') {
                await holatniOchirish({ runId: holat.run?.id, studentId });
                await ctx.answerCbQuery('Belgi olib tashlandi');
            } else {
                await yoz('Kelmadi');
                await ctx.answerCbQuery('❌ Chiqmadi');
            }
        } else {
            const keyingi = !hozirgi || hozirgi === 'Kelmadi' ? 'Olib ketildi'
                : hozirgi === 'Olib ketildi' ? 'Uyiga yetkazildi' : 'Kelmadi';
            await yoz(keyingi);
            await ctx.answerCbQuery(keyingi);
        }

        await reysniQaytaChizish(ctx, route, sana);
    });

    // "Qabul qildim" — bolalar mashinada: belgilanmaganlarning hammasi olindi.
    botInstance.action(/^reys_bosh_(\d+)$/, async (ctx) => {
        const schoolId = await filial(ctx);
        const topilgan = await haydovchiMarshruti(ctx, parseInt(ctx.match[1]));
        if (!topilgan) return ctx.answerCbQuery('Bu reja sizga biriktirilmagan');
        const sana = rejaSanasi(topilgan.route);
        await ctx.answerCbQuery('Qabul qilindi');
        await rejaniQabulQilish({ route: topilgan.route, date: sana, schoolId, markedById: topilgan.user.data.id });
        await reysniQaytaChizish(ctx, topilgan.route, sana);
        await ctx.reply(JOYLASHUV_YORDAM, getDriverMenu());
    });

    // "Yetkazdim" — hammasi uyida: chiqmaganlardan boshqa hamma yetkazildi.
    botInstance.action(/^reys_tugat_(\d+)$/, async (ctx) => {
        const schoolId = await filial(ctx);
        const topilgan = await haydovchiMarshruti(ctx, parseInt(ctx.match[1]));
        if (!topilgan) return ctx.answerCbQuery('Bu reja sizga biriktirilmagan');
        const sana = rejaSanasi(topilgan.route);
        await ctx.answerCbQuery('Yetkazildi');
        const { soni } = await rejaniYetkazish({ route: topilgan.route, date: sana, schoolId, markedById: topilgan.user.data.id });
        await reysniQaytaChizish(ctx, topilgan.route, sana);
        await ctx.reply(`✅ Rahmat! Reja yakunlandi${soni ? ` — ${soni} ta o'quvchi uyiga yetkazildi` : ''}. Jonli joylashuvni endi to'xtatishingiz mumkin.`);
    });

    botInstance.action(/^reys_yangi_(\d+)$/, async (ctx) => {
        const topilgan = await haydovchiMarshruti(ctx, parseInt(ctx.match[1]));
        if (!topilgan) return ctx.answerCbQuery('Bu reja sizga biriktirilmagan');
        await ctx.answerCbQuery('Yangilandi');
        await reysniQaytaChizish(ctx, topilgan.route, rejaSanasi(topilgan.route));
    });

    // ===== Haydovchining kunlik tasdiqlashi =====
    //
    // Dars tugashidan ~2 soat oldin bot so'raydi: bugun shu to'lqinda
    // qatnasha olasizmi. Reja faqat "HA" deganlardan tuziladi — javob
    // bermaganlarni admin ro'yxatda ko'radi va qo'ng'iroq qiladi.

    const tasdiqJavobi = async (ctx, status) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'driver') return ctx.answerCbQuery('Bu tugma haydovchilar uchun');
        const sana = ctx.match[1];
        const vaqt = ctx.match[2];

        await javobniYozish({ driverId: user.data.id, date: sana, endTime: vaqt, status, schoolId });
        await ctx.answerCbQuery(status === 'HA' ? 'Yozib oldik, rahmat' : 'Yozib oldik');

        const belgi = status === 'HA' ? '✅' : '❌';
        const izoh = status === 'HA'
            ? `Rahmat! ${vaqt} ga yaqin marshrutingiz shu yerda chiqadi.`
            : 'Yaxshi, bugun bu vaqtda hisobga olmaymiz.';
        try {
            await ctx.editMessageText(
                `${belgi} <b>${vaqt}</b> · ${status === 'HA' ? 'qatnashaman' : 'qatnasha olmayman'}\n\n${izoh}`,
                { parse_mode: 'HTML' }
            );
        } catch (e) {
            if (!String(e.message || '').includes('not modified')) throw e;
        }
    };

    botInstance.action(/^hd_ha_(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})$/, ctx => tasdiqJavobi(ctx, 'HA'));
    botInstance.action(/^hd_yoq_(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})$/, ctx => tasdiqJavobi(ctx, 'YOQ'));

    // ===== Qadam-baqadam rejim =====
    //
    // Haydovchi butun ro'yxat bilan emas, KEYINGI bekat bilan ishlaydi: kim,
    // qayerda, telefoni, navigatsiya. "Oldim"/"Chiqmadi" bosildi — o'sha xabar
    // keyingi bekatga almashadi. Tartib serverda masofa bo'yicha qurilgan.

    /** Navigatsiya havolalari: koordinata bo'lsa aniq nuqta, bo'lmasa manzil. */
    const navHavolalar = (student) => {
        const k = parseLatLng(student.location);
        if (k) {
            return {
                google: `https://www.google.com/maps/dir/?api=1&destination=${k[0]},${k[1]}&travelmode=driving`,
                yandex: `https://yandex.uz/maps/?rtext=~${k[0]},${k[1]}&rtt=auto`,
            };
        }
        const q = encodeURIComponent((student.address || '').trim() || student.name);
        return {
            google: `https://www.google.com/maps/search/?api=1&query=${q}`,
            yandex: `https://yandex.uz/maps/?text=${q}`,
        };
    };

    /**
     * Keyingi bekat: tartib bo'yicha hali belgilanmagan birinchisi.
     * `keyin` berilsa — o'sha o'quvchidan keyingi belgilanmagani (o'tkazib
     * yuborish uchun), oxiriga yetsa boshidan.
     */
    const keyingiBekat = (route, holat, keyin = 0) => {
        const ochiq = route.stops.filter(st => !holat.holatlar[st.studentId]);
        if (ochiq.length === 0) return null;
        if (!keyin) return ochiq[0];
        const idx = ochiq.findIndex(st => st.studentId === keyin);
        return ochiq[(idx + 1) % ochiq.length];
    };

    /** Qadam xabari: matn va tugmalar. */
    const qadamKorinishi = async (route, holat, bekat, sana) => {
        const belgilangan = route.stops.filter(st => holat.holatlar[st.studentId]).length;
        const yonalish = route.direction === 'QAYTISH';
        const st = bekat.student;
        const raqam = route.stops.findIndex(x => x.studentId === bekat.studentId) + 1;

        // Oldingi nuqta: oxirgi belgilangan bekat, bo'lmasa markaz.
        const markaz = await markazNuqtasi(schoolId);
        let oldingi = markaz;
        let oldingiNom = 'markazdan';
        const belgilanganlar = route.stops.filter(x => holat.holatlar[x.studentId] && parseLatLng(x.student.location));
        if (belgilanganlar.length) {
            const oxirgi = belgilanganlar[belgilanganlar.length - 1];
            oldingi = parseLatLng(oxirgi.student.location);
            oldingiNom = 'oldingi bekatdan';
        }
        const k = parseLatLng(st.location);
        const masofa = k ? distanceKm(oldingi, k) : null;

        let matn = `🚌 <b>${route.name}</b> · ${belgilangan}/${route.stops.length}\n`;
        matn += `${yonalish ? '🏠 uyga tarqatish' : '🏫 markazga olib kelish'} · ${sana}\n\n`;
        matn += `➡️ <b>Keyingi bekat (${raqam}/${route.stops.length})</b>\n`;
        matn += `👤 <b>${st.name}</b>\n`;
        matn += `🏠 ${st.address || 'manzil kiritilmagan'}\n`;
        matn += `📞 ${st.phone}\n`;
        if (masofa !== null) {
            matn += `📍 ${oldingiNom} ${masofa < 1 ? Math.round(masofa * 1000) + ' m' : masofa.toFixed(1) + ' km'}\n`;
        } else {
            matn += `⚠️ Xaritadagi joylashuvi belgilanmagan\n`;
        }

        const nav = navHavolalar(st);
        const [olindi] = yonalishHolatlari(route.direction);
        const tugmalar = [
            [Markup.button.url('🗺 Google Maps', nav.google), Markup.button.url('🗺 Yandex', nav.yandex)],
            [
                Markup.button.callback(`✅ ${olindi === 'Olib ketildi' ? 'Oldim' : 'Yetkazdim'}`, `reys_q_${route.id}_${bekat.studentId}_ok`),
                Markup.button.callback('❌ Chiqmadi', `reys_q_${route.id}_${bekat.studentId}_yoq`),
            ],
            [
                Markup.button.callback('⏭ Keyinroq', `reys_qadam_${route.id}_${bekat.studentId}`),
                Markup.button.callback('📋 Ro\'yxat', `reys_yangi_${route.id}`),
            ],
        ];
        return { matn, tugmalar };
    };

    /** Reys tugagandagi xulosa. */
    const xulosaKorinishi = (route, holat) => {
        const kelmagan = route.stops.filter(st => holat.holatlar[st.studentId] === 'Kelmadi');
        let matn = `✅ <b>${route.name}</b> — reys tugadi\n`;
        matn += `${route.stops.length - kelmagan.length}/${route.stops.length} ${route.direction === 'QAYTISH' ? 'yetkazildi' : 'olindi'}`;
        if (kelmagan.length) {
            matn += `\n\n❌ Chiqmaganlar:\n` + kelmagan.map(st => `• ${st.student.name}`).join('\n');
        }
        if (holat.run?.startedAt && holat.run?.finishedAt) {
            const daq = Math.round((new Date(holat.run.finishedAt) - new Date(holat.run.startedAt)) / 60000);
            matn += `\n\n⏱ ${toTimeStr(holat.run.startedAt)} – ${toTimeStr(holat.run.finishedAt)} (${daq} daqiqa)`;
        }
        return { matn, tugmalar: [[Markup.button.callback('📋 Ro\'yxat', `reys_yangi_${route.id}`)]] };
    };

    /** Qadam xabarini chizadi (yangi yoki joyida). */
    const qadamniChizish = async (ctx, route, sana, keyin = 0, yangiXabar = false) => {
        const schoolId = await filial(ctx);
        let holat = await marshrutHolati({ routeId: route.id, date: sana });
        const bekat = keyingiBekat(route, holat, keyin);

        let korinish;
        if (!bekat) {
            // Hammasi belgilandi — reys o'zi tugaydi.
            if (holat.run && !holat.run.finishedAt) {
                await reysVaqti({ route, date: sana, schoolId, maydon: 'finishedAt' });
                holat = await marshrutHolati({ routeId: route.id, date: sana });
            }
            korinish = xulosaKorinishi(route, holat);
        } else {
            korinish = await qadamKorinishi(route, holat, bekat, sana);
        }

        const extra = { parse_mode: 'HTML', disable_web_page_preview: true, ...Markup.inlineKeyboard(korinish.tugmalar) };
        if (yangiXabar) return ctx.reply(korinish.matn, extra);
        try {
            await ctx.editMessageText(korinish.matn, extra);
        } catch (e) {
            if (!String(e.message || '').includes('not modified')) throw e;
        }
    };

    // Qadam rejimiga kirish / keyingisiga o'tish (o'tkazib yuborish)
    botInstance.action(/^reys_qadam_(\d+)_(\d+)$/, async (ctx) => {
        const schoolId = await filial(ctx);
        const topilgan = await haydovchiMarshruti(ctx, parseInt(ctx.match[1]));
        if (!topilgan) return ctx.answerCbQuery('Bu marshrut sizga biriktirilmagan');
        const keyin = parseInt(ctx.match[2]) || 0;
        const sana = toDateStr();

        // Reys hali boshlanmagan bo'lsa — hozir boshlandi.
        const holat = await marshrutHolati({ routeId: topilgan.route.id, date: sana });
        if (!holat.run?.startedAt) await reysVaqti({ route: topilgan.route, date: sana, schoolId, maydon: 'startedAt' });

        await ctx.answerCbQuery(keyin ? 'Keyingisi' : 'Reys boshlandi');
        // Ro'yxat xabaridan kirilganda alohida xabar ochiladi; qadam ichida
        // "keyinroq" bosilsa o'sha xabar almashadi.
        await qadamniChizish(ctx, topilgan.route, sana, keyin, !keyin);
    });

    // Bekatni belgilash: ok — olindi/yetkazildi, yoq — chiqmadi
    botInstance.action(/^reys_q_(\d+)_(\d+)_(ok|yoq)$/, async (ctx) => {
        const schoolId = await filial(ctx);
        const topilgan = await haydovchiMarshruti(ctx, parseInt(ctx.match[1]));
        if (!topilgan) return ctx.answerCbQuery('Bu marshrut sizga biriktirilmagan');
        const { user, route } = topilgan;
        const studentId = parseInt(ctx.match[2]);
        const sana = toDateStr();
        const [olindi] = yonalishHolatlari(route.direction);
        const status = ctx.match[3] === 'ok' ? olindi : 'Kelmadi';

        await holatniYozish({
            route, studentId, status, date: sana, schoolId,
            markedById: user.data.id, transportId: route.transportId,
        });
        await ctx.answerCbQuery(status);
        await qadamniChizish(ctx, route, sana);
    });

    botInstance.hears('🚍 Mening Transportim', async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'driver') return;

        const transport = await prisma.transport.findFirst({
            where: { driverId: user.data.id, schoolId }
        });

        if (!transport) return ctx.reply("Sizga hech qanday transport biriktirilmagan.");

        let msg = `🚍 Mening Transportim:\n\n`;
        msg += `📄 Nomi: ${transport.name}\n`;
        msg += `🚙 Model: ${transport.model || 'Noma\'lum'}\n`;
        msg += `🔢 Raqami: ${transport.number || 'Noma\'lum'}\n`;
        msg += `👥 Sig'im: ${transport.capacity} kishi\n`;
        msg += `✅ Holati: ${transport.status}\n`;

        ctx.reply(msg);
    });

    // Admin Handlers
    botInstance.hears('📢 Yangi Lidlar', async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'admin') return;
        if (!yetadimi(await xodimRuxsati(user.data), 'lidlar.royxat', 1)) return ctx.reply("Lidlarni ko'rishga ruxsatingiz yo'q.");

        const leads = await prisma.lead.findMany({
            where: { schoolId },
            take: 5,
            orderBy: { createdAt: 'desc' }
        });

        if (leads.length === 0) return ctx.reply("Yangi lidlar topilmadi.");

        let msg = "📢 Oxirgi tushgan lidlar:\n\n";
        leads.forEach(l => {
            msg += `👤 ${l.name} | 📞 ${l.phone}\n`;
            msg += `📚 Kurs: ${l.course} | 🗓 ${l.createdAt.toLocaleDateString()}\n\n`;
        });

        ctx.reply(msg);
    });

    botInstance.hears('📊 Kunlik Hisobot', async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'admin') return;
        const ruxsat = await xodimRuxsati(user.data);
        if (!yetadimi(ruxsat, 'bosh.korsatkich', 1)) return ctx.reply("Hisobotni ko'rishga ruxsatingiz yo'q.");

        const today = new Date().toISOString().split('T')[0];

        const [studentsCount, leadsToday, paymentsToday] = await Promise.all([
            prisma.student.count({ where: { schoolId } }),
            prisma.lead.count({ where: { schoolId, createdAt: { gte: new Date(today) } } }),
            prisma.payment.aggregate({
                where: { schoolId, date: today },
                _sum: { amount: true }
            })
        ]);

        let msg = `📊 Kunlik Hisobot (${today})\n\n`;
        msg += `👥 Jami o'quvchilar: ${studentsCount}\n`;
        msg += `🆕 Bugungi lidlar: ${leadsToday}\n`;
        // Tushum — faqat pul ko'rsatkichlarini ko'radiganga.
        if (yetadimi(ruxsat, 'bosh.pul', 1)) msg += `💰 Bugungi tushum: ${(paymentsToday._sum.amount || 0).toLocaleString()} UZS\n`;

        ctx.reply(msg);
    });

    botInstance.hears('📧 Ommaviy xabar', async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'admin') {
            return ctx.reply("Bu buyruq faqat xodimlar uchun.");
        }
        if (!yetadimi(await xodimRuxsati(user.data), 'xabarlar.yuborish', 2)) {
            return ctx.reply("Ommaviy xabar yuborishga ruxsatingiz yo'q.");
        }

        adminStates[ctx.from.id] = 'AWAITING_BROADCAST';
        ctx.reply(
            "Hammaga yuborilishi kerak bo'lgan xabarni kiriting (yoki Bekor qilish uchun quyidagi tugmani bosing):", 
            Markup.keyboard([['❌ Bekor qilish']]).resize()
        );
    });

    // Guest Handlers
    botInstance.hears('ℹ️ Markaz haqida', async (ctx) => {
        const schoolId = await filial(ctx);
        const settings = await getSchoolSettings(schoolId);
        const courses = schoolId
            ? await prisma.course.findMany({ where: { schoolId }, select: { name: true }, take: 20 })
            : [];

        const NL = String.fromCharCode(10);
        const lines = [(settings && settings.orgName) || "O'quv markazi", ''];
        if (courses.length > 0) {
            lines.push('Kurslarimiz:');
            courses.forEach(c => lines.push('• ' + c.name));
            lines.push('');
        }
        if (settings && settings.address) lines.push('📍 ' + settings.address);
        const raqamlar = [settings && settings.adminPhone, settings && settings.adminPhone2].filter(Boolean);
        if (raqamlar.length) lines.push('📞 ' + raqamlar.join(', '));
        if (settings && settings.workingHours) lines.push('🕒 ' + settings.workingHours);

        await replyWithLogo(ctx, schoolId, lines.join(NL).trim());
    });

    // Markaz nuqtasi Sozlamalarda belgilansa o'sha yuboriladi; belgilanmagan
    // bo'lsa eski qattiq yozilgan nuqta — CRM xaritasi ham aynan shunday
    // ishlaydi (StudentLocationMap dagi ZAXIRA_MARKAZ).
    botInstance.hears('📍 Geolokatsiya', async (ctx) => {
        const schoolId = await filial(ctx);
        const settings = await getSchoolSettings(schoolId);
        let lat = 38.4833, lng = 67.9333;
        const belgilangan = settings && settings.centerLocation;
        if (belgilangan && belgilangan.includes(',')) {
            const [a, b] = belgilangan.split(',').map(Number);
            if (isFinite(a) && isFinite(b)) { lat = a; lng = b; }
        }
        ctx.replyWithLocation(lat, lng);
    });

    botInstance.hears('📞 Kontaktlar', (ctx) => {
        ctx.reply("Biz bilan bog'lanish uchun o'quv markazimiz ma'muriyatiga murojaat qiling.");
    });

    botInstance.hears('📝 Sinov darsiga yozilish', (ctx) => {
        ctx.reply("Iltimos, ismingiz va qaysi kursga qiziqayotganingizni yozib qoldiring. \n\nMasalan: Ali, Ingliz tili");
    });

    // Message handler for trial registration and general text
    botInstance.on('text', async (ctx, next) => {
        const schoolId = await filial(ctx);
        const tid = ctx.from.id;
        const text = ctx.message.text;

        // Payme "Boshqa summa" javobi — bizning ForceReply xabarimizga reply.
        const replyTo = ctx.message.reply_to_message;
        const paymeMatch = replyTo?.from?.is_bot ? PAYME_PROMPT_RE.exec(replyTo.text || '') : null;
        if (paymeMatch) {
            const student = await paymeStudent(ctx, paymeMatch[1] ? parseInt(paymeMatch[1]) : undefined);
            if (!student) return;
            const amount = parseInt(text.replace(/[^\d]/g, ''), 10);
            if (!Number.isInteger(amount)) return ctx.reply("Faqat raqam yozing, masalan: 500000");
            return paymeSendLink(ctx, student, amount);
        }

        if (adminStates[tid] === 'AWAITING_BROADCAST') {
            const xodim = await findUser(tid, schoolId);
            const xodimR = xodim?.type === 'admin' ? await xodimRuxsati(xodim.data) : null;
            if (text === '❌ Bekor qilish') {
                delete adminStates[tid];
                return ctx.reply('Bekor qilindi.', getAdminMenu(xodimR));
            }

            delete adminStates[tid];
            // Ruxsat shu orada olib qo'yilgan bo'lishi mumkin — yuborishdan oldin yana tekshiramiz.
            if (!yetadimi(xodimR, 'xabarlar.yuborish', 2)) return ctx.reply("Ommaviy xabar yuborishga ruxsatingiz yo'q.", getAdminMenu(xodimR));
            const statusMsg = await ctx.reply("Xabar yuborilmoqda...");

            try {
                const [students, teachers, users] = await Promise.all([
                    prisma.student.findMany({ where: { telegramId: { not: null }, schoolId }, select: { telegramId: true } }),
                    prisma.teacher.findMany({ where: { telegramId: { not: null }, schoolId }, select: { telegramId: true } }),
                    prisma.user.findMany({ where: { telegramId: { not: null }, schoolId }, select: { telegramId: true } })
                ]);

                const allTids = new Set([
                    ...students.map(s => s.telegramId),
                    ...teachers.map(t => t.telegramId),
                    ...users.map(u => u.telegramId)
                ]);

                let successCount = 0;
                for (const targetId of allTids) {
                    try {
                        await botInstance.telegram.sendMessage(targetId, text);
                        successCount++;
                    } catch (e) {
                        console.error(`Broadcast failed for ${targetId}:`, e.message);
                    }
                }

                await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
                return ctx.reply(`Xabar ${successCount} ta foydalanuvchiga muvaffaqiyatli yuborildi! ✅`, getAdminMenu(xodimR));
            } catch (err) {
                console.error("Broadcast global error:", err);
                return ctx.reply("Xabar yuborishda xatolik yuz berdi.", getAdminMenu(xodimR));
            }
        }

        if (text.startsWith('/') || ['📅', '💳', '✅', '📊', '🎒', '💰', '📢', '📧', '⚙️', '📝', 'ℹ️', '📍', '📞', '👤', '🚪'].some(icon => text.includes(icon))) {
            return next();
        }

        if (text.includes(',') && text.length > 5) {
            const [name, course] = text.split(',').map(s => s.trim());
            const phone = "Bot orqali";

            await prisma.lead.create({
                data: {
                    name,
                    course,
                    phone,
                    source: 'Telegram Bot',
                    schoolId: schoolId || 1,
                }
            });

            return ctx.reply("Rahmat! Sizning so'rovingiz qabul qilindi. Tez orada adminlarimiz bog'lanishadi.");
        }

        next();
    });
};

// Default static bot setup
if (process.env.TELEGRAM_BOT_TOKEN) {
    bot.telegram.webhookReply = false;
    setupBotHandlers(bot, 1);
}

// Get bot instance dynamically
export const getTelegramBot = async (schoolId) => {
    if (!schoolId) {
        return bot;
    }
    // Token keshlanmaydi: Sozlamalarda o'zgartirilsa darhol yangisi ishlasin.
    const settings = await prisma.setting.findUnique({ where: { schoolId: Number(schoolId) } });
    let token = (settings && settings.telegram && settings.telegram.includes(':'))
        ? settings.telegram.trim()
        : null;

    // Filialning o'z boti bo'lmasa — markazning boti. Markazda bitta bot bor
    // va u hamma filialga xizmat qiladi (Langar filialida Setting qatori ham
    // yo'q edi), shuning uchun o'sha filialga yuborilgan xabar tashkilotning
    // sozlangan filiali boti orqali ketadi.
    if (!token) {
        for (const id of await orgSchoolIds(schoolId)) {
            if (id === Number(schoolId)) continue;
            const other = await prisma.setting.findUnique({ where: { schoolId: id }, select: { telegram: true } });
            if (other?.telegram && other.telegram.includes(':')) { token = other.telegram.trim(); break; }
        }
    }
    if (!token) token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token || token === 'fake_token_for_init') return null;
    
    let instance = botCache.get(token);
    if (!instance) {
        instance = new Telegraf(token);
        // Webhook javobi orqali yuborish o'chiq: aks holda birinchi
        // answerCbQuery/reply HTTP javobni yopadi va Vercel undan keyingi
        // ishni (masalan "Qabul qildim" dagi 20 ta yozuv) to'xtatib qo'yishi
        // mumkin. Endi javob ishlov berish tugagach yopiladi.
        instance.telegram.webhookReply = false;
        setupBotHandlers(instance, Number(schoolId));
        botCache.set(token, instance);
    }
    return instance;
};

/**
 * Rahbarlarga xabar: tashkilotdagi har bir ADMIN (u barcha filiallarni
 * boshqaradi — ilgari faqat shu filialdagisi olardi, Langar filialidagi
 * hodisa hech kimga yetmasdi) va shu filial menejerlari. Xodimning ikkinchi
 * raqamiga bog'langan Telegram (telegramId2) ham oladi.
 */
export const notifyAdmins = async (message, schoolId) => {
    const ids = schoolId ? await orgSchoolIds(schoolId) : [];
    const rahbarlar = await prisma.user.findMany({
        where: {
            role: { in: ['ADMIN', 'MANAGER'] },
            status: { not: 'Arxiv' },
            OR: [{ telegramId: { not: null } }, { telegramId2: { not: null } }],
            ...(ids.length ? { schoolId: { in: ids } } : {}),
        },
        select: { name: true, role: true, schoolId: true, telegramId: true, telegramId2: true },
    });

    const schoolBot = await getTelegramBot(schoolId);
    if (!schoolBot) return;

    const chatlar = new Set();
    for (const r of rahbarlar) {
        if (r.role === 'MANAGER' && schoolId && r.schoolId !== Number(schoolId)) continue;
        for (const chat of [r.telegramId, r.telegramId2]) if (chat) chatlar.add(String(chat));
    }
    for (const chat of chatlar) {
        try {
            await schoolBot.telegram.sendMessage(chat, message);
        } catch (e) {
            console.error(`Rahbarga (${chat}) xabar yuborib bo'lmadi:`, e.message);
        }
    }
};

export const startBot = () => {
    if (process.env.TELEGRAM_BOT_TOKEN) {
        bot.launch();
        console.log('Default Telegram Bot started via polling');
    }
};

export default bot;
