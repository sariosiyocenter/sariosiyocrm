-- Ustozga har bir guruh uchun qanday haq to'lanishi.
--
-- Rahbar aytgan hollar:
--   * faqat oylik oklad          -> guruhda hech narsa belgilanmaydi, payType NULL
--   * tushgan puldan foiz        -> payType NULL (User.kpiPercent ishlaydi) yoki 'Foiz'
--   * har bir guruh uchun belgilangan summa (2 mln, boshqasiga 3 mln) -> 'Belgilangan'
--   * bitta guruh uchun boshqacha foiz -> 'Foiz' + payValue
--
-- payType NULL bo'lsa xodim kartasidagi umumiy KPI foizi qo'llanadi.
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "payType" TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "payValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
