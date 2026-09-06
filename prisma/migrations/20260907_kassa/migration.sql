-- Kassa: xarajat qayerdan to'langani, inkassatsiya va kunni yopish.
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "method" TEXT NOT NULL DEFAULT 'Naqd';

CREATE TABLE IF NOT EXISTS "CashHandover" (
  "id" SERIAL PRIMARY KEY,
  "amount" DOUBLE PRECISION NOT NULL,
  "date" TEXT NOT NULL,
  "toWhom" TEXT NOT NULL,
  "note" TEXT,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schoolId" INTEGER NOT NULL,
  CONSTRAINT "CashHandover_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CashHandover_schoolId_date_idx" ON "CashHandover"("schoolId", "date");

CREATE TABLE IF NOT EXISTS "CashDayClose" (
  "id" SERIAL PRIMARY KEY,
  "date" TEXT NOT NULL,
  "expected" DOUBLE PRECISION NOT NULL,
  "counted" DOUBLE PRECISION NOT NULL,
  "note" TEXT,
  "closedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schoolId" INTEGER NOT NULL,
  CONSTRAINT "CashDayClose_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CashDayClose_schoolId_date_key" ON "CashDayClose"("schoolId", "date");

-- "Plastik" — "Karta"ning eski nomi; ikkita nom bitta narsani anglatardi.
UPDATE "Payment" SET "type" = 'Karta' WHERE "type" = 'Plastik';
