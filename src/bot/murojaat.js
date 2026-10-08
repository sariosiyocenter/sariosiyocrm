// Shikoyat va takliflar: rahbariyatga, ustozga ham — va javob yozish.
//
// Egasi (2026-10-08): "o'quvchi va ota-ona shikoyati o'qituvchiga ham borishi,
// unga javob berish imkoniyati". Ilgari matn rahbarlarga oddiy xabar bo'lib
// ketardi: saqlanmasdi, ustoz ko'rmasdi, javob yozib bo'lmasdi.
//
// Endi murojaat bazaga yoziladi (Murojaat / MurojaatJavob) va yozishma bo'ladi:
//
//   ✍️ Shikoyat va takliflar → kimga?  mj_r (rahbariyat) | mj_t_<ustoz>_<o'quvchi>
//   → matn (ForceReply "· SH" yoki "· SHT<ustoz>_<o'quvchi>")
//   → rahbarlar va ustoz oladi, har birida «✍️ Javob yozish» (mj_j_<id> → "· MJ<id>")
//   → javob muallifga boradi, unda «↩️ Javob yozish» (mj_y_<id> → "· MY<id>")
//
// Ustozga yozilgan murojaat rahbariyatga ham boradi — ustoz ko'rmay qolsa yoki
// botga ulanmagan bo'lsa ham e'tiborsiz qolmasin.
import { Markup } from 'telegraf';
import prisma from '../../lib/prisma.js';

export const MUROJAAT_TUGMASI = '✍️ Shikoyat va takliflar';
const YANGI_RE = /·\sSH(?:T(\d+)_(\d+))?\s*$/;
const JAVOB_RE = /·\sMJ(\d+)\s*$/;
const DAVOM_RE = /·\sMY(\d+)\s*$/;
const ENG_UZUN = 3000;

