// Botdagi ikki narsa (egasi, 2026-09-26):
//
// 1. Klik to'lovini administrator Telegram'da tasdiqlaydi yoki rad etadi
//    ("telegramda bitirish kerak tasdiqlashlarni"). Xabarni
//    services/klikTasdiq.js yuboradi; bu yerda — uning tugmalari:
//      tt_ok_<id>   ✅ Tasdiqlash  → ikkinchi so'rov (tasodifan bosilmasin)
//      tt_ha_<id>   ✔️ Ha, pul keldi → Payment yoziladi, balansga tushadi
//      tt_rad_<id>  ❌ Rad etish    → tayyor sabablar
//      tt_s_<id>_<i> tayyor sabab bilan rad etish
//      tt_sb_<id>   ✏️ boshqa sabab → ForceReply, javob "· R<id>" belgisidan taniladi
//      tt_orq_<id>  ↩️ Orqaga
//    Serverda holat saqlanmaydi (Vercel'da har so'rov boshqa konteynerda).
//
// 2. "🆔 ID raqam" — ota-ona farzandining 5 xonali ID sini so'rab oladi
//    ("o'quvchi ota onasi uni telegramdan so'rab ola olsin to'lov qilish uchun").
import prisma from '../../lib/prisma.js';
import {
    tasdiqniBajar, radniBajar, jurnalgaYoz, tasdiqlovchimi, chekVaqtiMatni,
    kutishTugmalari, tasdiqSorovTugmalari, sababTugmalari, TAYYOR_SABABLAR,
} from '../../services/klikTasdiq.js';
import { kodlarniTaminla } from '../../services/oquvchiKod.js';
import { loadSettings as paymeLoadSettings, isConfigured as paymeIsConfigured } from '../../services/payme.js';

