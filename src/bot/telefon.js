// Telefon raqamni botda almashtirish — services/telefonKod.js.
//
// Egasi (2026-10-08): "sms kod bilan telefon nomer o'zgartirish". Ilgari raqam
// faqat CRM da, xodim qo'li bilan o'zgarardi: ota-ona raqamini almashtirsa SMS
// lar eski raqamga ketaverardi.
//
// 2026-10-10: Eskiz kod SMS i matnini rad etdi va bo'lim butunlay ishlamay
// qoldi. Endi ikki yo'l bor, birinchisi Eskizga bog'liq emas:
//
//   Profil → «📱 Raqamni o'zgartirish» (tel_boshla) → klaviatura:
//   1) «📱 Telegramdagi raqamimni yuborish» (request_contact). Kontakt shu
//      odamning o'ziniki bo'lsa (contact.user_id === from.id), raqamni Telegram
//      o'zi tasdiqlagan — darhol almashtiriladi, SMS yo'q.
//   2) «✏️ Boshqa raqamni yozish» → yangi raqam (ForceReply, belgi "· TR")
//      → o'sha raqamga SMS kod (ForceReply, belgi "· TK<id>")
//      → kod to'g'ri bo'lsa raqam almashtiriladi.
//      SMS matni Eskizda tasdiqlanmagan bo'lsa bu yo'l taklif qilinmaydi va
//      odamga nima qilish mumkinligi aytiladi (Telegram raqami yoki ma'mur).
//
// Ikkala yo'l ham raqamni bitta joyda almashtiradi (yakunla → raqamniAlmashtir).
//
// Serverda holat yo'q (Vercel): bosqich so'rov xabaridagi belgidan taniladi.
// Kontakt ro'yxatdan o'tgan odamdan kelsa — raqam almashtirish, aks holda
// ro'yxatdan o'tish (bot.js dagi 'contact'). Shuning uchun bu fayl bot.js dagi
// 'contact' ishlovchisidan OLDIN ulanadi va begona yangilanishda next() qiladi.
import { Markup } from 'telegraf';
import prisma from '../../lib/prisma.js';
import { raqamYashir } from '../../lib/tolovXabari.js';
import {
    kodYubor, kodTekshir, smsHolati, ogohlantirishKerak, bazaRaqami, KOD_MUDDATI_DAQIQA, KOD_SHABLONI,
} from '../../services/telefonKod.js';

const RAQAM_BELGI = '· TR';
const RAQAM_RE = /·\sTR\s*$/;
const KOD_RE = /·\sTK(\d+)\s*$/;

const TG_RAQAM = '📱 Telegramdagi raqamimni yuborish';
const BOSHQA_RAQAM = '✏️ Boshqa raqamni yozish';
// manzil.js dagi bilan bir xil matn: menyuni o'sha yerdagi ishlovchi qaytaradi.
const ORQAGA = '⬅️ Menyuga qaytish';

export const telefonTugmasi = () => Markup.inlineKeyboard([[Markup.button.callback("📱 Raqamni o'zgartirish", 'tel_boshla')]]);

/** smsBor — SMS kod yo'li hozir ishlaydi (matn Eskizda tasdiqlangan). */
const klaviatura = (smsBor) => Markup.keyboard([
    [Markup.button.contactRequest(TG_RAQAM)],
    ...(smsBor ? [[BOSHQA_RAQAM]] : []),
    [ORQAGA],
]).resize();

const kirishMatni = (smsBor) => "📱 Telefon raqamni o'zgartirish\n\n" + (smsBor
    ? `1️⃣ Telegramingiz yangi raqamingizga ulangan bo'lsa — pastdagi «${TG_RAQAM}» tugmasini bosing. Markazdagi raqamingiz darhol o'shanga o'zgaradi, SMS kerak emas.\n\n` +
      `2️⃣ Boshqa raqam bo'lsa — «${BOSHQA_RAQAM}» ni bosing: o'sha raqamga SMS orqali tasdiqlash kodi boradi.`
    : `Telegramingiz yangi raqamingizga ulangan bo'lsa — pastdagi «${TG_RAQAM}» tugmasini bosing. Markazdagi raqamingiz darhol o'shanga o'zgaradi.\n\n` +
      "Boshqa raqamga o'zgartirish (SMS kod bilan) hozircha ishlamayapti. Bunday holda markaz ma'muriga murojaat qiling — raqamni u o'zgartirib beradi.");