const ismKor = (name) => {
    const n = String(name || '').replace(/\s+/g, ' ').trim();
    if (n !== n.toUpperCase()) return n;
    return n.toLowerCase().replace(/(^|[\s-'])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
};
const qisqa = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const soraq = (joy) => ({ reply_markup: { force_reply: true, input_field_placeholder: joy, selective: true } });

export function registerMurojaat(bot, { findUser, filial, rahbarChatlari, asosiyMenyu }) {
    const oilami = (u) => !!u && (u.type === 'student' || String(u.type).startsWith('parent_'));
    const bolalar = (u) => (Array.isArray(u.farzandlar) && u.farzandlar.length ? u.farzandlar : [u.data].filter(Boolean));

    /** Farzandlarning ustozlari: [{ teacher, kurs, studentId }] — har ustoz bir marta. */
    const ustozlar = async (ids) => {
        if (!ids.length) return [];
        const kurslar = await prisma.group.findMany({
            where: { students: { some: { id: { in: ids } } } },
            select: {
                name: true,
                teacher: { select: { id: true, name: true, status: true } },
                teacher2: { select: { id: true, name: true, status: true } },
                students: { where: { id: { in: ids } }, select: { id: true } },
            },
            orderBy: { name: 'asc' },
        });
        const royxat = new Map();
        for (const g of kurslar) {
            for (const t of [g.teacher, g.teacher2]) {
                if (!t || t.status === 'Arxiv' || royxat.has(t.id)) continue;
                royxat.set(t.id, { teacher: t, kurs: g.name, studentId: g.students[0]?.id });
            }
        }
        return [...royxat.values()].filter(x => x.studentId);
    };

    const matnSorovi = (ctx, kimga, belgi) => ctx.reply(
        `✍️ ${kimga} yozmoqchi bo'lgan shikoyat yoki taklifingizni shu xabarga javob qilib yozing.\n${belgi}`,
        soraq('Shikoyat yoki taklif...')
    );

    bot.hears(MUROJAAT_TUGMASI, async (ctx) => {
        const schoolId = await filial(ctx);
        const u = await findUser(ctx.from.id, schoolId);
        const us = oilami(u) ? await ustozlar(bolalar(u).map(s => s.id)) : [];
        if (!us.length) return matnSorovi(ctx, 'Rahbariyatga', '· SH');
        return ctx.reply(
            "Sizning fikringiz biz uchun muhim! ✍️\n\nKimga yozmoqchisiz?\nUstozga yozilgan murojaatni rahbariyat ham ko'radi.",
            Markup.inlineKeyboard([
                ...us.slice(0, 8).map(x => [Markup.button.callback(qisqa(`👨‍🏫 ${x.teacher.name} — ${x.kurs}`, 60), `mj_t_${x.teacher.id}_${x.studentId}`)]),
                [Markup.button.callback('🏢 Faqat rahbariyatga', 'mj_r')],
            ])
        );
    });

    bot.action('mj_r', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        return matnSorovi(ctx, 'Rahbariyatga', '· SH');
    });

    bot.action(/^mj_t_(\d+)_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const t = await prisma.teacher.findUnique({ where: { id: Number(ctx.match[1]) }, select: { name: true } });
        if (!t) return matnSorovi(ctx, 'Rahbariyatga', '· SH');
        return matnSorovi(ctx, `Ustoz ${t.name} ga`, `· SHT${ctx.match[1]}_${ctx.match[2]}`);
    });

    /** Yozgan odam kim: { kimdan, ism, telefon, studentId, schoolId }. */
    const muallif = (ctx, u, schoolId, studentId) => {
        const tg = [[ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' '), ctx.from.username ? '@' + ctx.from.username : ''].filter(Boolean).join(' ');
        if (oilami(u)) {
            const royxat = bolalar(u);
            const s = royxat.find(x => x.id === studentId) || u.data;
            const rol = u.type === 'parent_father' ? 'Ota' : u.type === 'parent_mother' ? 'Ona' : "O'quvchi";
            return {
                kimdan: u.type, studentId: s.id, schoolId: s.schoolId || schoolId,
                ism: `${rol} — ${(studentId ? [s] : royxat).map(f => ismKor(f.name)).join(', ')}`,
                telefon: (u.type === 'parent_father' ? s.fatherPhone : u.type === 'parent_mother' ? s.motherPhone : s.phone) || null,
            };
        }
        if (u) {
            const rol = u.type === 'teacher' ? 'Ustoz' : u.type === 'driver' ? 'Haydovchi' : 'Xodim';
            return { kimdan: u.type, studentId: null, schoolId: u.data.schoolId || schoolId, ism: `${rol} — ${u.data.name}`, telefon: u.data.phone || null };
        }
        return { kimdan: 'guest', studentId: null, schoolId, ism: `Mehmon: ${tg || ctx.from.id}`, telefon: null };
    };

    const javobTugmasi = (id) => Markup.inlineKeyboard([[Markup.button.callback('✍️ Javob yozish', `mj_j_${id}`)]]);
    const davomTugmasi = (id) => Markup.inlineKeyboard([[Markup.button.callback('↩️ Javob yozish', `mj_y_${id}`)]]);

    /** Murojaatni (yoki uning davomini) rahbarlar va ustozga yetkazadi. @returns ustozga yetdimi */
    const tarqat = async (ctx, m, matn, { ustozgaYetmadi = '' } = {}) => {
        const tugma = javobTugmasi(m.id);
        const chatlar = (await rahbarChatlari(m.schoolId)).filter(c => c !== String(ctx.from.id));
        for (const chat of chatlar) {
            await ctx.telegram.sendMessage(chat, matn + ustozgaYetmadi, tugma).catch(e => console.error(`[Murojaat] rahbarga (${chat}):`, e.message));
        }
        return chatlar.length;
    };

    const yangiMurojaat = async (ctx, schoolId, matn, teacherId, studentId) => {
        const u = await findUser(ctx.from.id, schoolId);
        const kim = muallif(ctx, u, schoolId, studentId);
        // Ustoz — faqat o'z farzandining ustozi: tugmadagi raqam almashtirilgan bo'lsa murojaat
        // begona ustozga ketmaydi, faqat rahbariyatga boradi.
        const ozUstozi = teacherId && oilami(u) && (await ustozlar(bolalar(u).map(s => s.id))).some(x => x.teacher.id === teacherId);
        const ustoz = ozUstozi ? await prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true, name: true, telegramId: true, status: true } }) : null;
        const m = await prisma.murojaat.create({
            data: {
                schoolId: kim.schoolId, studentId: kim.studentId, kimdan: kim.kimdan, ism: kim.ism, telefon: kim.telefon,
                tgChat: String(ctx.from.id), teacherId: ustoz?.id || null, matn,
            },
        });
        const bosh = `✍️ Murojaat №${m.id}\n👤 ${kim.ism}${kim.telefon ? `\n📞 ${kim.telefon}` : ''}${ustoz ? `\n👨‍🏫 Ustozga: ${ustoz.name}` : ''}\n\n${matn}`;

        let ustozgaYetdi = false;
        if (ustoz?.telegramId && ustoz.status !== 'Arxiv') {
            ustozgaYetdi = await ctx.telegram.sendMessage(ustoz.telegramId, bosh, javobTugmasi(m.id)).then(() => true)
                .catch(e => { console.error('[Murojaat] ustozga:', e.message); return false; });
        }
        const rahbarlar = await tarqat(ctx, m, bosh, { ustozgaYetmadi: ustoz && !ustozgaYetdi ? "\n\n⚠️ Ustoz botga ulanmagan — unga yetib bormadi." : '' });
        // Hech kim botga ulanmagan bo'lsa "yetkazildi" deyilmaydi — murojaat bazada saqlangan.
        if (!rahbarlar && !ustozgaYetdi) {
            return ctx.reply("✅ Murojaatingiz qabul qilindi. Javob shu yerga keladi.", await asosiyMenyu(u));
        }

        const javob = ustoz
            ? (ustozgaYetdi ? `✅ Rahmat! Murojaatingiz ustoz ${ustoz.name} ga va rahbariyatga yetkazildi.` : "✅ Rahmat! Murojaatingiz rahbariyatga yetkazildi (ustoz hozircha botga ulanmagan — unga rahbariyat yetkazadi).")
            : "✅ Rahmat! Murojaatingiz rahbariyatga yetkazildi.";
        return ctx.reply(`${javob}\nJavob shu yerga keladi.`, await asosiyMenyu(u));
    };

    // Javob yozish: xodim (rahbar) yoki shu murojaat yuborilgan ustoz.
    const javobBeruvchi = async (ctx, m) => {
        const schoolId = await filial(ctx);
        const u = await findUser(ctx.from.id, schoolId);
        if (!u) return null;
        if (u.type === 'admin') {
            // Murojaatni olganlar: tashkilot administratorlari va shu filial menejeri (rahbarChatlari).
            const mening = (await rahbarChatlari(m.schoolId)).includes(String(ctx.from.id));
            return mening ? { kimdan: 'xodim', ism: `Ma'muriyat (${u.data.name})`, user: u } : null;
        }
        if (u.type === 'teacher' && m.teacherId === u.data.id) return { kimdan: 'ustoz', ism: `Ustoz ${u.data.name}`, user: u };
        return null;
    };

    bot.action(/^mj_j_(\d+)$/, async (ctx) => {
        const m = await prisma.murojaat.findUnique({ where: { id: Number(ctx.match[1]) } });
        if (!m) return ctx.answerCbQuery('Murojaat topilmadi', { show_alert: true }).catch(() => {});
        if (!(await javobBeruvchi(ctx, m))) return ctx.answerCbQuery("Bu murojaatga javob yozishga ruxsatingiz yo'q", { show_alert: true }).catch(() => {});
        await ctx.answerCbQuery().catch(() => {});
        return ctx.reply(
            `✍️ №${m.id} murojaatga javobingizni shu xabarga javob qilib yozing.\nU ${m.ism} ga yuboriladi.\n· MJ${m.id}`,
            soraq('Javob matni...')
        );
    });

    bot.action(/^mj_y_(\d+)$/, async (ctx) => {
        const m = await prisma.murojaat.findUnique({ where: { id: Number(ctx.match[1]) } });
        if (!m || m.tgChat !== String(ctx.from.id)) return ctx.answerCbQuery('Murojaat topilmadi', { show_alert: true }).catch(() => {});
        await ctx.answerCbQuery().catch(() => {});
        return ctx.reply(`↩️ №${m.id} murojaat bo'yicha javobingizni shu xabarga javob qilib yozing.\n· MY${m.id}`, soraq('Javob matni...'));
    });

    bot.on('text', async (ctx, next) => {
        const replyTo = ctx.message.reply_to_message;
        const soroq = replyTo?.from?.is_bot ? (replyTo.text || '') : '';
        const yangi = YANGI_RE.exec(soroq);
        const javob = JAVOB_RE.exec(soroq);
        const davom = DAVOM_RE.exec(soroq);
        if (!yangi && !javob && !davom) return next();

        // Bot so'rovlarini xabar oxiridagi "· XX" belgisidan taniydi. Murojaat matni boshqalarga
        // bot xabari bo'lib boradi — undagi "·" belgi bo'lib o'qilmasligi uchun almashtiriladi
        // (aks holda "· R12" bilan tugagan shikoyatga javob yozgan rahbar 12-to'lovni rad etib qo'yardi).
        const matn = ctx.message.text.trim().replace(/·/g, '•');
        if (matn.length < 2) return ctx.reply("Matn juda qisqa — to'liqroq yozing.");
        if (matn.length > ENG_UZUN) return ctx.reply(`Matn juda uzun — ${ENG_UZUN} belgidan qisqaroq yozing.`);
        const schoolId = await filial(ctx);

        try {
            if (yangi) return await yangiMurojaat(ctx, schoolId, matn, yangi[1] ? Number(yangi[1]) : null, yangi[2] ? Number(yangi[2]) : null);

            const m = await prisma.murojaat.findUnique({ where: { id: Number((javob || davom)[1]) } });
            if (!m) return ctx.reply('Murojaat topilmadi.');

            if (javob) {
                const kim = await javobBeruvchi(ctx, m);
                if (!kim) return ctx.reply("Bu murojaatga javob yozishga ruxsatingiz yo'q.");
                await prisma.murojaatJavob.create({ data: { murojaatId: m.id, kimdan: kim.kimdan, ism: kim.ism, tgChat: String(ctx.from.id), matn } });
                await prisma.murojaat.update({ where: { id: m.id }, data: { holat: 'javob_berildi' } });
                const yetdi = await ctx.telegram.sendMessage(
                    m.tgChat,
                    `📩 Murojaatingizga javob keldi (№${m.id})\n👤 ${kim.ism}\n\n${matn}\n\n— Sizning murojaatingiz: «${qisqa(m.matn, 200)}»`,
                    davomTugmasi(m.id)
                ).then(() => true).catch(e => { console.error('[Murojaat] javob:', e.message); return false; });

                // Boshqa oluvchilar ham javob berilganini bilsin (ikki kishi bir xil javob yozmasin).
                const xabar = `💬 №${m.id} murojaatga javob berildi\n👤 ${kim.ism}\n\n${matn}\n\n— Murojaat (${m.ism}): «${qisqa(m.matn, 200)}»`;
                for (const chat of (await rahbarChatlari(m.schoolId)).filter(c => c !== String(ctx.from.id))) {
                    await ctx.telegram.sendMessage(chat, xabar).catch(() => {});
                }
                if (kim.kimdan !== 'ustoz' && m.teacherId) {
                    const t = await prisma.teacher.findUnique({ where: { id: m.teacherId }, select: { telegramId: true } });
                    if (t?.telegramId && t.telegramId !== String(ctx.from.id)) await ctx.telegram.sendMessage(t.telegramId, xabar).catch(() => {});
                }
                return ctx.reply(yetdi ? `✅ Javobingiz ${m.ism} ga yuborildi.` : "⚠️ Javob saqlandi, lekin yuborib bo'lmadi — murojaat egasi botni to'xtatgan bo'lishi mumkin.");
            }

            // Muallifning davomi.
            if (m.tgChat !== String(ctx.from.id)) return ctx.reply('Murojaat topilmadi.');
            await prisma.murojaatJavob.create({ data: { murojaatId: m.id, kimdan: 'muallif', ism: m.ism, tgChat: String(ctx.from.id), matn } });
            await prisma.murojaat.update({ where: { id: m.id }, data: { holat: 'yangi' } });
            const bosh = `↩️ №${m.id} murojaat bo'yicha yana yozdi\n👤 ${m.ism}${m.telefon ? `\n📞 ${m.telefon}` : ''}\n\n${matn}\n\n— Birinchi murojaat: «${qisqa(m.matn, 200)}»`;
            if (m.teacherId) {
                const t = await prisma.teacher.findUnique({ where: { id: m.teacherId }, select: { telegramId: true, status: true } });
                if (t?.telegramId && t.status !== 'Arxiv') await ctx.telegram.sendMessage(t.telegramId, bosh, javobTugmasi(m.id)).catch(() => {});
            }
            await tarqat(ctx, m, bosh);
            return ctx.reply('✅ Yuborildi. Javob shu yerga keladi.');
        } catch (e) {
            console.error('[Murojaat]', e.message);
            return ctx.reply("Hozir qabul qilib bo'lmadi, birozdan keyin qayta urinib ko'ring.");
        }
    });
}
