// Qarz eslatmasidagi "✅ To'laganman" tugmasi (services/qarzXabari.js).
//
// Egasi (2026-09-26): "может быть, они на самом деле уже платили, но мы не
// написали". Ota-ona tugmani bossa — bot qachon, qancha va kimga
// to'laganini yoki chek rasmini so'raydi (ForceReply). Javob QarzJavob bo'lib
// yoziladi, administratorlarga boradi va xodim tekshirmaguncha shu o'quvchiga
// avtomatik eslatma ketmaydi. Xodim CRM da yopgach natija shu chatga keladi.
//
//   qj_t_<studentId>  — "✅ To'laganman"
//   javob belgisi     — so'rov oxirida "· Q<studentId>" (serverda holat
//                       saqlanmaydi: Vercel'da har so'rov boshqa konteynerda)
import { javobYarat, kimdanTuri } from '../../services/qarzXabari.js';

const JAVOB_RE = /·\sQ(\d+)\s*$/;

const ismKor = (name) => {
    const n = String(name || '').replace(/\s+/g, ' ').trim();
    if (n !== n.toUpperCase()) return n;
    return n.toLowerCase().replace(/(^|[\s-'])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
};

export function registerQarzJavob(bot, { findUser, filial }) {
    /** Bosgan odam — shu o'quvchining o'zi yoki ota-onasi bo'lsa: { user, student }. */
    const oila = async (ctx, studentId) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || !(user.type === 'student' || String(user.type).startsWith('parent_'))) return null;
        const bolalar = Array.isArray(user.farzandlar) && user.farzandlar.length ? user.farzandlar : [user.data].filter(Boolean);
        const student = bolalar.find(s => s.id === studentId);
        return student ? { user, student } : null;
    };

    bot.action(/^qj_t_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const o = await oila(ctx, Number(ctx.match[1]));
        if (!o) return ctx.reply("Bu o'quvchi sizning ro'yxatingizda yo'q. Avval /start bosib telefon raqamingizni yuboring.");
        return ctx.reply(
            `✍️ ${ismKor(o.student.name)} uchun qachon, qancha va kimga to'laganingizni yozing yoki chek rasmini yuboring — shu xabarga javob qilib.\n· Q${o.student.id}`,
            { reply_markup: { force_reply: true, input_field_placeholder: '5-sentabr, 500 000, naqd, kassaga', selective: true } }
        );
    });

    /** ForceReply ga javob (matn yoki rasm). Boshqa xabarlar keyingi ishlovchiga. */
    const qabul = async (ctx, next, { matn = null, rasm = null }) => {
        const replyTo = ctx.message?.reply_to_message;
        const m = replyTo?.from?.is_bot ? JAVOB_RE.exec(replyTo.text || replyTo.caption || '') : null;
        if (!m) return next();
        const o = await oila(ctx, Number(m[1]));
        if (!o) return ctx.reply("Bu o'quvchi sizning ro'yxatingizda yo'q.");
        if (!matn && !rasm) return ctx.reply("To'lov haqida yozing yoki chek rasmini yuboring.");
        try {
            await javobYarat({ studentId: o.student.id, kimdan: kimdanTuri(o.user.type), tgChat: ctx.chat.id, matn, rasm });
        } catch (e) {
            console.error('[Qarz javobi]', e.message);
            return ctx.reply("Hozir qabul qilib bo'lmadi, birozdan keyin qayta urinib ko'ring.");
        }
        return ctx.reply(
            "✅ Rahmat! Ma'lumotingiz administratorga yetkazildi. Tekshirib, shu yerga javob beramiz.\n" +
            "Tekshirilguncha to'lov eslatmasi yuborilmaydi." +
            (rasm ? '' : "\n\nChek rasmi bo'lsa, uni ham shu xabarga javob qilib yuboring.")
        );
    };

    bot.on('text', (ctx, next) => qabul(ctx, next, { matn: ctx.message.text }));
    bot.on('photo', (ctx, next) => {
        const rasmlar = ctx.message.photo || [];
        return qabul(ctx, next, { matn: ctx.message.caption || null, rasm: rasmlar[rasmlar.length - 1]?.file_id || null });
    });
    // Chek fayl sifatida (PDF yoki siqilmagan rasm) yuborilsa ham.
    bot.on('document', (ctx, next) => qabul(ctx, next, { matn: ctx.message.caption || null, rasm: ctx.message.document?.file_id || null }));
}
