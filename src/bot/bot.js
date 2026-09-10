import { Telegraf, Markup } from 'telegraf';
import prisma from '../../lib/prisma.js';
import { isLessonDay, toDateStr, toTimeStr } from '../../lib/lessons.js';
import { bugungiReyslar, marshrutHolati, holatniYozish, holatniOchirish, reysVaqti, holatlar as yonalishHolatlari, markazNuqtasi } from '../../services/logistics.js';
import { javobniYozish } from '../../services/kunlikReja.js';
import { parseLatLng, distanceKm } from '../../lib/tartib.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'fake_token_for_init');

// In-memory state tracking
const adminStates = {};
const attStates = {}; // { tid: { groupId, records: { studentId: status } } }
const botCache = new Map(); // token -> botInstance

// User roles and menus
const getStudentMenu = () => Markup.keyboard([
    ['📅 Dars Jadvali', '💳 To\'lovlar'],
    ['✅ Davomat', '📊 Baholar'],
    ['✍️ Shikoyat va takliflar', '👤 Profil'],
    ['🚪 Chiqish']
]).resize();

const getTeacherMenu = () => Markup.keyboard([
    ['🎒 Davomat qilish', '📅 Mening Jadvalim'],
    ['💰 Oylik va Bonuslar', '👤 Profil'],
    ['🚪 Chiqish']
]).resize();

const getAdminMenu = () => Markup.keyboard([
    ['📢 Yangi Lidlar', '📊 Kunlik Hisobot'],
    ['📧 Ommaviy xabar', '⚙️ Sozlamalar'],
    ['🚪 Chiqish']
]).resize();

const getDriverMenu = () => Markup.keyboard([
    ['🚌 Bugungi reyslar'],
    ['📍 O\'quvchilar lokatsiyasi', '🚍 Mening Transportim'],
    ['👤 Profil', '🚪 Chiqish']
]).resize();

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
        const value = await prisma.setting.findUnique({ where: { schoolId: Number(schoolId) } });
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

// Helper to find user by telegramId and schoolId
const findUser = async (tid, schoolId) => {
    const tidStr = String(tid);
    const scWhere = schoolId ? { schoolId } : {};

    // 1. Try to find student where student.telegramId === tidStr
    const student = await prisma.student.findFirst({ 
        where: { telegramId: tidStr, ...scWhere } 
    });
    if (student) return { type: 'student', data: student };

    // 2. Try to find student where student.fatherTelegramId === tidStr
    const fatherStudent = await prisma.student.findFirst({ 
        where: { fatherTelegramId: tidStr, ...scWhere } 
    });
    if (fatherStudent) return { type: 'parent_father', data: fatherStudent };

    // 3. Try to find student where student.motherTelegramId === tidStr
    const motherStudent = await prisma.student.findFirst({ 
        where: { motherTelegramId: tidStr, ...scWhere } 
    });
    if (motherStudent) return { type: 'parent_mother', data: motherStudent };

    const teacher = await prisma.teacher.findFirst({ 
        where: { telegramId: tidStr, ...scWhere } 
    });
    if (teacher) return { type: 'teacher', data: teacher };

    const user = await prisma.user.findFirst({ 
        where: { telegramId: tidStr, ...scWhere } 
    });
    if (user) {
        if (user.role === 'DRIVER') return { type: 'driver', data: user };
        return { type: 'admin', data: user };
    }

    return null;
};

