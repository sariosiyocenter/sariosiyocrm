import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
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
    ['📍 O\'quvchilar lokatsiyasi', '🚍 Mening Transportim'],
    ['👤 Profil', '🚪 Chiqish']
]).resize();

const getGuestMenu = () => Markup.keyboard([
    ['ℹ️ Markaz haqida', '📍 Geolokatsiya'],
    ['📝 Sinov darsiga yozilish', '📞 Kontaktlar']
]).resize();

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

            return ctx.reply(greeting, menu);
        }

        ctx.reply(
            "CRM botiga xush kelibsiz! \n\nTizimdan foydalanish uchun telefon raqamingizni yuboring:",
            Markup.keyboard([
                [Markup.button.contactRequest('📱 Telefon raqamni yuborish')]
            ]).resize()
        );
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

        const transport = await prisma.transport.findFirst({
            where: { driverId: user.data.id, schoolId },
            include: { 
                students: {
                    include: { groups: true }
                }
            }
        });

        if (!transport) return ctx.reply("Sizga hali hech qanday transport biriktirilmagan.");
        if (transport.students.length === 0) return ctx.reply("Sizning transportingizda hali o'quvchilar yo'q.");

        const today = new Date();
        const dayNum = today.getDate();
        const isOdd = dayNum % 2 !== 0;
        const dayType = isOdd ? 'TOQ' : 'JUFT';
        
        const months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
        const dateLabel = `${dayNum}-${months[today.getMonth()]}`;
        
        const todayStudents = transport.students.filter(s => {
            if (!s.groups || s.groups.length === 0) return true;
            return s.groups.some(g => {
                const d = (g.days || '').trim().toUpperCase();
                return d === 'HAR KUNI' || d === dayType;
            });
        });

        if (todayStudents.length === 0) {
            return ctx.reply(
                `🗓 Bugun: ${dateLabel}, ${dayType} kun\n\n` +
                `✅ Bugun ushbu transportda olib boriladigan o'quvchi yo'q.`
            );
        }

        let msg = `🗓 Bugun: ${dateLabel}, ${dayType} kun\n`;
        msg += `🚍 ${transport.name} — ${todayStudents.length} ta o'quvchi:\n\n`;

        todayStudents.forEach((s, idx) => {
            msg += `${idx + 1}. 👤 ${s.name}\n`;
            msg += `   🏫 ${s.studentSchool || 'Maktab noma\'lum'}\n`;
            msg += `   🏠 ${s.address || 'Manzil kiritilmagan'}\n`;
            if (s.location || s.address) {
                const loc = encodeURIComponent((s.location || s.address).trim());
                msg += `   🗺 https://yandex.uz/maps/?text=${loc}\n`;
            }
            msg += `   📞 ${s.phone}\n\n`;
        });

        ctx.reply(msg, { disable_web_page_preview: true });
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
    botInstance.hears('ℹ️ Markaz haqida', (ctx) => {
        ctx.reply("Sifatli ta'lim maskani! \n\nBizda: \n- Ingliz tili\n- Matematika\n- IT kurslari\n mavjud.");
    });

    botInstance.hears('📍 Geolokatsiya', (ctx) => {
        ctx.replyWithLocation(38.4833, 67.9333);
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