const RAD_PROMPT_RE = /·\sR(\d+)\s*$/;
/** "BOBORAJABOV QILICHBEK" → "Boborajabov Qilichbek". */
const ismKor = (name) => {
    const n = String(name || '').replace(/\s+/g, ' ').trim();
    if (n !== n.toUpperCase()) return n;
    return n.toLowerCase().replace(/(^|[\s-])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
};
const som = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\s/g, ' ');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function registerKlikTasdiq(bot, { findUser, filial }) {
    /** Yozgan odam — administrator xodimmi (User). */
    const adminniOl = async (ctx) => {
        const schoolId = await filial(ctx);
        const u = await findUser(ctx.from.id, schoolId);
        return u?.type === 'admin' ? u.data : null;
    };
    const kim = (a) => ({ id: a.id, name: a.name, role: a.role });

    /**
     * Tugma bosilganda: bosgan — shu to'lovni tasdiqlay oladigan administrator,
     * to'lov hali kutilmoqda. Aks holda sababini aytadi va null.
     */
    const tekshir = async (ctx, id) => {
        const admin = await adminniOl(ctx);
        const row = await prisma.tolovTasdiq.findUnique({ where: { id } });
        if (!admin || !row || !(await tasdiqlovchimi(admin, row))) {
            await ctx.answerCbQuery("Faqat administrator tasdiqlaydi", { show_alert: true }).catch(() => {});
            return null;
        }
        if (row.status !== 'kutilmoqda') {
            const kimdan = row.reviewedByName ? ` — ${row.reviewedByName}` : '';
            await ctx.answerCbQuery(`Bu to'lov allaqachon ko'rib chiqilgan: ${row.status}${kimdan}`, { show_alert: true }).catch(() => {});
            await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
            return null;
        }
        return { admin, row };
    };

    const tugmani = (ctx, markup) => ctx.editMessageReplyMarkup(markup.reply_markup).catch(() => {});

    bot.action(/^tt_ok_(\d+)$/, async (ctx) => {
        const q = await tekshir(ctx, Number(ctx.match[1]));
        if (!q) return;
        await ctx.answerCbQuery().catch(() => {});
        await tugmani(ctx, tasdiqSorovTugmalari(q.row.id));
    });

    bot.action(/^tt_orq_(\d+)$/, async (ctx) => {
        const q = await tekshir(ctx, Number(ctx.match[1]));
        if (!q) return;
        await ctx.answerCbQuery().catch(() => {});
        await tugmani(ctx, kutishTugmalari(q.row.id));
    });

    bot.action(/^tt_rad_(\d+)$/, async (ctx) => {
        const q = await tekshir(ctx, Number(ctx.match[1]));
        if (!q) return;
        await ctx.answerCbQuery().catch(() => {});
        await tugmani(ctx, sababTugmalari(q.row.id));
    });

    bot.action(/^tt_ha_(\d+)$/, async (ctx) => {
        const q = await tekshir(ctx, Number(ctx.match[1]));
        if (!q) return;
        const r = await tasdiqniBajar(q.row, kim(q.admin));
        if (!r.ok) {
            await ctx.answerCbQuery(r.error, { show_alert: true }).catch(() => {});
            return;
        }
        await jurnalgaYoz(q.row, kim(q.admin), 'tasdiqlandi');
        // Xabar matni va tugmalari qarorniTarqat da yangilangan; bu xabar
        // ro'yxatda bo'lmasa ham (eski xabar) tugmalar qolmasin.
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
        // To'lov SMS i holati (services/tolovXabari.js): yuborildi / navbatda / ketmadi.
        const h = r.xabar?.holat;
        const sms = ['yuborildi', 'yetkazildi'].includes(h) ? ' Ota-onaga SMS yuborildi.'
          : ['kutmoqda', 'yuborilmoqda'].includes(h) ? " SMS navbatda — o'zi yuboriladi."
            : h === 'xato' ? ` SMS ketmadi: ${r.xabar.sabab || ''}` : '';
        await ctx.answerCbQuery(`✅ Tasdiqlandi — ${som(q.row.amount)} so'm balansga tushdi.${sms}`, { show_alert: true }).catch(() => {});
    });

    const radEt = async (ctx, q, sabab) => {
        const r = await radniBajar(q.row, sabab, kim(q.admin));
        if (!r.ok) return { xato: r.error };
        await jurnalgaYoz(q.row, kim(q.admin), 'rad etildi', r.reason);
        return { ok: true };
    };

    bot.action(/^tt_s_(\d+)_(\d)$/, async (ctx) => {
        const q = await tekshir(ctx, Number(ctx.match[1]));
        if (!q) return;
        const sabab = TAYYOR_SABABLAR[Number(ctx.match[2])];
        if (!sabab) return ctx.answerCbQuery().catch(() => {});
        const r = await radEt(ctx, q, sabab);
        if (r.xato) return ctx.answerCbQuery(r.xato, { show_alert: true }).catch(() => {});
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
        await ctx.answerCbQuery(`❌ Rad etildi: ${sabab}`).catch(() => {});
    });

    bot.action(/^tt_sb_(\d+)$/, async (ctx) => {
        const q = await tekshir(ctx, Number(ctx.match[1]));
        if (!q) return;
        await ctx.answerCbQuery().catch(() => {});
        const student = await prisma.student.findUnique({ where: { id: q.row.studentId }, select: { name: true } });
        await ctx.reply(
            `✏️ Rad etish sababini yozing (shu xabarga javob qilib):\n${ismKor(student?.name || '')}, ${som(q.row.amount)} so'm, chek ${chekVaqtiMatni(q.row.paidAt)}\n· R${q.row.id}`,
            { reply_markup: { force_reply: true, input_field_placeholder: 'Sabab...', selective: true } }
        );
    });

    // "Boshqa sabab" javobi. Boshqa har qanday matn keyingi ishlovchiga o'tadi.
    bot.on('text', async (ctx, next) => {
        const replyTo = ctx.message?.reply_to_message;
        const m = replyTo?.from?.is_bot ? RAD_PROMPT_RE.exec(replyTo.text || '') : null;
        if (!m) return next();
        const admin = await adminniOl(ctx);
        const row = await prisma.tolovTasdiq.findUnique({ where: { id: Number(m[1]) } });
        if (!admin || !row || !(await tasdiqlovchimi(admin, row))) return ctx.reply('Faqat administrator rad eta oladi.');
        if (row.status !== 'kutilmoqda') return ctx.reply(`Bu to'lov allaqachon ko'rib chiqilgan: ${row.status}${row.reviewedByName ? ` — ${row.reviewedByName}` : ''}`);
        const sabab = String(ctx.message.text || '').trim();
        if (!sabab) return ctx.reply('Sababni yozing.');
        const r = await radEt(ctx, { admin, row }, sabab);
        if (r.xato) return ctx.reply(`❌ ${r.xato}`);
        return ctx.reply(`❌ Rad etildi — ${som(row.amount)} so'm balansga tushmadi.\nSabab: ${sabab}`);
    });

    // --- 🆔 ID raqam ---------------------------------------------------------
    bot.hears('🆔 ID raqam', async (ctx) => {
        const schoolId = await filial(ctx);
        const u = await findUser(ctx.from.id, schoolId);
        if (!u || (u.type !== 'student' && !String(u.type).startsWith('parent_'))) {
            return ctx.reply("O'quvchi ID si o'quvchi va ota-onalarga ko'rsatiladi. Avval /start bosib telefon raqamingizni yuboring.");
        }
        const bolalar = (Array.isArray(u.farzandlar) && u.farzandlar.length ? u.farzandlar : [u.data]).filter(Boolean);
        let kodlar;
        try {
            kodlar = await kodlarniTaminla(bolalar.map(s => s.id));
        } catch (e) {
            console.error("[bot] O'quvchi ID:", e.message);
            return ctx.reply("ID ni hozir olib bo'lmadi, birozdan keyin qayta urinib ko'ring.");
        }
        const kop = bolalar.length > 1;
        const qatorlar = [kop ? "🆔 <b>Farzandlaringizning ID raqamlari</b>" : "🆔 <b>O'quvchi ID raqami</b>", ''];
        for (const s of bolalar) {
            qatorlar.push(`👤 ${esc(ismKor(s.name))}`, `🆔 <code>${kodlar.get(s.id) ?? '—'}</code>`, '');
        }
        const payme = await paymeLoadSettings(bolalar[0]?.schoolId || schoolId).catch(() => null);
        if (payme && paymeIsConfigured(payme) && payme.paymeMode === 'live') {
            qatorlar.push(
                `Payme ilovasida markazimizni toping va o'quvchi ID si so'ralgan joyga ${kop ? "farzandingizning" : 'shu'} 5 xonali raqamni yozing, keyin summani kiriting. Pul o'quvchining balansiga tushadi.`,
                '',
                "Raqamni bosib nusxa olishingiz mumkin. Havola orqali to'lash uchun — «💳 To'lovlar».",
            );
        } else {
            qatorlar.push("Bu raqam o'quvchiga doimiy beriladi va boshqa hech kimda takrorlanmaydi. Raqamni bosib nusxa olishingiz mumkin.");
        }
        return ctx.reply(qatorlar.join('\n').trim(), { parse_mode: 'HTML' });
    });
}
