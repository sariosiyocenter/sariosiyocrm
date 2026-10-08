// O'quvchi (yoki ota-ona) manzilini botdan yuboradi — services/oquvchiJoyi.js.
//
// Egasi (2026-10-08): "o'quvchi telegram bot orqali lokatsiyasini kirgizsin,
// dynamic qilish — har darsda boshqa joyga borishim mumkin". Shuning uchun
// yuborilgan joylashuv uch xil saqlanadi: faqat bugun, faqat ertaga yoki doimiy.
// Bir kunlik manzil kuni o'tgach o'zi doimiysiga qaytadi.
//
//   📍 Manzilim               — hozirgi manzil va yuborish tugmasi
//   joylashuv xabari           — "Qachon uchun?" (mz_<tur>_<lat>_<lng>)
//   mzk_<tur>_<sid>_<lat>_<lng> — bir nechta farzand: kim uchun (sid=0 — hammasi)
//   mzx_<joyId>                — bir kunlik manzilni bekor qilish
//
// Serverda holat saqlanmaydi (Vercel'da har so'rov boshqa konteynerda):
// koordinata tugmaning o'zida turadi.
import { Markup } from 'telegraf';
import { toDateStr } from '../../lib/lessons.js';
import { parseLatLng } from '../../lib/tartib.js';
import {
    nuqtaMatni, xaritaHavolasi, ertangiKun, manzilniYoz, manzilniBekorQil, kunlikManzillar, kunlikJoylarniQolla,
} from '../../services/oquvchiJoyi.js';

export const MANZIL_TUGMASI = '📍 Manzilim';
const ORQAGA = '⬅️ Menyuga qaytish';

