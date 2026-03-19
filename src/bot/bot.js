import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// In-memory state tracking
const adminStates = {};
const teacherStates = {};
const attStates = {}; // { tid: { groupId, records: { studentId: status } } }

// User roles and menus
const getStudentMenu = () => Markup.keyboard([
    ['📅 Dars Jadvali', '💳 To\'lovlar'],
    ['✅ Davomat', '📊 Baholar'],
    ['✍️ Shikoyat va takliflar', '👤 Profil']
]).resize();

const getTeacherMenu = () => Markup.keyboard([
    ['🎒 Davomat qilish', '📅 Mening Jadvalim'],
    ['💰 Oylik va Bonuslar', '👤 Profil']
]).resize();

const getAdminMenu = () => Markup.keyboard([
    ['📢 Yangi Lidlar', '📊 Kunlik Hisobot'],
    ['📧 Ommaviy xabar', '⚙️ Sozlamalar']
]).resize();

const getGuestMenu = () => Markup.keyboard([
    ['ℹ️ Markaz haqida', '📍 Geolokatsiya'],
    ['📝 Sinov darsiga yozilish', '📞 Kontaktlar']
]).resize();

// Helper to find user by telegramId
const findUser = async (tid) => {
    const tidStr = String(tid);
    const student = await prisma.student.findUnique({ where: { telegramId: tidStr } });
    if (student) return { type: 'student', data: student };

    const teacher = await prisma.teacher.findUnique({ where: { telegramId: tidStr } });
    if (teacher) return { type: 'teacher', data: teacher };

    const user = await prisma.user.findUnique({ where: { telegramId: tidStr } });
    if (user) return { type: 'admin', data: user };

    return null;
};

bot.start(async (ctx) => {
    const user = await findUser(ctx.from.id);
    if (user) {
        let menu;
        if (user.type === 'student') menu = getStudentMenu();
        else if (user.type === 'teacher') menu = getTeacherMenu();
        else if (user.type === 'admin') menu = getAdminMenu();

        return ctx.reply(`Xush kelibsiz, ${user.data.name}!`, menu);
    }

    ctx.reply(
        "SARIOSIYO CRM botiga xush kelibsiz! \n\nTizimdan foydalanish uchun telefon raqamingizni yuboring:",
        Markup.keyboard([
            [Markup.button.contactRequest('📱 Telefon raqamni yuborish')]
        ]).resize()
    );
});

bot.command('logout', async (ctx) => {
    const tidStr = String(ctx.from.id);
    await Promise.all([
        prisma.student.updateMany({ where: { telegramId: tidStr }, data: { telegramId: null } }),
        prisma.teacher.updateMany({ where: { telegramId: tidStr }, data: { telegramId: null } }),
        prisma.user.updateMany({ where: { telegramId: tidStr }, data: { telegramId: null } })
    ]);
    ctx.reply("Hisobingiz botdan uzildi. Endi qaytadan ro'yxatdan o'tishingiz mumkin ( /start bosib).", Markup.keyboard([
        [Markup.button.contactRequest('📱 Telefon raqamni yuborish')]
    ]).resize());
});

bot.on('contact', async (ctx) => {
    const phone = ctx.message.contact.phone_number.replace('+', '').trim();
    const tid = String(ctx.from.id);

    // Try to find as student
    let student = await prisma.student.findFirst({ 
        where: { phone: { contains: phone.slice(-9) } } 
    });
    if (student) {
        await prisma.student.update({ where: { id: student.id }, data: { telegramId: tid } });
        return ctx.reply(`Siz o'quvchi sifatida ro'yxatdan o'tdingiz: ${student.name}`, getStudentMenu());
    }

    // Try to find as teacher
    let teacher = await prisma.teacher.findFirst({ 
        where: { phone: { contains: phone.slice(-9) } } 
    });
    if (teacher) {
        await prisma.teacher.update({ where: { id: teacher.id }, data: { telegramId: tid } });
        return ctx.reply(`Siz o'qituvchi sifatida ro'yxatdan o'tdingiz: ${teacher.name}`, getTeacherMenu());
    }

    // Try to find in users (Admin/Manager/Receptionist)
    let user = await prisma.user.findFirst({ 
        where: { phone: { contains: phone.slice(-9) } } 
    });
    if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { telegramId: tid } });
        return ctx.reply(`Siz xodim sifatida ro'yxatdan o'tdingiz: ${user.name}`, getAdminMenu());
    }

    ctx.reply("Kechirasiz, ushbu raqam tizimda topilmadi. Ma'lumot olish uchun mehmon menyusidan foydalaning.", getGuestMenu());
});

