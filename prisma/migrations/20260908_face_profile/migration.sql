-- Face ID yuz belgisi alohida jadvalga. Ilgari u Student.customPrices ichida
-- turardi va /api/init bilan hamma o'quvchi uchun yuborilardi.
CREATE TABLE IF NOT EXISTS "FaceProfile" (
  "id" SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "descriptor" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'kamera',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schoolId" INTEGER NOT NULL,
  CONSTRAINT "FaceProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FaceProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "FaceProfile_studentId_key" ON "FaceProfile"("studentId");
CREATE INDEX IF NOT EXISTS "FaceProfile_schoolId_idx" ON "FaceProfile"("schoolId");
