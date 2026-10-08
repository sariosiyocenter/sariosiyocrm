// Xodim (administrator, menejer, resepshn) uchun bot bo'limlari.
//
// Egasi (2026-10-08): "adminni telegram botini yaxshilash". Ilgari menyuda uchta
// tugma bor edi: oxirgi 5 ta lid, bir qatorli kunlik hisobot (faqat o'z filiali)
// va ommaviy xabar. Rahbar telefonidan markazda nima bo'layotganini ko'ra olmasdi.
// Endi:
//
//   📊 Kunlik Hisobot    — tushum (usullar, filiallar bo'yicha), oy boshidan, chiqim,
//                          davomat, yangi o'quvchi va lidlar, qarzdorlik, tug'ilgan
//                          kunlar; ◀️ ▶️ bilan boshqa kunlar           ab_h_<sana>
//   📅 Bugungi darslar   — kurslar vaqti bo'yicha, yo'qlama qilinganmi   ab_d_<sana>
//   💰 Qarzdorlar        — jami va ro'yxat, sahifalab                    ab_q_<sahifa>
//   📢 Yangi Lidlar      — sahifalab, telefon va holati bilan            ab_l_<sahifa>
//   🔎 O'quvchi qidirish — ism, telefon yoki ID; kartasi                 ab_o_<id>
//                          (xodim oddiy matn yozsa ham qidiradi)
//
// Hammasi lavozim ruxsatiga bo'ysunadi (Sozlamalar → Ruxsatlar): pul — bosh.pul /
// oquvchilar.balans ko'rmaydiganga chiqmaydi. Administrator butun markazni,
// boshqa xodim o'z filialini ko'radi. Raqamlar CRM dagi hisobotlar bilan bir xil
// funksiyalardan olinadi (routes/hisobot.js).
import { Markup } from 'telegraf';
import prisma from '../../lib/prisma.js';
import { isLessonDay, toDateStr } from '../../lib/lessons.js';
import { yetadimi, toliqRuxsatli } from '../../lib/ruxsatlar.js';
import { OQIYDIGAN_HOLATLAR } from '../../lib/oquvchiHolati.js';
import { USTOZ_NOMLARI, ustozNomlari } from '../../lib/ustozlar.js';
import { kunlikKassa, qarzdorlik } from '../../routes/hisobot.js';

export const ADMIN_TUGMALARI = {
    hisobot: '📊 Kunlik Hisobot',
    darslar: '📅 Bugungi darslar',
    qarz: '💰 Qarzdorlar',
    lidlar: '📢 Yangi Lidlar',
    qidiruv: "🔎 O'quvchi qidirish",
};
const QIDIRUV_BELGI = '· QD';
const QIDIRUV_RE = /·\sQD\s*$/;
const SAHIFA = 12;
const HAFTA = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const DARSDA_YOQ = ['Kelmapdi', 'Kelmadi', 'Sababli'];