// Student Handlers
bot.hears('📅 Dars Jadvali', async (ctx) => {
    const user = await findUser(ctx.from.id);
    if (!user || user.type !== 'student') return;

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

bot.hears('💳 To\'lovlar', async (ctx) => {
    const user = await findUser(ctx.from.id);
    if (!user || user.type !== 'student') return;

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

bot.hears('✅ Davomat', async (ctx) => {
    const user = await findUser(ctx.from.id);
    if (!user || user.type !== 'student') return;

    const attendances = await prisma.attendance.findMany({
        where: { studentId: user.data.id },
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

bot.hears('📊 Baholar', async (ctx) => {
    const user = await findUser(ctx.from.id);
    if (!user || user.type !== 'student') return;

    const scores = await prisma.score.findMany({
        where: { studentId: user.data.id },
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

bot.hears('✍️ Shikoyat va takliflar', async (ctx) => {
    ctx.reply("Sizning fikringiz biz uchun muhim! ✍️\n\nShikoyat yoki taklifingiz bo'lsa, shu yerga yozib qoldiring. Adminlarimiz uni albatta ko'rib chiqishadi.");
});

bot.hears('👤 Profil', async (ctx) => {
    const user = await findUser(ctx.from.id);
    if (!user) return;

    let msg = `👤 Mening Profilim:\n\n`;
    msg += `🆔 ID: ${user.data.id}\n`;
    msg += `NAME: ${user.data.name}\n`;
    msg += `📞 TEL: ${user.data.phone}\n`;
    msg += `🎭 ROL: ${user.type === 'admin' ? 'Xodim' : (user.type === 'teacher' ? 'O\'qituvchi' : 'O\'quvchi')}\n`;

    ctx.reply(msg);
});

// Teacher Handlers
bot.hears('🎒 Davomat qilish', async (ctx) => {
    const user = await findUser(ctx.from.id);
    if (!user || user.type !== 'teacher') return;

    const groups = await prisma.group.findMany({
        where: { teacherId: user.data.id }
    });

    if (groups.length === 0) return ctx.reply("Sizga biriktirilgan guruhlar topilmadi.");

    let buttons = groups.map(g => [Markup.button.callback(`👥 ${g.name}`, `mark_att_${g.id}`)]);
    ctx.reply("Guruhni tanlang:", Markup.inlineKeyboard(buttons));
});

bot.hears('📅 Mening Jadvalim', async (ctx) => {
    const user = await findUser(ctx.from.id);
    if (!user || user.type !== 'teacher') return;

    const groups = await prisma.group.findMany({
        where: { teacherId: user.data.id },
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

bot.hears('💰 Oylik va Bonuslar', async (ctx) => {
    const user = await findUser(ctx.from.id);
    if (!user || user.type !== 'teacher') return;

    const teacher = user.data;
    let msg = `💰 Ish haqi ma'lumotlari:\n\n`;
    msg += `💳 Oylik turi: ${teacher.salaryType === 'PERCENTAGE' ? 'Foizbay' : 'Belgilangan (Fixed)'}\n`;
    
    if (teacher.salaryType === 'PERCENTAGE') {
        msg += `📈 Ulush: ${teacher.sharePercentage}%\n`;
    } else {
        msg += `💵 Oylik miqdori: ${teacher.salary.toLocaleString()} UZS\n`;
    }
    
    msg += `📖 Dars haqi: ${teacher.lessonFee.toLocaleString()} UZS\n`;
    msg += `\n(Batafsil ma'lumot uchun boshqaruv paneliga murojaat qiling)`;

    ctx.reply(msg);
});

bot.action(/mark_att_(\d+)/, async (ctx) => {
    const groupId = parseInt(ctx.match[1]);
    const tid = ctx.from.id;

    const group = await prisma.group.findUnique({
        where: { id: groupId },
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

bot.action(/toggle_att_(\d+)/, async (ctx) => {
    const studentId = parseInt(ctx.match[1]);
    const tid = ctx.from.id;
    const state = attStates[tid];

    if (!state) return ctx.answerCbQuery("Sessiya eskirgan, qaytadan boshlang.");

    state.records[studentId] = state.records[studentId] === 'Keldi' ? 'Kelmapdi' : 'Keldi';

    const group = await prisma.group.findUnique({
        where: { id: state.groupId },
        include: { students: true }
    });

    await renderAttendanceList(ctx, group.name, group.students, state.records);
    ctx.answerCbQuery();
});

bot.action('save_attendance', async (ctx) => {
    const tid = ctx.from.id;
    const state = attStates[tid];

    if (!state) return ctx.answerCbQuery("Xatolik: Ma'lumot topilmadi.");

    const today = new Date().toISOString().split('T')[0];
    const group = await prisma.group.findUnique({ where: { id: state.groupId } });
    
    try {
        const results = [];
        for (const [studentId, status] of Object.entries(state.records)) {
            const sId = parseInt(studentId);
            
            // Upsert attendance
            const existing = await prisma.attendance.findFirst({
                where: { studentId: sId, groupId: state.groupId, date: today, schoolId: group.schoolId }
            });

            if (existing) {
                await prisma.attendance.update({ where: { id: existing.id }, data: { status } });
            } else {
                await prisma.attendance.create({
                    data: { studentId: sId, groupId: state.groupId, date: today, status, schoolId: group.schoolId }
                });
            }

            // Optional: notify student/parent if telegramId exists
            const student = await prisma.student.findUnique({ where: { id: sId } });
            if (student && student.telegramId) {
                const icon = status === 'Keldi' ? '✅' : '❌';
                bot.telegram.sendMessage(student.telegramId, 
                    `${icon} Davomat xabarnomasi:\n\n` +
                    `👤 O'quvchi: ${student.name}\n` +
                    `📌 Holat: ${status}\n` +
                    `📅 Sana: ${today}\n` +
                    `📚 Guruh: ${group.name}`
                ).catch(e => console.error('Notify student error:', e));
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

// Admin Handlers
bot.hears('📢 Yangi Lidlar', async (ctx) => {
    const user = await findUser(ctx.from.id);
    if (!user || user.type !== 'admin') return;

    const leads = await prisma.lead.findMany({
        where: { schoolId: user.data.schoolId || undefined },
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

bot.hears('📊 Kunlik Hisobot', async (ctx) => {
    const user = await findUser(ctx.from.id);
    if (!user || user.type !== 'admin') return;

    const schoolId = user.data.schoolId;
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

bot.hears('📧 Ommaviy xabar', async (ctx) => {
    const user = await findUser(ctx.from.id);
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
bot.hears('ℹ️ Markaz haqida', (ctx) => {
    ctx.reply("SARIOSIYO O'quv Markazi - sifatli ta'lim maskani! \n\nBizda: \n- Ingliz tili\n- Matematika\n- IT kurslari\n mavjud.");
});

bot.hears('📍 Geolokatsiya', (ctx) => {
    ctx.replyWithLocation(38.4833, 67.9333); // Example coords
});

bot.hears('📞 Kontaktlar', (ctx) => {
    ctx.reply("Telefon: +998 90 123 45 67\nTelegram: @sariosiyo_admin\nManzil: Sariosiyo tumani, Markaziy ko'cha.");
});

bot.hears('📝 Sinov darsiga yozilish', (ctx) => {
    ctx.reply("Iltimos, ismingiz va qaysi kursga qiziqayotganingizni yozib qoldiring. \n\nMasalan: Ali, Ingliz tili");
    ctx.session = { step: 'waiting_for_trial' }; // Note: requires session middleware if used properly, but for now we simplify
});

// Simple message handler for trial registration and general text
bot.on('text', async (ctx, next) => {
    const tid = ctx.from.id;
    const text = ctx.message.text;

    // Handle Broadcast State for Admins
    if (adminStates[tid] === 'AWAITING_BROADCAST') {
        if (text === '❌ Bekor qilish') {
            delete adminStates[tid];
            const user = await findUser(tid);
            return ctx.reply('Bekor qilindi.', getAdminMenu());
        }

        delete adminStates[tid];
        
        // Show "sending" status to admin
        const statusMsg = await ctx.reply("Xabar yuborilmoqda...");

        try {
            const [students, teachers, users] = await Promise.all([
                prisma.student.findMany({ where: { telegramId: { not: null } }, select: { telegramId: true } }),
                prisma.teacher.findMany({ where: { telegramId: { not: null } }, select: { telegramId: true } }),
                prisma.user.findMany({ where: { telegramId: { not: null } }, select: { telegramId: true } })
            ]);

            const allTids = new Set([
                ...students.map(s => s.telegramId),
                ...teachers.map(t => t.telegramId),
                ...users.map(u => u.telegramId)
            ]);

            let successCount = 0;
            for (const targetId of allTids) {
                try {
                    await bot.telegram.sendMessage(targetId, text);
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

    // Skip handling if it's a menu button
    if (text.startsWith('/') || ['📅', '💳', '✅', '📊', '🎒', '💰', '📢', '📧', '⚙️', '📝', 'ℹ️', '📍', '📞', '👤'].some(icon => text.includes(icon))) {
        return next();
    }

    // Basic heuristic for trial registration
    if (text.includes(',') && text.length > 5) {
        const [name, course] = text.split(',').map(s => s.trim());
        const phone = "Bot orqali";

        await prisma.lead.create({
            data: {
                name,
                course,
                phone,
                source: 'Telegram Bot',
                schoolId: 1,
            }
        });

        return ctx.reply("Rahmat! Sizning so'rovingiz qabul dili. Tez orada adminlarimiz bog'lanishadi.");
    }

    next();
});

// Helper for notifications
export const notifyAdmins = async (message, schoolId) => {
    const admins = await prisma.user.findMany({
        where: { 
            role: { in: ['ADMIN', 'MANAGER'] },
            telegramId: { not: null },
            schoolId: schoolId || undefined
        }
    });

    for (const admin of admins) {
        try {
            await bot.telegram.sendMessage(admin.telegramId, message);
        } catch (e) {
            console.error(`Admin ${admin.name} ga xabar yuborib bo'lmadi:`, e);
        }
    }
};

// Export a function to start the bot
export const startBot = () => {
    bot.launch();
    console.log('Telegram Bot started');
    
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
};

export default bot;
