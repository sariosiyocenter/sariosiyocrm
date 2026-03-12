import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Defined' : 'UNDEFINED');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

async function main() {
    try {
        console.log('Connecting to database...');
        await prisma.$connect();
        console.log('Connected successfully!');
        const result = await prisma.$queryRaw`SELECT 1 as result`;
        console.log('Query result:', result);
    } catch (error) {
        console.error('Connection error details:');
        console.error(JSON.stringify(error, null, 2));
        console.error('Stack:', error.stack);
        if (error.message) console.error('Message:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
