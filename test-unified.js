import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function test() {
    const email = `test_unified_${Date.now()}@teacher.com`;
    const name = 'Test Unified Teacher';
    const role = 'TEACHER';
    const schoolId = 1; // Assuming school 1 exists

    console.log(`Creating user with email: ${email}`);

    try {
        const hashedPassword = await bcrypt.hash('password123', 10);

        // Simulate what happens in server.js app.post('/api/users')
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                phone: '+998901234567',
                role,
                schoolId
            }
        });

        console.log('User created:', user.id);

        // This is the logic we added to server.js
        if (user.role === 'TEACHER') {
            console.log('Role is TEACHER, creating teacher profile...');
            await prisma.teacher.create({
                data: {
                    name: user.name,
                    phone: user.phone || '',
                    salary: 0,
                    sharePercentage: 0,
                    lessonFee: 0,
                    birthDate: '',
                    hiredDate: new Date().toISOString().split('T')[0],
                    status: 'Faol',
                    schoolId
                }
            });
            console.log('Teacher profile created successfully!');
        }

        // Now verify the teacher exists separately
        const teacher = await prisma.teacher.findFirst({
            where: { name: name, schoolId: schoolId }
        });

        if (teacher) {
            console.log('SUCCESS: Teacher record found in database!');
            console.log(teacher);
        } else {
            console.log('FAILURE: Teacher record NOT found in database.');
        }

        // Cleanup
        await prisma.teacher.deleteMany({ where: { name: name } });
        await prisma.user.delete({ where: { id: user.id } });
        console.log('Cleanup complete.');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

test();
