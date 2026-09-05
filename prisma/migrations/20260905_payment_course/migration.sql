-- To'lov qaysi kurs uchun ekanligini belgilash.
-- NULL bo'lishi mumkin: eski to'lovlarda kurs ko'rsatilmagan, umumiy to'lovlarda esa
-- bitta kursga bog'lash shart emas.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "courseId" INTEGER;

CREATE INDEX IF NOT EXISTS "Payment_courseId_idx" ON "Payment"("courseId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_courseId_fkey'
  ) THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
