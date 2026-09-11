-- Payme (Merchant API): sozlamalar, buyurtma, tranzaksiya, jurnal.
-- Kalitlar (paymeKey, paymeTestKey) SETTINGS_KEY bilan shifrlangan holda saqlanadi.
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "paymeMerchantId" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "paymeKey" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "paymeTestKey" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "paymeMode" TEXT NOT NULL DEFAULT 'off';
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "paymeEndpointToken" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "paymeAllowRefund" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "paymeIpCheck" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "paymeMxik" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "paymePackageCode" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "paymeVatPercent" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "Setting_paymeEndpointToken_idx" ON "Setting"("paymeEndpointToken");

-- Buyurtma: o'quvchi + guruh + summa. ID — tasodifiy 16 belgili token (Payme account.order_id).
CREATE TABLE IF NOT EXISTS "PaymeOrder" (
  "id" TEXT PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "groupId" INTEGER,
  "courseId" INTEGER,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "source" TEXT NOT NULL DEFAULT 'crm',
  "createdById" INTEGER,
  "chatId" TEXT,
  "test" BOOLEAN NOT NULL DEFAULT false,
  "paymentId" INTEGER,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" INTEGER NOT NULL,
  CONSTRAINT "PaymeOrder_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaymeOrder_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymeOrder_paymentId_key" ON "PaymeOrder"("paymentId");
CREATE INDEX IF NOT EXISTS "PaymeOrder_schoolId_studentId_idx" ON "PaymeOrder"("schoolId", "studentId");
CREATE INDEX IF NOT EXISTS "PaymeOrder_schoolId_createdAt_idx" ON "PaymeOrder"("schoolId", "createdAt");

-- Payme tranzaksiyasi: 1 yaratildi, 2 o'tkazildi, -1 / -2 bekor.
CREATE TABLE IF NOT EXISTS "PaymeTransaction" (
  "id" SERIAL PRIMARY KEY,
  "paymeId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "state" INTEGER NOT NULL,
  "reason" INTEGER,
  "paymeTime" BIGINT NOT NULL,
  "createTime" BIGINT NOT NULL,
  "performTime" BIGINT NOT NULL DEFAULT 0,
  "cancelTime" BIGINT NOT NULL DEFAULT 0,
  "paymentId" INTEGER,
  "refundPaymentId" INTEGER,
  "fiscalPerform" JSONB,
  "fiscalCancel" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" INTEGER NOT NULL,
  CONSTRAINT "PaymeTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaymeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaymeTransaction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "fiscalPerform" JSONB;
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "fiscalCancel" JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS "PaymeTransaction_paymeId_key" ON "PaymeTransaction"("paymeId");
CREATE INDEX IF NOT EXISTS "PaymeTransaction_orderId_idx" ON "PaymeTransaction"("orderId");
CREATE INDEX IF NOT EXISTS "PaymeTransaction_schoolId_createTime_idx" ON "PaymeTransaction"("schoolId", "createTime");
CREATE INDEX IF NOT EXISTS "PaymeTransaction_schoolId_paymeTime_idx" ON "PaymeTransaction"("schoolId", "paymeTime");

-- Har bir Payme so'rovining izi (Authorization sarlavhasisiz).
CREATE TABLE IF NOT EXISTS "PaymeLog" (
  "id" SERIAL PRIMARY KEY,
  "schoolId" INTEGER,
  "method" TEXT,
  "paymeId" TEXT,
  "orderId" TEXT,
  "ip" TEXT,
  "ok" BOOLEAN NOT NULL,
  "errorCode" INTEGER,
  "request" JSONB,
  "response" JSONB,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PaymeLog_schoolId_createdAt_idx" ON "PaymeLog"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymeLog_paymeId_idx" ON "PaymeLog"("paymeId");
