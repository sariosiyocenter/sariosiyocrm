-- Xodimni arxivga olish uchun holat maydoni.
-- Davomat (StaffAttendance) yoki oylik (SalaryPayment) yozuvi bor xodimni
-- o'chirib bo'lmaydi, shuning uchun uni arxivlaymiz.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Faol';
