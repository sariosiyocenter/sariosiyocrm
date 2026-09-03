-- O'quv reja: mavzularga modul / soat / material maydonlari.
-- Hammasi NULL bo'lishi mumkin, shuning uchun mavjud yozuvlarga ta'sir qilmaydi.
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "moduleName" TEXT;
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "hours" INTEGER;
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "materials" TEXT;
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "status" TEXT;