const SMS_YOQ = "Hozircha SMS orqali kod yuborib bo'lmaydi: SMS matni aloqa operatori tasdig'idan o'tmagan.\n\n" +
    "Nima qilish mumkin:\n" +
    `• Telegramingiz yangi raqamingizga ulangan bo'lsa — «${TG_RAQAM}» tugmasini bosing, SMS kerak emas.\n` +
    "• Aks holda markaz ma'muriga murojaat qiling — raqamni u o'zgartirib beradi.";

// Rahbarlarga: SMS kod yo'li nega ishlamayapti va nima qilish kerak (holat — kodSmsHolati).
const SHABLON_JOYI = `CRM → Xabarlar → Shablonlar → «${KOD_SHABLONI.name}»`;
const UNGACHA = "Ungacha odamlar raqamni faqat Telegramdagi raqamiga o'zgartira oladi yoki sizga murojaat qiladi.";
const OGOH = {
    rad: "⚠️ Botda telefon raqamni SMS kod bilan almashtirish ishlamayapti: kod yuboriladigan SMS matnini Eskiz rad etgan.\n" +
        `${SHABLON_JOYI}: matnni o'zgartirib saqlang — Eskizga o'zi qayta yuboriladi.\n${UNGACHA}`,
    tekshiruvda: "ℹ️ Botda telefon raqamni SMS kod bilan almashtirish hozircha ishlamaydi: kod yuboriladigan SMS matni Eskiz tekshiruvida (odatda 1 ish kuni). Tasdiqlangach o'zi ishlaydi.\n" +
        `Holati: ${SHABLON_JOYI}.\n${UNGACHA}`,
    ulanmagan: "⚠️ Botda telefon raqamni SMS kod bilan almashtirish ishlamayapti: kod yuboriladigan SMS matni Eskizga yetib bormagan.\n" +
        `${SHABLON_JOYI} kartasida sababi yozilgan — o'sha yerda «Eskizga qayta yuborish» ni bosing.\n${UNGACHA}`,
};

