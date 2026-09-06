-- To'lov/hisob yozuvini guruhga bog'lash.
-- Ilgari oylik hisob faqat kurs nomini izohda saqlardi, shuning uchun qaysi pul
-- qaysi guruhga (demak qaysi ustozga) tegishli ekanini aniqlab bo'lmasdi.
-- Guruhlar orasida ko'chirish va pul qaytarish hisobi shu maydonga tayanadi.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "groupId" INTEGER;

CREATE INDEX IF NOT EXISTS "Payment_groupId_idx" ON "Payment"("groupId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_groupId_fkey') THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "Group"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