// Setup handlers for a specific bot instance and schoolId
export const setupBotHandlers = (botInstance, schoolId) => {
    botInstance.catch((err, ctx) => {
        console.error(`Telegram Bot xatosi (${ctx.updateType}) [School: ${schoolId}]:`, err);
    });

    botInstance.start(async (ctx) => {
        const user = await findUser(ctx.from.id, schoolId);
        if (user) {
            let menu;
            let greeting = `Xush kelibsiz, ${user.data.name}!`;

            if (user.type === 'student') {
                menu = getStudentMenu();
            } else if (user.type === 'parent_father') {
                menu = getStudentMenu();
                greeting = `Xush kelibsiz! Siz o'quvchi ${user.data.name} ning otasi (${user.data.fatherName || ''}) sifatida ulandingiz.`;
            } else if (user.type === 'parent_mother') {
                menu = getStudentMenu();
                greeting = `Xush kelibsiz! Siz o'quvchi ${user.data.name} ning onasi (${user.data.motherName || ''}) sifatida ulandingiz.`;
            } else if (user.type === 'teacher') {
                menu = getTeacherMenu();
            } else if (user.type === 'admin') {
                menu = getAdminMenu();
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
        const tidStr = String(ctx.from.id);
        const scWhere = schoolId ? { schoolId } : {};

        await Promise.all([
            prisma.student.updateMany({ where: { telegramId: tidStr, ...scWhere }, data: { telegramId: null } }),
            prisma.student.updateMany({ where: { fatherTelegramId: tidStr, ...scWhere }, data: { fatherTelegramId: null } }),
            prisma.student.updateMany({ where: { motherTelegramId: tidStr, ...scWhere }, data: { motherTelegramId: null } }),
            prisma.teacher.updateMany({ where: { telegramId: tidStr, ...scWhere }, data: { telegramId: null } }),
            prisma.user.updateMany({ where: { telegramId: tidStr, ...scWhere }, data: { telegramId: null } })
        ]);
        ctx.reply("Hisobingiz botdan uzildi. Endi qaytadan ro'yxatdan o'tishingiz mumkin ( /start bosib).", Markup.keyboard([
            [Markup.button.contactRequest('📱 Telefon raqamni yuborish')]
        ]).resize());
    };

    botInstance.command('logout', logoutHandler);
    botInstance.hears('🚪 Chiqish', logoutHandler);

    botInstance.on('contact', async (ctx) => {
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
            prisma.user.updateMany({ where: { telegramId: tid }, data: { telegramId: null } })
        ]);

        // 1. Try to find student where phone matches phoneSuffix
        let student = await prisma.student.findFirst({
            where: { phone: { contains: phoneSuffix }, schoolId }
        });
        if (student) {
            await prisma.student.update({ where: { id: student.id }, data: { telegramId: tid } });
            return ctx.reply(`Siz o'quvchi sifatida ro'yxatdan o'tdingiz: ${student.name}`, getStudentMenu());
        }

        // 2. Try to find student where fatherPhone matches phoneSuffix
        let fatherStudent = await prisma.student.findFirst({
            where: { fatherPhone: { contains: phoneSuffix }, schoolId }
        });
        if (fatherStudent) {
            await prisma.student.update({ where: { id: fatherStudent.id }, data: { fatherTelegramId: tid } });
            const pName = fatherStudent.fatherName ? ` (${fatherStudent.fatherName})` : '';
            return ctx.reply(`Siz ota sifatida ro'yxatdan o'tdingiz: ${fatherStudent.name} ning otasi${pName}`, getStudentMenu());
        }

        // 3. Try to find student where motherPhone matches phoneSuffix
        let motherStudent = await prisma.student.findFirst({
            where: { motherPhone: { contains: phoneSuffix }, schoolId }
        });
        if (motherStudent) {
            await prisma.student.update({ where: { id: motherStudent.id }, data: { motherTelegramId: tid } });
            const pName = motherStudent.motherName ? ` (${motherStudent.motherName})` : '';
            return ctx.reply(`Siz ona sifatida ro'yxatdan o'tdingiz: ${motherStudent.name} ning onasi${pName}`, getStudentMenu());
        }

        // Try to find as teacher
        let teacher = await prisma.teacher.findFirst({ 
            where: { phone: { contains: phoneSuffix }, schoolId } 
        });
        if (teacher) {
            await prisma.teacher.update({ where: { id: teacher.id }, data: { telegramId: tid } });
            return ctx.reply(`Siz o'qituvchi sifatida ro'yxatdan o'tdingiz: ${teacher.name}`, getTeacherMenu());
        }

        // Try to find in users (Admin/Manager/Receptionist)
        let user = await prisma.user.findFirst({ 
            where: { phone: { contains: phoneSuffix }, schoolId } 
        });
        if (user) {
            await prisma.user.update({ where: { id: user.id }, data: { telegramId: tid } });
            const menu = user.role === 'DRIVER' ? getDriverMenu() : getAdminMenu();
            return ctx.reply(`Siz xodim sifatida ro'yxatdan o'tdingiz: ${user.name}`, menu);
        }

        ctx.reply("Kechirasiz, ushbu raqam tizimda topilmadi. Ma'lumot olish uchun mehmon menyusidan foydalaning.", getGuestMenu());
    });

    // Student Handlers
    botInstance.hears('📅 Dars Jadvali', async (ctx) => {
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || (user.type !== 'student' && !user.type.startsWith('parent_'))) return;

        const student = await prisma.student.findUnique({
            where: { id: user.data.id },
            include: { groups: { include: { teacher: true, course: true, roomRel: true } } }
        });

        if (student.groups.length === 0) return ctx.reply("Siz hali hech qaysi guruhga a'zo emassiz.");

        let msg = "📅 Sizning dars jadvalingiz:\n\n";
        student.groups.forEach(g => {
            msg += `🔹 ${g.name} (${g.course.name})\n`;
            msg += `🕒 ${g.schedule} | ${g.days}\n`;
            msg += `👨‍🏫 Ustoz: ${g.teacher.name}\n`;
            msg += `🚪 Xona: ${g.roomRel?.name || 'Noma\'lum'}\n\n`;
        });

        ctx.reply(msg);
    });

    botInstance.hears('💳 To\'lovlar', async (ctx) => {
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || (user.type !== 'student' && !user.type.startsWith('parent_'))) return;

        const student = await prisma.student.findUnique({
            where: { id: user.data.id },
            include: { payments: { take: 5, orderBy: { id: 'desc' } } }
        });

        let msg = `💰 Joriy balansingiz: ${student.balance.toLocaleString()} UZS\n\n`;
        msg += "💳 Oxirgi to'lovlar:\n";
        
        if (student.payments.length === 0) {
            msg += "Hech qanday to'lov topilmadi.";
        } else {
            student.payments.forEach(p => {
                msg += `▫️ ${p.date}: ${p.amount.toLocaleString()} (${p.type})\n`;
            });
        }

        ctx.reply(msg);
    });

    botInstance.hears('✅ Davomat', async (ctx) => {
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || (user.type !== 'student' && !user.type.startsWith('parent_'))) return;

        const attendances = await prisma.attendance.findMany({
            where: { studentId: user.data.id, schoolId },
            take: 10,
            orderBy: { date: 'desc' },
            include: { group: true }
        });

        if (attendances.length === 0) return ctx.reply("Davomat ma'lumotlari topilmadi.");

        let msg = "📊 Oxirgi davomat holati:\n\n";
        attendances.forEach(a => {
            const icon = a.status === 'Keldi' ? '✅' : (a.status === 'Kelmapdi' ? '❌' : '⚠️');
            msg += `${icon} ${a.date} | ${a.group.name}\n`;
        });

        ctx.reply(msg);
    });

    botInstance.hears('📊 Baholar', async (ctx) => {
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || (user.type !== 'student' && !user.type.startsWith('parent_'))) return;

        const scores = await prisma.score.findMany({
            where: { studentId: user.data.id, schoolId },
            take: 10,
            orderBy: { id: 'desc' }
        });

        if (scores.length === 0) return ctx.reply("Hozircha baholar mavjud emas.");

        let msg = "📊 Oxirgi baholaringiz:\n\n";
        scores.forEach(s => {
            msg += `▫️ ${s.date}: ${s.value} ball\n`;
        });

        ctx.reply(msg);
    });

    botInstance.hears('✍️ Shikoyat va takliflar', async (ctx) => {
        ctx.reply("Sizning fikringiz biz uchun muhim! ✍️\n\nShikoyat yoki taklifingiz bo'lsa, shu yerga yozib qoldiring. Adminlarimiz uni albatta ko'rib chiqishadi.");
    });

    botInstance.hears('👤 Profil', async (ctx) => {
        const user = await findUser(ctx.from.id, schoolId);
        if (!user) return;

        let roleLabel = 'O\'quvchi';
        if (user.type === 'parent_father') roleLabel = 'Ota';
        else if (user.type === 'parent_mother') roleLabel = 'Ona';
        else if (user.type === 'teacher') roleLabel = 'O\'qituvchi';
        else if (user.type === 'driver') roleLabel = 'Haydovchi';
        else if (user.type === 'admin') roleLabel = 'Xodim';

        let msg = `👤 Mening Profilim:\n\n`;
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

    // Teacher Handlers
    botInstance.hears('🎒 Davomat qilish', async (ctx) => {
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'teacher') return;

        const groups = await prisma.group.findMany({
            where: { teacherId: user.data.id, schoolId }
        });

        if (groups.length === 0) return ctx.reply("Sizga biriktirilgan guruhlar topilmadi.");

        let buttons = groups.map(g => [Markup.button.callback(`👥 ${g.name}`, `mark_att_${g.id}`)]);
        ctx.reply("Guruhni tanlang:", Markup.inlineKeyboard(buttons));
    });

    botInstance.hears('📅 Mening Jadvalim', async (ctx) => {
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

    botInstance.action(/mark_att_(\d+)/, async (ctx) => {
        const groupId = parseInt(ctx.match[1]);
        const tid = ctx.from.id;

        const group = await prisma.group.findFirst({
            where: { id: groupId, schoolId },
            include: { students: true }
        });

        if (!group) return ctx.answerCbQuery("Guruh topilmadi");
        if (group.students.length === 0) return ctx.reply("Bu guruhda o'quvchilar yo'q.");

        // Initialize state
        attStates[tid] = {
            groupId: groupId,
            records: {}
        };
        group.students.forEach(s => {
            attStates[tid].records[s.id] = 'Keldi'; // Default
        });

        await renderAttendanceList(ctx, group.name, group.students, attStates[tid].records);
        ctx.answerCbQuery();
    });

    const renderAttendanceList = async (ctx, groupName, students, records) => {
        const buttons = students.map(s => {
            const status = records[s.id];
            const icon = status === 'Keldi' ? '✅' : '❌';
            return [Markup.button.callback(`${icon} ${s.name}`, `toggle_att_${s.id}`)];
        });

        buttons.push([Markup.button.callback('💾 Saqlash', 'save_attendance')]);

        const msg = `👥 ${groupName} guruhi uchun davomat (${new Date().toLocaleDateString()}):\n` +
                    `Ism yonidagi tugmani bosib holatni o'zgartiring.`;

        if (ctx.callbackQuery) {
            await ctx.editMessageText(msg, Markup.inlineKeyboard(buttons));
        } else {
            await ctx.reply(msg, Markup.inlineKeyboard(buttons));
        }
    };

    botInstance.action(/toggle_att_(\d+)/, async (ctx) => {
        const studentId = parseInt(ctx.match[1]);
        const tid = ctx.from.id;
        const state = attStates[tid];

        if (!state) return ctx.answerCbQuery("Sessiya eskirgan, qaytadan boshlang.");

        state.records[studentId] = state.records[studentId] === 'Keldi' ? 'Kelmapdi' : 'Keldi';

        const group = await prisma.group.findFirst({
            where: { id: state.groupId, schoolId },
            include: { students: true }
        });

        await renderAttendanceList(ctx, group.name, group.students, state.records);
        ctx.answerCbQuery();
    });

    botInstance.action('save_attendance', async (ctx) => {
        const tid = ctx.from.id;
        const state = attStates[tid];

        if (!state) return ctx.answerCbQuery("Xatolik: Ma'lumot topilmadi.");

        const today = new Date().toISOString().split('T')[0];
        const group = await prisma.group.findFirst({ where: { id: state.groupId, schoolId } });
        
        try {
            for (const [studentId, status] of Object.entries(state.records)) {
                const sId = parseInt(studentId);
                
                // Upsert attendance
                const existing = await prisma.attendance.findFirst({
                    where: { studentId: sId, groupId: state.groupId, date: today, schoolId }
                });

                if (existing) {
                    await prisma.attendance.update({ where: { id: existing.id }, data: { status } });
                } else {
                    await prisma.attendance.create({
                        data: { studentId: sId, groupId: state.groupId, date: today, status, schoolId }
                    });
                }

                // Optional: notify student/parent if telegramId exists
                const student = await prisma.student.findFirst({ where: { id: sId, schoolId } });
                if (student) {
                    const icon = status === 'Keldi' ? '✅' : '❌';
                    const msg = `${icon} Davomat xabarnomasi:\n\n` +
                                `👤 O'quvchi: ${student.name}\n` +
                                `📌 Holat: ${status}\n` +
                                `📅 Sana: ${today}\n` +
                                `📚 Guruh: ${group.name}`;

                    if (student.telegramId) {
                        botInstance.telegram.sendMessage(student.telegramId, msg).catch(e => console.error('Notify student error:', e));
                    }
                    if (student.fatherTelegramId) {
                        botInstance.telegram.sendMessage(student.fatherTelegramId, msg).catch(e => console.error('Notify father error:', e));
                    }
                    if (student.motherTelegramId) {
                        botInstance.telegram.sendMessage(student.motherTelegramId, msg).catch(e => console.error('Notify mother error:', e));
                    }
                }
            }

            await ctx.editMessageText(`✅ ${group.name} guruhi uchun davomat saqlandi!`);
            delete attStates[tid];
        } catch (err) {
            console.error('Save attendance error:', err);
            ctx.reply("Davomatni saqlashda xatolik yuz berdi.");
        }
        ctx.answerCbQuery();
    });

    // Driver Handlers
    botInstance.hears('📍 O\'quvchilar lokatsiyasi', async (ctx) => {
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'driver') return;

        // Ro'yxat marshrut bekatlaridan olinadi. Ilgari bu yerda
        // transport.students (ya'ni Student.transportId) o'qilardi, Logistika
        // esa marshrutga yozardi — ikki manba bir-biridan ajralib ketgan edi
        // va marshrutga qo'shilgan o'quvchi haydovchida umuman ko'rinmasdi.
        const sana = toDateStr();
        const dayType = isLessonDay('TOQ', sana) ? 'TOQ' : isLessonDay('JUFT', sana) ? 'JUFT' : 'Dam olish';
        const months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
        // Yorliq ham UZ sanasidan olinadi, server soatidan emas.
        const [, oy, kun] = sana.split('-');
        const dateLabel = `${Number(kun)}-${months[Number(oy) - 1]}`;

        const routes = await prisma.route.findMany({
            where: {
                schoolId,
                OR: [
                    { driverId: user.data.id },
                    { transport: { driverId: user.data.id } },
                ],
            },
            include: {
                transport: { select: { name: true } },
                stops: {
                    orderBy: { tartib: 'asc' },
                    include: { student: { select: { name: true, phone: true, address: true, location: true, studentSchool: true } } },
                },
            },
            orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
        });

        if (routes.length === 0) return ctx.reply('Sizga hali hech qanday marshrut biriktirilmagan.');

        const bugungi = routes.filter(r => isLessonDay(r.days, sana));
        if (bugungi.length === 0) {
            return ctx.reply(
                `🗓 Bugun: ${dateLabel}, ${dayType} kun\n\n` +
                `✅ Bugun sizda reys yo'q.`
            );
        }

        for (const route of bugungi) {
            const yonalish = route.direction === 'QAYTISH' ? 'uyga qaytish' : 'markazga olib kelish';
            let msg = `🗓 ${dateLabel}, ${dayType} kun\n`;
            msg += `🚌 ${route.name} — ${route.startTime || '--:--'} (${yonalish})\n`;
            msg += `🚍 ${route.transport?.name || 'mashina biriktirilmagan'} — ${route.stops.length} ta o'quvchi:\n\n`;

            if (route.stops.length === 0) {
                msg += "Bu marshrutda hali o'quvchi yo'q.\n";
            }
            route.stops.forEach((stop, idx) => {
                const st = stop.student;
                msg += `${idx + 1}. 👤 ${st.name}\n`;
                msg += `   🏫 ${st.studentSchool || 'Maktab noma\'lum'}\n`;
                msg += `   🏠 ${st.address || 'Manzil kiritilmagan'}\n`;
                if (st.location) {
                    msg += `   🗺 https://www.google.com/maps?q=${st.location}\n`;
                } else if (st.address) {
                    msg += `   🗺 https://yandex.uz/maps/?text=${encodeURIComponent(st.address.trim())}\n`;
                }
                msg += `   📞 ${st.phone}\n\n`;
            });

            await ctx.reply(msg, { disable_web_page_preview: true });
        }
    });

    // ===== Haydovchining bugungi reyslari =====
    //
    // Butun holat bazada: tugma bosilganda yozuv yoziladi va xabar qayta
    // chiziladi. Xotirada hech narsa saqlanmaydi, shuning uchun bot qayta
    // ishga tushsa ham eski xabardagi tugmalar ishlayveradi.

    /** Reys xabarining matni va tugmalari. */
    const reysKorinishi = (route, holat, sana) => {
        const yonalish = route.direction === 'QAYTISH' ? '🏠 uyga qaytish' : '🏫 markazga olib kelish';
        const belgilangan = route.stops.filter(st => holat.holatlar[st.studentId]).length;

        let matn = `🚌 <b>${route.name}</b>\n`;
        matn += `${yonalish} · ${route.startTime || '--:--'} · ${sana}\n`;
        matn += `🚍 ${route.transport?.name || 'mashina biriktirilmagan'}\n`;
        matn += `✔️ ${belgilangan}/${route.stops.length} belgilandi\n`;
        // Vaqt O'zbekiston bo'yicha: server UTC da ishlaydi.
        if (holat.run?.startedAt) matn += `▶️ boshlandi: ${toTimeStr(holat.run.startedAt)}\n`;
        if (holat.run?.finishedAt) matn += `⏹ tugadi: ${toTimeStr(holat.run.finishedAt)}\n`;
        matn += `\n`;

        route.stops.forEach((st, idx) => {
            const s2 = st.student;
            const belgi = holat.holatlar[st.studentId];
            const icon = !belgi ? '⬜' : belgi === 'Kelmadi' ? '❌' : '✅';
            matn += `${icon} <b>${idx + 1}. ${s2.name}</b>\n`;
            matn += `   🏠 ${s2.address || 'manzil kiritilmagan'}\n`;
            if (s2.location) matn += `   🗺 https://www.google.com/maps?q=${s2.location}\n`;
            matn += `   📞 ${s2.phone}\n`;
        });
        if (route.stops.length === 0) matn += "Bu marshrutda hali o'quvchi yo'q.\n";

        const tugmalar = route.stops.map((st, idx) => {
            const belgi = holat.holatlar[st.studentId];
            const icon = !belgi ? '⬜' : belgi === 'Kelmadi' ? '❌' : '✅';
            // Ism qisqartiriladi: tugma matni telefon ekraniga sig'sin.
            const ism = st.student.name.length > 22 ? st.student.name.slice(0, 21) + '…' : st.student.name;
            return [Markup.button.callback(`${icon} ${idx + 1}. ${ism}`, `reys_h_${route.id}_${st.studentId}`)];
        });

        const vaqtTugma = !holat.run?.startedAt
            ? Markup.button.callback('▶️ Boshladim', `reys_bosh_${route.id}`)
            : !holat.run?.finishedAt
                ? Markup.button.callback('⏹ Tugatdim', `reys_tugat_${route.id}`)
                : Markup.button.callback('✅ Reys tugagan', `reys_yangi_${route.id}`);
        tugmalar.unshift([vaqtTugma]);
        // Asosiy ish rejimi: bittadan bekat, navigatsiya bilan.
        tugmalar.unshift([Markup.button.callback('🧭 Qadam-baqadam boshlash', `reys_qadam_${route.id}_0`)]);
        tugmalar.push([Markup.button.callback('🔄 Yangilash', `reys_yangi_${route.id}`)]);

        return { matn, tugmalar };
    };

    /** Haydovchi va uning shu marshrutga haqqi bormi. */
    const haydovchiMarshruti = async (ctx, routeId) => {
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'driver') return null;
        const route = await prisma.route.findFirst({
            where: {
                id: routeId,
                schoolId,
                OR: [{ driverId: user.data.id }, { transport: { driverId: user.data.id } }],
            },
            include: {
                transport: { select: { id: true, name: true } },
                stops: {
                    orderBy: { tartib: 'asc' },
                    include: { student: { select: { id: true, name: true, phone: true, address: true, location: true } } },
                },
            },
        });
        if (!route) return null;
        return { user, route };
    };

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

    botInstance.hears('🚌 Bugungi reyslar', async (ctx) => {
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'driver') return;

        const sana = toDateStr();
        const reyslar = await bugungiReyslar({ schoolId, date: sana, driverId: user.data.id });

        if (reyslar.length === 0) {
            return ctx.reply(`🗓 ${sana}\n\nBugun sizda reys yo'q.`);
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
    });

    // O'quvchi tugmasi: belgilanmagan -> olindi/yetkazildi -> kelmadi -> belgilanmagan
    botInstance.action(/^reys_h_(\d+)_(\d+)$/, async (ctx) => {
        const routeId = parseInt(ctx.match[1]);
        const studentId = parseInt(ctx.match[2]);
        const topilgan = await haydovchiMarshruti(ctx, routeId);
        if (!topilgan) return ctx.answerCbQuery('Bu marshrut sizga biriktirilmagan');
        const { user, route } = topilgan;

        const sana = toDateStr();
        const holat = await marshrutHolati({ routeId, date: sana });
        const hozirgi = holat.holatlar[studentId];
        const [birinchi] = yonalishHolatlari(route.direction);

        if (!hozirgi) {
            await holatniYozish({
                route, studentId, status: birinchi, date: sana, schoolId,
                markedById: user.data.id, transportId: route.transportId,
            });
            await ctx.answerCbQuery(birinchi);
        } else if (hozirgi !== 'Kelmadi') {
            await holatniYozish({
                route, studentId, status: 'Kelmadi', date: sana, schoolId,
                markedById: user.data.id, transportId: route.transportId,
            });
            await ctx.answerCbQuery('Kelmadi');
        } else {
            // Uchinchi bosishda belgi olib tashlanadi — xato bosgan bo'lsa.
            await holatniOchirish({ runId: holat.run?.id, studentId });
            await ctx.answerCbQuery('Belgi olib tashlandi');
        }

        await reysniQaytaChizish(ctx, route, sana);
    });

    botInstance.action(/^reys_bosh_(\d+)$/, async (ctx) => {
        const topilgan = await haydovchiMarshruti(ctx, parseInt(ctx.match[1]));
        if (!topilgan) return ctx.answerCbQuery('Bu marshrut sizga biriktirilmagan');
        const sana = toDateStr();
        await reysVaqti({ route: topilgan.route, date: sana, schoolId, maydon: 'startedAt' });
        await ctx.answerCbQuery('Reys boshlandi');
        await reysniQaytaChizish(ctx, topilgan.route, sana);
    });

    botInstance.action(/^reys_tugat_(\d+)$/, async (ctx) => {
        const topilgan = await haydovchiMarshruti(ctx, parseInt(ctx.match[1]));
        if (!topilgan) return ctx.answerCbQuery('Bu marshrut sizga biriktirilmagan');
        const sana = toDateStr();
        await reysVaqti({ route: topilgan.route, date: sana, schoolId, maydon: 'finishedAt' });
        await ctx.answerCbQuery('Reys tugadi');
        await reysniQaytaChizish(ctx, topilgan.route, sana);
    });

    botInstance.action(/^reys_yangi_(\d+)$/, async (ctx) => {
        const topilgan = await haydovchiMarshruti(ctx, parseInt(ctx.match[1]));
        if (!topilgan) return ctx.answerCbQuery('Bu marshrut sizga biriktirilmagan');
        await ctx.answerCbQuery('Yangilandi');
        await reysniQaytaChizish(ctx, topilgan.route, toDateStr());
    });

    // ===== Haydovchining kunlik tasdiqlashi =====
    //
    // Dars tugashidan ~2 soat oldin bot so'raydi: bugun shu to'lqinda
    // qatnasha olasizmi. Reja faqat "HA" deganlardan tuziladi — javob
    // bermaganlarni admin ro'yxatda ko'radi va qo'ng'iroq qiladi.

    const tasdiqJavobi = async (ctx, status) => {
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
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'admin') return;

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
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'admin') return;

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
        msg += `💰 Bugungi tushum: ${(paymentsToday._sum.amount || 0).toLocaleString()} UZS\n`;

        ctx.reply(msg);
    });

    botInstance.hears('📧 Ommaviy xabar', async (ctx) => {
        const user = await findUser(ctx.from.id, schoolId);
        if (!user || user.type !== 'admin') {
            return ctx.reply("Bu buyruq faqat xodimlar uchun.");
        }

        adminStates[ctx.from.id] = 'AWAITING_BROADCAST';
        ctx.reply(
            "Hammaga yuborilishi kerak bo'lgan xabarni kiriting (yoki Bekor qilish uchun quyidagi tugmani bosing):", 
            Markup.keyboard([['❌ Bekor qilish']]).resize()
        );
    });

    // Guest Handlers
    botInstance.hears('ℹ️ Markaz haqida', async (ctx) => {
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
        if (settings && settings.adminPhone) lines.push('📞 ' + settings.adminPhone);
        if (settings && settings.workingHours) lines.push('🕒 ' + settings.workingHours);

        await replyWithLogo(ctx, schoolId, lines.join(NL).trim());
    });

    // Markaz nuqtasi Sozlamalarda belgilansa o'sha yuboriladi; belgilanmagan
    // bo'lsa eski qattiq yozilgan nuqta — CRM xaritasi ham aynan shunday
    // ishlaydi (StudentLocationMap dagi ZAXIRA_MARKAZ).
    botInstance.hears('📍 Geolokatsiya', async (ctx) => {
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
        const tid = ctx.from.id;
        const text = ctx.message.text;

        if (adminStates[tid] === 'AWAITING_BROADCAST') {
            if (text === '❌ Bekor qilish') {
                delete adminStates[tid];
                const user = await findUser(tid, schoolId);
                return ctx.reply('Bekor qilindi.', getAdminMenu());
            }

            delete adminStates[tid];
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
                return ctx.reply(`Xabar ${successCount} ta foydalanuvchiga muvaffaqiyatli yuborildi! ✅`, getAdminMenu());
            } catch (err) {
                console.error("Broadcast global error:", err);
                return ctx.reply("Xabar yuborishda xatolik yuz berdi.", getAdminMenu());
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
    setupBotHandlers(bot, 1);
}

// Get bot instance dynamically
export const getTelegramBot = async (schoolId) => {
    if (!schoolId) {
        return bot;
    }
    const settings = await prisma.setting.findUnique({ where: { schoolId: Number(schoolId) } });
    const token = (settings && settings.telegram && settings.telegram.includes(':')) 
        ? settings.telegram.trim() 
        : process.env.TELEGRAM_BOT_TOKEN;
        
    if (!token || token === 'fake_token_for_init') return null;
    
    let instance = botCache.get(token);
    if (!instance) {
        instance = new Telegraf(token);
        setupBotHandlers(instance, Number(schoolId));
        botCache.set(token, instance);
    }
    return instance;
};

export const notifyAdmins = async (message, schoolId) => {
    const admins = await prisma.user.findMany({
        where: { 
            role: { in: ['ADMIN', 'MANAGER'] },
            telegramId: { not: null },
            schoolId: schoolId || undefined
        }
    });

    const schoolBot = await getTelegramBot(schoolId);
    if (!schoolBot) return;

    for (const admin of admins) {
        try {
            await schoolBot.telegram.sendMessage(admin.telegramId, message);
        } catch (e) {
            console.error(`Admin ${admin.name} ga xabar yuborib bo'lmadi:`, e);
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
