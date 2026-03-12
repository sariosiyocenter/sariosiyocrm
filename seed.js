import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    try {
        // Create default school
        const school = await prisma.school.create({
            data: {
                name: 'SARIOSIYO Filliali',
                address: 'Main St 123'
            }
        });

        // Create default setting for this school
        await prisma.setting.create({
            data: {
                schoolId: school.id,
                orgName: "SARIOSIYO",
                adminPhone: "+9981234567"
            }
        });

        // Create admin user
        await prisma.user.create({
            data: {
                email: 'admin@sariosiyo.uz',
                password: hashedPassword,
                name: 'Admin',
                role: 'ADMIN',
                schoolId: school.id // Associate with the first school
            }
        });

        console.log('Seeded successfully!');
        console.log(`Default School ID: ${school.id}`);
        console.log(`Admin User: admin@sariosiyo.uz / admin123`);
    } catch (err) {
        console.error('Error during seeding:', err);
    }
}

seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
