import { PrismaClient } from '@prisma/client';

// One Prisma client per process, shared by every import site.
//
// server.js and src/bot/bot.js each used to construct their own, which meant two
// connection pools inside the same container. On Vercel every concurrent request can
// spin up its own container, so the pools multiplied until Supabase refused new
// connections — the "Timed out fetching a new connection from the connection pool"
// error recorded in error.log during login.
//
// Caching on globalThis also survives module re-evaluation in dev watch mode.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__sariosiyoPrisma ?? new PrismaClient();

if (!globalForPrisma.__sariosiyoPrisma) {
  globalForPrisma.__sariosiyoPrisma = prisma;
}

export default prisma;
