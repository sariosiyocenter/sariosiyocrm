// Telefon raqamni botda SMS kod bilan almashtirish — services/telefonKod.js.
//
// Egasi (2026-10-08): "sms kod bilan telefon nomer o'zgartirish". Ilgari raqam
// faqat CRM da, xodim qo'li bilan o'zgarardi: ota-ona raqamini almashtirsa SMS
// lar eski raqamga ketaverardi.
//
//   Profil → «📱 Raqamni o'zgartirish» (tel_boshla)
//   → yangi raqam so'raladi   (ForceReply, belgi "· TR")
//   → o'sha raqamga SMS kod   (ForceReply, belgi "· TK<id>")
//   → kod to'g'ri bo'lsa raqam shu odamning yozuvlarida almashtiriladi.
//
// Serverda holat yo'q (Vercel): bosqich so'rov xabaridagi belgidan taniladi.
import { Markup } from 'telegraf';
import prisma from '../../lib/prisma.js';
import { raqamYashir } from '../../lib/tolovXabari.js';
import { kodYubor, kodTekshir, KOD_MUDDATI_DAQIQA } from '../../services/telefonKod.js';

const RAQAM_BELGI = '· TR';
const RAQAM_RE = /·\sTR\s*$/;
const KOD_RE = /·\sTK(\d+)\s*$/;

export const telefonTugmasi = () => Markup.inlineKeyboard([[Markup.button.callback("📱 Raqamni o'zgartirish", 'tel_boshla')]]);

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
 * @returns {Promise<{ kim: string, eski: string[] }>} kim — rahbarlarga xabar uchun
 */
export async function raqamniAlmashtir(user, tid, yangi) {
    const tidStr = String(tid);
    const eski = new Set();
    const qosh = (v) => { if (v && oxirgi9(v) !== oxirgi9(yangi)) eski.add(v); };

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
        return { kim: `${[...new Set(bolalar)].join(', ')} (${rol})`, eski: [...eski] };
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
        return { kim: `${t.name} (ustoz)`, eski: [...eski] };
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
    return { kim: `${u.name} (${user.type === 'driver' ? 'haydovchi' : 'xodim'}${ikkinchi ? ', 2-raqam' : ''})`, eski: [...eski] };
}

export function registerTelefon(bot, { findUser, filial, notifyAdmins, asosiyMenyu }) {
    const kim = async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        return { schoolId: user?.data?.schoolId || schoolId, user };
    };

    const raqamSorovi = (ctx, boshi = '') => ctx.reply(
        `${boshi}📱 Yangi telefon raqamingizni shu xabarga javob qilib yozing.\nMasalan: 90 123 45 67\n\nShu raqamga SMS orqali tasdiqlash kodi boradi.\n${RAQAM_BELGI}`,
        { reply_markup: { force_reply: true, input_field_placeholder: '90 123 45 67', selective: true } }
    );

    bot.action('tel_boshla', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const { user } = await kim(ctx);
        if (!user) return ctx.reply("Avval /start bosib ro'yxatdan o'ting.");
        return raqamSorovi(ctx);
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
            if (n.xato) {
                // Rahbarlarga soatiga bir marta (har urinishda emas) — n.ogohlantir.
                if (n.moderatsiya && n.ogohlantir && notifyAdmins) {
                    await notifyAdmins(
                        "⚠️ Botda telefon raqamni almashtirish ishlamadi: kod yuboriladigan SMS matni Eskizda hali tasdiqlanmagan.\n" +
                        "CRM → Xabarlar → Shablonlar → «TELEFON RAQAMNI ALMASHTIRISH KODI» holatini tekshiring.",
                        schoolId
                    ).catch(() => {});
                }
                // Raqam noto'g'ri yozilgan bo'lsa — qayta so'raymiz.
                return n.raqamXato ? raqamSorovi(ctx, `❗️ ${n.xato}\n\n`) : ctx.reply(`❗️ ${n.xato}`);
            }
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
        let natija;
        try {
            natija = await raqamniAlmashtir(user, ctx.from.id, t.telefon);
        } catch (e) {
            console.error('[Telefon almashtirish]', e.message);
            return ctx.reply("Raqam tasdiqlandi, lekin saqlashda xatolik bo'ldi. Markaz ma'muriga murojaat qiling.");
        }
        if (notifyAdmins) {
            await notifyAdmins(
                `📱 Telefon raqam o'zgardi (botda, SMS kod bilan)\n👤 ${natija.kim}\n` +
                `${natija.eski.length ? `Eski: ${natija.eski.join(', ')}\n` : ''}Yangi: ${t.telefon}`,
                schoolId
            ).catch(() => {});
        }
        return ctx.reply(`✅ Telefon raqamingiz o'zgartirildi: ${t.telefon}\nEndi SMS xabarlar shu raqamga keladi.`, await asosiyMenyu(user));
    });
}
