import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const schools = await prisma.school.findMany();
        const students = await prisma.student.count();
        const groups = await prisma.group.count();
        const teachers = await prisma.teacher.count();
        console.log('--- DATABASE DIAGNOSTIC ---');
        console.log('Schools:', schools.map(s => s.name).join(', ') || 'NONE');
        console.log('Students Total:', students);
        console.log('Groups Total:', groups);
        console.log('Teachers Total:', teachers);
        console.log('---------------------------');
    } catch (e) {
        console.error('Diagnostic failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