const som = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\s/g, ' ');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ismKor = (name) => {
    const n = String(name || '').replace(/\s+/g, ' ').trim();
    if (n !== n.toUpperCase()) return n;
    return n.toLowerCase().replace(/(^|[\s-'])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
};
const kunSurish = (sana, kun) => {
    const d = new Date(`${sana}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + kun);
    return d.toISOString().slice(0, 10);
};
const sanaMatni = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}, ${HAFTA[new Date(`${s}T12:00:00Z`).getUTCDay()]}`;
const qisqaSana = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}`;
const vaqt = (schedule) => (String(schedule || '').match(/\d{1,2}:\d{2}/)?.[0] || '').padStart(5, '0');
/** Tug'ilgan sana matnidan "MM-DD" ("2012-10-08" yoki "08.10.2012"). */
const oyKun = (v) => {
    const s = String(v || '').trim();
    let x = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (x) return `${x[2].padStart(2, '0')}-${x[3].padStart(2, '0')}`;
    x = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s);
    return x ? `${x[2].padStart(2, '0')}-${x[1].padStart(2, '0')}` : '';
};
/** Telegram 4096 belgidan uzun xabarni olmaydi. Oxirgi butun qatorgacha kesiladi — HTML teg o'rtasidan emas. */
const qirq = (matn) => {
    if (matn.length <= 3900) return matn;
    const kesim = matn.lastIndexOf('\n', 3900);
    return matn.slice(0, kesim > 0 ? kesim : 3900) + "\n… (ro'yxat davomi sig'madi)";
};
const html = (extra = {}) => ({ parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

export function registerAdminBot(bot, { findUser, filial, xodimRuxsati, orgSchoolIds }) {
    /** Xodim va uning ko'rish doirasi; xodim bo'lmasa null. */
    const xodim = async (ctx) => {
        const schoolId = await filial(ctx);
        const u = await findUser(ctx.from.id, schoolId);
        if (!u || u.type !== 'admin') return null;
        const ruxsat = await xodimRuxsati(u.data);
        // "Faqat o'z kurslari" bilan cheklangan lavozim (ustoz) CRM da boshqalarning o'quvchisini
        // ko'rmaydi — botda ham butun filial ro'yxati va qidiruvi unga ochilmaydi.
        if (ruxsat?.faqatOz) return null;
        // Administrator butun markazni ko'radi, boshqa xodim — o'z filialini.
        const ids = toliqRuxsatli(u.data.role) ? await orgSchoolIds(schoolId) : [schoolId];
        const filiallar = ids.length > 1
            ? await prisma.school.findMany({ where: { id: { in: ids } }, select: { id: true, name: true }, orderBy: { id: 'asc' } })
            : [];
        return { u: u.data, ruxsat, ids, filiallar };
    };
    const yoq = (ctx, nima) => ctx.reply(`${nima} ko'rishga ruxsatingiz yo'q.`);
    /** Tugma bosilganda xabarni yangilaydi, menyudan kelganda yangi xabar yuboradi. */
    const korsat = (ctx, matn, tugmalar) => {
        const extra = html(tugmalar?.length ? Markup.inlineKeyboard(tugmalar) : {});
        return ctx.callbackQuery ? ctx.editMessageText(qirq(matn), extra).catch(() => {}) : ctx.reply(qirq(matn), extra);
    };

    // ===== Kunlik hisobot =====

    const hisobot = async (ctx, sana) => {
        const x = await xodim(ctx);
        if (!x) return;
        if (!yetadimi(x.ruxsat, 'bosh.korsatkich', 1)) return yoq(ctx, 'Hisobotni');
        const bugun = toDateStr();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(sana) || sana > bugun) sana = bugun;
        const pul = yetadimi(x.ruxsat, 'bosh.pul', 1);
        const sch = { schoolId: { in: x.ids } };
        const kunBoshi = new Date(`${sana}T00:00:00+05:00`);
        const kunOxiri = new Date(kunBoshi.getTime() + 86400000);

        const [faol, sinov, yangi, lidlar, davomat, kurslar, tugilganlar] = await Promise.all([
            prisma.student.count({ where: { ...sch, status: 'Faol' } }),
            prisma.student.count({ where: { ...sch, status: 'Sinov' } }),
            prisma.student.count({ where: { ...sch, joinedDate: sana } }),
            prisma.lead.count({ where: { ...sch, createdAt: { gte: kunBoshi, lt: kunOxiri } } }),
            prisma.attendance.groupBy({ by: ['status'], where: { ...sch, date: sana }, _count: true }),
            prisma.group.findMany({ where: sch, select: { id: true, days: true, _count: { select: { students: true } } } }),
            prisma.student.findMany({
                where: { ...sch, status: { in: OQIYDIGAN_HOLATLAR }, birthDate: { not: '' } },
                select: { name: true, birthDate: true },
            }),
        ]);
        const darsliKurslar = kurslar.filter(g => g._count.students > 0 && isLessonDay(g.days, sana));
        const belgilangan = darsliKurslar.length
            ? (await prisma.attendance.groupBy({ by: ['groupId'], where: { date: sana, groupId: { in: darsliKurslar.map(g => g.id) } }, _count: true })).length
            : 0;
        const dav = (holatlar) => davomat.filter(d => holatlar.includes(d.status)).reduce((s, d) => s + d._count, 0);

        let m = `📊 <b>Kunlik hisobot</b>\n${sanaMatni(sana)}${x.filiallar.length ? ' · butun markaz' : ''}\n\n`;

        if (pul) {
            const oyBoshi = `${sana.slice(0, 8)}01`;
            const [kassa, oylik, qarz] = await Promise.all([
                kunlikKassa(x.ids, sana),
                prisma.payment.aggregate({
                    where: { ...sch, date: { gte: oyBoshi, lte: sana }, amount: { gt: 0 }, type: { notIn: ['Oylik', 'Chegirma'] } },
                    _sum: { amount: true },
                }),
                prisma.student.aggregate({ where: { ...sch, balance: { lt: -0.5 }, status: { not: 'Arxiv' } }, _sum: { balance: true }, _count: true }),
            ]);
            m += `💰 <b>Tushum: ${som(kassa.kirim.jami)} so'm</b> (${kassa.kirim.soni} ta to'lov)\n`;
            for (const u of kassa.kirim.usullar.filter(u => u.soni)) m += `   ▫️ ${u.nom}: ${som(u.summa)} (${u.soni} ta)\n`;
            if (x.filiallar.length && kassa.kirim.soni) {
                const filialTushum = await prisma.payment.groupBy({
                    by: ['schoolId'],
                    where: { ...sch, date: sana, amount: { gt: 0 }, type: { notIn: ['Oylik', 'Chegirma'] } },
                    _sum: { amount: true },
                });
                for (const f of x.filiallar) {
                    const t = filialTushum.find(q => q.schoolId === f.id)?._sum.amount || 0;
                    m += `   🏢 ${esc(f.name)}: ${som(t)}\n`;
                }
            }
            if (kassa.chiqim.soni) m += `💸 Chiqim: ${som(kassa.chiqim.jami)} so'm (${kassa.chiqim.soni} ta)\n`;
            m += `🏦 Kassada naqd: ${som(kassa.kassa.kutilgan)} so'm${kassa.kassa.yopilgan ? ' · kun yopilgan' : ''}\n`;
            m += `📈 Oy boshidan tushum: ${som(oylik._sum.amount)} so'm\n`;
            m += `⚠️ Qarzdorlik: ${som(-(qarz._sum.balance || 0))} so'm (${qarz._count} o'quvchi)\n\n`;
        }

        m += `👥 O'quvchilar: ${faol} faol${sinov ? `, ${sinov} sinovda` : ''}\n`;
        m += `🆕 Yangi o'quvchi: ${yangi} · Lidlar: ${lidlar}\n`;
        if (darsliKurslar.length) {
            m += `📅 Darslar: ${darsliKurslar.length} ta kurs, yo'qlama ${belgilangan} tasida qilingan\n`;
            if (belgilangan) m += `✅ Keldi: ${dav(['Keldi', 'Kechikdi', 'ErtaKetdi'])} · ❌ Kelmadi: ${dav(['Kelmapdi', 'Kelmadi'])} · 📝 Sababli: ${dav(['Sababli'])}\n`;
        } else {
            m += "📅 Bu kuni dars yo'q\n";
        }
        const tk = tugilganlar.filter(s => oyKun(s.birthDate) === sana.slice(5));
        if (tk.length) m += `\n🎂 Tug'ilgan kun: ${tk.slice(0, 12).map(s => esc(ismKor(s.name))).join(', ')}${tk.length > 12 ? ` va yana ${tk.length - 12} ta` : ''}\n`;

        const tugma = [Markup.button.callback(`◀️ ${qisqaSana(kunSurish(sana, -1))}`, `ab_h_${kunSurish(sana, -1)}`)];
        if (sana < bugun) {
            tugma.push(Markup.button.callback('Bugun', `ab_h_${bugun}`));
            if (kunSurish(sana, 1) < bugun) tugma.push(Markup.button.callback(`${qisqaSana(kunSurish(sana, 1))} ▶️`, `ab_h_${kunSurish(sana, 1)}`));
        }
        return korsat(ctx, m, [tugma, [Markup.button.callback('📅 Shu kungi darslar', `ab_d_${sana}`)]]);
    };

    bot.hears(ADMIN_TUGMALARI.hisobot, (ctx) => hisobot(ctx, toDateStr()));
    bot.action(/^ab_h_(\d{4}-\d{2}-\d{2})$/, async (ctx) => { await ctx.answerCbQuery().catch(() => {}); return hisobot(ctx, ctx.match[1]); });

    // ===== Bugungi darslar =====

    const darslar = async (ctx, sana) => {
        const x = await xodim(ctx);
        if (!x) return;
        if (!yetadimi(x.ruxsat, 'bosh.korsatkich', 1)) return yoq(ctx, 'Darslarni');
        const kurslar = (await prisma.group.findMany({
            where: { schoolId: { in: x.ids } },
            select: { id: true, name: true, days: true, schedule: true, schoolId: true, ...USTOZ_NOMLARI, _count: { select: { students: true } } },
        })).filter(g => g._count.students > 0 && isLessonDay(g.days, sana))
            .sort((a, b) => (vaqt(a.schedule) || '99').localeCompare(vaqt(b.schedule) || '99') || a.name.localeCompare(b.name));

        let m = `📅 <b>Darslar</b> — ${sanaMatni(sana)}\n\n`;
        if (!kurslar.length) {
            m += "Bu kuni dars yo'q.";
        } else {
            const yozuvlar = await prisma.attendance.groupBy({
                by: ['groupId', 'status'], where: { date: sana, groupId: { in: kurslar.map(g => g.id) } }, _count: true,
            });
            let qilinmagan = 0;
            for (const g of kurslar) {
                const y = yozuvlar.filter(q => q.groupId === g.id);
                const yoqlar = y.filter(q => DARSDA_YOQ.includes(q.status)).reduce((s, q) => s + q._count, 0);
                const bor = y.filter(q => !DARSDA_YOQ.includes(q.status) && q.status !== "Dars bo'lmadi").reduce((s, q) => s + q._count, 0);
                const bolmadi = y.some(q => q.status === "Dars bo'lmadi");
                if (!y.length) qilinmagan++;
                const filialNomi = x.filiallar.length ? ` · ${esc(x.filiallar.find(f => f.id === g.schoolId)?.name || '')}` : '';
                m += `🕘 <b>${vaqt(g.schedule) || '—'}</b> ${esc(g.name)} — ${esc(ustozNomlari(g) || 'ustozsiz')}${filialNomi}\n`;
                m += !y.length ? `      ⏳ yo'qlama qilinmagan (${g._count.students} o'quvchi)\n`
                    : bolmadi && !bor ? "      ✖️ dars bo'lmadi\n"
                    : `      ✅ ${bor} keldi · ❌ ${yoqlar} kelmadi\n`;
            }
            m += `\nJami ${kurslar.length} ta kurs${qilinmagan ? `, ${qilinmagan} tasida yo'qlama qilinmagan` : " — hammasida yo'qlama qilingan"}.`;
        }
        return korsat(ctx, m, [[Markup.button.callback('📊 Shu kungi hisobot', `ab_h_${sana}`)]]);
    };

    bot.hears(ADMIN_TUGMALARI.darslar, (ctx) => darslar(ctx, toDateStr()));
    bot.action(/^ab_d_(\d{4}-\d{2}-\d{2})$/, async (ctx) => { await ctx.answerCbQuery().catch(() => {}); return darslar(ctx, ctx.match[1]); });

    // ===== Qarzdorlar =====

    const sahifaTugmalari = (kalit, sahifa, jami) => {
        const t = [];
        if (sahifa > 0) t.push(Markup.button.callback('◀️ Oldingi', `${kalit}_${sahifa - 1}`));
        if ((sahifa + 1) * SAHIFA < jami) t.push(Markup.button.callback('Keyingi ▶️', `${kalit}_${sahifa + 1}`));
        return t.length ? [t] : [];
    };

    const qarzdorlar = async (ctx, sahifa) => {
        const x = await xodim(ctx);
        if (!x) return;
        if (!yetadimi(x.ruxsat, 'oquvchilar.balans', 1)) return yoq(ctx, 'Qarzdorlikni');
        const q = await qarzdorlik(x.ids);
        let m = `💰 <b>Qarzdorlik: ${som(q.jami)} so'm</b> (${q.soni} o'quvchi)\n`;
        const yosh = q.yosh.filter(y => y.soni);
        if (yosh.length) m += yosh.map(y => `▫️ ${y.nom}: ${som(y.summa)} (${y.soni} ta)`).join('\n') + '\n';
        if (!q.soni) return korsat(ctx, m + "\nQarzdor o'quvchi yo'q 🎉", []);
        const bosh = Math.min(sahifa, Math.floor((q.royxat.length - 1) / SAHIFA)) * SAHIFA;
        m += '\n';
        q.royxat.slice(bosh, bosh + SAHIFA).forEach((r, i) => {
            const tel = r.otaOnaTel || r.telefon;
            m += `${bosh + i + 1}. <b>${esc(ismKor(r.ism))}</b> — ${som(r.qarz)}${r.oylar ? ` · ${r.oylar} oy` : ''}\n`;
            m += `     ${esc(r.kurslar.map(k => k.nom).join(', ') || '—')}${tel ? ` · 📞 ${esc(tel)}` : ''}\n`;
        });
        return korsat(ctx, m, sahifaTugmalari('ab_q', bosh / SAHIFA, q.royxat.length));
    };

    bot.hears(ADMIN_TUGMALARI.qarz, (ctx) => qarzdorlar(ctx, 0));
    bot.action(/^ab_q_(\d+)$/, async (ctx) => { await ctx.answerCbQuery().catch(() => {}); return qarzdorlar(ctx, Number(ctx.match[1])); });

    // ===== Lidlar =====

    const lidlar = async (ctx, sahifa) => {
        const x = await xodim(ctx);
        if (!x) return;
        if (!yetadimi(x.ruxsat, 'lidlar.royxat', 1)) return yoq(ctx, 'Lidlarni');
        const where = { schoolId: { in: x.ids } };
        const [jami, yangi, royxat] = await Promise.all([
            prisma.lead.count({ where }),
            prisma.lead.count({ where: { ...where, status: 'Yangi' } }),
            prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, skip: sahifa * SAHIFA, take: SAHIFA }),
        ]);
        if (!jami) return korsat(ctx, "📢 Lidlar hali yo'q.", []);
        let m = `📢 <b>Lidlar</b> — jami ${jami} ta, shundan ${yangi} tasi yangi (hali ishlanmagan)\n\n`;
        for (const l of royxat) {
            const belgi = l.status === 'Yangi' ? '🆕' : '▫️';
            m += `${belgi} <b>${esc(l.name)}</b> · 📞 ${esc(l.phone)}\n`;
            m += `     ${esc(l.course || '—')} · ${esc(l.status)} · ${qisqaSana(toDateStr(l.createdAt))}${l.source ? ` · ${esc(l.source)}` : ''}\n`;
        }
        return korsat(ctx, m, sahifaTugmalari('ab_l', sahifa, jami));
    };

    bot.hears(ADMIN_TUGMALARI.lidlar, (ctx) => lidlar(ctx, 0));
    bot.action(/^ab_l_(\d+)$/, async (ctx) => { await ctx.answerCbQuery().catch(() => {}); return lidlar(ctx, Number(ctx.match[1])); });

    // ===== O'quvchi qidirish =====

    const kartaMatni = async (x, id) => {
        const s = await prisma.student.findFirst({
            where: { id, schoolId: { in: x.ids } },
            select: {
                id: true, name: true, status: true, phone: true, fatherPhone: true, motherPhone: true, fatherName: true, motherName: true,
                balance: true, birthDate: true, needsTransport: true, schoolId: true,
                telegramId: true, fatherTelegramId: true, motherTelegramId: true,
                oquvchiKod: { select: { kod: true } },
                groups: { select: { name: true, schedule: true, ...USTOZ_NOMLARI }, orderBy: { name: 'asc' } },
            },
        });
        if (!s) return null;
        const bugun = toDateStr();
        const [oxirgiTolov, davomat] = await Promise.all([
            prisma.payment.findFirst({
                where: { studentId: s.id, amount: { gt: 0 }, type: { notIn: ['Oylik', 'Chegirma'] } },
                orderBy: [{ date: 'desc' }, { id: 'desc' }], select: { amount: true, date: true, type: true },
            }),
            prisma.attendance.findMany({ where: { studentId: s.id, date: { gte: kunSurish(bugun, -30), lte: bugun } }, select: { status: true } }),
        ]);
        let m = `👤 <b>${esc(ismKor(s.name))}</b>\n`;
        m += `🆔 ${s.oquvchiKod?.kod ?? `№${s.id}`} · ${esc(s.status)}`;
        if (x.filiallar.length) m += ` · ${esc(x.filiallar.find(f => f.id === s.schoolId)?.name || '')}`;
        m += '\n\n';
        m += s.groups.length
            ? s.groups.map(g => `📚 ${esc(g.name)} — ${esc(ustozNomlari(g) || 'ustozsiz')}${vaqt(g.schedule) ? ` · ${vaqt(g.schedule)}` : ''}`).join('\n') + '\n'
            : "📚 Kursga yozilmagan\n";
        m += '\n';
        const tg = (t) => (t ? ' ✅' : '');
        if (s.phone) m += `📞 O'zi: ${esc(s.phone)}${tg(s.telegramId)}\n`;
        if (s.fatherPhone) m += `📞 Otasi: ${esc(s.fatherPhone)}${s.fatherName ? ` (${esc(s.fatherName)})` : ''}${tg(s.fatherTelegramId)}\n`;
        if (s.motherPhone) m += `📞 Onasi: ${esc(s.motherPhone)}${s.motherName ? ` (${esc(s.motherName)})` : ''}${tg(s.motherTelegramId)}\n`;
        if (s.telegramId || s.fatherTelegramId || s.motherTelegramId) m += '<i>✅ — botga ulangan</i>\n';
        if (yetadimi(x.ruxsat, 'oquvchilar.balans', 1)) {
            m += '\n';
            m += s.balance < -0.5 ? `⚠️ <b>Qarz: ${som(-s.balance)} so'm</b>\n` : `💳 Balans: ${som(s.balance)} so'm\n`;
            if (oxirgiTolov) m += `🧾 Oxirgi to'lov: ${som(oxirgiTolov.amount)} so'm · ${qisqaSana(oxirgiTolov.date)} · ${oxirgiTolov.type === 'Peyme' ? 'Payme' : esc(oxirgiTolov.type)}\n`;
        }
        if (davomat.length) {
            const keldi = davomat.filter(d => !DARSDA_YOQ.includes(d.status) && d.status !== "Dars bo'lmadi").length;
            const kelmadi = davomat.filter(d => DARSDA_YOQ.includes(d.status)).length;
            m += `\n📅 Oxirgi 30 kun: ${keldi} marta keldi, ${kelmadi} marta kelmadi\n`;
        }
        if (s.needsTransport) m += '🚌 Transportda qatnaydi\n';
        return m;
    };

    const qidir = async (ctx, soz) => {
        const x = await xodim(ctx);
        if (!x) return false;
        if (!yetadimi(x.ruxsat, 'oquvchilar.royxat', 1)) { await yoq(ctx, "O'quvchilarni"); return true; }
        const q = soz.replace(/\s+/g, ' ').trim();
        if (q.length < 3) { await ctx.reply("Kamida 3 ta belgi yozing: ism, telefon yoki o'quvchi ID si."); return true; }
        const raqam = q.replace(/\D/g, '');
        const faqatRaqam = raqam.length >= 3 && /^[\d\s+()-]+$/.test(q);
        const sch = { schoolId: { in: x.ids } };
        let topilgan = [];
        if (faqatRaqam) {
            const son = Number(raqam);
            const [kod, tel] = await Promise.all([
                raqam.length <= 6 ? prisma.student.findMany({ where: { ...sch, OR: [{ oquvchiKod: { kod: son } }, { id: son }] }, select: { id: true, name: true, status: true }, take: 5 }) : [],
                raqam.length >= 4 ? prisma.student.findMany({
                    where: { ...sch, OR: [{ phone: { contains: raqam.slice(-9) } }, { fatherPhone: { contains: raqam.slice(-9) } }, { motherPhone: { contains: raqam.slice(-9) } }] },
                    select: { id: true, name: true, status: true }, take: 20,
                }) : [],
            ]);
            topilgan = [...kod, ...tel.filter(t => !kod.some(k => k.id === t.id))];
            // Raqamlar bazada bo'shliq bilan yozilgan bo'lishi mumkin ("+998 90 123 45 67").
            if (!topilgan.length && raqam.length >= 7) {
                const hammasi = await prisma.student.findMany({ where: sch, select: { id: true, name: true, status: true, phone: true, fatherPhone: true, motherPhone: true } });
                topilgan = hammasi.filter(s => [s.phone, s.fatherPhone, s.motherPhone].some(v => String(v || '').replace(/\D/g, '').includes(raqam.slice(-9)))).slice(0, 20);
            }
        } else {
            const sozlar = q.split(' ').filter(w => w.length >= 2).slice(0, 4);
            if (!sozlar.length) { await ctx.reply("Ismni to'liqroq yozing (kamida 2 harfli so'z)."); return true; }
            topilgan = await prisma.student.findMany({
                where: { ...sch, AND: sozlar.map(w => ({ name: { contains: w, mode: 'insensitive' } })) },
                select: { id: true, name: true, status: true }, orderBy: { name: 'asc' }, take: 21,
            });
        }
        // Arxivdagilar oxirida.
        topilgan.sort((a, b) => (a.status === 'Arxiv') - (b.status === 'Arxiv'));
        if (!topilgan.length) { await ctx.reply(`🔎 «${q}» bo'yicha o'quvchi topilmadi.`); return true; }
        if (topilgan.length === 1) { await ctx.reply(await kartaMatni(x, topilgan[0].id), html()); return true; }
        const kop = topilgan.length > 20;
        await ctx.reply(
            `🔎 «${q}» — ${kop ? '20 tadan ko\'p' : topilgan.length + ' ta'} o'quvchi topildi${kop ? ". Aniqroq yozing yoki ro'yxatdan tanlang:" : '. Tanlang:'}`,
            Markup.inlineKeyboard(topilgan.slice(0, 20).map(s =>
                [Markup.button.callback(`${ismKor(s.name).slice(0, 44)}${s.status !== 'Faol' ? ` · ${s.status}` : ''}`, `ab_o_${s.id}`)]))
        );
        return true;
    };

    bot.hears(ADMIN_TUGMALARI.qidiruv, async (ctx) => {
        const x = await xodim(ctx);
        if (!x) return;
        if (!yetadimi(x.ruxsat, 'oquvchilar.royxat', 1)) return yoq(ctx, "O'quvchilarni");
        return ctx.reply(
            `🔎 O'quvchining ismi, telefon raqami yoki ID sini shu xabarga javob qilib yozing.\nKeyingi safar tugmani bosmasdan to'g'ridan-to'g'ri yozsangiz ham bo'ladi.\n${QIDIRUV_BELGI}`,
            { reply_markup: { force_reply: true, input_field_placeholder: 'Ism, telefon yoki ID', selective: true } }
        );
    });

    bot.action(/^ab_o_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const x = await xodim(ctx);
        if (!x || !yetadimi(x.ruxsat, 'oquvchilar.royxat', 1)) return;
        const m = await kartaMatni(x, Number(ctx.match[1]));
        return ctx.reply(m || "O'quvchi topilmadi.", html());
    });

    // Xodim yozgan oddiy matn — o'quvchi qidiruvi. Boshqa bo'limlarning so'rovlariga
    // (ForceReply) javoblar bu yerga yetib kelmaydi: ular oldinroq ushlanadi.
    bot.on('text', async (ctx, next) => {
        const matn = ctx.message.text || '';
        const replyTo = ctx.message.reply_to_message;
        const qidiruvJavobi = replyTo?.from?.is_bot && QIDIRUV_RE.test(replyTo.text || '');
        if (!qidiruvJavobi && (replyTo || matn.startsWith('/') || /^\p{Extended_Pictographic}/u.test(matn))) return next();
        return (await qidir(ctx, matn)) ? undefined : next();
    });
}