const oxirgi9 = (v) => {
    const d = String(v || '').replace(/\D/g, '');
    return d.length >= 9 ? d.slice(-9) : '';
};
const ismKor = (name) => {
    const n = String(name || '').replace(/\s+/g, ' ').trim();
    if (n !== n.toUpperCase()) return n;
    return n.toLowerCase().replace(/(^|[\s-'])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
};

/**
 * Shu Telegram hisobiga tegishli raqam(lar)ni yangisiga almashtiradi.
 * @returns {Promise<{ kim: string, eski: string[], ozgardi: boolean }>} kim — rahbarlarga xabar uchun;
 *          ozgardi — biror yozuvdagi raqam haqiqatan boshqa edi (yo'q bo'lsa hech narsa o'zgarmagan)
 */
export async function raqamniAlmashtir(user, tid, yangi) {
    const tidStr = String(tid);
    const eski = new Set();
    let ozgardi = false;
    const qosh = (v) => {
        if (oxirgi9(v) === oxirgi9(yangi)) return;
        ozgardi = true;
        if (v) eski.add(v);
    };

    if (user.type === 'student' || String(user.type).startsWith('parent_')) {
        const [ota, ona, ozi] = await Promise.all([
            prisma.student.findMany({ where: { fatherTelegramId: tidStr }, select: { id: true, name: true, fatherPhone: true } }),
            prisma.student.findMany({ where: { motherTelegramId: tidStr }, select: { id: true, name: true, motherPhone: true } }),
            prisma.student.findMany({ where: { telegramId: tidStr }, select: { id: true, name: true, phone: true } }),
        ]);
        ota.forEach(s => qosh(s.fatherPhone));
        ona.forEach(s => qosh(s.motherPhone));
        ozi.forEach(s => qosh(s.phone));
        await Promise.all([
            ota.length && prisma.student.updateMany({ where: { id: { in: ota.map(s => s.id) } }, data: { fatherPhone: yangi } }),
            ona.length && prisma.student.updateMany({ where: { id: { in: ona.map(s => s.id) } }, data: { motherPhone: yangi } }),
            ozi.length && prisma.student.updateMany({ where: { id: { in: ozi.map(s => s.id) } }, data: { phone: yangi } }),
        ].filter(Boolean));
        const rol = ota.length ? 'otasi' : ona.length ? 'onasi' : "o'quvchi";
        const bolalar = [...ota, ...ona, ...ozi].map(s => ismKor(s.name));
        return { kim: `${[...new Set(bolalar)].join(', ')} (${rol})`, eski: [...eski], ozgardi };
    }

    if (user.type === 'teacher') {
        const t = await prisma.teacher.findUnique({ where: { id: user.data.id }, select: { id: true, name: true, phone: true, userId: true } });
        qosh(t.phone);
        await prisma.teacher.update({ where: { id: t.id }, data: { phone: yangi } });
        // Ustoz va xodim yozuvi bitta odam: xodim kartasidagi o'sha raqam ham yangilanadi.
        if (t.userId) {
            const u = await prisma.user.findUnique({ where: { id: t.userId }, select: { phone: true } });
            if (u && (!u.phone || oxirgi9(u.phone) === oxirgi9(t.phone))) await prisma.user.update({ where: { id: t.userId }, data: { phone: yangi } });
        }
        return { kim: `${t.name} (ustoz)`, eski: [...eski], ozgardi };
    }

    // Xodim yoki haydovchi. Ikkinchi Telegram (telegramId2) — ikkinchi raqam.
    const u = await prisma.user.findUnique({ where: { id: user.data.id }, select: { id: true, name: true, phone: true, phone2: true, telegramId: true, telegramId2: true } });
    const ikkinchi = u.telegramId !== tidStr && u.telegramId2 === tidStr;
    qosh(ikkinchi ? u.phone2 : u.phone);
    await prisma.user.update({ where: { id: u.id }, data: ikkinchi ? { phone2: yangi } : { phone: yangi } });
    if (!ikkinchi) {
        const t = await prisma.teacher.findFirst({ where: { userId: u.id }, select: { id: true, phone: true } });
        if (t && oxirgi9(t.phone) === oxirgi9(u.phone)) await prisma.teacher.update({ where: { id: t.id }, data: { phone: yangi } });
    }
    return { kim: `${u.name} (${user.type === 'driver' ? 'haydovchi' : 'xodim'}${ikkinchi ? ', 2-raqam' : ''})`, eski: [...eski], ozgardi };
}

export function registerTelefon(bot, { findUser, filial, notifyAdmins, asosiyMenyu }) {
    const kim = async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        return { schoolId: user?.data?.schoolId || schoolId, user };
    };

    /** SMS kod yo'li ishlamayotganini rahbarlarga aytadi — har urinishda emas (ogohlantirishKerak). */
    const ogohlantir = async (schoolId, holat) => {
        if (!notifyAdmins || !OGOH[holat]) return;
        try {
            if (await ogohlantirishKerak(schoolId)) await notifyAdmins(OGOH[holat], schoolId);
        } catch (e) {
            console.error('[Telefon] ogohlantirish:', e.message);
        }
    };

    const raqamSorovi = (ctx, boshi = '') => ctx.reply(
        `${boshi}📱 Yangi telefon raqamingizni shu xabarga javob qilib yozing.\nMasalan: 90 123 45 67\n\nShu raqamga SMS orqali tasdiqlash kodi boradi.\n${RAQAM_BELGI}`,
        { reply_markup: { force_reply: true, input_field_placeholder: '90 123 45 67', selective: true } }
    );

    /** Tasdiqlangan raqamni yozadi, rahbarlarga xabar beradi va menyuni qaytaradi (ikkala yo'l uchun bitta). */
    const yakunla = async (ctx, user, schoolId, telefon, usul) => {
        let natija;
        try {
            natija = await raqamniAlmashtir(user, ctx.from.id, telefon);
        } catch (e) {
            console.error('[Telefon almashtirish]', e.message);
            return ctx.reply("Raqam tasdiqlandi, lekin saqlashda xatolik bo'ldi. Markaz ma'muriga murojaat qiling.", await asosiyMenyu(user));
        }
        if (!natija.ozgardi) {
            return ctx.reply(
                `ℹ️ ${telefon} markazda allaqachon sizning raqamingiz sifatida yozilgan — hech narsa o'zgarmadi.\n` +
                "Boshqa raqamga o'zgartirish kerak bo'lsa: 👤 Profil → «📱 Raqamni o'zgartirish».",
                await asosiyMenyu(user)
            );
        }
        if (notifyAdmins) {
            await notifyAdmins(
                `📱 Telefon raqam o'zgardi (botda, ${usul})\n👤 ${natija.kim}\n` +
                `${natija.eski.length ? `Eski: ${natija.eski.join(', ')}\n` : ''}Yangi: ${telefon}`,
                schoolId
            ).catch(() => {});
        }
        return ctx.reply(
            `✅ Telefon raqamingiz o'zgartirildi.\n${natija.eski.length ? `Eski: ${natija.eski.join(', ')}\n` : ''}Yangi: ${telefon}\n` +
            "Endi SMS xabarlar yangi raqamga keladi. Xato bo'lsa — markaz ma'muriga ayting.",
            await asosiyMenyu(user)
        );
    };

    bot.action('tel_boshla', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const { user, schoolId } = await kim(ctx);
        if (!user) return ctx.reply("Avval /start bosib ro'yxatdan o'ting.");
        const holat = await smsHolati(schoolId);
        if (holat !== 'tayyor') await ogohlantir(schoolId, holat);
        return ctx.reply(kirishMatni(holat === 'tayyor'), klaviatura(holat === 'tayyor'));
    });

    bot.hears(BOSHQA_RAQAM, async (ctx) => {
        const { user, schoolId } = await kim(ctx);
        if (!user) return ctx.reply("Avval /start bosib ro'yxatdan o'ting.");
        const holat = await smsHolati(schoolId);
        if (holat === 'tayyor') return raqamSorovi(ctx);
        await ogohlantir(schoolId, holat);
        return ctx.reply(`❗️ ${SMS_YOQ}`, klaviatura(false));
    });

    // Telegramdagi o'z raqami. Ro'yxatdan o'tmagan odamning kontakti — ro'yxatdan o'tish (bot.js).
    bot.on('contact', async (ctx, next) => {
        const { user, schoolId } = await kim(ctx);
        if (!user) return next();
        const k = ctx.message.contact;
        // Faqat o'z raqami: begona kontakt (yoki user_id siz vizitka) hech narsani tasdiqlamaydi.
        if (!k.user_id || k.user_id !== ctx.from.id) {
            return ctx.reply(
                "❗️ Bu kontakt sizning Telegram raqamingiz emas, shuning uchun raqam o'zgartirilmadi.\n" +
                "Raqamingizni o'zgartirish uchun: 👤 Profil → «📱 Raqamni o'zgartirish»."
            );
        }
        const telefon = bazaRaqami(k.phone_number);
        if (!telefon) {
            return ctx.reply(
                "❗️ Telegramdagi raqamingiz O'zbekiston raqami emas — unga SMS xabar yuborib bo'lmaydi, shuning uchun raqam o'zgartirilmadi.\n" +
                "Markaz ma'muriga murojaat qiling.",
                await asosiyMenyu(user)
            );
        }
        return yakunla(ctx, user, schoolId, telefon, 'Telegram raqami bilan');
    });

    bot.on('text', async (ctx, next) => {
        const replyTo = ctx.message.reply_to_message;
        const soroq = replyTo?.from?.is_bot ? (replyTo.text || '') : '';
        const kodMos = KOD_RE.exec(soroq);
        if (!kodMos && !RAQAM_RE.test(soroq)) return next();

        const { user, schoolId } = await kim(ctx);
        if (!user) return ctx.reply("Avval /start bosib ro'yxatdan o'ting.");
        const matn = ctx.message.text.trim();

        // 1-bosqich: yangi raqam.
        if (!kodMos) {
            const n = await kodYubor({ tgChat: ctx.from.id, telefon: matn, schoolId });
            if (n.moderatsiya) {
                await ogohlantir(schoolId, n.holat);
                return ctx.reply(`❗️ ${SMS_YOQ}`, klaviatura(false));
            }
            // Raqam noto'g'ri yozilgan bo'lsa — qayta so'raymiz.
            if (n.xato) return n.raqamXato ? raqamSorovi(ctx, `❗️ ${n.xato}\n\n`) : ctx.reply(`❗️ ${n.xato}`);
            return ctx.reply(
                `📩 ${raqamYashir(matn)} raqamiga SMS orqali 5 xonali kod yuborildi.\nKodni shu xabarga javob qilib yozing (${KOD_MUDDATI_DAQIQA} daqiqa amal qiladi).\n· TK${n.id}`,
                { reply_markup: { force_reply: true, input_field_placeholder: '5 xonali kod', selective: true } }
            );
        }

        // 2-bosqich: kod.
        const t = await kodTekshir({ id: Number(kodMos[1]), tgChat: ctx.from.id, kod: matn });
        if (t.xato) {
            if (t.tugadi) return ctx.reply(`❗️ ${t.xato}`, telefonTugmasi());
            return ctx.reply(
                `❗️ ${t.xato}\nKodni shu xabarga javob qilib yozing.\n· TK${kodMos[1]}`,
                { reply_markup: { force_reply: true, input_field_placeholder: '5 xonali kod', selective: true } }
            );
        }
        return yakunla(ctx, user, schoolId, t.telefon, 'SMS kod bilan');
    });
}