const ismKor = (name) => {
    const n = String(name || '').replace(/\s+/g, ' ').trim();
    if (n !== n.toUpperCase()) return n;
    return n.toLowerCase().replace(/(^|[\s-'])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const kunMatni = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}`;
const TUR = { b: 'bugun', e: 'ertaga', d: 'doimiy' };
const KOORD = '(-?\\d{1,3}\\.\\d{1,6})_(-?\\d{1,3}\\.\\d{1,6})';

const yuborishKlaviaturasi = () => Markup.keyboard([
    [Markup.button.locationRequest('📍 Hozirgi joyimni yuborish')],
    [ORQAGA],
]).resize();

export function registerManzil(bot, { findUser, filial, notifyAdmins, asosiyMenyu }) {
    const oilami = (u) => !!u && (u.type === 'student' || String(u.type).startsWith('parent_'));
    const bolalar = (u) => (Array.isArray(u.farzandlar) && u.farzandlar.length ? u.farzandlar : [u.data].filter(Boolean));

    /** Bosgan odam oila a'zosi bo'lsa — { user, bolalar }, aks holda null. */
    const oila = async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        return oilami(user) ? { user, bolalar: bolalar(user) } : null;
    };

    bot.hears(MANZIL_TUGMASI, async (ctx) => {
        const o = await oila(ctx);
        if (!o) return ctx.reply("Bu bo'lim o'quvchi va ota-onalar uchun. Avval /start bosib telefon raqamingizni yuboring.");
        const bugun = toDateStr();
        await kunlikJoylarniQolla(bugun).catch(e => console.error('[Manzil]', e.message));
        // Yangilangan manzilni o'qish uchun qayta so'raymiz.
        const yangi = await oila(ctx);
        const royxat = yangi ? yangi.bolalar : o.bolalar;
        const kunlik = await kunlikManzillar(royxat.map(s => s.id), bugun);

        const qatorlar = royxat.map(s => {
            const bosh = royxat.length > 1 ? `👤 <b>${esc(ismKor(s.name))}</b>\n` : '';
            const k = kunlik.filter(j => j.studentId === s.id);
            const amalda = k.find(j => j.holat === 'qollandi');
            const doimiy = amalda ? amalda.avvalgi : s.location;
            let m = bosh;
            m += parseLatLng(doimiy)
                ? `🏠 Doimiy manzil: <a href="${xaritaHavolasi(doimiy)}">xaritada ko'rish</a>\n`
                : "🏠 Doimiy manzil: hali kiritilmagan\n";
            for (const j of k) {
                m += `📅 ${j.sana === bugun ? 'Bugun' : kunMatni(j.sana)} uchun: <a href="${xaritaHavolasi(j.location)}">boshqa manzil</a>\n`;
            }
            if (!s.needsTransport) m += "ℹ️ Transportga yozilmagan — manzil markazda saqlanadi.\n";
            return m;
        }).join('\n');

        return ctx.reply(
            `📍 <b>Manzil</b>\n\n${qatorlar}\n` +
            "Manzilni kiritish yoki o'zgartirish uchun pastdagi tugma bilan <b>hozir turgan joyingizni</b> yuboring.\n" +
            "Boshqa joyni ko'rsatmoqchi bo'lsangiz: 📎 → Joylashuv → xaritadan nuqtani tanlang.\n\n" +
            "Keyin bot so'raydi: faqat bugun uchunmi, ertaga uchunmi yoki doimiy.",
            { parse_mode: 'HTML', disable_web_page_preview: true, ...yuborishKlaviaturasi() }
        );
    });

    bot.hears(ORQAGA, async (ctx) => {
        const schoolId = await filial(ctx);
        const user = await findUser(ctx.from.id, schoolId);
        return ctx.reply('📋 Asosiy menyu', await asosiyMenyu(user));
    });

    // Joylashuv xabari. Haydovchiniki bot.js da (jonli joylashuv) — unga tegilmaydi.
    bot.on('location', async (ctx, next) => {
        const o = await oila(ctx);
        if (!o) return next();
        const loc = ctx.message.location;
        const nuqta = nuqtaMatni(loc.latitude, loc.longitude);
        if (!nuqta) return ctx.reply("Joylashuvni o'qib bo'lmadi, qayta yuborib ko'ring.");
        const [lat, lng] = nuqta.split(',');
        const bugun = toDateStr();
        return ctx.reply(
            `📍 Joylashuv qabul qilindi.\n\nBu manzil qachon uchun?`,
            {
                reply_to_message_id: ctx.message.message_id,
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(`📅 Faqat bugun (${kunMatni(bugun)})`, `mz_b_${lat}_${lng}`)],
                    [Markup.button.callback(`📅 Faqat ertaga (${kunMatni(ertangiKun(bugun))})`, `mz_e_${lat}_${lng}`)],
                    [Markup.button.callback('🏠 Doimiy manzil', `mz_d_${lat}_${lng}`)],
                ]),
            }
        );
    });

    /** Tanlangan farzand(lar)ga manzilni yozadi va javob matnini qaytaradi. */
    const yoz = async (ctx, o, tur, kimlar, nuqta) => {
        const bugun = toDateStr();
        const natijalar = [];
        for (const s of kimlar) {
            const n = await manzilniYoz({
                studentId: s.id, schoolId: s.schoolId, nuqta, tur,
                kimdan: o.user.type, tgChat: String(ctx.chat.id), bugun,
            });
            natijalar.push({ s, n });
        }
        const ismlar = kimlar.map(s => ismKor(s.name)).join(', ');
        const havola = `<a href="${xaritaHavolasi(nuqta)}">xaritada ko'rish</a>`;
        let matn;
        if (tur === 'doimiy') {
            matn = `✅ Doimiy manzil saqlandi — ${havola}.` +
                (natijalar.some(x => x.n.bugunBoshqa) ? "\nBugun uchun alohida manzil kiritilgan edi: bugun o'sha, ertadan yangi doimiy manzil ishlaydi." : '');
        } else {
            const sana = natijalar[0].n.sana;
            matn = `✅ ${tur === 'bugun' ? 'Bugun' : `Ertaga (${kunMatni(sana)})`} uchun manzil saqlandi — ${havola}.\n` +
                "Shu kundan keyin o'zi doimiy manzilga qaytadi.";
        }
        if (o.bolalar.length > 1) matn += `\n👤 ${esc(ismlar)}`;

        const bekor = tur === 'doimiy' ? [] : natijalar.filter(x => x.n.joyId).map(x =>
            [Markup.button.callback(`↩️ Bekor qilish${kimlar.length > 1 ? ` — ${(ismKor(x.s.name).split(' ')[1] || ismKor(x.s.name))}` : ''}`, `mzx_${x.n.joyId}`)]);
        await ctx.editMessageText(matn, { parse_mode: 'HTML', disable_web_page_preview: true, ...Markup.inlineKeyboard(bekor) }).catch(() => {});

        // Transportda qatnaydigan bolaning manzili o'zgarsa — reja tuzuvchilar bilsin.
        const transportdagi = kimlar.filter(s => s.needsTransport);
        if (transportdagi.length && notifyAdmins) {
            const qachon = tur === 'doimiy' ? 'doimiy manzil' : tur === 'bugun' ? 'BUGUN uchun manzil' : `ertaga (${kunMatni(natijalar[0].n.sana)}) uchun manzil`;
            const kim = o.user.type === 'parent_father' ? 'otasi' : o.user.type === 'parent_mother' ? 'onasi' : "o'zi";
            await notifyAdmins(
                `📍 Manzil o'zgardi (botdan, ${kim})\n👤 ${transportdagi.map(s => ismKor(s.name)).join(', ')}\n🗓 ${qachon}\n🗺 ${xaritaHavolasi(nuqta)}`,
                transportdagi[0].schoolId
            ).catch(e => console.error('[Manzil] xabar:', e.message));
        }
    };

    bot.action(new RegExp(`^mz_([bed])_${KOORD}$`), async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const o = await oila(ctx);
        if (!o) return ctx.reply("Avval /start bosib telefon raqamingizni yuboring.");
        const [, t, lat, lng] = ctx.match;
        const nuqta = nuqtaMatni(lat, lng);
        if (!nuqta) return;
        if (o.bolalar.length > 1) {
            return ctx.editMessageText('👨‍👩‍👧‍👦 Bu manzil kim uchun?', Markup.inlineKeyboard([
                [Markup.button.callback('Barcha farzandlarim', `mzk_${t}_0_${lat}_${lng}`)],
                ...o.bolalar.slice(0, 8).map(s => [Markup.button.callback(ismKor(s.name).slice(0, 40), `mzk_${t}_${s.id}_${lat}_${lng}`)]),
            ])).catch(() => {});
        }
        return yoz(ctx, o, TUR[t], o.bolalar, nuqta);
    });

    bot.action(new RegExp(`^mzk_([bed])_(\\d+)_${KOORD}$`), async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const o = await oila(ctx);
        if (!o) return ctx.reply("Avval /start bosib telefon raqamingizni yuboring.");
        const [, t, sid, lat, lng] = ctx.match;
        const nuqta = nuqtaMatni(lat, lng);
        const kimlar = Number(sid) ? o.bolalar.filter(s => s.id === Number(sid)) : o.bolalar;
        if (!nuqta || !kimlar.length) return ctx.editMessageText("Bu o'quvchi sizning ro'yxatingizda yo'q.").catch(() => {});
        return yoz(ctx, o, TUR[t], kimlar, nuqta);
    });

    bot.action(/^mzx_(\d+)$/, async (ctx) => {
        const o = await oila(ctx);
        if (!o) return ctx.answerCbQuery("Avval /start bosing", { show_alert: true }).catch(() => {});
        const joyId = Number(ctx.match[1]);
        // Faqat o'z farzandining manzili.
        const mening = (await kunlikManzillar(o.bolalar.map(s => s.id), toDateStr())).find(j => j.id === joyId);
        if (!mening) return ctx.answerCbQuery('Bu manzil allaqachon bekor qilingan yoki muddati tugagan', { show_alert: true }).catch(() => {});
        await manzilniBekorQil(joyId);
        await ctx.answerCbQuery('Bekor qilindi').catch(() => {});
        return ctx.editMessageText('↩️ Bir kunlik manzil bekor qilindi — doimiy manzil amalda.').catch(() => {});
    });
}
